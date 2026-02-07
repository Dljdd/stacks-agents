import React, { useState } from 'react'
import { LayoutDashboard, Users, Wallet, BarChart3, MessageSquare, UserCircle, ChevronLeft, ChevronRight } from 'lucide-react'
import WalletConnect from '@/components/WalletConnect'

const links = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'agents', label: 'Agents', icon: Users },
  { key: 'payments', label: 'Payments', icon: Wallet },
  { key: 'analytics', label: 'Analytics', icon: BarChart3 },
  { key: 'contacts', label: 'Contacts', icon: UserCircle },
  { key: 'chatbot', label: 'Chat', icon: MessageSquare },
]

export default function Sidebar({ activeTab, onSelect, onWidthChange }) {
  const [collapsed, setCollapsed] = useState(false)
  const expandedWidth = 240 // px
  const collapsedWidth = 72 // px

  React.useEffect(() => {
    onWidthChange?.(collapsed ? collapsedWidth : expandedWidth)
  }, [collapsed, onWidthChange])

  return (
    <aside
      className="fixed left-0 top-0 h-full z-50 transition-all duration-300 bg-slate-800/50 backdrop-blur-sm border-r border-slate-700/50"
      style={{
        width: collapsed ? `${collapsedWidth}px` : `${expandedWidth}px`,
      }}
    >
      <div className="h-16 flex items-center justify-between px-4 border-b border-slate-700/50">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-500/10">
            <LayoutDashboard className="w-5 h-5 text-blue-400" strokeWidth={1.5} />
          </div>
          {!collapsed && (
            <span className="font-semibold tracking-wide text-white">AgentPay</span>
          )}
        </div>
        <button
          onClick={() => setCollapsed(v => !v)}
          className="p-2 rounded-md transition-colors text-slate-400 hover:text-white hover:bg-slate-700/50"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      <nav className="py-4 space-y-1 px-3">
        {links.map(({ key, label, icon: Icon }) => {
          const active = activeTab === key
          return (
            <button
              key={key}
              onClick={() => onSelect(key)}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group ${
                active 
                  ? 'bg-blue-500/10 text-blue-400 shadow-lg shadow-blue-500/25' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <div className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all ${
                active 
                  ? 'bg-blue-500/20 text-blue-400' 
                  : 'bg-slate-700/50 text-slate-400 group-hover:bg-slate-600/50 group-hover:text-white'
              }`}>
                <Icon className="w-5 h-5" strokeWidth={1.5} />
              </div>
              {!collapsed && (
                <span className="text-sm font-medium truncate">
                  {label}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      {/* WalletConnect fixed in bottom-left of viewport */}
      <div className="fixed left-4 bottom-4 z-50">
        <WalletConnect />
      </div>
    </aside>
  )
}
