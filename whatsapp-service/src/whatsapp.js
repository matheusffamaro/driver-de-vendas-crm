const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, Browsers, downloadMediaMessage } = require('@whiskeysockets/baileys');
const axios = require('axios');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const logger = require('./logger');

class WhatsAppManager {
  constructor(webhookUrl) {
    this.sessions = new Map();
    this.webhookUrl = webhookUrl;
    this.sessionsDir = path.join(__dirname, '..', 'sessions');
    this.mediaDir = path.join(__dirname, '..', 'media');
    this.messageCache = new Map();
    
    if (!fs.existsSync(this.sessionsDir)) {
      fs.mkdirSync(this.sessionsDir, { recursive: true });
    }
    
    if (!fs.existsSync(this.mediaDir)) {
      fs.mkdirSync(this.mediaDir, { recursive: true });
    }
  }

  /**
   * Download and save media from a message
   * Returns the local filename if successful
   */
  async downloadAndSaveMedia(msg, messageType) {
    try {
      const content = msg.message[messageType];
      if (!content) return null;

      // Determine file extension based on mimetype
      const mimetype = content.mimetype || 'application/octet-stream';
      let extension = 'bin';
      
      if (mimetype.includes('image/jpeg') || mimetype.includes('image/jpg')) extension = 'jpg';
      else if (mimetype.includes('image/png')) extension = 'png';
      else if (mimetype.includes('image/gif')) extension = 'gif';
      else if (mimetype.includes('image/webp')) extension = 'webp';
      else if (mimetype.includes('video/mp4')) extension = 'mp4';
      else if (mimetype.includes('video/')) extension = 'mp4';
      else if (mimetype.includes('audio/ogg')) extension = 'ogg';
      else if (mimetype.includes('audio/mpeg')) extension = 'mp3';
      else if (mimetype.includes('audio/')) extension = 'mp3';
      else if (mimetype.includes('application/pdf')) extension = 'pdf';
      else if (content.fileName) {
        const parts = content.fileName.split('.');
        if (parts.length > 1) extension = parts.pop();
      }

      // Generate unique filename
      const hash = crypto.createHash('md5').update(msg.key.id).digest('hex');
      const filename = `${hash}.${extension}`;
      const filepath = path.join(this.mediaDir, filename);

      // Check if already downloaded
      if (fs.existsSync(filepath)) {
        logger.info(`Media already exists: ${filename}`);
        return { filename, mimetype, originalName: content.fileName || null };
      }

      // Download the media
      logger.info(`Downloading media: ${messageType} -> ${filename}`);
      
      const buffer = await downloadMediaMessage(
        msg,
        'buffer',
        {},
        {
          logger,
          reuploadRequest: async (msg) => {
            // If media needs to be re-uploaded, try to get it
            const session = Array.from(this.sessions.values()).find(s => s.status === 'connected');
            if (session) {
              return session.socket.updateMediaMessage(msg);
            }
            throw new Error('No connected session for media reupload');
          }
        }
      );

      if (buffer) {
        fs.writeFileSync(filepath, buffer);
        logger.info(`Media saved: ${filename} (${buffer.length} bytes)`);
        return { filename, mimetype, originalName: content.fileName || null, size: buffer.length };
      }

      return null;
    } catch (error) {
      logger.error(`Error downloading media: ${error.message}`);
      return null;
    }
  }

  /**
   * Restore all saved sessions on service startup
   */
  async restoreAllSessions() {
    try {
      const sessionDirs = fs.readdirSync(this.sessionsDir);
      
      logger.info(`Found ${sessionDirs.length} saved sessions to restore`);
      
      for (const sessionId of sessionDirs) {
        const sessionPath = path.join(this.sessionsDir, sessionId);
        const stat = fs.statSync(sessionPath);
        
        if (stat.isDirectory()) {
          // Check if there's a creds.json file (valid session)
          const credsFile = path.join(sessionPath, 'creds.json');
          if (fs.existsSync(credsFile)) {
            logger.info(`Restoring session: ${sessionId}`);
            try {
              await this.createSession(sessionId);
              logger.info(`Session ${sessionId} restoration initiated`);
            } catch (error) {
              logger.error(`Failed to restore session ${sessionId}: ${error.message}`);
            }
          }
        }
      }
      
      logger.info('Session restoration complete');
    } catch (error) {
      logger.error(`Error restoring sessions: ${error.message}`);
    }
  }

