const express = require('express');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const WhatsAppManager = require('./whatsapp');
const logger = require('./logger');

const app = express();
const PORT = process.env.PORT || 3001;
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'http://api:8000/api/whatsapp/webhook';

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Serve media files statically
const mediaDir = path.join(__dirname, '..', 'media');
app.use('/media', express.static(mediaDir, {
  maxAge: '7d', // Cache for 7 days
  setHeaders: (res, path) => {
    // Set proper content type headers
    if (path.endsWith('.jpg') || path.endsWith('.jpeg')) {
      res.setHeader('Content-Type', 'image/jpeg');
    } else if (path.endsWith('.png')) {
      res.setHeader('Content-Type', 'image/png');
    } else if (path.endsWith('.gif')) {
      res.setHeader('Content-Type', 'image/gif');
    } else if (path.endsWith('.webp')) {
      res.setHeader('Content-Type', 'image/webp');
    } else if (path.endsWith('.mp4')) {
      res.setHeader('Content-Type', 'video/mp4');
    } else if (path.endsWith('.ogg')) {
      res.setHeader('Content-Type', 'audio/ogg');
    } else if (path.endsWith('.mp3')) {
      res.setHeader('Content-Type', 'audio/mpeg');
    }
  }
}));

// WhatsApp Manager Instance
const whatsappManager = new WhatsAppManager(WEBHOOK_URL);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', sessions: whatsappManager.getActiveSessions() });
});

// ==========================================
// SESSION MANAGEMENT
// ==========================================

// Create new session
app.post('/sessions', async (req, res) => {
  try {
    const { sessionId, tenantId } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({ success: false, message: 'sessionId is required' });
    }

    // If session already exists, check its status
    const existing = whatsappManager.getSession(sessionId);
    if (existing) {
      // If already connected, return success
      if (existing.status === 'connected') {
        return res.json({
          success: true,
          data: {
            sessionId,
            status: 'connected',
            message: 'Sessão já está conectada.',
          },
        });
      }
      
      // If has QR code, return it
      if (existing.qrCode) {
        return res.json({
          success: true,
          data: {
            sessionId,
            status: existing.status,
            qrCode: existing.qrCode,
            message: 'Sessão em andamento. Use o QR Code.',
          },
        });
      }
      
      // If connecting/reconnecting, wait for QR
      if (existing.status === 'connecting' || existing.status === 'reconnecting' || existing.status === 'qr_code') {
        return res.json({
          success: true,
          data: {
            sessionId,
            status: existing.status,
            message: 'Sessão em andamento. Aguardando QR Code...',
          },
        });
      }
      
      // Otherwise, delete the old session and create new
      logger.info(`Deleting old session ${sessionId} to recreate`);
      await whatsappManager.deleteSession(sessionId);
    }

    logger.info(`Creating session: ${sessionId}`);
    const result = await whatsappManager.createSession(sessionId, tenantId);
    
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error(`Error creating session: ${error.message}`);
    logger.error(`Stack: ${error.stack}`);
    res.status(500).json({ success: false, message: error.message || 'Unknown error' });
  }
});

