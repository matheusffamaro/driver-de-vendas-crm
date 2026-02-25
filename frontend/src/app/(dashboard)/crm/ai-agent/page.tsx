'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  Bot, 
  Settings, 
  FileText, 
  Upload, 
  Trash2, 
  RefreshCw,
  MessageSquare,
  Clock,
  Mail,
  Phone,
  ChevronDown,
  ChevronUp,
  Save,
  Info,
  XCircle,
  Sparkles
} from 'lucide-react'
import { api, whatsappApi } from '@/lib/api'

// API functions
const aiAgentApi = {
  get: () => api.get('/ai-agent'),
  update: (data: any) => api.put('/ai-agent', data),
  resetInstructions: () => api.post('/ai-agent/reset-instructions'),
  testChat: (message: string) => api.post('/ai-agent/test-chat', { message }),
  listDocuments: () => api.get('/ai-agent/documents'),
  uploadDocument: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post('/ai-agent/documents', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  deleteDocument: (id: string) => api.delete(`/ai-agent/documents/${id}`),
}

interface HumanServiceHours {
  [key: string]: { enabled: boolean; start: string; end: string }
}

const DAYS = [
  { key: 'monday', label: 'SEG' },
  { key: 'tuesday', label: 'TER' },
  { key: 'wednesday', label: 'QUA' },
  { key: 'thursday', label: 'QUI' },
  { key: 'friday', label: 'SEX' },
  { key: 'saturday', label: 'SÁB' },
  { key: 'sunday', label: 'DOM' },
]

export default function AiAgentPage() {
  const queryClient = useQueryClient()
  const [activeSection, setActiveSection] = useState<string | null>('general')
  const [testMessage, setTestMessage] = useState('')
  const [testResponse, setTestResponse] = useState('')

  // Fetch agent config
  const { data: agentData, isLoading } = useQuery({
    queryKey: ['ai-agent'],
    queryFn: () => aiAgentApi.get(),
  })

  const agent = agentData?.data?.data || {}
  const defaults = agentData?.data?.defaults || {}

  // Fetch documents
  const { data: documentsData } = useQuery({
    queryKey: ['ai-agent-documents'],
    queryFn: () => aiAgentApi.listDocuments(),
  })
  const documents = documentsData?.data?.data || []

  // Fetch WhatsApp sessions
  const { data: sessionsData } = useQuery({
    queryKey: ['whatsapp-sessions'],
    queryFn: () => whatsappApi.sessions(),
  })
  const whatsappSessions = sessionsData?.data?.data || []

  // Form state
  const [formData, setFormData] = useState<any>({})
  const [isInitialized, setIsInitialized] = useState(false)

  // Update form when agent data loads
  useEffect(() => {
    if (agent && Object.keys(agent).length > 0 && !isInitialized) {
      setFormData({
        ...agent,
        whatsapp_session_id: agent.whatsapp_session_id === null ? 'default' : agent.whatsapp_session_id,
      })
      setIsInitialized(true)
    }
  }, [agent, isInitialized])

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: any) => aiAgentApi.update(data),
    onSuccess: (response) => {
      if (response?.data?.data) {
        const d = response.data.data
        setFormData({
          ...d,
          whatsapp_session_id: d.whatsapp_session_id === null ? 'default' : d.whatsapp_session_id,
        })
      }
      queryClient.invalidateQueries({ queryKey: ['ai-agent'] })
      alert('Configurações salvas com sucesso!')
    },
    onError: () => {
      alert('Erro ao salvar configurações.')
    },
  })

  // Reset instructions mutation
  const resetMutation = useMutation({
    mutationFn: () => aiAgentApi.resetInstructions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-agent'] })
      alert('Instruções redefinidas para o padrão.')
    },
  })

  // Test chat mutation
  const testChatMutation = useMutation({
    mutationFn: (message: string) => aiAgentApi.testChat(message),
    onSuccess: (response) => {
      setTestResponse(response?.data?.data?.response || 'Sem resposta')
    },
    onError: (error: any) => {
      setTestResponse(error?.response?.data?.message || 'Erro ao testar')
    },
  })

  // Upload document mutation
  const uploadMutation = useMutation({
    mutationFn: (file: File) => aiAgentApi.uploadDocument(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-agent-documents'] })
    },
    onError: () => {
      alert('Erro ao carregar documento.')
    },
  })

  // Delete document mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => aiAgentApi.deleteDocument(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-agent-documents'] })
    },
  })

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      uploadMutation.mutate(file)
    }
  }

  const handleSave = () => {
    updateMutation.mutate(formData)
  }

  const toggleSection = (section: string) => {
    setActiveSection(activeSection === section ? null : section)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg">
            <Bot className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Agente de Chat</h1>
            <p className="text-sm text-gray-500">Configure seu assistente de IA para atendimento automático</p>
          </div>
        </div>
      </div>

      {/* General Configuration */}
      <div className="bg-white rounded-xl shadow-sm border">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 border-b">
          <h2 className="font-semibold text-gray-800">Configuração Geral</h2>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Ativo</span>
            <button
              onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                formData.is_active ? 'bg-emerald-500' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  formData.is_active ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Ativo em (Sessão WhatsApp)</label>
              <select
                value={formData.whatsapp_session_id || 'none'}
                onChange={(e) => setFormData({ ...formData, whatsapp_session_id: e.target.value === 'none' ? 'none' : e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
              >
                <option value="none">Nenhuma (Desativado)</option>
                <option value="default">Todas as sessões</option>
                {whatsappSessions.map((session: any) => (
                  <option key={session.id} value={session.id}>
                    {session.phone_number || session.id} {session.status === 'connected' ? '✓' : '○'}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1">
                {whatsappSessions.length === 0 
                  ? 'Nenhuma sessão WhatsApp encontrada' 
                  : `${whatsappSessions.filter((s: any) => s.status === 'connected').length} sessão(ões) conectada(s)`}
              </p>
            </div>
            <div className="min-w-0">
              <label className="block text-sm text-gray-600 mb-1">Notificar escalonamento humano por email</label>
              <div className="flex items-center gap-2 min-w-0">
                <input
                  type="checkbox"
                  checked={formData.notify_human_escalation || false}
                  onChange={(e) => setFormData({ ...formData, notify_human_escalation: e.target.checked })}
                  className="rounded border-gray-300 text-emerald-500 focus:ring-emerald-500 flex-shrink-0"
                />
                <input
                  type="email"
                  value={formData.notification_email || ''}
                  onChange={(e) => setFormData({ ...formData, notification_email: e.target.value })}
                  placeholder="email@exemplo.com"
                  className="flex-1 min-w-0 px-3 py-1.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Human Service Hours */}
          <div>
            <label className="block text-sm text-gray-600 mb-2">Horários de atendimento da IA</label>
            <p className="text-xs text-gray-500 mb-3">
              Defina os horários em que a IA responderá automaticamente. Fora desses períodos, o chatbot não enviará respostas.
              Dias sem horário definido permitem a IA responder o dia todo.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {DAYS.map((day) => {
                const dayConfig = formData.human_service_hours?.[day.key] || {}
                const isEnabled = dayConfig.enabled || false
                return (
                  <div
                    key={day.key}
                    className={`border rounded-lg p-3 transition-colors ${
                      isEnabled ? 'border-emerald-300 bg-emerald-50/50' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <input
                        type="checkbox"
                        checked={isEnabled}
                        onChange={(e) => {
                          const hours = { ...(formData.human_service_hours || {}) }
                          hours[day.key] = {
                            ...hours[day.key],
                            enabled: e.target.checked,
                            start: hours[day.key]?.start || '08:00',
                            end: hours[day.key]?.end || '18:00',
                          }
                          setFormData({ ...formData, human_service_hours: hours })
                        }}
                        className="rounded border-gray-300 text-emerald-500 focus:ring-emerald-500"
                      />
                      <span className={`font-medium text-sm ${isEnabled ? 'text-emerald-700' : 'text-gray-600'}`}>
                        {day.label}
                      </span>
                    </div>
                    {isEnabled && (
                      <div className="flex items-center gap-1.5 ml-6">
                        <input
                          type="time"
                          value={dayConfig.start || '08:00'}
                          onChange={(e) => {
                            const hours = { ...(formData.human_service_hours || {}) }
                            hours[day.key] = { ...hours[day.key], start: e.target.value }
                            setFormData({ ...formData, human_service_hours: hours })
                          }}
                          className="px-2 py-1 border rounded text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 w-24"
                        />
                        <span className="text-xs text-gray-400">até</span>
                        <input
                          type="time"
                          value={dayConfig.end || '18:00'}
                          onChange={(e) => {
                            const hours = { ...(formData.human_service_hours || {}) }
                            hours[day.key] = { ...hours[day.key], end: e.target.value }
                            setFormData({ ...formData, human_service_hours: hours })
                          }}
                          className="px-2 py-1 border rounded text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 w-24"
                        />
                      </div>
                    )}
                    {!isEnabled && (
                      <p className="text-xs text-gray-400 ml-6">IA ativa o dia todo</p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors disabled:opacity-50"
          >
            {updateMutation.isPending ? 'Salvando...' : 'Atualizar Chatbot'}
          </button>
        </div>
      </div>

      {/* Knowledge Base */}
      <div className="bg-white rounded-xl shadow-sm border">
        <div className="p-4 border-b">
          <h2 className="font-semibold text-gray-800">Base de Conhecimento</h2>
          <p className="text-sm text-gray-500">Carregue documentos para fornecer conhecimento específico ao chatbot.</p>
        </div>

        <div className="p-4 space-y-4">
          <div className="bg-blue-50 text-blue-700 px-4 py-3 rounded-lg flex items-start gap-2 text-sm">
            <Info className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <p>As alterações na base de conhecimento só terão efeito em novas conversas. As conversas existentes continuarão usando a base de conhecimento anterior.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Carregar Novos Arquivos</label>
            <label className="block border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-emerald-400 transition-colors cursor-pointer">
              <Upload className="h-8 w-8 mx-auto text-gray-400 mb-2" />
              <p className="text-gray-500">
                Arraste e solte os arquivos ou <span className="text-emerald-600 underline">Clique aqui</span>
              </p>
              <p className="text-xs text-gray-400 mt-1">PDF, TXT, DOC (máx 10MB)</p>
              <input
                type="file"
                accept=".pdf,.txt,.doc,.docx"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>

          {/* Documents List */}
          {documents.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-gray-700">Documentos carregados</h3>
              {documents.map((doc: any) => (
                <div key={doc.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="font-medium text-sm text-gray-800">{doc.name}</p>
                      <p className="text-xs text-gray-500">{(doc.file_size / 1024).toFixed(1)} KB</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      if (confirm('Excluir este documento?')) {
                        deleteMutation.mutate(doc.id)
                      }
                    }}
                    className="p-1 text-gray-400 hover:text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Instructions Configuration */}
      <div className="bg-white rounded-xl shadow-sm border">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 border-b">
          <div className="min-w-0">
            <h2 className="font-semibold text-gray-800">Configuração de Instruções</h2>
            <p className="text-sm text-gray-500">Configure como seu chatbot responde aos usuários</p>
          </div>
          <button
            onClick={() => {
              if (confirm('Redefinir todas as instruções para o padrão?')) {
                resetMutation.mutate()
              }
            }}
            className="px-3 py-1.5 border rounded-lg text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Redefinir Instruções
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="bg-blue-50 text-blue-700 px-4 py-3 rounded-lg flex items-start gap-2 text-sm">
            <Info className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <p>As alterações nas instruções só terão efeito em novas conversas. As conversas existentes continuarão usando a configuração anterior.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Instrução</label>
            <select
              value={formData.instruction_type || 'structured'}
              onChange={(e) => setFormData({ ...formData, instruction_type: e.target.value })}
              className="w-48 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="structured">Estruturado</option>
              <option value="custom">Personalizado</option>
            </select>
          </div>

          {formData.instruction_type === 'custom' ? (
            <div className="border rounded-lg p-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Instrução personalizada completa</label>
              <p className="text-xs text-gray-500 mb-3">
                Escreva todas as instruções que o chatbot deve seguir em um único texto.
              </p>
              <textarea
                value={formData.custom_instructions || ''}
                onChange={(e) => setFormData({ ...formData, custom_instructions: e.target.value })}
                rows={12}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-y text-sm"
                placeholder="Escreva as instruções completas para o chatbot..."
              />
            </div>
          ) : (
            <>
              {[
                { key: 'function_definition', label: 'Definição de Função', icon: Settings },
                { key: 'company_info', label: 'Sobre a Empresa, Produtos e Serviços', icon: Info },
                { key: 'tone', label: 'Tom da Conversa', icon: MessageSquare },
                { key: 'knowledge_guidelines', label: 'Orientações sobre a Base de Conhecimento', icon: FileText },
                { key: 'incorrect_info_prevention', label: 'Prevenção de Informações Incorretas', icon: XCircle },
                { key: 'human_escalation_rules', label: 'Encaminhamento para Atendimento Humano', icon: Phone },
                { key: 'useful_links', label: 'Links Úteis', icon: Info },
                { key: 'conversation_examples', label: 'Exemplos de Conversa', icon: MessageSquare },
              ].map((field) => (
                <div key={field.key} className="border rounded-lg">
                  <button
                    onClick={() => toggleSection(field.key)}
                    className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-2">
                      <field.icon className="h-4 w-4 text-gray-400" />
                      <span className="font-medium text-gray-700">{field.label}</span>
                    </div>
                    {activeSection === field.key ? (
                      <ChevronUp className="h-4 w-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-gray-400" />
                    )}
                  </button>
                  {activeSection === field.key && (
                    <div className="px-4 pb-4">
                      <button
                        onClick={() => setFormData({ ...formData, [field.key]: defaults[field.key] || '' })}
                        className="text-xs text-emerald-600 hover:text-emerald-700 mb-2 flex items-center gap-1"
                      >
                        <FileText className="h-3 w-3" />
                        Usar padrão e editar
                      </button>
                      <textarea
                        value={formData[field.key] || ''}
                        onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                        rows={6}
                        className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-y text-sm"
                        placeholder={defaults[field.key] || `Configure ${field.label.toLowerCase()}...`}
                      />
                      <p className="text-xs text-gray-400 text-right mt-1">Máx 2500 caracteres</p>
                    </div>
                  )}
                </div>
              ))}
            </>
          )}

          <button
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors disabled:opacity-50"
          >
            {updateMutation.isPending ? 'Salvando...' : 'Atualizar Instruções'}
          </button>
        </div>
      </div>

      {/* Test Chat */}
      <div className="bg-white rounded-xl shadow-sm border">
        <div className="p-4 border-b">
          <h2 className="font-semibold text-gray-800">Testar Chatbot</h2>
          <p className="text-sm text-gray-500">Envie uma mensagem de teste para ver como o chatbot responde.</p>
        </div>

        <div className="p-4 space-y-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={testMessage}
              onChange={(e) => setTestMessage(e.target.value)}
              placeholder="Digite uma mensagem de teste..."
              className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && testMessage.trim()) {
                  testChatMutation.mutate(testMessage)
                }
              }}
            />
            <button
              onClick={() => testChatMutation.mutate(testMessage)}
              disabled={!testMessage.trim() || testChatMutation.isPending}
              className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              <Sparkles className={`h-4 w-4 ${testChatMutation.isPending ? 'animate-pulse' : ''}`} />
              {testChatMutation.isPending ? 'Processando...' : 'Enviar'}
            </button>
          </div>

          {testResponse && (
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm font-medium text-gray-600 mb-2">Resposta do Chatbot:</p>
              <p className="text-gray-800 whitespace-pre-wrap">{testResponse}</p>
            </div>
          )}

          {!formData.is_active && (
            <p className="text-sm text-blue-600">
              O teste funciona mesmo com o chatbot desativado.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
