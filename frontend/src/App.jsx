import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import Dashboard from './components/Dashboard';
import AgentManager from './components/AgentManager';
import PaymentProcessor from './components/PaymentProcessor';
import Analytics from './components/Analytics';
import Contacts from './components/Contacts';
import Chatbot from './components/Chatbot';
import ErrorBoundary from './components/ErrorBoundary';
import WalletConnect from './components/WalletConnect';
import './styles.css';

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
    <div className="app">
      <header className="header">
        <div className="header-content">
          <div className="logo">🤖 Stacks AI Payment Agents</div>
          <div className="wallet-placeholder">
            <WalletConnect 
              onWalletConnected={() => {
                if (process.env.NODE_ENV === 'development') {
                  if (!window.__wallet_connected_logged) {
                    console.info('Wallet connected')
                    window.__wallet_connected_logged = true
                  }
                }
              }}
              onWalletDisconnected={() => {
                if (process.env.NODE_ENV === 'development') {
                  console.info('Wallet disconnected')
                  window.__wallet_connected_logged = false
                }
              }}
            />
          </div>
          <nav className="nav-tabs">
            <button className={`nav-tab ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>Dashboard</button>
            <button className={`nav-tab ${activeTab === 'agents' ? 'active' : ''}`} onClick={() => setActiveTab('agents')}>Agents</button>
            <button className={`nav-tab ${activeTab === 'payments' ? 'active' : ''}`} onClick={() => setActiveTab('payments')}>Payments</button>
            <button className={`nav-tab ${activeTab === 'analytics' ? 'active' : ''}`} onClick={() => setActiveTab('analytics')}>Analytics</button>
            <button className={`nav-tab ${activeTab === 'contacts' ? 'active' : ''}`} onClick={() => setActiveTab('contacts')}>Contacts</button>
            <button className={`nav-tab ${activeTab === 'chatbot' ? 'active' : ''}`} onClick={() => setActiveTab('chatbot')}>💬 Chatbot</button>
          </nav>
        </div>
      </header>

      <main className="main-content">
        <ErrorBoundary>
          {renderActiveTab()}
        </ErrorBoundary>
      </main>
    </div>
  )
}

