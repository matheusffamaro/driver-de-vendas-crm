'use client'

import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Plus, 
  Search, 
  Settings, 
  Phone,
  Send,
  Paperclip,
  Smile,
  Mic,
  MoreVertical,
  Pin,
  Archive,
  User,
  X,
  ArrowLeft,
  QrCode,
  Check,
  CheckCheck,
  Clock,
  Image,
  FileText,
  MessageSquare,
  RefreshCw,
  LayoutGrid
} from 'lucide-react'
import { whatsappApi, clientsApi, pipelineApi, usersApi } from '@/lib/api'
import { toast } from '@/hooks/use-toast'
import { usePermissionStore } from '@/stores/permission-store'
import { useAuthStore } from '@/stores/auth-store'
import { format, parseISO, isToday, isYesterday } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import Link from 'next/link'

interface Session {
  id: string
  phone_number: string
  session_name: string
  status: 'disconnected' | 'connecting' | 'connected' | 'qr_code'
  conversations_count: number
  connected_at: string | null
  user_id?: string | null
}

interface Conversation {
  id: string
  contact_name: string | null
  contact_phone: string
  profile_picture: string | null
  is_group: boolean
  group_name: string | null
  assigned_user: { id: string; name: string; signature?: string | null } | null
  contact: { id: string; name: string; phone: string; email: string } | null
  is_pinned: boolean
  is_archived: boolean
  unread_count: number
  last_message_at: string | null
  last_message?: {
    type: string
    content: string | null
    direction: 'incoming' | 'outgoing'
    sender_name?: string | null
  }
}

interface Message {
  id: string
  direction: 'incoming' | 'outgoing'
  type: 'text' | 'image' | 'video' | 'audio' | 'ptt' | 'document' | 'sticker' | 'location' | 'contact' | 'contacts'
  content: string | null
  media_url: string | null
  media_filename: string | null
  media_mimetype?: string | null
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed'
  sender: { id: string; name: string } | null
  sender_name: string | null
  sender_phone: string | null
  created_at: string
}