  async createSession(sessionId, tenantId) {
    try {
      const sessionDir = path.join(this.sessionsDir, sessionId);
      
      if (!fs.existsSync(sessionDir)) {
        fs.mkdirSync(sessionDir, { recursive: true });
      }

      const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
      const { version } = await fetchLatestBaileysVersion();

      const socket = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: true,
        browser: Browsers.ubuntu('Chrome'),
        logger: logger,
        syncFullHistory: false, // Disabled - only receive new messages
        markOnlineOnConnect: false,
        getMessage: async (key) => {
          const cacheKey = `${key.remoteJid}_${key.id}`;
          const cached = this.messageCache.get(cacheKey);
          if (cached) return cached;
          return { conversation: '' };
        },
      });

      const sessionData = {
        socket,
        status: 'connecting',
        qrCode: null,
        phoneNumber: null,
        pushName: null,
        connectedAt: null,
        tenantId,
        contacts: new Map(),
        chats: new Map(),
      };

      this.sessions.set(sessionId, sessionData);

      socket.ev.on('connection.update', async (update) => {
        await this.handleConnectionUpdate(sessionId, update, saveCreds);
      });

      socket.ev.on('creds.update', saveCreds);

      socket.ev.on('messages.upsert', async (m) => {
        await this.handleMessagesUpsert(sessionId, m);
      });

      socket.ev.on('messages.update', async (m) => {
        await this.handleMessagesUpdate(sessionId, m);
      });

      socket.ev.on('contacts.upsert', (contacts) => {
        for (const contact of contacts) {
          sessionData.contacts.set(contact.id, contact);
        }
      });

      socket.ev.on('chats.upsert', (chats) => {
        for (const chat of chats) {
          sessionData.chats.set(chat.id, chat);
        }
      });

      // History sync disabled - only process new messages
      // socket.ev.on('messaging-history.set', async ({ messages, chats, isLatest }) => {
      //   logger.info(`History sync received: ${messages.length} messages, ${chats.length} chats, isLatest: ${isLatest}`);
      //   if (messages.length > 0) {
      //     await this.handleHistorySync(sessionId, messages);
      //   }
      // });

