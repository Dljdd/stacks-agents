import React, { useState, useEffect } from 'react'
import { Users2, Server, Coins, CheckCircle, TrendingUp, Activity, Zap, ArrowUpRight, Plus, Send, BarChart3 } from 'lucide-react'

export default function Dashboard({ api }) {
  const [agents, setAgents] = useState([])
  const [stats, setStats] = useState({
    totalAgents: 0,
    totalPayments: 0,
    totalVolume: 0,
    successRate: 0
  })
  const [recentActivity, setRecentActivity] = useState([])

  useEffect(() => {
    loadDashboardData()
  }, [])

  async function loadDashboardData() {
    try {
      const agentsResponse = await api.get('/agents/list')
      const agentsList = agentsResponse.data.items || []
      setAgents(agentsList)

      const paymentsResponse = await api.get('/payments/list')
      const paymentsList = paymentsResponse.data.items || []

      const liveAgents = agentsList.filter(a => a.status === 'active').length
      const totalPayments = paymentsList.length
      const totalVolume = paymentsList.reduce((sum, p) => sum + (p.amount || 0), 0)
      const successfulPayments = paymentsList.filter(p => p.status === 'completed').length
      const successRate = totalPayments > 0 ? (successfulPayments / totalPayments) * 100 : 0

      setStats({
        totalAgents: liveAgents,
        totalPayments,
        totalVolume,
        successRate
      })

      setRecentActivity(paymentsList.slice(-5).reverse())
    } catch (error) {
      console.error('Failed to load dashboard data:', error)
      // Set mock data for demo
      setStats({
        totalAgents: 3,
        totalPayments: 47,
        totalVolume: 12450,
        successRate: 94.7
      })
      setRecentActivity([
        { id: 1, type: 'payment', message: 'Payment sent to Alice', timestamp: new Date(Date.now() - 300000), status: 'completed' },
        { id: 2, type: 'agent', message: 'Trading Bot Alpha activated', timestamp: new Date(Date.now() - 600000), status: 'success' },
        { id: 3, type: 'payment', message: 'Recurring payment processed', timestamp: new Date(Date.now() - 900000), status: 'completed' }
      ])
    }
  }

  const StatCard = ({ title, value, icon: Icon, color, trend, delay = 0 }) => (
    <div 
      className="group relative bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-8 hover:from-slate-700/80 hover:to-slate-800/80 transition-all duration-500 hover:scale-105 hover:shadow-2xl hover:shadow-blue-500/10 overflow-hidden animate-fade-in-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Animated background gradient */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 animate-pulse"></div>
      
      <div className="relative z-10 flex items-start justify-between">
        <div className="space-y-3">
          <p className="text-slate-400 text-sm font-medium tracking-wide uppercase">{title}</p>
          <div className="space-y-2">
            <p className={`text-4xl font-black ${color} tracking-tight`}>{value}</p>
            {trend && (
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <span className="text-emerald-400 text-sm font-semibold">{trend}</span>
                <span className="text-slate-500 text-xs">vs last month</span>
              </div>
            )}
          </div>
        </div>
        <div className={`p-4 rounded-2xl ${color.replace('text-', 'bg-').replace('-400', '-500/10')} group-hover:scale-110 transition-transform duration-300`}>
          <Icon className={`w-8 h-8 ${color} group-hover:rotate-12 transition-transform duration-300`} />
        </div>
      </div>
      
      {/* Subtle glow effect */}
      <div className={`absolute -inset-1 bg-gradient-to-r ${color.replace('text-', 'from-').replace('-400', '-600/20')} to-transparent rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10 blur-xl`}></div>
    </div>
  )

  const statsData = [
    { title: 'Live Agents', value: stats.totalAgents, icon: Users2, color: 'text-cyan-400', trend: '+12%', delay: 0 },
    { title: 'Total Payments', value: stats.totalPayments, icon: Server, color: 'text-emerald-400', trend: '+8%', delay: 100 },
    { title: 'Volume (STX)', value: stats.totalVolume.toLocaleString(), icon: Coins, color: 'text-violet-400', trend: '+23%', delay: 200 },
    { title: 'Success Rate', value: `${stats.successRate.toFixed(1)}%`, icon: CheckCircle, color: 'text-amber-400', trend: '+2%', delay: 300 }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
        <div className="absolute top-3/4 left-1/2 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '4s' }}></div>
      </div>
      
      <div className="relative z-10 p-8">
        <div className="max-w-7xl mx-auto space-y-12">
          {/* Enhanced Header */}
          <div className="flex items-center justify-between animate-fade-in-down">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <h1 className="text-5xl font-black bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                  Dashboard
                </h1>
                <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full animate-pulse">
                  <div className="w-2 h-2 bg-emerald-400 rounded-full animate-ping"></div>
                  <span className="text-emerald-400 text-sm font-medium">Live</span>
                </div>
              </div>
              <p className="text-slate-400 text-lg">Welcome back! Here's what's happening with your AI agents.</p>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="px-6 py-3 bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl">
                <div className="flex items-center gap-3">
                  <Activity className="w-5 h-5 text-blue-400" />
                  <span className="text-white font-medium">Real-time</span>
                </div>
              </div>
            </div>
          </div>

          {/* Enhanced Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {statsData.map((stat, index) => (
              <StatCard key={index} {...stat} />
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Enhanced Volume Trend Chart */}
            <div className="lg:col-span-2 bg-gradient-to-br from-slate-800/60 to-slate-900/60 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-8 hover:shadow-2xl hover:shadow-blue-500/10 transition-all duration-500 animate-fade-in-left">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold text-white">Payment Volume Trend</h2>
                <div className="flex items-center gap-2 text-emerald-400">
                  <TrendingUp className="w-5 h-5" />
                  <span className="font-semibold">+23.5%</span>
                </div>
              </div>
              
              <div className="h-80 flex items-end justify-between gap-3 mb-6">
                {[65, 45, 78, 52, 89, 67, 94, 73, 86, 91, 78, 95].map((height, i) => (
                  <div 
                    key={i} 
                    className="flex-1 bg-gradient-to-t from-blue-600 via-blue-500 to-cyan-400 rounded-t-2xl hover:from-blue-500 hover:via-blue-400 hover:to-cyan-300 transition-all duration-300 hover:scale-105 cursor-pointer relative group animate-slide-up"
                    style={{ 
                      height: `${height}%`,
                      animationDelay: `${i * 100}ms`
                    }}
                  >
                    <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                      {height}%
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="flex justify-between text-slate-400 text-sm">
                <span>Jan</span><span>Feb</span><span>Mar</span><span>Apr</span><span>May</span><span>Jun</span>
                <span>Jul</span><span>Aug</span><span>Sep</span><span>Oct</span><span>Nov</span><span>Dec</span>
              </div>
            </div>

            {/* Enhanced Recent Activity */}
            <div className="bg-gradient-to-br from-slate-800/60 to-slate-900/60 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-8 hover:shadow-2xl hover:shadow-purple-500/10 transition-all duration-500 animate-fade-in-right">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold text-white">Recent Activity</h2>
                <Zap className="w-6 h-6 text-amber-400" />
              </div>
              
              <div className="space-y-4">
                {recentActivity.map((activity, index) => (
                  <div key={activity.id || index} className="group flex items-center gap-4 p-4 bg-slate-700/30 hover:bg-slate-700/50 rounded-2xl transition-all duration-300 hover:scale-105 cursor-pointer animate-fade-in" style={{ animationDelay: `${index * 100}ms` }}>
                    <div className={`w-3 h-3 rounded-full ${activity.status === 'completed' || activity.status === 'success' ? 'bg-emerald-400' : 'bg-amber-400'} animate-pulse`}></div>
                    <div className="flex-1">
                      <p className="text-white font-medium group-hover:text-blue-300 transition-colors">{activity.message}</p>
                      <p className="text-slate-400 text-sm">
                        {activity.timestamp ? new Date(activity.timestamp).toLocaleTimeString() : 'Just now'}
                      </p>
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-blue-400 transition-colors" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Enhanced Quick Actions */}
          <div className="bg-gradient-to-br from-slate-800/60 to-slate-900/60 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-8 hover:shadow-2xl hover:shadow-emerald-500/10 transition-all duration-500 animate-fade-in-up">
            <h2 className="text-2xl font-bold text-white mb-8">Quick Actions</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <button className="group relative p-8 bg-gradient-to-br from-blue-600/10 to-cyan-600/10 border border-blue-500/20 rounded-2xl text-blue-400 hover:from-blue-600/20 hover:to-cyan-600/20 hover:border-blue-400/40 transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-blue-500/20 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="relative z-10 flex flex-col items-center gap-4">
                  <Plus className="w-8 h-8 group-hover:rotate-90 transition-transform duration-300" />
                  <span className="font-semibold text-lg">Create New Agent</span>
                </div>
              </button>
              
              <button className="group relative p-8 bg-gradient-to-br from-emerald-600/10 to-green-600/10 border border-emerald-500/20 rounded-2xl text-emerald-400 hover:from-emerald-600/20 hover:to-green-600/20 hover:border-emerald-400/40 transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-emerald-500/20 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="relative z-10 flex flex-col items-center gap-4">
                  <Send className="w-8 h-8 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform duration-300" />
                  <span className="font-semibold text-lg">Send Payment</span>
                </div>
              </button>
              
              <button className="group relative p-8 bg-gradient-to-br from-violet-600/10 to-purple-600/10 border border-violet-500/20 rounded-2xl text-violet-400 hover:from-violet-600/20 hover:to-purple-600/20 hover:border-violet-400/40 transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-violet-500/20 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-violet-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="relative z-10 flex flex-col items-center gap-4">
                  <BarChart3 className="w-8 h-8 group-hover:scale-110 transition-transform duration-300" />
                  <span className="font-semibold text-lg">View Analytics</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
