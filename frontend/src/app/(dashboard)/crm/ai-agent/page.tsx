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
  CheckCircle,
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
      setFormData(agent)
      setIsInitialized(true)
    }
  }, [agent, isInitialized])

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: any) => aiAgentApi.update(data),
    onSuccess: (response) => {
      // Update form with saved data
      if (response?.data?.data) {
        setFormData(response.data.data)
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

  const aiModel = agentData?.data?.ai_model || {}

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
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

      {/* AI Model Status Card */}
      <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl border border-blue-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white rounded-lg shadow-sm">
              <Sparkles className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                {aiModel.provider || 'Google Gemini'}
                <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                  GRATUITO
                </span>
              </h3>
              <p className="text-sm text-gray-600">
                Modelo: <span className="font-medium">{aiModel.model || 'gemini-2.5-flash'}</span>
                {' • '}
                Limite: <span className="font-medium">{aiModel.rate_limit || '15 requests/minute'}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {aiModel.configured ? (
              <span className="flex items-center gap-1 px-3 py-1 text-sm bg-green-100 text-green-700 rounded-full">
                <CheckCircle className="h-4 w-4" />
                Configurado
              </span>
            ) : (
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 px-3 py-1 text-sm bg-amber-100 text-amber-700 rounded-full hover:bg-amber-200 transition-colors"
              >
                <Info className="h-4 w-4" />
                Obter API Key Grátis
              </a>
            )}
          </div>
        </div>
        {!aiModel.configured && (
          <div className="mt-3 p-3 bg-white/70 rounded-lg text-sm text-gray-600">
            <p className="font-medium text-gray-800 mb-1">Como configurar:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Acesse <a href="https://aistudio.google.com/apikey" target="_blank" className="text-blue-600 hover:underline">aistudio.google.com/apikey</a></li>
              <li>Crie uma chave de API gratuita</li>
              <li>Adicione no arquivo <code className="px-1 py-0.5 bg-gray-100 rounded text-xs">.env</code>: <code className="px-1 py-0.5 bg-gray-100 rounded text-xs">GEMINI_API_KEY=sua_chave</code></li>
              <li>Reinicie o sistema</li>
            </ol>
          </div>
        )}
      </div>

      {/* General Configuration */}
      <div className="bg-white rounded-xl shadow-sm border">
        <div className="flex items-center justify-between p-4 border-b">
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
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Ativo em (Sessão WhatsApp)</label>
              <select
                value={formData.whatsapp_session_id || ''}
                onChange={(e) => setFormData({ ...formData, whatsapp_session_id: e.target.value || null })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
              >
                <option value="">Nenhuma (Desativado)</option>
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
            <div>
              <label className="block text-sm text-gray-600 mb-1">Notificar escalonamento humano por email</label>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.notify_human_escalation || false}
                  onChange={(e) => setFormData({ ...formData, notify_human_escalation: e.target.checked })}
                  className="rounded border-gray-300 text-emerald-500 focus:ring-emerald-500"
                />
                <input
                  type="email"
                  value={formData.notification_email || ''}
                  onChange={(e) => setFormData({ ...formData, notification_email: e.target.value })}
                  placeholder="email@exemplo.com"
                  className="flex-1 px-3 py-1.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Human Service Hours */}
          <div>
            <label className="block text-sm text-gray-600 mb-2">Períodos para atendimento humano</label>
            <p className="text-xs text-gray-500 mb-3">
              Sempre que seu contato precisar de atendimento humano, o chatbot irá fazer a transferência. Em horários fora dos períodos configurados, avisaremos seu contato que o atendimento pode demorar mais.
            </p>
            <div className="grid grid-cols-7 gap-2">
              {DAYS.map((day) => (
                <div key={day.key} className="text-center">
                  <div className="border rounded-lg p-3 hover:border-emerald-300 transition-colors cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.human_service_hours?.[day.key]?.enabled || false}
                      onChange={(e) => {
                        const hours = { ...formData.human_service_hours }
                        hours[day.key] = { ...hours[day.key], enabled: e.target.checked }
                        setFormData({ ...formData, human_service_hours: hours })
                      }}
                      className="mb-2 rounded border-gray-300 text-emerald-500 focus:ring-emerald-500"
                    />
                    <p className="font-medium text-gray-700 text-sm">{day.label}</p>
                    <p className="text-xs text-gray-400">Clique para definir o horário</p>
                  </div>
                </div>
              ))}
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
        <div className="flex items-center justify-between p-4 border-b">
          <div>
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

          {/* Instruction Fields */}
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
          <div className="flex gap-2">
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
              disabled={!testMessage.trim() || testChatMutation.isPending || !formData.is_active}
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
            <p className="text-sm text-amber-600">
              ⚠️ Ative o chatbot para testar as respostas.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