      return {
        sessionId,
        status: 'connecting',
        message: 'Aguardando QR Code...',
      };
    } catch (error) {
      logger.error(`Error creating session ${sessionId}: ${error.message}`);
      throw error;
    }
  }

  async handleConnectionUpdate(sessionId, update, saveCreds) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      try {
        const qrCodeDataUrl = await QRCode.toDataURL(qr, { width: 300, margin: 2 });
        session.qrCode = qrCodeDataUrl;
        session.status = 'qr_code';
        await this.sendWebhook(sessionId, 'qr_code', { qr: qrCodeDataUrl });
      } catch (error) {
        logger.error('Error generating QR code:', error);
      }
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      if (statusCode === DisconnectReason.loggedOut) {
        session.status = 'disconnected';
        await this.sendWebhook(sessionId, 'logged_out', {});
        const sessionDir = path.join(this.sessionsDir, sessionId);
        if (fs.existsSync(sessionDir)) {
          fs.rmSync(sessionDir, { recursive: true });
        }
        this.sessions.delete(sessionId);
      } else if (shouldReconnect) {
        session.status = 'reconnecting';
        await this.sendWebhook(sessionId, 'reconnecting', {});
        setTimeout(async () => {
          try {
            await this.createSession(sessionId, session.tenantId);
          } catch (error) {
            logger.error(`Error reconnecting session ${sessionId}:`, error);
          }
        }, 3000);
      }
    } else if (connection === 'open') {
      const user = session.socket.user;
      session.status = 'connected';
      session.qrCode = null;
      session.phoneNumber = user?.id?.split(':')[0] || user?.id?.split('@')[0];
      session.pushName = user?.name;
      session.connectedAt = new Date().toISOString();

      await this.sendWebhook(sessionId, 'connected', {
        phoneNumber: session.phoneNumber,
        pushName: session.pushName,
      });
    }
  }

  async handleMessagesUpsert(sessionId, { messages, type }) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Handle both notify (new messages) and history (historical messages)
    const isHistory = type === 'history' || type === 'append';
    
    logger.info(`Processing ${messages.length} messages for session ${sessionId}, type: ${type}`);

    for (const msg of messages) {
      if (!msg.message || msg.key.remoteJid === 'status@broadcast') continue;
      const messageData = this.extractMessageData(msg);
      
      // Skip system/internal messages
      if (!messageData) continue;
      
      // Mark as historical message
      messageData.isHistory = isHistory;
      
      // Download media for image/video/audio/document messages
      const mediaTypes = ['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage', 'stickerMessage'];
      const messageType = Object.keys(msg.message)[0];
      
      if (mediaTypes.includes(messageType)) {
        try {
          const mediaInfo = await this.downloadAndSaveMedia(msg, messageType);
          if (mediaInfo) {
            messageData.mediaUrl = `/media/${mediaInfo.filename}`;
            messageData.mediaMimetype = mediaInfo.mimetype;
            messageData.mediaFilename = mediaInfo.originalName;
            messageData.mediaSize = mediaInfo.size;
            logger.info(`Media downloaded for message ${msg.key.id}: ${mediaInfo.filename}`);
          }
        } catch (mediaError) {
          logger.error(`Failed to download media for message ${msg.key.id}: ${mediaError.message}`);
        }
      }
      
      // For groups, get the actual group name
      if (messageData.isGroup && !isHistory) {
        const groupName = await this.getGroupName(sessionId, msg.key.remoteJid);
        if (groupName) {
          messageData.groupName = groupName;
        }
      }
      
      // Fetch profile picture for the conversation (group or contact)
      if (!isHistory) {
        const profilePicture = await this.getProfilePicture(sessionId, msg.key.remoteJid);
        if (profilePicture) {
          messageData.profilePicture = profilePicture;
        }
      }
      
      await this.sendWebhook(sessionId, 'message', messageData);
    }
  }

  /**
   * Handle history sync - processes messages received while offline
   */
  async handleHistorySync(sessionId, messages) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    logger.info(`Processing ${messages.length} historical messages for session ${sessionId}`);
    
    let processedCount = 0;
    let errorCount = 0;

    for (const msg of messages) {
      try {
        if (!msg.message || msg.key.remoteJid === 'status@broadcast') continue;
        
        const messageData = this.extractMessageData(msg);
        if (!messageData) continue;
        
        // Mark as historical message
        messageData.isHistory = true;
        
        // Download media for image/video/audio/document messages
        const mediaTypes = ['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage', 'stickerMessage'];
        const messageType = Object.keys(msg.message)[0];
        
        if (mediaTypes.includes(messageType)) {
          try {
            const mediaInfo = await this.downloadAndSaveMedia(msg, messageType);
            if (mediaInfo) {
              messageData.mediaUrl = `/media/${mediaInfo.filename}`;
              messageData.mediaMimetype = mediaInfo.mimetype;
              messageData.mediaFilename = mediaInfo.originalName;
              messageData.mediaSize = mediaInfo.size;
            }
          } catch (mediaError) {
            logger.debug(`Failed to download media for historical message ${msg.key.id}: ${mediaError.message}`);
          }
        }
        
        await this.sendWebhook(sessionId, 'message', messageData);
        processedCount++;
      } catch (error) {
        errorCount++;
        logger.debug(`Error processing historical message: ${error.message}`);
      }
    }

    logger.info(`History sync complete: ${processedCount} processed, ${errorCount} errors`);
  }

  async getGroupName(sessionId, groupJid) {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'connected') return null;

    try {
      // Check cache first
      const cacheKey = `group_${groupJid}`;
      if (this.groupNameCache && this.groupNameCache.has(cacheKey)) {
        const cached = this.groupNameCache.get(cacheKey);
        // Cache for 1 hour
        if (Date.now() - cached.timestamp < 3600000) {
          return cached.name;
        }
      }

      // Fetch group metadata from WhatsApp
      const metadata = await session.socket.groupMetadata(groupJid);
      const groupName = metadata?.subject || null;
      
      // Cache the result
      if (!this.groupNameCache) {
        this.groupNameCache = new Map();
      }
      this.groupNameCache.set(cacheKey, { name: groupName, timestamp: Date.now() });
      
      logger.info(`Fetched group name for ${groupJid}: ${groupName}`);
      return groupName;
    } catch (error) {
      logger.error(`Could not fetch group name for ${groupJid}: ${error.message}`);
      return null;
    }
  }

  async getProfilePicture(sessionId, jid) {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'connected') return null;

    try {
      // Check cache first
      const cacheKey = `profile_${jid}`;
      if (this.profilePictureCache && this.profilePictureCache.has(cacheKey)) {
        const cached = this.profilePictureCache.get(cacheKey);
        // Cache for 1 hour
        if (Date.now() - cached.timestamp < 3600000) {
          return cached.url;
        }
      }

      // Fetch from WhatsApp
      const url = await session.socket.profilePictureUrl(jid, 'image');
      
      // Cache the result
      if (!this.profilePictureCache) {
        this.profilePictureCache = new Map();
      }
      this.profilePictureCache.set(cacheKey, { url, timestamp: Date.now() });
      
      return url;
    } catch (error) {
      // User might not have a profile picture or privacy settings block it
      logger.debug(`Could not fetch profile picture for ${jid}: ${error.message}`);
      return null;
    }
  }

  async handleMessagesUpdate(sessionId, updates) {
    for (const update of updates) {
      if (update.update.status) {
        const statusMap = { 0: 'error', 1: 'pending', 2: 'sent', 3: 'delivered', 4: 'read' };
        await this.sendWebhook(sessionId, 'message_status', {
          messageId: update.key.id,
          remoteJid: update.key.remoteJid,
          status: statusMap[update.update.status] || 'unknown',
        });
      }
    }
  }

  extractMessageData(msg) {
    const messageType = Object.keys(msg.message)[0];
    const content = msg.message[messageType];
    
    // Skip system/internal messages
    const systemMessageTypes = [
      'messageContextInfo',
      'senderKeyDistributionMessage', 
      'protocolMessage',
      'reactionMessage',
      'ephemeralMessage',
      'viewOnceMessage',
      'deviceSentMessage',
      'encReactionMessage',
    ];
    
    if (systemMessageTypes.includes(messageType)) {
      return null; // Will be filtered out
    }
    
    let type = 'text';
    let text = null;

    switch (messageType) {
      case 'conversation':
        text = content;
        break;
      case 'extendedTextMessage':
        text = content.text;
        break;
      case 'imageMessage':
        type = 'image';
        text = content.caption || '📷 Imagem';
        break;
      case 'videoMessage':
        type = 'video';
        text = content.caption || '🎬 Vídeo';
        break;
      case 'audioMessage':
        type = content.ptt ? 'ptt' : 'audio';
        text = '🎤 Mensagem de voz';
        break;
      case 'documentMessage':
        type = 'document';
        text = content.fileName || '📄 Documento';
        break;
      case 'stickerMessage':
        type = 'sticker';
        text = '🎨 Figurinha';
        break;
      case 'locationMessage':
        type = 'location';
        text = content.name || content.address || '📍 Localização';
        break;
      case 'contactMessage':
        type = 'contact';
        text = content.displayName || '👤 Contato';
        break;
      case 'contactsArrayMessage':
        type = 'contacts';
        text = '👥 Contatos';
        break;
      default:
        // For unknown types, don't show the raw type name
        type = 'unknown';
        text = null;
    }

    // Check if it's a group message
    const isGroup = msg.key.remoteJid?.endsWith('@g.us');
    
    // For groups, participant is the actual sender
    const participant = msg.key.participant || null;
    
    // Extract phone number from participant or remoteJid
    let senderPhone = null;
    if (isGroup && participant) {
      senderPhone = participant.replace('@s.whatsapp.net', '').replace('@c.us', '');
    } else if (!msg.key.fromMe) {
      senderPhone = msg.key.remoteJid?.replace('@s.whatsapp.net', '').replace('@c.us', '').replace('@g.us', '');
    }

    return {
      messageId: msg.key.id,
      from: msg.key.remoteJid,
      fromMe: msg.key.fromMe,
      pushName: msg.pushName,
      timestamp: msg.messageTimestamp,
      type,
      text,
      // Group-specific fields
      isGroup,
      participant,
      senderPhone,
      senderName: msg.pushName || null,
    };
  }

  async sendWebhook(sessionId, event, data) {
    const session = this.sessions.get(sessionId);
    
    try {
      const payload = {
        sessionId,
        tenantId: session?.tenantId,
        event,
        ...data,
        timestamp: new Date().toISOString(),
      };
      
      if (event === 'qr_code' && data.qr) {
        payload.qrCode = data.qr;
      }
      
      await axios.post(this.webhookUrl, payload, { timeout: 10000 });
    } catch (error) {
      logger.error(`Webhook error for ${sessionId}: ${error.message}`);
    }
  }

  getSession(sessionId) {
    return this.sessions.get(sessionId);
  }

  getAllSessions() {
    const sessions = [];
    for (const [id, session] of this.sessions) {
      sessions.push({
        id,
        status: session.status,
        phoneNumber: session.phoneNumber,
        pushName: session.pushName,
        connectedAt: session.connectedAt,
      });
    }
    return sessions;
  }

  getActiveSessions() {
    return Array.from(this.sessions.keys());
  }

  async disconnectSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');
    try {
      await session.socket.logout();
    } catch (error) {
      logger.error(`Error logging out session ${sessionId}:`, error);
    }
    session.status = 'disconnected';
    await this.sendWebhook(sessionId, 'disconnected', {});
  }

  async deleteSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      try {
        await session.socket.end();
      } catch (error) {}
    }
    const sessionDir = path.join(this.sessionsDir, sessionId);
    if (fs.existsSync(sessionDir)) {
      fs.rmSync(sessionDir, { recursive: true });
    }
    this.sessions.delete(sessionId);
  }

  async sendTextMessage(sessionId, to, text) {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'connected') {
      throw new Error('Session not connected');
    }
    const jid = this.formatJid(to);
    const result = await session.socket.sendMessage(jid, { text });
    return { messageId: result.key.id, to: jid, status: 'sent' };
  }

  async sendMediaMessage(sessionId, to, type, mediaData, caption, filename, mimetype) {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'connected') {
      throw new Error('Session not connected');
    }
    const jid = this.formatJid(to);

    let messageContent = {};

    // mediaData can be a URL or base64
    let media;
    if (mediaData.startsWith('http://') || mediaData.startsWith('https://')) {
      // It's a URL - fetch the content
      const response = await axios.get(mediaData, { responseType: 'arraybuffer' });
      media = Buffer.from(response.data);
    } else if (mediaData.startsWith('data:')) {
      // It's base64 data URL
      const base64Data = mediaData.split(',')[1];
      media = Buffer.from(base64Data, 'base64');
    } else {
      // Assume it's raw base64
      media = Buffer.from(mediaData, 'base64');
    }

    switch (type) {
      case 'image':
        messageContent = {
          image: media,
          caption: caption || undefined,
          mimetype: mimetype || 'image/jpeg',
        };
        break;
      case 'video':
        messageContent = {
          video: media,
          caption: caption || undefined,
          mimetype: mimetype || 'video/mp4',
        };
        break;
      case 'audio':
      case 'ptt':
        // WhatsApp voice messages - send with actual mimetype
        // Baileys will handle the audio appropriately
        messageContent = {
          audio: media,
          mimetype: mimetype || 'audio/mp4',
          ptt: true, // Send as voice note (PTT)
          seconds: 60, // Optional: duration hint
        };
        break;
      case 'document':
        messageContent = {
          document: media,
          mimetype: mimetype || 'application/octet-stream',
          fileName: filename || 'document',
        };
        break;
      default:
        throw new Error(`Unsupported media type: ${type}`);
    }

    const result = await session.socket.sendMessage(jid, messageContent);
    return { messageId: result.key.id, to: jid, status: 'sent', type };
  }

  async fetchChatHistory(sessionId, jid, count = 50) {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'connected') {
      throw new Error('Session not connected');
    }

    try {
      const formattedJid = this.formatJid(jid);
      logger.info(`Fetching ${count} messages from ${formattedJid}`);

      // Use the store if available, otherwise fetch from server
      const messages = await session.socket.fetchMessagesFromWA(formattedJid, count);
      
      const extractedMessages = [];
      for (const msg of messages) {
        if (msg.message) {
          extractedMessages.push(this.extractMessageData(msg));
        }
      }

      logger.info(`Fetched ${extractedMessages.length} messages from ${formattedJid}`);
      return extractedMessages;
    } catch (error) {
      logger.error(`Error fetching chat history for ${jid}: ${error.message}`);
      // Try alternative method
      try {
        const formattedJid = this.formatJid(jid);
        const messages = await session.socket.chatModify({
          count: count,
          archive: false,
          lastMessages: []
        }, formattedJid);
        return messages || [];
      } catch (innerError) {
        logger.error(`Alternative method also failed: ${innerError.message}`);
        return [];
      }
    }
  }

  async syncAllChats(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'connected') {
      throw new Error('Session not connected');
    }

    try {
      logger.info(`Starting full chat sync for session ${sessionId}`);
      // Request history sync
      await session.socket.sendPresenceUpdate('available');
      return { success: true, message: 'Sync initiated' };
    } catch (error) {
      logger.error(`Error syncing chats: ${error.message}`);
      throw error;
    }
  }

  async getContactInfo(sessionId, phoneNumber) {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'connected') {
      throw new Error('Session not connected');
    }

    try {
      const jid = this.formatJid(phoneNumber);
      
      // First, check if we have the contact in our local cache
      const cachedContact = session.contacts.get(jid);
      if (cachedContact) {
        return {
          jid,
          pushName: cachedContact.notify || cachedContact.name || null,
          name: cachedContact.name || null,
          verifiedName: cachedContact.verifiedName || null,
        };
      }

      // Try to get status (which includes push name sometimes)
      try {
        const status = await session.socket.fetchStatus(jid);
        if (status) {
          return {
            jid,
            pushName: status.setAt ? null : null, // status doesn't give pushName directly
            status: status.status,
          };
        }
      } catch (e) {
        // Status might not be available for all contacts
      }

      // Check if contact is on WhatsApp
      const [result] = await session.socket.onWhatsApp(phoneNumber);
      if (result && result.exists) {
        return {
          jid: result.jid,
          exists: true,
          pushName: null, // onWhatsApp doesn't return pushName
        };
      }

      return { jid, exists: false, pushName: null };
    } catch (error) {
      logger.error(`Error getting contact info: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get contact info by exact jid (supports @lid, @s.whatsapp.net, etc).
   * Used to resolve real display name when we only have remote_jid.
   */
  async getContactInfoByJid(sessionId, jid) {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'connected') {
      throw new Error('Session not connected');
    }
    if (!jid || typeof jid !== 'string') {
      return { jid: jid || null, pushName: null, name: null };
    }
    const normalizedJid = jid.trim();
    try {
      const cachedContact = session.contacts.get(normalizedJid);
      if (cachedContact) {
        const pushName = cachedContact.notify || cachedContact.name || null;
        const name = cachedContact.name || cachedContact.verifiedName || null;
        return {
          jid: normalizedJid,
          pushName: pushName || name,
          name: name || pushName,
          verifiedName: cachedContact.verifiedName || null,
        };
      }
      return { jid: normalizedJid, pushName: null, name: null };
    } catch (error) {
      logger.error(`Error getting contact info by jid: ${error.message}`);
      return { jid: normalizedJid, pushName: null, name: null };
    }
  }

  formatJid(phoneNumber) {
    const cleaned = phoneNumber.replace(/\D/g, '');
    if (phoneNumber.includes('@g.us')) return phoneNumber;
    return `${cleaned}@s.whatsapp.net`;
  }

  async shutdown() {
    for (const [sessionId, session] of this.sessions) {
      try {
        await session.socket.end();
      } catch (error) {}
    }
    this.sessions.clear();
  }

  // ==========================================
  // MULTI-NUMBER SYSTEM (NEW)
  // ==========================================

  /**
   * Create a session for a WhatsApp number (new system)
   * Uses numberId instead of sessionId
   */
  async createNumberSession(numberId, phoneNumber, tenantId) {
    try {
      logger.info(`Creating number session for ${phoneNumber} (ID: ${numberId})`);
      
      // Use numberId as sessionId internally
      const result = await this.createSession(`number-${numberId}`, tenantId);
      
      // Store additional metadata
      const session = this.sessions.get(`number-${numberId}`);
      if (session) {
        session.numberId = numberId;
        session.phoneNumber = phoneNumber;
      }
      
      return result;
    } catch (error) {
      logger.error(`Error creating number session ${numberId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get session by number ID
   */
  getNumberSession(numberId) {
    return this.sessions.get(`number-${numberId}`);
  }

  /**
   * Get QR code for a number
   */
  getNumberQRCode(numberId) {
    const session = this.getNumberSession(numberId);
    if (!session) return null;
    
    return {
      status: session.status,
      qrCode: session.qrCode,
      phoneNumber: session.phoneNumber,
      connectedAt: session.connectedAt,
    };
  }

  /**
   * Send message using a specific number
   */
  async sendMessageFromNumber(numberId, to, text) {
    return await this.sendTextMessage(`number-${numberId}`, to, text);
  }

  /**
   * Disconnect a number session
   */
  async disconnectNumber(numberId) {
    return await this.disconnectSession(`number-${numberId}`);
  }

  /**
   * Delete a number session
   */
  async deleteNumber(numberId) {
    return await this.deleteSession(`number-${numberId}`);
  }

  /**
   * Get all active numbers
   */
  getAllNumbers() {
    const numbers = [];
    for (const [id, session] of this.sessions) {
      if (id.startsWith('number-')) {
        numbers.push({
          numberId: session.numberId || id.replace('number-', ''),
          status: session.status,
          phoneNumber: session.phoneNumber,
          pushName: session.pushName,
          connectedAt: session.connectedAt,
        });
      }
    }
    return numbers;
  }
}

module.exports = WhatsAppManager;
