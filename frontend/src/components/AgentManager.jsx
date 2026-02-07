import React, { useState } from 'react'
import { Bot, Plus, Settings, Play, Pause, Trash2, DollarSign, Calendar, Activity, X } from 'lucide-react'

const AgentCard = ({ agent, onEdit, onToggle, onDelete }) => {
  const statusColors = {
    active: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-400' },
    paused: { bg: 'bg-orange-500/10', text: 'text-orange-400', dot: 'bg-orange-400' },
    inactive: { bg: 'bg-slate-500/10', text: 'text-slate-400', dot: 'bg-slate-400' }
  }

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 hover:bg-slate-800/70 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/10">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-500/10 rounded-xl">
            <Bot className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">{agent.name}</h3>
            <p className="text-slate-400 text-sm">{agent.description}</p>
          </div>
        </div>
        <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${statusColors[agent.status].bg}`}>
          <div className={`w-2 h-2 rounded-full ${statusColors[agent.status].dot}`}></div>
          <span className={`text-sm font-medium ${statusColors[agent.status].text}`}>
            {agent.status.charAt(0).toUpperCase() + agent.status.slice(1)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="text-center p-3 bg-slate-700/30 rounded-lg">
          <div className="flex items-center justify-center gap-1 text-slate-400 text-xs mb-1">
            <DollarSign className="w-3 h-3" />
            Balance
          </div>
          <p className="text-blue-400 font-semibold">{agent.balance}</p>
        </div>
        <div className="text-center p-3 bg-slate-700/30 rounded-lg">
          <div className="flex items-center justify-center gap-1 text-slate-400 text-xs mb-1">
            <Activity className="w-3 h-3" />
            Transactions
          </div>
          <p className="text-emerald-400 font-semibold">{agent.transactions}</p>
        </div>
        <div className="text-center p-3 bg-slate-700/30 rounded-lg">
          <div className="flex items-center justify-center gap-1 text-slate-400 text-xs mb-1">
            <Calendar className="w-3 h-3" />
            Created
          </div>
          <p className="text-slate-300 font-semibold">{agent.created}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => onToggle(agent.id)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
            agent.status === 'active' 
              ? 'bg-orange-500/10 text-orange-400 hover:bg-orange-500/20' 
              : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
          }`}
        >
          {agent.status === 'active' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          {agent.status === 'active' ? 'Pause' : 'Start'}
        </button>
        <button
          onClick={() => onEdit(agent)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-700/50 text-slate-300 hover:bg-slate-700 transition-colors"
        >
          <Settings className="w-4 h-4" />
          Configure
        </button>
        <button
          onClick={() => onDelete(agent.id)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors ml-auto"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

const CreateAgentModal = ({ isOpen, onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    spendingLimit: '',
    category: 'trading'
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit(formData)
    setFormData({ name: '', description: '', spendingLimit: '', category: 'trading' })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800/90 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">Create New Agent</h2>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Agent Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., Trading Bot v2"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="Describe what this agent does..."
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Spending Limit (STX) *</label>
            <input
              type="number"
              value={formData.spendingLimit}
              onChange={(e) => setFormData({ ...formData, spendingLimit: e.target.value })}
              className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="1000"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Category</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="trading">Trading</option>
              <option value="payments">Payment Processor</option>
              <option value="analytics">Analytics</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="flex gap-4 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 hover:text-white rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-blue-500/25 font-semibold"
            >
              Create Agent
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function AgentManager() {
  const [agents, setAgents] = useState([
    {
      id: 1,
      name: 'Trading Bot Alpha',
      description: 'Automated trading with risk management',
      status: 'active',
      balance: '2,450 STX',
      transactions: '127',
      created: 'Jan 15'
    },
    {
      id: 2,
      name: 'Payment Processor',
      description: 'Handles recurring payments and subscriptions',
      status: 'active',
      balance: '1,250 STX',
      transactions: '89',
      created: 'Jan 12'
    },
    {
      id: 3,
      name: 'Analytics Agent',
      description: 'Collects and processes transaction data',
      status: 'paused',
      balance: '0 STX',
      transactions: '0',
      created: 'Jan 10'
    }
  ])

  const [showCreateModal, setShowCreateModal] = useState(false)
  const totalBalance = '3,700 STX'

  const handleCreateAgent = (formData) => {
    const newAgent = {
      id: agents.length + 1,
      name: formData.name,
      description: formData.description,
      status: 'inactive',
      balance: '0 STX',
      transactions: '0',
      created: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }
    setAgents([...agents, newAgent])
    setShowCreateModal(false)
  }

  const handleToggleAgent = (id) => {
    setAgents(agents.map(agent => 
      agent.id === id 
        ? { ...agent, status: agent.status === 'active' ? 'paused' : 'active' }
        : agent
    ))
  }

  const handleDeleteAgent = (id) => {
    if (window.confirm('Are you sure you want to delete this agent?')) {
      setAgents(agents.filter(agent => agent.id !== id))
    }
  }

  const handleEditAgent = (agent) => {
    console.log('Edit agent:', agent)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Agent Manager</h1>
            <p className="text-slate-400">Create and manage your AI payment agents</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-blue-500/25 font-semibold"
          >
            <Plus size={18} strokeWidth={1.5} />
            Create Agent
          </button>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <Bot className="w-5 h-5 text-blue-400" />
              <span className="text-slate-400 text-sm font-medium">Total Agents</span>
            </div>
            <p className="text-2xl font-bold text-white">{agents.length}</p>
          </div>
          
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <Activity className="w-5 h-5 text-emerald-400" />
              <span className="text-slate-400 text-sm font-medium">Active Agents</span>
            </div>
            <p className="text-2xl font-bold text-emerald-400">{agents.filter(a => a.status === 'active').length}</p>
          </div>
          
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <DollarSign className="w-5 h-5 text-purple-400" />
              <span className="text-slate-400 text-sm font-medium">Total Balance</span>
            </div>
            <p className="text-2xl font-bold text-purple-400">{totalBalance}</p>
          </div>
        </div>

        {/* Agents Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {agents.map(agent => (
            <AgentCard
              key={agent.id}
              agent={agent}
              onEdit={handleEditAgent}
              onToggle={handleToggleAgent}
              onDelete={handleDeleteAgent}
            />
          ))}
        </div>

        {/* Create Agent Modal */}
        <CreateAgentModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateAgent}
        />
      </div>
    </div>
  )
}