export default function WhatsAppPage() {
  const queryClient = useQueryClient()
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [mobileView, setMobileView] = useState<'conversations' | 'chat'>('conversations')
  const [searchTerm, setSearchTerm] = useState('')
  const [showNewSessionModal, setShowNewSessionModal] = useState(false)
  const [showSettingsMenu, setShowSettingsMenu] = useState(false)
  const [messageText, setMessageText] = useState('')
  const [showQRModal, setShowQRModal] = useState(false)
  const [showQuickReplySuggestions, setShowQuickReplySuggestions] = useState(false)
  const [quickReplyFilter, setQuickReplyFilter] = useState('')
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [selectedSellerSignature, setSelectedSellerSignature] = useState<string | null>(null)
  const [showMyConversations, setShowMyConversations] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const { isManager, isAdmin } = usePermissionStore()
  const { user } = useAuthStore()
  const canManage = isManager || isAdmin || !!user?.is_super_admin
  const canCreateSession = !!user

  // Common emojis for quick access
  const commonEmojis = ['😀', '😂', '😍', '🥰', '😊', '👍', '👏', '🙏', '❤️', '🔥', '✅', '👋', '🎉', '💪', '😎', '🤔', '😅', '😁', '🙂', '😉']

  // Fetch sessions
  const { data: sessionsData, isLoading: loadingSessions, refetch: refetchSessions } = useQuery({
    queryKey: ['whatsapp-sessions'],
    queryFn: () => whatsappApi.sessions(),
    refetchOnWindowFocus: true, // Refetch when returning to the tab
    refetchOnMount: 'always', // Always refetch when component mounts
    staleTime: 5000, // Consider data stale after 5 seconds
  })

  const sessions: Session[] = sessionsData?.data?.data || []
  
  // Get current selected session object
  const selectedSession = sessions.find(s => s.id === selectedSessionId)

  useEffect(() => {
    if (!canManage) {
      setShowMyConversations(true)
      setSelectedSellerSignature(null)
    }
  }, [canManage])

  const { data: usersData } = useQuery({
    queryKey: ['whatsapp-sellers'],
    queryFn: () => usersApi.list({ per_page: 200 }),
    enabled: canManage,
  })

  const availableSellers = usersData?.data?.data || []
  const sellersWithSignature = availableSellers.filter((seller: any) => seller.signature)

  // Auto-select first connected session
  useEffect(() => {
    if (sessions.length > 0 && !selectedSessionId) {
      const connectedSession = sessions.find(s => s.status === 'connected')
      setSelectedSessionId(connectedSession?.id || sessions[0].id)
    }
  }, [sessions, selectedSessionId])

  // Fetch conversations - always fetch when session is selected (conversations exist in database)
  const { 
    data: conversationsData, 
    isLoading: loadingConversations,
    refetch: refetchConversations,
    isFetching: fetchingConversations 
  } = useQuery({
    queryKey: ['whatsapp-conversations', selectedSessionId, searchTerm, selectedSellerSignature, showMyConversations],
    queryFn: () => whatsappApi.conversations(selectedSessionId!, {
      search: searchTerm || undefined,
      assigned_signature: selectedSellerSignature || undefined,
      my_conversations: showMyConversations || undefined,
    }),
    enabled: !!selectedSessionId, // Always fetch when session is selected
    refetchInterval: selectedSession?.status === 'connected' ? 3000 : false, // Only auto-refetch when connected
    refetchOnWindowFocus: true,
    staleTime: 1000,
  })

  const conversations: Conversation[] = conversationsData?.data?.data || []

  // Fetch messages - always fetch when conversation is selected (messages exist in database)
  const { 
    data: messagesData, 
    isLoading: loadingMessages,
    refetch: refetchMessages,
    isFetching: fetchingMessages 
  } = useQuery({
    queryKey: ['whatsapp-messages', selectedConversation?.id],
    queryFn: () => whatsappApi.messages(selectedConversation!.id, { limit: 100 }),
    enabled: !!selectedConversation?.id, // Always fetch when conversation is selected
    refetchInterval: selectedSession?.status === 'connected' ? 2000 : false, // Only auto-refetch when connected
    refetchOnWindowFocus: true,
    staleTime: 500,
  })

  // Messages come in DESC order (newest first), reverse for chat display (oldest first)
  const messages: Message[] = (messagesData?.data?.data || []).slice().reverse()

  // Sync session mutation
  const syncSessionMutation = useMutation({
    mutationFn: (sessionId: string) => whatsappApi.syncSession(sessionId),
    onSuccess: () => {
      setTimeout(() => {
        refetchConversations()
      }, 2000)
    },
  })

  // Fetch history mutation
  const fetchHistoryMutation = useMutation({
    mutationFn: (conversationId: string) => whatsappApi.fetchHistory(conversationId, 100),
    onSuccess: () => {
      refetchMessages()
    },
  })

  // Manual sync function - sync session + refetch data
  const handleManualSync = async () => {
    // First, always refresh session status and get the latest data
    const { data: freshSessionsData } = await refetchSessions()
    const freshSessions: Session[] = freshSessionsData?.data?.data || []
    const currentSession = freshSessions.find(s => s.id === selectedSessionId)
    
    // Only try to sync if session is connected
    if (selectedSessionId && currentSession?.status === 'connected') {
      try {
        await syncSessionMutation.mutateAsync(selectedSessionId)
      } catch (e) {
        // Ignore sync errors, still refetch
        console.log('Sync error (ignored):', e)
      }
      await Promise.all([
        refetchConversations(),
        selectedConversation?.id ? refetchMessages() : Promise.resolve(),
      ])
    } else if (currentSession?.status === 'qr_code' || currentSession?.status === 'connecting') {
      // If session needs QR code, show the QR modal
      setShowQRModal(true)
    } else if (currentSession?.status === 'disconnected') {
      // Session is disconnected, offer to reconnect
      toast.warning('Sessão desconectada', 'Clique em "Reconectar" para conectar novamente.')
    }
  }

  // Fetch history for current conversation
  const handleFetchHistory = async () => {
    if (selectedConversation?.id) {
      await fetchHistoryMutation.mutateAsync(selectedConversation.id)
    }
  }

  // Sync indicator
  const isSyncing = fetchingConversations || fetchingMessages || syncSessionMutation.isPending || fetchHistoryMutation.isPending || loadingSessions
  
  // Clear selected conversation when session disconnects or changes
  useEffect(() => {
    if (selectedSession && selectedSession.status !== 'connected' && selectedConversation) {
      // Session disconnected, clear conversation selection
      setSelectedConversation(null)
      setMobileView('conversations')
    }
  }, [selectedSession?.status])

  // Reset mobileView when conversation is cleared
  useEffect(() => {
    if (!selectedConversation) {
      setMobileView('conversations')
    }
  }, [selectedConversation])

  // Fetch quick replies for shortcuts
  const { data: quickRepliesData } = useQuery({
    queryKey: ['whatsapp-quick-replies'],
    queryFn: () => whatsappApi.quickReplies(),
  })
  const quickReplies = quickRepliesData?.data?.data || []

  // Filter quick replies based on typed shortcut
  const filteredQuickReplies = quickReplies.filter((reply: { shortcut: string; title: string; content: string }) =>
    reply.shortcut.toLowerCase().includes(quickReplyFilter.toLowerCase()) ||
    reply.title.toLowerCase().includes(quickReplyFilter.toLowerCase())
  )

  // Handle message text change with shortcut detection
  const handleMessageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setMessageText(value)
    
    // Check if text starts with "/"
    if (value.startsWith('/')) {
      setShowQuickReplySuggestions(true)
      setQuickReplyFilter(value)
    } else {
      setShowQuickReplySuggestions(false)
      setQuickReplyFilter('')
    }
  }

  // Select a quick reply
  const selectQuickReply = (content: string) => {
    setMessageText(content)
    setShowQuickReplySuggestions(false)
    setQuickReplyFilter('')
    inputRef.current?.focus()
  }

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Create session mutation
  const createSessionMutation = useMutation({
    mutationFn: (data: { phone_number: string; session_name?: string; is_global?: boolean }) =>
      whatsappApi.createSession(data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-sessions'] })
      setShowNewSessionModal(false)
      const session = response.data.data.session
      // Show QR modal for new sessions or reconnections
      if (session.status === 'qr_code' || session.status === 'connecting') {
        setSelectedSessionId(session.id)
        setShowQRModal(true)
      }
    },
  })

  // Refresh profile pictures mutation
  const refreshProfilePicturesMutation = useMutation({
    mutationFn: () => whatsappApi.refreshProfilePictures(selectedSessionId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-conversations', selectedSessionId] })
    },
  })

  // Refresh group names mutation
  const refreshGroupNamesMutation = useMutation({
    mutationFn: () => whatsappApi.refreshGroupNames(selectedSessionId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-conversations', selectedSessionId] })
    },
  })

  // Fix contact names mutation (correct names that were overwritten by our own pushName)
  const fixContactNamesMutation = useMutation({
    mutationFn: () => whatsappApi.fixContactNames(selectedSessionId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-conversations', selectedSessionId] })
      if (selectedConversation?.id) {
        queryClient.invalidateQueries({ queryKey: ['whatsapp-messages', selectedConversation.id] })
      }
      toast.success('Nomes atualizados', 'Lista de contatos atualizada. Nomes no formato número@lid foram limpos.')
    },
  })

  // Reconnect session mutation (clear data and reconnect fresh)
  const reconnectSessionMutation = useMutation({
    mutationFn: (sessionId: string) => whatsappApi.reconnectSession(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-sessions'] })
      queryClient.invalidateQueries({ queryKey: ['whatsapp-conversations'] })
      queryClient.invalidateQueries({ queryKey: ['whatsapp-messages'] })
      setSelectedConversation(null)
      setShowQRModal(true)
    },
  })

  // Clear session data mutation
  const clearSessionDataMutation = useMutation({
    mutationFn: (sessionId: string) => whatsappApi.clearSessionData(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-conversations', selectedSessionId] })
      queryClient.invalidateQueries({ queryKey: ['whatsapp-messages'] })
      setSelectedConversation(null)
    },
  })

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: (data: { type: string; content: string }) =>
      whatsappApi.sendMessage(selectedConversation!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-messages', selectedConversation?.id] })
      setMessageText('')
    },
  })

  // Pin conversation mutation
  const togglePinMutation = useMutation({
    mutationFn: (conversationId: string) => whatsappApi.togglePin(conversationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-conversations'] })
    },
  })

  const claimConversationMutation = useMutation({
    mutationFn: (conversationId: string) => whatsappApi.assignConversation(conversationId, user!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-conversations'] })
    },
  })

  // Update session (owner / global) – only for admins/managers
  const updateSessionMutation = useMutation({
    mutationFn: ({ sessionId, data }: { sessionId: string; data: { user_id?: string | null; is_global?: boolean } }) =>
      whatsappApi.updateSession(sessionId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-sessions'] })
      queryClient.invalidateQueries({ queryKey: ['whatsapp-conversations'] })
      setShowSessionOwnerModal(false)
      toast.success('Sessão atualizada', 'Conversas foram vinculadas ao dono da sessão.')
    },
    onError: (err: any) => {
      toast.error('Erro', err?.response?.data?.message || err?.message)
    },
  })

  // Delete session mutation
  const deleteSessionMutation = useMutation({
    mutationFn: (sessionId: string) => whatsappApi.deleteSession(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-sessions'] })
      setSelectedSessionId(null)
      setShowDeleteConfirm(false)
    },
  })

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showSessionOwnerModal, setShowSessionOwnerModal] = useState(false)
  const [showQuickRepliesModal, setShowQuickRepliesModal] = useState(false)
  const [showQueuesModal, setShowQueuesModal] = useState(false)
  const [showAddToPipelineModal, setShowAddToPipelineModal] = useState(false)

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault()
    if (!messageText.trim() || !selectedConversation) return
    sendMessageMutation.mutate({ type: 'text', content: messageText })
  }

  // Handle emoji selection
  const handleEmojiSelect = (emoji: string) => {
    setMessageText(prev => prev + emoji)
    setShowEmojiPicker(false)
    inputRef.current?.focus()
  }

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selectedConversation) return

    // Determine file type
    let type = 'document'
    if (file.type.startsWith('image/')) type = 'image'
    else if (file.type.startsWith('video/')) type = 'video'
    else if (file.type.startsWith('audio/')) type = 'audio'

    // Send file via API
    whatsappApi.sendMessage(selectedConversation.id, { type, media: file })
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ['whatsapp-messages', selectedConversation.id] })
      })
      .catch((err) => {
        console.error('Error sending file:', err)
        toast.error('Erro', 'Não foi possível enviar o arquivo. Tente novamente.')
      })

    // Clear input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Handle audio recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      
      // Try to use ogg/opus format (preferred for WhatsApp), fallback to webm
      let mimeType = 'audio/webm;codecs=opus'
      if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
        mimeType = 'audio/ogg;codecs=opus'
      } else if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus'
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4'
      }
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        if (audioChunksRef.current.length === 0) {
          // Recording was cancelled
          stream.getTracks().forEach(track => track.stop())
          return
        }

        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType })
        const extension = mimeType.includes('ogg') ? 'ogg' : mimeType.includes('mp4') ? 'm4a' : 'webm'
        const audioFile = new File([audioBlob], `audio.${extension}`, { type: mimeType })
        
        if (selectedConversation) {
          whatsappApi.sendMessage(selectedConversation.id, { type: 'audio', media: audioFile })
            .then(() => {
              queryClient.invalidateQueries({ queryKey: ['whatsapp-messages', selectedConversation.id] })
            })
            .catch((err) => {
              console.error('Error sending audio:', err)
              toast.error('Erro', 'Não foi possível enviar o áudio. Tente novamente.')
            })
        }

        // Stop all tracks
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorder.start()
      setIsRecording(true)
      setRecordingTime(0)

      // Start timer
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)
    } catch (err) {
      console.error('Error starting recording:', err)
      toast.error('Microfone indisponível', 'Não foi possível acessar o microfone. Verifique as permissões.')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current)
        recordingIntervalRef.current = null
      }
    }
  }

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      audioChunksRef.current = [] // Clear chunks so nothing is sent
      setIsRecording(false)
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current)
        recordingIntervalRef.current = null
      }
    }
  }

  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const formatMessageTime = (dateString: string) => {
    try {
      const date = parseISO(dateString)
      return format(date, 'HH:mm')
    } catch {
      return ''
    }
  }

  const formatConversationDate = (dateString: string | null) => {
    if (!dateString) return ''
    try {
      const date = parseISO(dateString)
      if (isToday(date)) return format(date, 'HH:mm')
      if (isYesterday(date)) return 'Ontem'
      return format(date, 'dd/MM/yyyy')
    } catch {
      return ''
    }
  }

  const getMessageStatusIcon = (status: string) => {
    switch (status) {
      case 'sent': return <Check className="h-3 w-3 text-gray-400" />
      case 'delivered': return <CheckCheck className="h-3 w-3 text-gray-400" />
      case 'read': return <CheckCheck className="h-3 w-3 text-blue-500" />
      case 'failed': return <X className="h-3 w-3 text-red-500" />
      default: return <Clock className="h-3 w-3 text-gray-400" />
    }
  }

  const getSellerBadge = (name?: string | null, signature?: string | null) => {
    if (signature && signature.trim()) return signature.trim().toUpperCase()
    if (!name) return ''
    const parts = name.trim().split(/\s+/)
    const initials = parts.slice(0, 2).map((part) => part[0]?.toUpperCase() || '').join('')
    return initials || name[0]?.toUpperCase() || ''
  }

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] bg-white dark:bg-gray-900">
      {/* Session Selector (Top) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 sm:px-6 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
              <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                  <Phone className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                </div>
          <div className="flex flex-col min-w-0 flex-1">
            <select
              value={selectedSessionId || ''}
              onChange={(e) => setSelectedSessionId(e.target.value || null)}
              className="w-full min-w-0 sm:min-w-[260px] sm:max-w-[360px] bg-gray-100 dark:bg-gray-800 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="" disabled>
                {sessions.length === 0 ? 'Nenhuma sessão disponível' : 'Selecione uma sessão'}
              </option>
              {sessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.phone_number}
                  {session.session_name ? ` • ${session.session_name}` : ''}
                  {!session.user_id ? ' • Global' : ''}
                </option>
              ))}
            </select>
            <span
              className={`mt-1 text-xs ${
                selectedSession?.status === 'connected'
                  ? 'text-green-500'
                  : selectedSession?.status === 'qr_code' || selectedSession?.status === 'connecting'
                    ? 'text-yellow-500'
                    : 'text-gray-400'
              }`}
            >
              {selectedSession?.status === 'connected'
                ? 'Conectado'
                : selectedSession?.status === 'qr_code'
                  ? 'Aguardando QR Code'
                  : selectedSession?.status === 'connecting'
                    ? 'Conectando...'
                    : 'Desconectado'}
            </span>
                </div>
          {selectedSession &&
            (selectedSession.status === 'disconnected' ||
              selectedSession.status === 'qr_code' ||
              selectedSession.status === 'connecting') && (
                  <button
                    onClick={() => {
                      createSessionMutation.mutate({
                        phone_number: selectedSession.phone_number,
                        session_name: selectedSession.session_name,
                      })
                    }}
                    disabled={createSessionMutation.isPending}
                className="px-3 py-1 text-xs bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50"
                  >
                {createSessionMutation.isPending
                  ? 'Conectando...'
                  : selectedSession.status === 'qr_code'
                    ? 'Ver QR Code'
                    : 'Reconectar'}
                  </button>
                )}
              </div>
        <div className="flex items-center gap-2">
            <button 
              onClick={handleManualSync}
              disabled={isSyncing}
              className={`p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors ${
                selectedSession?.status !== 'connected' ? 'opacity-50' : ''
              }`}
              title={
                selectedSession?.status === 'connected' 
                  ? 'Sincronizar mensagens' 
                  : selectedSession?.status === 'qr_code' 
                    ? 'Clique para escanear QR Code'
                    : 'Sessão desconectada'
              }
            >
            <RefreshCw
              className={`h-5 w-5 ${
                selectedSession?.status === 'connected' 
                  ? isSyncing
                    ? 'text-emerald-500 animate-spin'
                    : 'text-gray-500'
                  : 'text-orange-500'
              }`}
            />
            </button>

            <div className="relative">
              <button 
                onClick={() => setShowSettingsMenu(!showSettingsMenu)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                <Settings className="h-5 w-5 text-gray-500 dark:text-gray-400" />
              </button>
              
              {showSettingsMenu && (
              <div className="absolute right-0 top-full mt-1 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-10">
                {canCreateSession && (
                  <button
                    onClick={() => {
                      setShowNewSessionModal(true)
                      setShowSettingsMenu(false)
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Novo número
                  </button>
                )}
                  <button
                    onClick={() => {
                      setShowQuickRepliesModal(true)
                      setShowSettingsMenu(false)
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
                  >
                    <MessageSquare className="h-4 w-4" />
                    Respostas rápidas
                  </button>
                {canManage && (
                  <button
                    onClick={() => {
                      setShowQueuesModal(true)
                      setShowSettingsMenu(false)
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
                  >
                    <User className="h-4 w-4" />
                    Fila de atribuição
                  </button>
                )}
                {canManage && selectedSession && (
                  <button
                    onClick={() => {
                      setShowSessionOwnerModal(true)
                      setShowSettingsMenu(false)
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
                  >
                    <User className="h-4 w-4" />
                    Definir dono da sessão
                  </button>
                )}
                  {selectedSession && selectedSession.status === 'connected' && (
                    <>
                      <button
                        onClick={() => {
                          refreshProfilePicturesMutation.mutate()
                          setShowSettingsMenu(false)
                        }}
                        disabled={refreshProfilePicturesMutation.isPending}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 disabled:opacity-50"
                      >
                        <Image className="h-4 w-4" />
                        {refreshProfilePicturesMutation.isPending ? 'Atualizando...' : 'Atualizar fotos'}
                      </button>
                      <button
                        onClick={() => {
                          refreshGroupNamesMutation.mutate()
                          setShowSettingsMenu(false)
                        }}
                        disabled={refreshGroupNamesMutation.isPending}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 disabled:opacity-50"
                      >
                        <MessageSquare className="h-4 w-4" />
                        {refreshGroupNamesMutation.isPending ? 'Atualizando...' : 'Atualizar nomes de grupos'}
                      </button>
                      <button
                        onClick={() => {
                          fixContactNamesMutation.mutate()
                          setShowSettingsMenu(false)
                        }}
                        disabled={fixContactNamesMutation.isPending}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 disabled:opacity-50"
                      >
                        <User className="h-4 w-4" />
                        {fixContactNamesMutation.isPending ? 'Corrigindo...' : 'Corrigir nomes de contatos'}
                      </button>
                    {(canManage || selectedSession.user_id === user?.id) && (
                      <button
                        onClick={() => {
                          if (confirm('Isso vai limpar todas as conversas e mensagens. Deseja continuar?')) {
                            clearSessionDataMutation.mutate(selectedSession.id)
                            setShowSettingsMenu(false)
                          }
                        }}
                        disabled={clearSessionDataMutation.isPending}
                        className="w-full px-4 py-2 text-left text-sm text-orange-600 hover:bg-orange-50 flex items-center gap-2 disabled:opacity-50"
                      >
                        <Archive className="h-4 w-4" />
                        {clearSessionDataMutation.isPending ? 'Limpando...' : 'Limpar histórico'}
                      </button>
                    )}
                    </>
                  )}
                  {selectedSession && (
                    <>
                    {(canManage || selectedSession.user_id === user?.id) && (
                      <button
                        onClick={() => {
                          if (confirm('Isso vai desconectar e reconectar com dados limpos. O QR Code será solicitado novamente. Deseja continuar?')) {
                            reconnectSessionMutation.mutate(selectedSession.id)
                            setShowSettingsMenu(false)
                          }
                        }}
                        disabled={reconnectSessionMutation.isPending}
                        className="w-full px-4 py-2 text-left text-sm text-blue-600 hover:bg-blue-50 flex items-center gap-2 disabled:opacity-50"
                      >
                        <RefreshCw className="h-4 w-4" />
                        {reconnectSessionMutation.isPending ? 'Reconectando...' : 'Reconectar (limpar tudo)'}
                      </button>
                    )}
                    {(canManage || selectedSession.user_id === user?.id) && (
                      <button
                        onClick={() => {
                          setShowDeleteConfirm(true)
                          setShowSettingsMenu(false)
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                      >
                        <X className="h-4 w-4" />
                        Remover...
                      </button>
                    )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Sessions & Conversations */}
        <div className={`w-full md:w-[360px] border-r border-gray-200 dark:border-gray-700 flex flex-col bg-white dark:bg-gray-800 shrink-0 ${mobileView === 'chat' ? 'hidden md:flex' : ''}`}>
        {/* Search & Filters */}
        <div className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Pesquisar por nome ou número"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {canManage && (
            <div className="mt-3">
              <label className="text-xs text-gray-500">Filtrar por sigla do vendedor</label>
              <select
                value={selectedSellerSignature || ''}
                onChange={(e) => setSelectedSellerSignature(e.target.value || null)}
                className="mt-1 w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 dark:text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Todos os vendedores</option>
                {sellersWithSignature.map((seller: any) => (
                  <option key={seller.id} value={seller.signature}>
                    {seller.signature} - {seller.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {canManage ? (
          <div className="flex gap-2 mt-3">
              <button
                onClick={() => setShowMyConversations(false)}
                className={`px-3 py-1 text-sm rounded-full ${
                  !showMyConversations
                    ? 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
              Tudo
            </button>
              <button
                onClick={() => setShowMyConversations(true)}
                className={`px-3 py-1 text-sm rounded-full ${
                  showMyConversations
                    ? 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
              Minhas
            </button>
          </div>
          ) : (
            <p className="mt-3 text-xs text-gray-500">Mostrando suas conversas</p>
          )}
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto">
          {loadingConversations ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-500" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Nenhuma conversa registrada ainda</p>
              <p className="text-sm">A partir de agora, suas novas mensagens de Whatsapp aparecerão aqui para você interagir</p>
            </div>
          ) : (
            conversations.map((conversation) => (
              <div
                key={conversation.id}
                onClick={async () => {
                  if (!canManage && selectedSession?.user_id === null && !conversation.assigned_user && user?.id) {
                    try {
                      const response = await claimConversationMutation.mutateAsync(conversation.id)
                      setSelectedConversation(response?.data?.data || conversation)
                      return
                    } catch {
                      toast.error('Conversa já foi atribuída a outro vendedor')
                      queryClient.invalidateQueries({ queryKey: ['whatsapp-conversations'] })
                    }
                  }
                  setSelectedConversation(conversation)
                }}
                className={`flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                  selectedConversation?.id === conversation.id ? 'bg-gray-100' : ''
                }`}
              >
                <div className="relative">
                  <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden">
                    {conversation.profile_picture ? (
                      <img 
                        src={conversation.profile_picture} 
                        alt="" 
                        className="w-full h-full object-cover" 
                      />
                    ) : (
                      <User className="h-6 w-6 text-gray-400" />
                    )}
                  </div>
                  {conversation.is_pinned && (
                    <Pin className="absolute -top-1 -right-1 h-4 w-4 text-emerald-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-gray-800 dark:text-white truncate flex items-center gap-1">
                      {conversation.is_group && <span className="text-xs">👥</span>}
                      {conversation.is_group 
                        ? (conversation.group_name || 'Grupo')
                        : (conversation.contact?.name || conversation.contact_name || conversation.contact_phone)
                      }
                    </p>
                    <span className="text-xs text-gray-400">
                      {formatConversationDate(conversation.last_message_at)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-500 truncate">
                      {conversation.last_message?.direction === 'outgoing' && (
                        <span className="mr-1">✓</span>
                      )}
                      {conversation.last_message?.content || 'Iniciar conversa...'}
                    </p>
                    {conversation.unread_count > 0 && (
                      <span className="ml-2 px-2 py-0.5 bg-emerald-500 text-white text-xs rounded-full">
                        {conversation.unread_count}
                      </span>
                    )}
                  </div>
                  {canManage && sessions.length <= 1 && conversation.assigned_user && (
                    <div className="flex items-center gap-1 mt-1">
                      <div className="px-1.5 py-0.5 bg-emerald-100 rounded-full flex items-center justify-center">
                        <span className="text-[9px] font-semibold text-emerald-700">
                          {getSellerBadge(conversation.assigned_user.name, conversation.assigned_user.signature)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className={`flex-1 flex flex-col min-w-0 ${mobileView === 'conversations' ? 'hidden md:flex' : ''}`}>
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  onClick={() => setMobileView('conversations')}
                  className="md:hidden p-2 -ml-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors shrink-0"
                  aria-label="Voltar para conversas"
                >
                  <ArrowLeft className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                </button>
                <div className="w-10 h-10 bg-gray-200 dark:bg-gray-600 rounded-full flex items-center justify-center overflow-hidden">
                  {selectedConversation.profile_picture ? (
                    <img 
                      src={selectedConversation.profile_picture} 
                      alt="" 
                      className="w-full h-full object-cover" 
                    />
                  ) : (
                    <User className="h-5 w-5 text-gray-400" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-800 dark:text-white">
                      {selectedConversation.is_group && <span className="mr-1">👥</span>}
                      {selectedConversation.is_group 
                        ? (selectedConversation.group_name || 'Grupo')
                        : (selectedConversation.contact?.name || selectedConversation.contact_name || selectedConversation.contact_phone)
                      }
                    </p>
                    {fetchingMessages && !loadingMessages && (
                      <RefreshCw className="h-3 w-3 text-emerald-500 animate-spin" />
                    )}
                  </div>
                  <p className="text-sm text-gray-500">
                    {selectedConversation.is_group 
                      ? 'Grupo do WhatsApp'
                      : selectedConversation.contact_phone 
                        ? (() => {
                            const raw = (selectedConversation.contact_phone || '').replace(/@lid$/i, '').replace(/@s\.whatsapp\.net$/i, '').trim();
                            if (/^\+\d{2}\s\d{2}\s/.test(raw)) return raw;
                            const digits = raw.replace(/\D/g, '');
                            return digits.length >= 10 ? `+${digits.replace(/(\d{2})(\d{2})(\d{4,5})(\d+)/, '$1 $2 $3-$4')}` : `+${raw}`;
                          })()
                        : 'Sem número'
                    }
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowAddToPipelineModal(true)}
                  className="px-3 py-1.5 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
                >
                  <LayoutGrid className="h-4 w-4" />
                  Funil de vendas
                </button>
                <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                  <MoreVertical className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div 
              className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50 dark:bg-gray-900"
            >
              {loadingMessages ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-500">
                  <MessageSquare className="h-12 w-12 mb-2 opacity-50" />
                  <p>Nenhuma mensagem nesta conversa</p>
                  <div className="flex gap-2 mt-3">
                    <button 
                      onClick={handleManualSync}
                      disabled={isSyncing}
                      className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 flex items-center gap-2 disabled:opacity-50"
                    >
                      <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
                      Sincronizar
                    </button>
                    <button 
                      onClick={handleFetchHistory}
                      disabled={fetchHistoryMutation.isPending}
                      className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-2 disabled:opacity-50"
                    >
                      <Clock className={`h-4 w-4 ${fetchHistoryMutation.isPending ? 'animate-spin' : ''}`} />
                      Carregar Histórico
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Load more history button */}
                  <div className="flex justify-center mb-4">
                    <button 
                      onClick={handleFetchHistory}
                      disabled={fetchHistoryMutation.isPending}
                      className="px-4 py-2 bg-gray-100 text-gray-600 text-sm rounded-full hover:bg-gray-200 flex items-center gap-2 disabled:opacity-50 transition-colors"
                    >
                      {fetchHistoryMutation.isPending ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          Carregando...
                        </>
                      ) : (
                        <>
                          <Clock className="h-4 w-4" />
                          Carregar mensagens anteriores
                        </>
                      )}
                    </button>
                  </div>
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.direction === 'outgoing' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[70%] rounded-lg px-4 py-2 ${
                          message.direction === 'outgoing'
                            ? 'bg-emerald-100 text-gray-800'
                            : 'bg-white text-gray-800 shadow-sm'
                        }`}
                      >
                        {/* Show sender name for group messages */}
                        {selectedConversation?.is_group && message.direction === 'incoming' && message.sender_name && (
                          <p className="text-xs font-semibold text-emerald-600 mb-1">
                            {message.sender_name}
                            {message.sender_phone && (
                              <span className="text-gray-400 font-normal ml-1">
                                (+{message.sender_phone.slice(0, 2)})
                              </span>
                            )}
                          </p>
                        )}
                        {message.type === 'text' ? (
                          <p className="whitespace-pre-wrap">{message.content}</p>
                        ) : message.type === 'image' ? (
                          <div className="max-w-[280px]">
                            {message.media_url ? (
                              <a 
                                href={`${process.env.NEXT_PUBLIC_API_URL || ''}/whatsapp/media/${message.media_url.split('/').pop()}`}
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="block"
                              >
                                <img 
                                  src={`${process.env.NEXT_PUBLIC_API_URL || ''}/whatsapp/media/${message.media_url.split('/').pop()}`}
                                  alt={message.content || 'Imagem'}
                                  className="rounded-lg max-w-full h-auto cursor-pointer hover:opacity-90 transition-opacity"
                                  loading="lazy"
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.style.display = 'none';
                                    target.nextElementSibling?.classList.remove('hidden');
                                  }}
                                />
                                <div className="hidden flex items-center gap-2 py-2">
                                  <Image className="h-5 w-5 text-gray-400" />
                                  <span className="text-sm">📷 {message.content || 'Imagem'}</span>
                                </div>
                              </a>
                            ) : (
                              <div className="flex items-center gap-2 py-2">
                                <Image className="h-5 w-5 text-gray-400" />
                                <span className="text-sm">📷 {message.content || 'Imagem'}</span>
                              </div>
                            )}
                            {message.content && message.media_url && (
                              <p className="text-sm mt-1 whitespace-pre-wrap">{message.content}</p>
                            )}
                          </div>
                        ) : message.type === 'video' ? (
                          <div className="max-w-[280px]">
                            {message.media_url ? (
                              <video 
                                src={`${process.env.NEXT_PUBLIC_API_URL || ''}/whatsapp/media/${message.media_url.split('/').pop()}`}
                                controls
                                className="rounded-lg max-w-full h-auto"
                                preload="metadata"
                              >
                                <source src={`${process.env.NEXT_PUBLIC_API_URL || ''}/whatsapp/media/${message.media_url.split('/').pop()}`} type="video/mp4" />
                                Seu navegador não suporta vídeos.
                              </video>
                            ) : (
                              <div className="flex items-center gap-2 py-2">
                                <span className="text-sm">🎬 {message.content || 'Vídeo'}</span>
                              </div>
                            )}
                            {message.content && message.media_url && (
                              <p className="text-sm mt-1 whitespace-pre-wrap">{message.content}</p>
                            )}
                          </div>
                        ) : message.type === 'ptt' || message.type === 'audio' ? (
                          <div className="min-w-[200px]">
                            {message.media_url ? (
                              <audio 
                                src={`${process.env.NEXT_PUBLIC_API_URL || ''}/whatsapp/media/${message.media_url.split('/').pop()}`}
                                controls
                                className="w-full max-w-[250px]"
                                preload="metadata"
                              >
                                <source src={`${process.env.NEXT_PUBLIC_API_URL || ''}/whatsapp/media/${message.media_url.split('/').pop()}`} />
                                Seu navegador não suporta áudio.
                              </audio>
                            ) : (
                              <div className="flex items-center gap-2 py-2">
                                <Mic className="h-5 w-5 text-gray-400" />
                                <span className="text-sm">🎤 Mensagem de voz</span>
                              </div>
                            )}
                          </div>
                        ) : message.type === 'document' ? (
                          <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                            <FileText className="h-8 w-8 text-gray-400 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">
                                {message.media_filename || message.content || 'Documento'}
                              </p>
                              {message.media_url && (
                                <a
                                  href={`${process.env.NEXT_PUBLIC_API_URL || ''}/whatsapp/media/${message.media_url.split('/').pop()}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-emerald-600 hover:underline"
                                >
                                  Baixar arquivo
                                </a>
                              )}
                            </div>
                          </div>
                        ) : message.type === 'sticker' ? (
                          <div className="max-w-[150px]">
                            {message.media_url ? (
                              <img 
                                src={`${process.env.NEXT_PUBLIC_API_URL || ''}/whatsapp/media/${message.media_url.split('/').pop()}`}
                                alt="Figurinha"
                                className="max-w-full h-auto"
                                loading="lazy"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = 'none';
                                  target.nextElementSibling?.classList.remove('hidden');
                                }}
                              />
                            ) : null}
                            <div className={`flex items-center gap-2 ${message.media_url ? 'hidden' : ''}`}>
                              <span className="text-2xl">🎨</span>
                              <span className="text-sm">Figurinha</span>
                            </div>
                          </div>
                        ) : message.type === 'location' ? (
                          <div className="flex items-center gap-2">
                            <span className="text-sm">📍 {message.content || 'Localização'}</span>
                          </div>
                        ) : message.type === 'contact' || message.type === 'contacts' ? (
                          <div className="flex items-center gap-2">
                            <span className="text-sm">👤 {message.content || 'Contato'}</span>
                          </div>
                        ) : message.content ? (
                          <p className="whitespace-pre-wrap">{message.content}</p>
                        ) : null}
                        <div className="flex items-center justify-end gap-1 mt-1">
                          <span className="text-xs text-gray-500">
                            {formatMessageTime(message.created_at)}
                          </span>
                          {message.direction === 'outgoing' && getMessageStatusIcon(message.status)}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Message Input */}
            <form onSubmit={handleSendMessage} className="p-4 bg-gray-100 border-t relative">
              {/* Quick Reply Suggestions */}
              {showQuickReplySuggestions && filteredQuickReplies.length > 0 && (
                <div className="absolute bottom-full left-0 right-0 mb-2 mx-4 bg-white rounded-lg shadow-lg border max-h-48 overflow-y-auto z-20">
                  {filteredQuickReplies.map((reply: { shortcut: string; title: string; content: string }, index: number) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => selectQuickReply(reply.content)}
                      className="w-full px-4 py-2 text-left hover:bg-gray-50 border-b last:border-b-0 flex items-center gap-3"
                    >
                      <span className="text-xs font-mono bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">
                        {reply.shortcut}
                      </span>
                      <div className="flex-1">
                        <p className="font-medium text-sm text-gray-700">{reply.title}</p>
                        <p className="text-xs text-gray-500 truncate">{reply.content}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Emoji Picker */}
              {showEmojiPicker && (
                <div className="absolute bottom-full left-0 mb-2 ml-2 bg-white rounded-lg shadow-lg border p-3 z-20">
                  <div className="grid grid-cols-10 gap-1">
                    {commonEmojis.map((emoji, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => handleEmojiSelect(emoji)}
                        className="w-8 h-8 flex items-center justify-center text-xl hover:bg-gray-100 rounded"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileSelect}
                accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                className="hidden"
              />

              {/* Recording State */}
              {isRecording ? (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={cancelRecording}
                    className="p-2 hover:bg-gray-200 rounded-full text-red-500"
                  >
                    <X className="h-5 w-5" />
                  </button>
                  <div className="flex-1 flex items-center gap-3">
                    <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                    <span className="text-sm text-gray-600 font-medium">{formatRecordingTime(recordingTime)}</span>
                    <div className="flex-1 h-1 bg-gray-300 rounded-full overflow-hidden">
                      <div className="h-full bg-red-500 animate-pulse" style={{ width: '100%' }} />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={stopRecording}
                    className="p-2 bg-emerald-500 hover:bg-emerald-600 rounded-full text-white"
                  >
                    <Send className="h-5 w-5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button 
                    type="button" 
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                  >
                    <Paperclip className="h-5 w-5 text-gray-500" />
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                  >
                    <Smile className="h-5 w-5 text-gray-500" />
                  </button>
                  <input
                    ref={inputRef}
                    type="text"
                    value={messageText}
                    onChange={handleMessageChange}
                    onFocus={() => setShowEmojiPicker(false)}
                    placeholder="Digite uma mensagem (use / para atalhos)"
                    className="flex-1 px-4 py-2 bg-white rounded-full focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  {messageText.trim() ? (
                    <button 
                      type="submit"
                      disabled={sendMessageMutation.isPending}
                      className="p-2 bg-emerald-500 hover:bg-emerald-600 rounded-full text-white transition-colors"
                    >
                      <Send className="h-5 w-5" />
                    </button>
                  ) : (
                    <button 
                      type="button" 
                      onClick={startRecording}
                      className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                    >
                      <Mic className="h-5 w-5 text-gray-500" />
                    </button>
                  )}
                </div>
              )}
            </form>
          </>
        ) : (
          /* Empty state */
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <div className="w-24 h-24 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                <MessageSquare className="h-12 w-12 text-gray-300" />
              </div>
              <h3 className="text-xl font-medium text-gray-700 mb-2">Olá, selecione uma conversa</h3>
              <p className="text-gray-500">Selecione uma conversa para começar a conversar com o cliente</p>
            </div>
          </div>
        )}
      </div>
      </div>

      {/* New Session Modal */}
      <AnimatePresence>
        {showNewSessionModal && (
          <NewSessionModal
            onClose={() => setShowNewSessionModal(false)}
            onSave={(data) => createSessionMutation.mutate(data)}
            isLoading={createSessionMutation.isPending}
            canCreateGlobal={canManage}
          />
        )}
      </AnimatePresence>

      {/* QR Code Modal */}
      <AnimatePresence>
        {showQRModal && selectedSessionId && (
          <QRCodeModal
            sessionId={selectedSessionId}
            onClose={() => setShowQRModal(false)}
            onConnected={() => {
              setShowQRModal(false)
              queryClient.invalidateQueries({ queryKey: ['whatsapp-sessions'] })
            }}
          />
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && selectedSession && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={() => setShowDeleteConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Remover Sessão</h3>
              <p className="text-gray-600 mb-4">
                Tem certeza que deseja remover a sessão <strong>{selectedSession.phone_number}</strong>? 
                Todas as conversas e mensagens serão perdidas.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => deleteSessionMutation.mutate(selectedSession.id)}
                  disabled={deleteSessionMutation.isPending}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50"
                >
                  {deleteSessionMutation.isPending ? 'Removendo...' : 'Remover'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Definir dono da sessão Modal */}
      <AnimatePresence>
        {showSessionOwnerModal && selectedSession && (
          <SessionOwnerModal
            session={selectedSession}
            sellers={availableSellers}
            onClose={() => setShowSessionOwnerModal(false)}
            onSave={(data) => updateSessionMutation.mutate({ sessionId: selectedSession.id, data })}
            isPending={updateSessionMutation.isPending}
          />
        )}
      </AnimatePresence>

      {/* Quick Replies Modal */}
      <AnimatePresence>
        {showQuickRepliesModal && (
          <QuickRepliesModal onClose={() => setShowQuickRepliesModal(false)} />
        )}
      </AnimatePresence>

      {/* Queues Modal */}
      <AnimatePresence>
        {showQueuesModal && selectedSessionId && (
          <QueuesModal 
            sessionId={selectedSessionId} 
            onClose={() => setShowQueuesModal(false)} 
          />
        )}
      </AnimatePresence>

      {/* Add to Pipeline Modal */}
      <AnimatePresence>
        {showAddToPipelineModal && selectedConversation && (
          <AddToPipelineModal 
            conversation={selectedConversation}
            onClose={() => setShowAddToPipelineModal(false)} 
            onSuccess={() => {
              setShowAddToPipelineModal(false)
              queryClient.invalidateQueries({ queryKey: ['whatsapp-conversations'] })
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// New Session Modal
function NewSessionModal({
  onClose,
  onSave,
  isLoading,
  canCreateGlobal,
}: {
  onClose: () => void
  onSave: (data: { phone_number: string; session_name?: string; is_global?: boolean }) => void
  isLoading: boolean
  canCreateGlobal: boolean
}) {
  const [phoneNumber, setPhoneNumber] = useState('')
  const [sessionName, setSessionName] = useState('')
  const [isGlobal, setIsGlobal] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!phoneNumber.trim()) return
    onSave({
      phone_number: phoneNumber,
      session_name: sessionName || undefined,
      is_global: canCreateGlobal ? isGlobal : undefined,
    })
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: -20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: -20 }}
        className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-800">Novo Número</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Número do WhatsApp *</label>
            <input
              type="text"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="5511999999999"
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              required
            />
            <p className="text-xs text-gray-400 mt-1">Ex: 5511999999999 (código do país + DDD + número)</p>
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">Nome da sessão</label>
            <input
              type="text"
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              placeholder="Ex: WhatsApp Comercial"
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          {canCreateGlobal && (
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={isGlobal}
                onChange={(e) => setIsGlobal(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
              />
              Número global (visível para todos os vendedores)
            </label>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading || !phoneNumber.trim()}
              className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50"
            >
              {isLoading ? 'Criando...' : 'Criar Sessão'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}

// QR Code Modal
function QRCodeModal({
  sessionId,
  onClose,
  onConnected,
}: {
  sessionId: string
  onClose: () => void
  onConnected: () => void
}) {
  const [countdown, setCountdown] = useState(60)

  // Fetch QR Code
  const { data: qrData, refetch } = useQuery({
    queryKey: ['whatsapp-qr', sessionId],
    queryFn: () => whatsappApi.getQRCode(sessionId),
    refetchInterval: 3000,
  })

  const status = qrData?.data?.data?.status
  const qrCode = qrData?.data?.data?.qr_code

  // Check if connected
  useEffect(() => {
    if (status === 'connected') {
      onConnected()
    }
  }, [status, onConnected])

  // Countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          refetch()
          return 60
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [refetch])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.95 }}
        className="bg-white rounded-xl shadow-xl w-full max-w-xl mx-4"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <button onClick={onClose} className="flex items-center gap-2 text-gray-600 hover:text-gray-800">
            <ArrowLeft className="h-5 w-5" />
            Voltar
          </button>
        </div>

        <div className="p-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
            <div>
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Conecte seu WhatsApp!</h2>
              <p className="text-gray-600 mb-6">
                Integre seus contatos e conversas do seu dispositivo para usar no seu CRM.
              </p>
              <ol className="space-y-3 text-sm text-gray-600">
                <li>1. Abra o aplicativo do WhatsApp no celular</li>
                <li>2. Clique em Menu <strong>⋮</strong> no Android, ou Configurações <strong>⚙</strong> no iPhone</li>
                <li>3. Clique em Dispositivos conectados e em seguida em Conectar dispositivo</li>
                <li>4. Aponte seu celular para a tela e leia o código QR.</li>
              </ol>
            </div>
            <div className="flex flex-col items-center">
              <div className="bg-white p-4 rounded-lg shadow-inner">
                {qrCode ? (
                  <img src={qrCode} alt="QR Code" className="w-48 h-48" />
                ) : (
                  <div className="w-48 h-48 flex flex-col items-center justify-center bg-gray-100">
                    <QrCode className="h-20 w-20 text-gray-300 animate-pulse" />
                    <p className="text-xs text-gray-400 mt-2">Gerando QR Code...</p>
                  </div>
                )}
              </div>
              <div className="mt-4 flex items-center gap-2">
                <div className="w-full bg-emerald-100 rounded-full h-2">
                  <div 
                    className="bg-emerald-500 h-2 rounded-full transition-all duration-1000"
                    style={{ width: `${(countdown / 60) * 100}%` }}
                  />
                </div>
                <span className="text-sm text-gray-500">{countdown}s</span>
              </div>
              <button 
                onClick={() => {
                  refetch()
                  setCountdown(60)
                }}
                className="mt-2 text-sm text-emerald-600 hover:underline flex items-center gap-1"
              >
                <QrCode className="h-4 w-4" />
                Recarregar QR Code
              </button>
              <p className="text-xs text-gray-400 mt-4 text-center">
                Ao escanear o código QR, você concorda com o Termo de Aceite
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

// Definir dono da sessão Modal
function SessionOwnerModal({
  session,
  sellers,
  onClose,
  onSave,
  isPending,
}: {
  session: Session
  sellers: { id: string; name: string; email?: string; signature?: string | null }[]
  onClose: () => void
  onSave: (data: { user_id?: string | null; is_global?: boolean }) => void
  isPending: boolean
}) {
  const [isGlobal, setIsGlobal] = useState(!session.user_id)
  const [selectedUserId, setSelectedUserId] = useState<string>(session.user_id || (sellers[0]?.id ?? ''))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (isGlobal) {
      onSave({ is_global: true })
    } else {
      onSave({ is_global: false, user_id: selectedUserId || null })
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.95 }}
        className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">Definir dono da sessão</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Número <strong>{session.phone_number}</strong>. Se não for global, todas as conversas serão vinculadas ao vendedor escolhido.
        </p>
        <form onSubmit={handleSubmit}>
          <label className="flex items-center gap-2 mb-3 cursor-pointer">
            <input
              type="radio"
              checked={isGlobal}
              onChange={() => setIsGlobal(true)}
              className="rounded border-gray-300"
            />
            <span className="text-gray-700 dark:text-gray-300">Número global (visível para todos os vendedores)</span>
          </label>
          <label className="flex items-center gap-2 mb-4 cursor-pointer">
            <input
              type="radio"
              checked={!isGlobal}
              onChange={() => setIsGlobal(false)}
              className="rounded border-gray-300"
            />
            <span className="text-gray-700 dark:text-gray-300">Número de um vendedor</span>
          </label>
          {!isGlobal && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Vendedor</label>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
              >
                {sellers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} {s.signature ? `(${s.signature})` : ''}</option>
                ))}
              </select>
            </div>
          )}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
              Cancelar
            </button>
            <button type="submit" disabled={isPending} className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50">
              {isPending ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}

// Quick Replies Modal
function QuickRepliesModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const [newReply, setNewReply] = useState({ shortcut: '', title: '', content: '' })
  const [editingId, setEditingId] = useState<string | null>(null)

  const { data: repliesData, isLoading } = useQuery({
    queryKey: ['whatsapp-quick-replies'],
    queryFn: () => whatsappApi.quickReplies(),
  })

  const replies = repliesData?.data?.data || []

  const createMutation = useMutation({
    mutationFn: (data: { shortcut: string; title: string; content: string }) =>
      whatsappApi.createQuickReply(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-quick-replies'] })
      setNewReply({ shortcut: '', title: '', content: '' })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      whatsappApi.updateQuickReply(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-quick-replies'] })
      setEditingId(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => whatsappApi.deleteQuickReply(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-quick-replies'] })
    },
  })

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.95 }}
        className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[80vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-800">Respostas Rápidas</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {/* Add new */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-medium text-gray-700 mb-3">Nova Resposta Rápida</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <input
                type="text"
                placeholder="Atalho (ex: /ola)"
                value={newReply.shortcut}
                onChange={(e) => setNewReply({ ...newReply, shortcut: e.target.value })}
                className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <input
                type="text"
                placeholder="Título"
                value={newReply.title}
                onChange={(e) => setNewReply({ ...newReply, title: e.target.value })}
                className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <textarea
              placeholder="Conteúdo da mensagem"
              value={newReply.content}
              onChange={(e) => setNewReply({ ...newReply, content: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            />
            <button
              onClick={() => createMutation.mutate(newReply)}
              disabled={!newReply.shortcut || !newReply.title || !newReply.content || createMutation.isPending}
              className="mt-3 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50"
            >
              {createMutation.isPending ? 'Salvando...' : 'Adicionar'}
            </button>
          </div>

          {/* List */}
          <div className="space-y-3">
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-500 mx-auto" />
              </div>
            ) : replies.length === 0 ? (
              <p className="text-center text-gray-500 py-8">Nenhuma resposta rápida cadastrada</p>
            ) : (
              replies.map((reply: any) => (
                <div key={reply.id} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-xs rounded font-mono">
                        {reply.shortcut}
                      </span>
                      <span className="font-medium text-gray-700">{reply.title}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => deleteMutation.mutate(reply.id)}
                        className="p-1 text-red-500 hover:bg-red-50 rounded"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">{reply.content}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

// Queues Modal
function QueuesModal({ sessionId, onClose }: { sessionId: string; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [newQueue, setNewQueue] = useState({ name: '', user_ids: [] as string[] })

  const { data: queuesData, isLoading } = useQuery({
    queryKey: ['whatsapp-queues', sessionId],
    queryFn: () => whatsappApi.assignmentQueues(sessionId),
  })

  const { data: usersData } = useQuery({
    queryKey: ['users-list'],
    queryFn: () => fetch('/api/v1/users').then(res => res.json()),
  })

  const queues = queuesData?.data?.data || []
  const users = usersData?.data || []

  const createMutation = useMutation({
    mutationFn: (data: { name: string; user_ids: string[] }) =>
      whatsappApi.createAssignmentQueue(sessionId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-queues'] })
      setNewQueue({ name: '', user_ids: [] })
    },
  })

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.95 }}
        className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[80vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-800">Filas de Atribuição</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {/* Add new */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-medium text-gray-700 mb-3">Nova Fila</h3>
            <input
              type="text"
              placeholder="Nome da fila"
              value={newQueue.name}
              onChange={(e) => setNewQueue({ ...newQueue, name: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 mb-3"
            />
            <p className="text-sm text-gray-500 mb-2">Usuários na fila:</p>
            <div className="flex flex-wrap gap-2 mb-3">
              {users.map((user: any) => (
                <label key={user.id} className="flex items-center gap-2 px-3 py-1 border rounded-full cursor-pointer hover:bg-gray-100">
                  <input
                    type="checkbox"
                    checked={newQueue.user_ids.includes(user.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setNewQueue({ ...newQueue, user_ids: [...newQueue.user_ids, user.id] })
                      } else {
                        setNewQueue({ ...newQueue, user_ids: newQueue.user_ids.filter(id => id !== user.id) })
                      }
                    }}
                    className="rounded text-emerald-500"
                  />
                  <span className="text-sm">{user.name}</span>
                </label>
              ))}
            </div>
            <button
              onClick={() => createMutation.mutate(newQueue)}
              disabled={!newQueue.name || newQueue.user_ids.length === 0 || createMutation.isPending}
              className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50"
            >
              {createMutation.isPending ? 'Salvando...' : 'Criar Fila'}
            </button>
          </div>

          {/* List */}
          <div className="space-y-3">
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-500 mx-auto" />
              </div>
            ) : queues.length === 0 ? (
              <p className="text-center text-gray-500 py-8">Nenhuma fila cadastrada</p>
            ) : (
              queues.map((queue: any) => (
                <div key={queue.id} className="p-4 border rounded-lg">
                  <h4 className="font-medium text-gray-700 mb-2">{queue.name}</h4>
                  <p className="text-sm text-gray-500">
                    {queue.user_ids?.length || 0} usuários na fila
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

// Add to Pipeline Modal
function AddToPipelineModal({ 
  conversation, 
  onClose, 
  onSuccess 
}: { 
  conversation: Conversation
  onClose: () => void
  onSuccess: () => void 
}) {
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>('')
  const [selectedStageId, setSelectedStageId] = useState<string>('')
  const [cardTitle, setCardTitle] = useState(conversation.contact_name || conversation.contact_phone)
  const [cardValue, setCardValue] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Fetch pipelines
  const { data: pipelinesData, isLoading: loadingPipelines } = useQuery({
    queryKey: ['pipelines'],
    queryFn: () => pipelineApi.list({ active_only: true }),
  })

  const pipelines = pipelinesData?.data?.data || []

  // Get selected pipeline details
  const selectedPipeline = pipelines.find((p: any) => p.id === selectedPipelineId)
  const stages = selectedPipeline?.stages || []

  // Auto-select first pipeline and first stage
  useEffect(() => {
    if (pipelines.length > 0 && !selectedPipelineId) {
      const defaultPipeline = pipelines.find((p: any) => p.is_default) || pipelines[0]
      setSelectedPipelineId(defaultPipeline.id)
    }
  }, [pipelines, selectedPipelineId])

  useEffect(() => {
    if (stages.length > 0 && !selectedStageId) {
      setSelectedStageId(stages[0].id)
    }
  }, [stages, selectedStageId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedPipelineId || !selectedStageId || !cardTitle) return

    setIsSubmitting(true)

    try {
      let contactId = conversation.contact?.id

      // If no contact linked, create one first
      if (!contactId) {
        // Create a new contact/client
        const contactResponse = await clientsApi.create({
          name: conversation.contact_name || conversation.contact_phone,
          phone: conversation.contact_phone,
          email: null,
          type: 'lead',
          status: 'active',
          notes: `Contato criado automaticamente a partir do WhatsApp`,
        })

        if (contactResponse?.data?.data?.id) {
          const newContactId = contactResponse.data.data.id
          contactId = newContactId

          // Link contact to the WhatsApp conversation
          await whatsappApi.linkContact(conversation.id, newContactId)
        }
      }

      // Now create the pipeline card with the contact
      await pipelineApi.cards.create(selectedPipelineId, {
        title: cardTitle,
        stage_id: selectedStageId,
        contact_id: contactId,
        value: cardValue ? parseFloat(cardValue) : 0,
        metadata: {
          phone: conversation.contact_phone,
          whatsapp_conversation_id: conversation.id,
        }
      })

      onSuccess()
    } catch (error) {
      console.error('Error creating card:', error)
      toast.error('Erro', 'Não foi possível adicionar ao funil. Tente novamente.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.95 }}
        className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b bg-emerald-500">
          <h2 className="text-lg font-semibold text-white">Adicionar ao Funil de Vendas</h2>
          <button onClick={onClose} className="p-1 hover:bg-emerald-600 rounded text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Contact Info */}
          <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900 rounded-full flex items-center justify-center">
              <User className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="font-medium text-gray-800 dark:text-white">{conversation.contact_name || 'Sem nome'}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{conversation.contact_phone}</p>
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Título do Card
            </label>
            <input
              type="text"
              value={cardTitle}
              onChange={(e) => setCardTitle(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Ex: Lead WhatsApp"
              required
            />
          </div>

          {/* Pipeline */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Funil de Vendas
            </label>
            {loadingPipelines ? (
              <div className="flex items-center justify-center py-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-emerald-500" />
              </div>
            ) : (
              <select
                value={selectedPipelineId}
                onChange={(e) => {
                  setSelectedPipelineId(e.target.value)
                  setSelectedStageId('')
                }}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              >
                <option value="">Selecione um funil</option>
                {pipelines.map((pipeline: any) => (
                  <option key={pipeline.id} value={pipeline.id}>
                    {pipeline.name} {pipeline.is_default && '(Padrão)'}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Stage */}
          {selectedPipelineId && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Etapa
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {stages.map((stage: any) => (
                  <button
                    key={stage.id}
                    type="button"
                    onClick={() => setSelectedStageId(stage.id)}
                    className={`p-2 rounded-lg border text-sm text-left transition-colors ${
                      selectedStageId === stage.id
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    style={{
                      borderLeftWidth: '4px',
                      borderLeftColor: stage.color || '#10b981'
                    }}
                  >
                    {stage.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Value */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Valor Estimado (opcional)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">R$</span>
              <input
                type="number"
                value={cardValue}
                onChange={(e) => setCardValue(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="0,00"
                step="0.01"
                min="0"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!selectedPipelineId || !selectedStageId || !cardTitle || isSubmitting}
              className="flex-1 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Adicionando...' : 'Adicionar ao Funil'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}
