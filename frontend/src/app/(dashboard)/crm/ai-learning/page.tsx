'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Brain,
  Lightbulb,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  FileText,
  TrendingUp,
  CheckCircle,
  XCircle,
  Plus,
  Trash2,
  Edit,
  Search,
  RefreshCw,
  BarChart3,
  Sparkles,
  BookOpen,
  Target,
  Clock,
  Award,
  Filter,
  Eye,
  Check
} from 'lucide-react'
import { aiLearningApi } from '@/lib/api'

type TabType = 'overview' | 'memories' | 'faq' | 'feedback' | 'patterns'

export default function AILearningPage() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [searchTerm, setSearchTerm] = useState('')
  const [memoryFilter, setMemoryFilter] = useState<string>('')
  const [feedbackFilter, setFeedbackFilter] = useState<string>('')
  
  // Modal states
  const [showAddMemory, setShowAddMemory] = useState(false)
  const [newMemory, setNewMemory] = useState({ key: '', value: '', type: 'fact', category: '' })

  // Fetch stats
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['ai-learning-stats'],
    queryFn: async () => {
      const response = await aiLearningApi.stats()
      return response.data.data
    },
  })

  // Fetch memories
  const { data: memoriesData, isLoading: memoriesLoading } = useQuery({
    queryKey: ['ai-memories', memoryFilter],
    queryFn: async () => {
      const response = await aiLearningApi.memories({ type: memoryFilter || undefined, limit: 100 })
      return response.data.data
    },
    enabled: activeTab === 'memories' || activeTab === 'overview',
  })

  // Fetch FAQ
  const { data: faqData, isLoading: faqLoading } = useQuery({
    queryKey: ['ai-faq'],
    queryFn: async () => {
      const response = await aiLearningApi.faq({ limit: 100 })
      return response.data.data
    },
    enabled: activeTab === 'faq' || activeTab === 'overview',
  })

  // Fetch feedback
  const { data: feedbackData, isLoading: feedbackLoading } = useQuery({
    queryKey: ['ai-feedback', feedbackFilter],
    queryFn: async () => {
      const response = await aiLearningApi.feedbackHistory({ rating: feedbackFilter || undefined, limit: 100 })
      return response.data.data
    },
    enabled: activeTab === 'feedback',
  })

  // Fetch patterns
  const { data: patternsData, isLoading: patternsLoading } = useQuery({
    queryKey: ['ai-patterns'],
    queryFn: async () => {
      const response = await aiLearningApi.patterns({ limit: 100 })
      return response.data.data
    },
    enabled: activeTab === 'patterns',
  })

  // Mutations
  const addMemoryMutation = useMutation({
    mutationFn: (data: typeof newMemory) => aiLearningApi.addMemory(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-memories'] })
      queryClient.invalidateQueries({ queryKey: ['ai-learning-stats'] })
      setShowAddMemory(false)
      setNewMemory({ key: '', value: '', type: 'fact', category: '' })
    },
  })

  const deleteMemoryMutation = useMutation({
    mutationFn: (id: string) => aiLearningApi.deleteMemory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-memories'] })
      queryClient.invalidateQueries({ queryKey: ['ai-learning-stats'] })
    },
  })

  const verifyFaqMutation = useMutation({
    mutationFn: (id: string) => aiLearningApi.verifyFaq(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-faq'] })
    },
  })

  const processFeedbackMutation = useMutation({
    mutationFn: () => aiLearningApi.processFeedback(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-learning-stats'] })
      queryClient.invalidateQueries({ queryKey: ['ai-feedback'] })
    },
  })

  const stats = statsData || { memories: {}, feedback: {}, faq: {}, patterns: {}, insights: {} }
  const memories = memoriesData || []
  const faqs = faqData || []
  const feedback = feedbackData || []
  const patterns = patternsData || []

  const getKeywords = (value: unknown): string[] => {
    if (Array.isArray(value)) return value.filter(Boolean).map(String)
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value)
        if (Array.isArray(parsed)) return parsed.filter(Boolean).map(String)
      } catch {
        // Not JSON, treat as single keyword string
      }
      return value.trim() ? [value.trim()] : []
    }
    return []
  }

  const tabs = [
    { id: 'overview', label: 'Visão Geral', icon: BarChart3 },
    { id: 'memories', label: 'Memórias', icon: Brain },
    { id: 'faq', label: 'FAQ Aprendido', icon: BookOpen },
    { id: 'feedback', label: 'Feedback', icon: MessageSquare },
    { id: 'patterns', label: 'Padrões', icon: Target },
  ]

  const memoryTypes = [
    { value: '', label: 'Todos' },
    { value: 'fact', label: 'Fatos' },
    { value: 'correction', label: 'Correções' },
    { value: 'preference', label: 'Preferências' },
    { value: 'policy', label: 'Políticas' },
    { value: 'product', label: 'Produtos' },
    { value: 'service', label: 'Serviços' },
  ]

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl">
            <Brain className="h-7 w-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Aprendizado da IA</h1>
            <p className="text-sm text-gray-500">Gerencie o conhecimento e evolução da sua IA</p>
          </div>
        </div>
        <button
          onClick={() => setShowAddMemory(true)}
          className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Adicionar Memória
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <Brain className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Memórias</p>
              <p className="text-2xl font-bold text-gray-800 dark:text-white">
                {stats.memories?.total || 0}
              </p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs">
            <span className="text-green-500">{stats.memories?.verified || 0} verificadas</span>
            <span className="text-gray-400">•</span>
            <span className="text-gray-500">
              {Math.round((stats.memories?.avg_confidence || 0) * 100)}% confiança
            </span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <BookOpen className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">FAQ Aprendido</p>
              <p className="text-2xl font-bold text-gray-800 dark:text-white">
                {stats.faq?.total || 0}
              </p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs">
            <span className="text-green-500">{stats.faq?.verified || 0} verificadas</span>
            <span className="text-gray-400">•</span>
            <span className="text-gray-500">
              {Math.round((stats.faq?.avg_helpfulness || 0) * 100)}% úteis
            </span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <ThumbsUp className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Taxa de Satisfação</p>
              <p className="text-2xl font-bold text-gray-800 dark:text-white">
                {stats.insights?.satisfaction_rate || 'N/A'}
              </p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs">
            <span className="text-green-500">{stats.feedback?.positive || 0} positivos</span>
            <span className="text-gray-400">•</span>
            <span className="text-red-500">{stats.feedback?.negative || 0} negativos</span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
              <Target className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Padrões Ativos</p>
              <p className="text-2xl font-bold text-gray-800 dark:text-white">
                {stats.patterns?.active || 0}
              </p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs">
            <span className="text-gray-500">
              {Math.round((stats.patterns?.avg_success_rate || 0) * 100)}% taxa de sucesso
            </span>
          </div>
        </motion.div>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === tab.id
                  ? 'text-purple-600 border-purple-600 dark:text-purple-400 dark:border-purple-400'
                  : 'text-gray-500 border-transparent hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Learning Progress */}
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl p-6 border border-purple-200 dark:border-purple-800">
                <h3 className="font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                  <Award className="h-5 w-5 text-purple-500" />
                  Progresso do Aprendizado
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Conhecimento Total</p>
                    <p className="text-3xl font-bold text-purple-600">
                      {stats.insights?.learning_progress?.total_knowledge || 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Conhecimento Verificado</p>
                    <p className="text-3xl font-bold text-green-600">
                      {stats.insights?.learning_progress?.verified_knowledge || 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Confiança Média</p>
                    <p className="text-3xl font-bold text-blue-600">
                      {stats.insights?.learning_progress?.avg_confidence || '0%'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Top Questions */}
              {stats.insights?.top_questions?.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-blue-500" />
                    Perguntas Mais Frequentes
                  </h3>
                  <div className="space-y-2">
                    {stats.insights.top_questions.map((q: any, i: number) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                      >
                        <span className="text-gray-700 dark:text-gray-300 text-sm">{q.question}</span>
                        <span className="text-gray-500 text-xs">{q.times_asked}x</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent Memories */}
              <div>
                <h3 className="font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                  <Brain className="h-5 w-5 text-purple-500" />
                  Memórias Recentes
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {memories.slice(0, 4).map((memory: any) => (
                    <div
                      key={memory.id}
                      className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="text-xs px-2 py-1 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
                            {memory.type}
                          </span>
                          <p className="mt-2 font-medium text-gray-800 dark:text-white text-sm">{memory.key}</p>
                          <p className="text-gray-600 dark:text-gray-400 text-xs mt-1">{memory.value}</p>
                        </div>
                        <span className="text-xs text-gray-500">
                          {Math.round(memory.confidence_score * 100)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Memories Tab */}
          {activeTab === 'memories' && (
            <div className="space-y-4">
              {/* Filters */}
              <div className="flex items-center gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Buscar memórias..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:border-gray-600"
                  />
                </div>
                <select
                  value={memoryFilter}
                  onChange={(e) => setMemoryFilter(e.target.value)}
                  className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:border-gray-600"
                >
                  {memoryTypes.map((type) => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>

              {/* Memories List */}
              {memoriesLoading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="h-6 w-6 animate-spin text-purple-500" />
                </div>
              ) : memories.length === 0 ? (
                <div className="text-center py-12">
                  <Brain className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-500">Nenhuma memória encontrada</p>
                  <p className="text-sm text-gray-400">A IA aprenderá à medida que interagir com usuários</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {memories
                    .filter((m: any) =>
                      !searchTerm ||
                      m.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      m.value.toLowerCase().includes(searchTerm.toLowerCase())
                    )
                    .map((memory: any) => (
                      <motion.div
                        key={memory.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-xs px-2 py-1 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
                                {memory.type}
                              </span>
                              {memory.category && (
                                <span className="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300">
                                  {memory.category}
                                </span>
                              )}
                              {memory.is_verified && (
                                <CheckCircle className="h-4 w-4 text-green-500" />
                              )}
                            </div>
                            <p className="font-medium text-gray-800 dark:text-white">{memory.key}</p>
                            <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">{memory.value}</p>
                            <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                              <span>Usado {memory.usage_count}x</span>
                              <span>Confiança: {Math.round(memory.confidence_score * 100)}%</span>
                              <span>Fonte: {memory.source}</span>
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              if (confirm('Excluir esta memória?')) {
                                deleteMemoryMutation.mutate(memory.id)
                              }
                            }}
                            className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </motion.div>
                    ))}
                </div>
              )}
            </div>
          )}

          {/* FAQ Tab */}
          {activeTab === 'faq' && (
            <div className="space-y-4">
              {faqLoading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="h-6 w-6 animate-spin text-purple-500" />
                </div>
              ) : faqs.length === 0 ? (
                <div className="text-center py-12">
                  <BookOpen className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-500">Nenhuma FAQ aprendida ainda</p>
                  <p className="text-sm text-gray-400">FAQs são geradas automaticamente de conversas bem-sucedidas</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {faqs.map((faq: any) => (
                    <motion.div
                      key={faq.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            {faq.is_verified ? (
                              <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400">
                                <CheckCircle className="h-3 w-3" />
                                Verificada
                              </span>
                            ) : (
                              <span className="text-xs px-2 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
                                Pendente
                              </span>
                            )}
                            <span className="text-xs text-gray-500">
                              {Math.round(faq.helpfulness_score * 100)}% útil
                            </span>
                          </div>
                          <p className="font-medium text-gray-800 dark:text-white">
                            <span className="text-blue-500">P:</span> {faq.question}
                          </p>
                          <p className="text-gray-600 dark:text-gray-400 text-sm mt-2">
                            <span className="text-green-500">R:</span> {faq.answer}
                          </p>
                          <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                            <span>Perguntado {faq.times_asked}x</span>
                            <span>Útil {faq.times_helpful}x</span>
                          </div>
                        </div>
                        {!faq.is_verified && (
                          <button
                            onClick={() => verifyFaqMutation.mutate(faq.id)}
                            className="p-2 text-gray-400 hover:text-green-500 transition-colors"
                            title="Verificar FAQ"
                          >
                            <Check className="h-5 w-5" />
                          </button>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Feedback Tab */}
          {activeTab === 'feedback' && (
            <div className="space-y-4">
              {/* Actions */}
              <div className="flex items-center justify-between">
                <select
                  value={feedbackFilter}
                  onChange={(e) => setFeedbackFilter(e.target.value)}
                  className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:border-gray-600"
                >
                  <option value="">Todos</option>
                  <option value="positive">Positivos</option>
                  <option value="negative">Negativos</option>
                  <option value="neutral">Neutros</option>
                </select>
                <button
                  onClick={() => processFeedbackMutation.mutate()}
                  disabled={processFeedbackMutation.isPending}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50"
                >
                  <RefreshCw className={`h-4 w-4 ${processFeedbackMutation.isPending ? 'animate-spin' : ''}`} />
                  Processar Feedback
                </button>
              </div>

              {feedbackLoading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="h-6 w-6 animate-spin text-purple-500" />
                </div>
              ) : feedback.length === 0 ? (
                <div className="text-center py-12">
                  <MessageSquare className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-500">Nenhum feedback registrado</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {feedback.map((item: any) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600"
                    >
                      <div className="flex items-start gap-3">
                        {item.rating === 'positive' ? (
                          <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                            <ThumbsUp className="h-4 w-4 text-green-500" />
                          </div>
                        ) : item.rating === 'negative' ? (
                          <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                            <ThumbsDown className="h-4 w-4 text-red-500" />
                          </div>
                        ) : (
                          <div className="p-2 bg-gray-100 dark:bg-gray-600 rounded-lg">
                            <MessageSquare className="h-4 w-4 text-gray-500" />
                          </div>
                        )}
                        <div className="flex-1">
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            <span className="font-medium text-gray-800 dark:text-white">Usuário:</span> {item.user_message}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            <span className="font-medium text-gray-800 dark:text-white">IA:</span> {item.ai_response}
                          </p>
                          {item.correction && (
                            <p className="text-sm text-amber-600 mt-2">
                              <span className="font-medium">Correção:</span> {item.correction}
                            </p>
                          )}
                          <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                            <span>{item.feature}</span>
                            <span>{item.processed ? 'Processado' : 'Pendente'}</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Patterns Tab */}
          {activeTab === 'patterns' && (
            <div className="space-y-4">
              {patternsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="h-6 w-6 animate-spin text-purple-500" />
                </div>
              ) : patterns.length === 0 ? (
                <div className="text-center py-12">
                  <Target className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-500">Nenhum padrão aprendido ainda</p>
                  <p className="text-sm text-gray-400">Padrões são identificados automaticamente de respostas bem-sucedidas</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {patterns.map((pattern: any) => (
                    <motion.div
                      key={pattern.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs px-2 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
                              {pattern.intent}
                            </span>
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              pattern.success_rate >= 0.7
                                ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                                : pattern.success_rate >= 0.5
                                ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'
                                : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                            }`}>
                              {Math.round(pattern.success_rate * 100)}% sucesso
                            </span>
                          </div>
                          <p className="font-medium text-gray-800 dark:text-white text-sm">
                            Keywords: {getKeywords(pattern.trigger_keywords).join(', ') || '-'}
                          </p>
                          <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
                            {pattern.response_template}
                          </p>
                          <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                            <span>Usado {pattern.times_used}x</span>
                            <span>Sucesso {pattern.times_successful}x</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Add Memory Modal */}
      <AnimatePresence>
        {showAddMemory && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setShowAddMemory(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                  <Brain className="h-5 w-5 text-purple-500" />
                  Adicionar Memória
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Ensine manualmente à IA um novo conhecimento
                </p>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Tipo
                  </label>
                  <select
                    value={newMemory.type}
                    onChange={(e) => setNewMemory({ ...newMemory, type: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:border-gray-600"
                  >
                    <option value="fact">Fato</option>
                    <option value="preference">Preferência</option>
                    <option value="policy">Política</option>
                    <option value="product">Produto</option>
                    <option value="service">Serviço</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Categoria (opcional)
                  </label>
                  <input
                    type="text"
                    value={newMemory.category}
                    onChange={(e) => setNewMemory({ ...newMemory, category: e.target.value })}
                    placeholder="Ex: preços, horários, produtos..."
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:border-gray-600"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Chave / Pergunta
                  </label>
                  <input
                    type="text"
                    value={newMemory.key}
                    onChange={(e) => setNewMemory({ ...newMemory, key: e.target.value })}
                    placeholder="Ex: Qual o horário de funcionamento?"
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:border-gray-600"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Valor / Resposta
                  </label>
                  <textarea
                    value={newMemory.value}
                    onChange={(e) => setNewMemory({ ...newMemory, value: e.target.value })}
                    rows={3}
                    placeholder="Ex: Funcionamos de segunda a sexta, das 9h às 18h."
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:border-gray-600 resize-none"
                  />
                </div>
              </div>

              <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex gap-3">
                <button
                  onClick={() => setShowAddMemory(false)}
                  className="flex-1 py-2 px-4 border rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => addMemoryMutation.mutate(newMemory)}
                  disabled={!newMemory.key || !newMemory.value || addMemoryMutation.isPending}
                  className="flex-1 py-2 px-4 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {addMemoryMutation.isPending ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  Adicionar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