// Get session status
app.get('/sessions/:sessionId/status', (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = whatsappManager.getSession(sessionId);
    
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    res.json({
      success: true,
      data: {
        status: session.status,
        qrCode: session.qrCode,
        phoneNumber: session.phoneNumber,
        pushName: session.pushName,
        connectedAt: session.connectedAt,
      },
    });
  } catch (error) {
    logger.error('Error getting session status:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get QR Code
app.get('/sessions/:sessionId/qr-code', (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = whatsappManager.getSession(sessionId);
    
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    if (session.status === 'connected') {
      return res.json({
        success: true,
        data: {
          status: 'connected',
          message: 'Session already connected',
        },
      });
    }

    res.json({
      success: true,
      data: {
        status: session.status,
        qrCode: session.qrCode,
      },
    });
  } catch (error) {
    logger.error('Error getting QR code:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Disconnect session
app.post('/sessions/:sessionId/disconnect', async (req, res) => {
  try {
    const { sessionId } = req.params;
    await whatsappManager.disconnectSession(sessionId);
    
    res.json({
      success: true,
      message: 'Session disconnected',
    });
  } catch (error) {
    logger.error('Error disconnecting session:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete session
app.delete('/sessions/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    await whatsappManager.deleteSession(sessionId);
    
    res.json({
      success: true,
      message: 'Session deleted',
    });
  } catch (error) {
    logger.error('Error deleting session:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// List all sessions
app.get('/sessions', (req, res) => {
  try {
    const sessions = whatsappManager.getAllSessions();
    res.json({
      success: true,
      data: sessions,
    });
  } catch (error) {
    logger.error('Error listing sessions:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// PROFILE PICTURES
// ==========================================

// Get profile picture for a contact
app.get('/sessions/:sessionId/profile-picture/:jid', async (req, res) => {
  try {
    const { sessionId, jid } = req.params;
    const profilePicture = await whatsappManager.getProfilePicture(sessionId, jid);
    
    res.json({
      success: true,
      data: {
        jid,
        profilePicture,
      },
    });
  } catch (error) {
    logger.error('Error getting profile picture:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Bulk fetch profile pictures for multiple JIDs
app.post('/sessions/:sessionId/profile-pictures', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { jids } = req.body;
    
    if (!jids || !Array.isArray(jids)) {
      return res.status(400).json({ success: false, message: 'jids array is required' });
    }

    const results = {};
    for (const jid of jids) {
      const profilePicture = await whatsappManager.getProfilePicture(sessionId, jid);
      if (profilePicture) {
        results[jid] = profilePicture;
      }
    }
    
    res.json({
      success: true,
      data: results,
    });
  } catch (error) {
    logger.error('Error getting profile pictures:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get group metadata (name, participants, etc)
app.get('/sessions/:sessionId/groups/:groupJid', async (req, res) => {
  try {
    const { sessionId, groupJid } = req.params;
    const groupName = await whatsappManager.getGroupName(sessionId, groupJid);
    
    res.json({
      success: true,
      data: {
        jid: groupJid,
        name: groupName,
      },
    });
  } catch (error) {
    logger.error('Error getting group metadata:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Bulk fetch group names for multiple JIDs
app.post('/sessions/:sessionId/groups', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { jids } = req.body;
    
    if (!jids || !Array.isArray(jids)) {
      return res.status(400).json({ success: false, message: 'jids array is required' });
    }

    const results = {};
    for (const jid of jids) {
      if (jid.endsWith('@g.us')) {
        const groupName = await whatsappManager.getGroupName(sessionId, jid);
        if (groupName) {
          results[jid] = groupName;
        }
      }
    }
    
    res.json({
      success: true,
      data: results,
    });
  } catch (error) {
    logger.error('Error getting group names:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// CONTACTS
// ==========================================

// Get contact info (pushName, etc) by phone number
app.get('/sessions/:sessionId/contacts/:phoneNumber', async (req, res) => {
  try {
    const { sessionId, phoneNumber } = req.params;
    const contactInfo = await whatsappManager.getContactInfo(sessionId, phoneNumber);
    
    res.json({
      success: true,
      data: contactInfo,
    });
  } catch (error) {
    logger.error('Error getting contact info:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get contact info by jid (supports @lid, @s.whatsapp.net) – for resolving real display name
app.post('/sessions/:sessionId/contact-info', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { jid } = req.body || {};
    if (!jid) {
      return res.status(400).json({ success: false, message: 'jid is required' });
    }
    const contactInfo = await whatsappManager.getContactInfoByJid(sessionId, jid);
    res.json({
      success: true,
      data: contactInfo,
    });
  } catch (error) {
    logger.error('Error getting contact info by jid:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// MESSAGING
// ==========================================

// Send text message
app.post('/messages/send/text', async (req, res) => {
  try {
    const { sessionId, to, text } = req.body;
    
    if (!sessionId || !to || !text) {
      return res.status(400).json({ 
        success: false, 
        message: 'sessionId, to, and text are required' 
      });
    }

    const result = await whatsappManager.sendTextMessage(sessionId, to, text);
    
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('Error sending text message:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Send media message
app.post('/messages/send/media', async (req, res) => {
  try {
    const { sessionId, to, type, media, caption, filename, mimetype } = req.body;
    
    if (!sessionId || !to || !type || !media) {
      return res.status(400).json({ 
        success: false, 
        message: 'sessionId, to, type, and media are required' 
      });
    }

    const result = await whatsappManager.sendMediaMessage(sessionId, to, type, media, caption, filename, mimetype);
    
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error(`Error sending media message: ${error.message}`);
    logger.error(`Stack: ${error.stack}`);
    res.status(500).json({ success: false, message: error.message || 'Unknown error' });
  }
});

// ==========================================
// SYNC / HISTORY
// ==========================================

// Fetch chat history for a specific conversation
app.post('/sessions/:sessionId/fetch-history', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { jid, count = 50 } = req.body;

    if (!jid) {
      return res.status(400).json({ 
        success: false, 
        message: 'jid is required' 
      });
    }

    const messages = await whatsappManager.fetchChatHistory(sessionId, jid, count);
    
    res.json({
      success: true,
      data: messages,
    });
  } catch (error) {
    logger.error(`Error fetching chat history: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Trigger full sync for a session
app.post('/sessions/:sessionId/sync', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const result = await whatsappManager.syncAllChats(sessionId);
    
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error(`Error syncing session: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Start server
app.listen(PORT, '0.0.0.0', async () => {
  logger.info(`WhatsApp Service running on port ${PORT}`);
  logger.info(`Webhook URL: ${WEBHOOK_URL}`);
  
  // Restore saved sessions on startup (after a short delay to ensure everything is ready)
  setTimeout(async () => {
    logger.info('Starting session restoration...');
    await whatsappManager.restoreAllSessions();
  }, 3000);
});

// ==========================================
// MULTI-NUMBER SYSTEM (NEW)
// ==========================================

// Create new WhatsApp number session
app.post('/numbers', async (req, res) => {
  try {
    const { numberId, phoneNumber } = req.body;
    
    if (!numberId || !phoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'numberId and phoneNumber are required',
      });
    }

    // Check if number session already exists
    const existing = whatsappManager.getNumberSession(numberId);
    if (existing) {
      if (existing.status === 'connected') {
        return res.json({
          success: true,
          data: {
            numberId,
            status: 'connected',
            message: 'Número já está conectado',
          },
        });
      }
      
      if (existing.qrCode) {
        return res.json({
          success: true,
          data: {
            numberId,
            status: existing.status,
            qr_code: existing.qrCode,
          },
        });
      }
    }

    // Create new number session
    const result = await whatsappManager.createNumberSession(numberId, phoneNumber);
    
    res.json({
      success: true,
      data: {
        numberId,
        status: result.status,
        message: result.message,
      },
    });
  } catch (error) {
    logger.error('Error creating number session:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Get QR Code for number
app.get('/numbers/:numberId/qr-code', (req, res) => {
  try {
    const { numberId } = req.params;
    const qrData = whatsappManager.getNumberQRCode(numberId);
    
    if (!qrData) {
      return res.status(404).json({
        success: false,
        message: 'Número não encontrado ou ainda não gerou QR Code',
      });
    }
    
    if (qrData.status === 'connected') {
      return res.json({
        success: true,
        data: {
          status: 'connected',
          message: 'Número já está conectado',
        },
      });
    }
    
    if (qrData.qrCode) {
      return res.json({
        success: true,
        data: {
          status: qrData.status,
          qr_code: qrData.qrCode,
        },
      });
    }
    
    res.json({
      success: false,
      message: 'QR Code ainda não está disponível. Aguarde...',
    });
  } catch (error) {
    logger.error('Error getting QR code:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Get number status
app.get('/numbers/:numberId/status', (req, res) => {
  try {
    const { numberId } = req.params;
    const session = whatsappManager.getNumberSession(numberId);
    
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Número não encontrado',
      });
    }
    
    res.json({
      success: true,
      data: {
        numberId,
        status: session.status,
        phoneNumber: session.phoneNumber,
        pushName: session.pushName,
        connectedAt: session.connectedAt,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Disconnect number
app.post('/numbers/:numberId/disconnect', async (req, res) => {
  try {
    const { numberId } = req.params;
    await whatsappManager.disconnectNumber(numberId);
    
    res.json({
      success: true,
      message: 'Número desconectado',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Delete number session
app.delete('/numbers/:numberId', async (req, res) => {
  try {
    const { numberId } = req.params;
    await whatsappManager.deleteNumber(numberId);
    
    res.json({
      success: true,
      message: 'Sessão do número removida',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Send message from specific number
app.post('/numbers/:numberId/send', async (req, res) => {
  try {
    const { numberId } = req.params;
    const { to, text, type, mediaData, caption, filename, mimetype } = req.body;
    
    if (!to) {
      return res.status(400).json({
        success: false,
        message: 'to is required',
      });
    }
    
    let result;
    if (type && type !== 'text') {
      result = await whatsappManager.sendMediaMessage(
        `number-${numberId}`,
        to,
        type,
        mediaData,
        caption,
        filename,
        mimetype
      );
    } else {
      result = await whatsappManager.sendMessageFromNumber(numberId, to, text);
    }
    
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('Error sending message:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// List all numbers
app.get('/numbers', (req, res) => {
  try {
    const numbers = whatsappManager.getAllNumbers();
    res.json({
      success: true,
      data: numbers,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down...');
  await whatsappManager.shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Shutting down...');
  await whatsappManager.shutdown();
  process.exit(0);
});
