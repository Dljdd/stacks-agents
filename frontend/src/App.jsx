import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import Dashboard from './components/Dashboard';
import AgentManager from './components/AgentManager';
import PaymentProcessor from './components/PaymentProcessor';
import Analytics from './components/Analytics';
import Contacts from './components/Contacts';
import Chatbot from './components/Chatbot';
import ErrorBoundary from './components/ErrorBoundary';
import './styles.css';
import Sidebar from './components/layout/Sidebar';
import { Button } from './components/retroui/Button';

const API_BASE = 'http://localhost:3001/api'
const WS_URL = 'ws://localhost:3001/ws/updates'

function useApi(token) {
  const api = useMemo(() => {
    const inst = axios.create({ baseURL: API_BASE })
    inst.interceptors.request.use((cfg) => {
      if (token) cfg.headers.Authorization = `Bearer ${token}`
      return cfg
    })
    return inst
  }, [token])
  return api
}

function useWebSocket(onMessage) {
  useEffect(() => {
    try {
      const ws = new WebSocket(WS_URL)
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          onMessage(data)
        } catch (e) {
          console.error('WebSocket parse error:', e)
        }
      }
      ws.onopen = () => {
        if (process.env.NODE_ENV === 'development') {
          if (!window.__ws_connected_logged) {
            console.info('WebSocket connected')
            window.__ws_connected_logged = true
          }
        }
      }
      ws.onerror = (error) => console.error('WebSocket error:', error)
      return () => ws.close()
    } catch (error) {
      console.error('WebSocket connection failed:', error)
    }
  }, [onMessage])
}

export default function App() {
  const [token, setToken] = useState('test')
  const [activeTab, setActiveTab] = useState('dashboard')
  const [notifications, setNotifications] = useState([])
  const [sidebarWidth, setSidebarWidth] = useState(240)
  const api = useApi(token)

  // WebSocket for real-time updates with error handling
  useWebSocket((data) => {
    setNotifications(prev => [...prev.slice(-4), {
      id: Date.now(),
      message: `${data.event}: ${JSON.stringify(data.payload)}`,
      timestamp: new Date()
    }])
  })

  function renderActiveTab() {
    switch (activeTab) {
      case 'agents':
        return <AgentManager api={api} />
      case 'payments':
        return <PaymentProcessor api={api} />
      case 'analytics':
        return <Analytics api={api} />
      case 'contacts':
        return <Contacts api={api} />
      case 'chatbot':
        return <Chatbot api={api} />
      default:
        return <Dashboard api={api} notifications={notifications} />
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <Sidebar activeTab={activeTab} onSelect={setActiveTab} onWidthChange={setSidebarWidth} />
      
      {/* WalletConnect moved into Sidebar footer */}

      <main
        className="min-h-screen"
        style={{ marginLeft: sidebarWidth }}
      >
        <ErrorBoundary>
          {renderActiveTab()}
        </ErrorBoundary>
      </main>
    </div>
  )
}
