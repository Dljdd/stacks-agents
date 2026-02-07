import React, { useEffect, useState } from 'react'
import { Outlet, NavLink } from 'react-router-dom'
import { useConnect } from '@stacks/connect-react'
import { showConnect } from '@stacks/connect'
import { 
  LayoutDashboard, 
  CreditCard, 
  Code2, 
  Settings, 
  Wallet,
  LogOut,
  Home,
  ShoppingBag,
  Users,
  Link as LinkIcon,
  Box,
  Wrench,
  BookOpen,
  TestTube,
  Sun,
  Moon,
  Send,
  Loader2,
  MessageCircle,
  RefreshCw
} from 'lucide-react'
import ChatWindow from './ChatWindow'

function Layout() {
  const { userSession } = useConnect()
  const isSignedIn = userSession?.isUserSignedIn()
  const userData = isSignedIn ? userSession.loadUserData() : null
  const [rpcConnected, setRpcConnected] = useState(false)
  const [rpcAddress, setRpcAddress] = useState('')
  const [theme, setTheme] = useState('dark')
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [chatReply, setChatReply] = useState(null)
  const [chatFocused, setChatFocused] = useState(false)
  const [isChatOpen, setIsChatOpen] = useState(false)

  useEffect(() => {
    // Only reflect prior connection flag; do not call provider on mount
    if (localStorage.getItem('leatherConnected') === '1') setRpcConnected(true)
  }, [])

  // Initialize rpcAddress from localStorage (if present) to show in UI immediately
  useEffect(() => {
    try {
      const savedAddr = localStorage.getItem('stxAddress') || ''
      if (savedAddr) {
        console.log('[DEBUG] Loaded STX address from localStorage:', savedAddr)
        setRpcAddress(savedAddr)
      }
    } catch {}
  }, [])

  // Initialize theme on mount
  useEffect(() => {
    const saved = localStorage.getItem('theme')
    const preferredDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    const initial = saved || (preferredDark ? 'dark' : 'light')
    setTheme(initial)
  }, [])

  // Apply theme to root
  useEffect(() => {
    if (!theme) return
    try {
      document.documentElement.setAttribute('data-theme', theme)
      localStorage.setItem('theme', theme)
    } catch {}
  }, [theme])

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))

  const isConnected = isSignedIn || rpcConnected

  const handleSignIn = () => {
    try {
      const provider = window?.LeatherProvider
      if (provider?.request) {
        console.log('[DEBUG] Layout.handleSignIn: using LeatherProvider.request(getAddresses)')
        provider
          .request('getAddresses')
          .then((res) => {
            console.log('[DEBUG] Leather getAddresses result:', res)
            // Persist minimal flag so UI reflects connected state
            localStorage.setItem('leatherConnected', '1')
            const addr =
              res?.addresses?.stacks?.testnet?.[0]?.address ||
              res?.addresses?.stacks?.mainnet?.[0]?.address ||
              res?.stacks?.testnet?.[0]?.address ||
              res?.stacks?.mainnet?.[0]?.address ||
              res?.addresses?.[0]?.address || ''
            setRpcConnected(true)
            if (addr) {
              setRpcAddress(addr)
              console.log('[DEBUG] STX address (Leather):', addr)
              try { localStorage.setItem('stxAddress', addr) } catch {}
            }
          })
          .catch((err) => {
            console.log('[DEBUG] Leather getAddresses error:', err)
            // Fallback to stacks.js connect modal
            showConnect({
              userSession,
              appDetails: { name: 'StacksPay', icon: '/logo.png' },
              redirectTo: window.location.href,
              onFinish: () => window.location.reload(),
              onCancel: () => {},
            })
          })
        return
      }
      console.log('[DEBUG] Layout.handleSignIn: calling showConnect()')
      showConnect({
        userSession,
        appDetails: {
          name: 'StacksPay',
          icon: '/logo.png',
        },
        redirectTo: window.location.href,
        onFinish: () => {
          try {
            const data = userSession?.loadUserData?.()
            const addr = data?.profile?.stxAddress?.testnet || data?.profile?.stxAddress?.mainnet
            if (addr) {
              console.log('[DEBUG] STX address (Stacks Connect):', addr)
              localStorage.setItem('stxAddress', addr)
            }
            localStorage.setItem('leatherConnected', '1')
          } catch {}
          window.location.reload()
        },
        onCancel: () => {},
      })
    } catch (e) {
      console.log('[DEBUG] Layout.handleSignIn error:', e)
    }
  }

  const handleSignOut = () => {
    try { userSession?.signUserOut?.() } catch {}
    localStorage.removeItem('leatherConnected')
    localStorage.removeItem('stxAddress')
    window.location.reload()
  }

  const primaryNav = [
    { name: 'Home', href: '/dashboard', icon: Home },
    { name: 'Transactions', href: '/payments', icon: CreditCard },
    { name: 'Customers', href: '/customers', icon: Users },
    { name: 'Product catalog', href: '/products', icon: ShoppingBag },
    { name: 'Subscriptions', href: '/subscriptions', icon: RefreshCw }
  ]

  const shortcutNav = [
    { name: 'Payment Links', href: '/payment-links', icon: LinkIcon },
    { name: 'Embedded Checkout', href: '/embedded-checkout', icon: Box },
    { name: 'Widget Builder', href: '/widget-builder', icon: Wrench }
  ]

  const developerNav = [
    { name: 'API Keys', href: '/integration', icon: Code2 },
    { name: 'Webhooks', href: '/webhooks', icon: LinkIcon },
    { name: 'API Testing', href: '/api-testing', icon: TestTube },
    { name: 'Docs', href: '/docs', icon: BookOpen },
    { name: 'Settings', href: '/settings', icon: Settings }
  ]

  return (
    <div className="min-h-screen bg-secondary">
      {/* Sidebar */}
      <div className="fixed inset-y-0 left-0 z-50 w-64 bg-secondary border-r border-white/10 text-white">
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="px-6 py-4 border-b border-white/10">
            <NavLink to="/" aria-label="Go to landing page" className="flex items-center space-x-2 group cursor-pointer">
              <img src="/logo.png" alt="StacksPay Logo" className="w-8 h-8 rounded-lg object-contain" />
              <span className="text-xl font-bold text-white group-hover:text-brand transition-colors">StacksPay</span>
            </NavLink>
            <p className="mt-1 text-xs text-white/60">Pay with Bitcoin. Instantly.</p>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-4 space-y-4 overflow-y-auto">
            <div>
              <div className="px-3 pb-2 text-xs font-semibold text-white/60 uppercase tracking-wider">Menu</div>
              <div className="space-y-1">
                {primaryNav.map((item) => (
                  <NavLink
                    key={item.name}
                    to={item.href}
                    className={({ isActive }) =>
                      `flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                        isActive
                          ? 'bg-white/10 text-brand'
                          : 'text-white/80 hover:bg-white/10'
                      }`
                    }
                  >
                    <item.icon className="w-5 h-5" />
                    <span>{item.name}</span>
                  </NavLink>
                ))}
              </div>
            </div>

            <div>
              <div className="px-3 pb-2 text-xs font-semibold text-white/60 uppercase tracking-wider">Shortcuts</div>
              <div className="space-y-1">
                {shortcutNav.map((item) => (
                  <NavLink
                    key={item.name}
                    to={item.href}
                    className={({ isActive }) =>
                      `flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                        isActive
                          ? 'bg-white/10 text-brand'
                          : 'text-white/80 hover:bg-white/10'
                      }`
                    }
                  >
                    <item.icon className="w-5 h-5" />
                    <span>{item.name}</span>
                  </NavLink>
                ))}
              </div>
            </div>

            <div>
              <div className="px-3 pb-2 text-xs font-semibold text-white/60 uppercase tracking-wider">Developer Tools</div>
              <div className="space-y-1">
                {developerNav.map((item) => (
                  item.name === 'Docs' ? (
                    <a
                      key={item.name}
                      href="/docs"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors text-white/80 hover:bg-white/10"
                    >
                      <item.icon className="w-5 h-5" />
                      <span>{item.name}</span>
                    </a>
                  ) : (
                    <NavLink
                      key={item.name}
                      to={item.href}
                      className={({ isActive }) =>
                        `flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                          isActive
                            ? 'bg-white/10 text-brand'
                            : 'text-white/80 hover:bg-white/10'
                        }`
                      }
                    >
                      <item.icon className="w-5 h-5" />
                      <span>{item.name}</span>
                    </NavLink>
                  )
                ))}
              </div>
            </div>
          </nav>

          {/* User section */}
          <div className="p-4 border-t border-white/10">
            {isConnected ? (
              <div className="space-y-3">
                <div className="flex items-center space-x-3 px-3 py-2">
                  <Wallet className="w-5 h-5 text-white/70" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {(userData?.profile?.stxAddress?.testnet || rpcAddress || '').slice(0, 8)}...
                    </p>
                    <p className="text-xs text-white/60">Connected</p>
                  </div>
                </div>
                <button
                  onClick={handleSignOut}
                  className="flex items-center space-x-2 w-full px-3 py-2 text-sm text-accent hover:bg-white/10 rounded-lg transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            ) : (
              <button
                onClick={handleSignIn}
                className="w-full btn-primary"
              >
                Connect Wallet
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="pl-64">
        <header className="px-8 py-4 bg-secondary border-b border-white/10">
          <div className="relative">
            <div className="flex items-center justify-between">
              <div className="w-8" />
              <div className="max-w-xl w-full mx-4">
                <div 
                  className={`chat-shell relative w-full rounded-xl border flex items-center gap-3 h-[60px] px-4 shadow-sm overflow-hidden cursor-pointer transition-all hover:ring-2 hover:ring-primary-400/60 ${chatFocused ? 'ring-2 ring-primary-400/60' : ''}`}
                  style={{ borderColor: 'rgba(255,255,255,0.15)' }}
                  onClick={() => setIsChatOpen(true)}
                  onFocus={() => setChatFocused(true)}
                  onBlur={() => setChatFocused(false)}
                  tabIndex={0}
                  role="button"
                  aria-label="Open chat with StacksBot"
                >
                  {/* Gradient glass background */}
                  <div className="absolute inset-0 pointer-events-none" style={{
                    background: 'linear-gradient(90deg, #F7931A 0%, #FFD580 100%)',
                    opacity: 0.2
                  }} />
                  <div className="absolute inset-0 backdrop-blur-xl" />
                  <MessageCircle className="relative z-10 w-5 h-5 text-[#F7931A]" />
                  <div className="chat-input relative z-10 flex-1 text-white/90 text-sm pointer-events-none">
                    Ask StacksBot about your Bitcoin payments...
                  </div>
                  <div className="relative z-10 w-10 h-10 inline-flex items-center justify-center rounded-full transition-all"
                       style={{ background: 'linear-gradient(90deg, #F7931A 0%, #FFD580 100%)' }}>
                    <MessageCircle className="w-4 h-4 text-[#1E1E1E]" />
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={toggleTheme}
                  aria-label="Toggle theme"
                  className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/15 transition-colors"
                  title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                >
                  {theme === 'dark' ? (
                    <Sun className="w-5 h-5 text-white" />
                  ) : (
                    <Moon className="w-5 h-5 text-white" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </header>
        {/* Main content */}
        <main className="p-8">
          <Outlet />
        </main>
      </div>

      {/* Chat Window */}
      <ChatWindow 
        isOpen={isChatOpen} 
        onToggle={() => setIsChatOpen(!isChatOpen)} 
      />
    </div>
  )
}

export default Layout
