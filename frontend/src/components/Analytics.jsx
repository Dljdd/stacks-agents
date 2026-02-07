import React, { useState } from 'react'
import { BarChart3, TrendingUp, Users, Zap, DollarSign, CheckCircle, Calendar, Activity, Target, ArrowUpRight, ArrowDownRight } from 'lucide-react'

const MetricCard = ({ title, value, change, changeType, icon: Icon, color }) => (
  <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 hover:bg-slate-800/70 transition-all duration-300">
    <div className="flex items-center justify-between mb-4">
      <div className={`p-3 rounded-xl ${color.bg}`}>
        <Icon className={`w-6 h-6 ${color.text}`} />
      </div>
      {change && (
        <div className={`flex items-center gap-1 px-2 py-1 rounded-lg ${changeType === 'positive' ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
          {changeType === 'positive' ? (
            <ArrowUpRight className="w-3 h-3 text-emerald-400" />
          ) : (
            <ArrowDownRight className="w-3 h-3 text-red-400" />
          )}
          <span className={`text-xs font-medium ${changeType === 'positive' ? 'text-emerald-400' : 'text-red-400'}`}>
            {change}
          </span>
        </div>
      )}
    </div>
    <div>
      <p className="text-slate-400 text-sm font-medium mb-1">{title}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  </div>
)

const ChartBar = ({ value, maxValue, label, color = 'bg-blue-500' }) => (
  <div className="flex flex-col items-center space-y-2">
    <div className="w-8 bg-slate-700/50 rounded-lg overflow-hidden h-32 flex items-end">
      <div 
        className={`w-full ${color} rounded-t-lg transition-all duration-500 ease-out`}
        style={{ height: `${(value / maxValue) * 100}%` }}
      />
    </div>
    <span className="text-xs text-slate-400 text-center">{label}</span>
  </div>
)

const AgentPerformanceCard = ({ agent }) => (
  <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-4 hover:bg-slate-800/70 transition-all duration-300">
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-purple-500/10 rounded-lg">
          <Users className="w-4 h-4 text-purple-400" />
        </div>
        <div>
          <p className="text-white font-semibold">{agent.name}</p>
          <p className="text-slate-400 text-sm">{agent.category}</p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-emerald-400 font-semibold">{agent.successRate}%</p>
        <p className="text-slate-400 text-xs">Success Rate</p>
      </div>
    </div>
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-400">Volume</span>
      <span className="text-white font-medium">{agent.volume} STX</span>
    </div>
  </div>
)

export default function Analytics() {
  const [timeframe, setTimeframe] = useState('7d')
  
  const [analyticsData] = useState({
    metrics: {
      totalVolume: 45750.25,
      totalTransactions: 1247,
      activeAgents: 8,
      successRate: 97.3,
      avgTransactionSize: 36.7
    },
    changes: {
      volume: '+12.5%',
      transactions: '+8.3%', 
      agents: '+2',
      successRate: '+0.8%'
    },
    volumeTrend: [
      { date: 'Mon', value: 8500 },
      { date: 'Tue', value: 7200 },
      { date: 'Wed', value: 9800 },
      { date: 'Thu', value: 6400 },
      { date: 'Fri', value: 8900 },
      { date: 'Sat', value: 5100 },
      { date: 'Sun', value: 7300 }
    ],
    categoryBreakdown: [
      { name: 'Infrastructure', amount: 18500, percentage: 40.4, color: 'bg-blue-500' },
      { name: 'Services', amount: 13750, percentage: 30.1, color: 'bg-emerald-500' },
      { name: 'Utilities', amount: 9200, percentage: 20.1, color: 'bg-purple-500' },
      { name: 'Other', amount: 4300, percentage: 9.4, color: 'bg-orange-500' }
    ],
    topAgents: [
      { name: 'Infrastructure Bot', category: 'Hosting', successRate: 99.2, volume: '12,450' },
      { name: 'Payment Processor', category: 'Services', successRate: 98.7, volume: '8,920' },
      { name: 'Utility Manager', category: 'Utilities', successRate: 96.8, volume: '6,340' },
      { name: 'Backup Agent', category: 'Storage', successRate: 95.4, volume: '4,180' }
    ]
  })

  const maxTrendValue = Math.max(...analyticsData.volumeTrend.map(d => d.value))

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Analytics Dashboard</h1>
            <p className="text-slate-400">Track performance metrics and spending patterns</p>
          </div>
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-slate-400" />
            <select 
              value={timeframe} 
              onChange={(e) => setTimeframe(e.target.value)}
              className="bg-slate-800/50 border border-slate-700/50 rounded-xl px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
            </select>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          <MetricCard
            title="Total Volume"
            value={`${analyticsData.metrics.totalVolume.toLocaleString()} STX`}
            change={analyticsData.changes.volume}
            changeType="positive"
            icon={DollarSign}
            color={{ bg: 'bg-emerald-500/10', text: 'text-emerald-400' }}
          />
          <MetricCard
            title="Transactions"
            value={analyticsData.metrics.totalTransactions.toLocaleString()}
            change={analyticsData.changes.transactions}
            changeType="positive"
            icon={Activity}
            color={{ bg: 'bg-blue-500/10', text: 'text-blue-400' }}
          />
          <MetricCard
            title="Active Agents"
            value={analyticsData.metrics.activeAgents}
            change={analyticsData.changes.agents}
            changeType="positive"
            icon={Users}
            color={{ bg: 'bg-purple-500/10', text: 'text-purple-400' }}
          />
          <MetricCard
            title="Success Rate"
            value={`${analyticsData.metrics.successRate}%`}
            change={analyticsData.changes.successRate}
            changeType="positive"
            icon={CheckCircle}
            color={{ bg: 'bg-emerald-500/10', text: 'text-emerald-400' }}
          />
          <MetricCard
            title="Avg Transaction"
            value={`${analyticsData.metrics.avgTransactionSize} STX`}
            icon={Target}
            color={{ bg: 'bg-orange-500/10', text: 'text-orange-400' }}
          />
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Volume Trend Chart */}
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <TrendingUp className="w-5 h-5 text-blue-400" />
              </div>
              <h2 className="text-xl font-semibold text-white">Volume Trend</h2>
            </div>
            
            <div className="flex items-end justify-between gap-4 h-40 mb-4">
              {analyticsData.volumeTrend.map((data, index) => (
                <ChartBar
                  key={index}
                  value={data.value}
                  maxValue={maxTrendValue}
                  label={data.date}
                  color="bg-gradient-to-t from-blue-600 to-blue-400"
                />
              ))}
            </div>
            
            <div className="text-center">
              <p className="text-slate-400 text-sm">Daily transaction volume over the past week</p>
            </div>
          </div>

          {/* Category Breakdown */}
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-emerald-500/10 rounded-lg">
                <BarChart3 className="w-5 h-5 text-emerald-400" />
              </div>
              <h2 className="text-xl font-semibold text-white">Spending by Category</h2>
            </div>
            
            <div className="space-y-4">
              {analyticsData.categoryBreakdown.map((category, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300 font-medium">{category.name}</span>
                    <div className="text-right">
                      <span className="text-white font-semibold">{category.amount.toLocaleString()} STX</span>
                      <span className="text-slate-400 text-sm ml-2">({category.percentage}%)</span>
                    </div>
                  </div>
                  <div className="w-full bg-slate-700/50 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${category.color} transition-all duration-500`}
                      style={{ width: `${category.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Agent Performance */}
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <Zap className="w-5 h-5 text-purple-400" />
            </div>
            <h2 className="text-xl font-semibold text-white">Top Performing Agents</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {analyticsData.topAgents.map((agent, index) => (
              <AgentPerformanceCard key={index} agent={agent} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
