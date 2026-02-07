import React, { useState, useEffect, useRef, useMemo } from 'react'
import { Send, Bot, User, MessageSquare, Zap } from 'lucide-react'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { AppConfig, UserSession, showConnect, openContractCall } from '@stacks/connect'
import { principalCV, uintCV, noneCV, someCV, stringUtf8CV } from '@stacks/transactions'

export default function Chatbot({ api }) {
  const [messages, setMessages] = useState([
    {
      id: 1,
      type: 'bot',
      content: "Hi! I'm your payment assistant. Try commands like:\n• 'pay 100 STX to SAM for dinner'\n• 'send 50 to ALICE with memo hosting'\n• 'transfer 25 STX to SP3ABC... for services'",
      timestamp: new Date()
    }
  ])
  const [input, setInput] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [agents, setAgents] = useState([])
  const [contacts, setContacts] = useState([])
  const messagesEndRef = useRef(null)

  // Leather session
  const userSession = useMemo(() => new UserSession({ appConfig: new AppConfig(['store_write', 'publish_data']) }), [])

  const HIRO_API = 'https://api.testnet.hiro.so'
  const EXPLORER_BASE = 'https://explorer.hiro.so/tx/'

  async function pollTxConfirmation(txId, ctx) {
    try {
      let attempts = 0
      const maxAttempts = 60
      while (attempts < maxAttempts) {
        attempts++
        const res = await fetch(`${HIRO_API}/extended/v1/tx/${txId}`)
        if (res.ok) {
          const json = await res.json()
          const status = json?.tx_status || json?.status
          if (status === 'success') {
            // Mini receipt
            if (ctx) {
              const lines = [
                `✅ Payment confirmed`,
                `• Amount: ${(ctx.amountMicro / 1_000_000).toFixed(6)} STX`,
                `• To: ${ctx.recipientLabel}`,
                ctx.memo ? `• Memo: ${ctx.memo}` : null,
                `• Tx: ${EXPLORER_BASE}${txId}?chain=testnet`
              ].filter(Boolean)
              addMessage('bot', lines.join('\n'))
            } else {
              addMessage('bot', `✅ Payment confirmed. Tx: ${EXPLORER_BASE}${txId}?chain=testnet`)
            }
            return
          }
          if (status === 'abort_by_response' || status === 'failed') {
            addMessage('bot', `❌ Transaction failed: ${json?.tx_result?.repr || ''}`)
            return
          }
        }
        await new Promise(r => setTimeout(r, 1000))
      }
      addMessage('bot', '⏳ Still pending confirmation...')
    } catch (e) {
      addMessage('bot', `⚠️ Unable to confirm transaction: ${e?.message || e}`)
    }
  }

  useEffect(() => {
    loadAgents()
    loadContacts()
    scrollToBottom()
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  async function loadAgents() {
    try {
      const response = await api.get('/agents/list')
      setAgents(response.data.items || [])
    } catch (error) {
      console.error('Failed to load agents:', error)
    }
  }

  function loadContacts() {
    const saved = localStorage.getItem('stacks-contacts')
    if (saved) {
      setContacts(JSON.parse(saved))
    }
  }

  function addMessage(type, content) {
    const message = {
      id: Date.now(),
      type,
      content,
      timestamp: new Date()
    }
    setMessages(prev => [...prev, message])
  }

  function parsePaymentCommand(text) {
    const normalized = text.trim()
    // Unified regex: verb amount (optional STX) [to recipient] [memo|for note]
    const re = /(pay|send|transfer)\s+(\d+(?:\.\d+)?)\s*(?:stx)?(?:\s*to\s+([@\w.-]+|ST[A-Z0-9]{39}|SP[A-Z0-9]{39}))?(?:.*?(?:memo|for|note)\s+(.+))?/i
    let amount = null
    let recipient = null
    let recipientName = null
    let memo = ''

    const m = normalized.match(re)
    if (m) {
      amount = parseFloat(m[2])
      // Convert to microSTX
      if (!isNaN(amount)) amount = Math.round(amount * 1_000_000)
      const recToken = m[3]
      if (recToken) {
        // If address token, use directly; else try contacts
        if (/^(ST|SP)[A-Z0-9]{39}$/i.test(recToken)) {
          recipient = recToken
        } else {
          const tokenLower = recToken.replace(/^@/, '').toLowerCase()
          for (const contact of contacts) {
            const candidates = [contact.nickname, contact.name, contact.name?.split(' ')[0]].filter(Boolean)
            if (candidates.some(c => c.toLowerCase() === tokenLower)) {
              recipient = contact.address
              recipientName = contact.name
              break
            }
          }
        }
      }
      if (m[4]) memo = m[4].trim()
    }

    // Fallback: address elsewhere
    if (!recipient) {
      const addressMatch = normalized.match(/(ST[A-Z0-9]{39}|SP[A-Z0-9]{39})/i)
      if (addressMatch) recipient = addressMatch[1]
    }

    return {
      amount,
      recipient,
      recipientName,
      memo: memo || 'Chatbot payment',
      isValid: Boolean(amount && recipient)
    }
  }

  async function processCommand(text) {
    setIsProcessing(true)
    addMessage('user', text)

    try {
      // Parse the command
      const parsed = parsePaymentCommand(text)
      
      if (!parsed.isValid) {
        // If Gemini API key configured, ask it to reformulate as a valid command
        const apiKey = import.meta.env.VITE_GEMINI_API_KEY
        if (apiKey) {
          try {
            const genAI = new GoogleGenerativeAI(apiKey)
            const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
            const prompt = `You are a payment command assistant for a Stacks wallet. Rewrite the user's request into a single-line canonical command like: \n- pay 100 STX to SPXXXX memo lunch\nOnly output the command, nothing else. User: ${text}`
            const result = await model.generateContent(prompt)
            const suggestion = result.response.text().trim()
            addMessage('bot', `I couldn't parse that. Try this command:\n${suggestion}`)
          } catch (e) {
            addMessage('bot', "I couldn't understand that command. Please try:\n• 'pay 100 STX to SAM'\n• 'send 50 to SP3ABC...'\n• Make sure you have contacts set up for nicknames")
          }
        } else {
          addMessage('bot', "I couldn't understand that command. Please try:\n• 'pay 100 STX to SAM'\n• 'send 50 to SP3ABC...'\n• Make sure you have contacts set up for nicknames")
        }
        return
      }

      // Check if we have agents
      if (agents.length === 0) {
        addMessage('bot', "No payment agents available. Please create an agent first in the Agents tab.")
        return
      }

      // Ensure wallet connected
      if (!userSession.isUserSignedIn()) {
        await new Promise((resolve) => showConnect({ userSession, appDetails: { name: 'AgentPay', icon: window.location.origin + '/neon-logo.svg' }, onFinish: resolve, onCancel: resolve }))
      }

      // Initiation message
      addMessage('bot', `🚀 Initiating payment: ${(parsed.amount / 1000000).toFixed(6)} STX to ${parsed.recipientName || parsed.recipient}`)

      // Ask backend for signing payload
      const response = await api.post(
        '/payments/process',
        {
          agentId: agents[0].id,
          amount: Math.floor(parsed.amount),
          recipient: parsed.recipient,
          memo: parsed.memo
        },
        { headers: { Authorization: 'Bearer dev' } }
      )

      const { signingPayload } = response.data || {}
      if (!signingPayload?.contractId || !signingPayload?.functionName) {
        throw new Error('Invalid signing payload from server')
      }

      const [contractAddress, contractName] = signingPayload.contractId.split('.')
      const [argAgent, argRecipient, argAmount, argMemo] = signingPayload.args
      const functionArgs = [
        principalCV(argAgent || agents[0].id),
        principalCV(argRecipient || parsed.recipient),
        uintCV(argAmount || Math.floor(parsed.amount)),
        argMemo ? someCV(stringUtf8CV(argMemo)) : (parsed.memo ? someCV(stringUtf8CV(parsed.memo)) : noneCV()),
      ]

      await openContractCall({
        userSession,
        contractAddress,
        contractName,
        functionName: signingPayload.functionName,
        functionArgs,
        appDetails: { name: 'AgentPay', icon: window.location.origin + '/neon-logo.svg' },
        onFinish: (data) => {
          const txId = data?.txId || data?.transactionId
          if (txId) {
            addMessage('bot', `🟦 Transaction submitted. View: ${EXPLORER_BASE}${txId}?chain=testnet`)
            const ctx = { amountMicro: Math.floor(parsed.amount), recipientLabel: parsed.recipientName || parsed.recipient, memo: parsed.memo }
            pollTxConfirmation(txId, ctx)
          } else {
            addMessage('bot', '🟦 Transaction submitted.')
          }
        }
      })

    } catch (error) {
      console.error('Payment failed:', error)
      const errorMsg = `❌ Payment failed: ${error.response?.data?.error?.message || error.message}`
      addMessage('bot', errorMsg)
    } finally {
      setIsProcessing(false)
    }
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!input.trim() || isProcessing) return
    
    const command = input.trim()
    setInput('')
    processCommand(command)
  }

  function formatTime(date) {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    })
  }

  return (
    <div className="min-h-screen p-8 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-8 w-full mb-8">
        <h1 className="text-3xl font-extrabold bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent mb-2">
          Payment Assistant
        </h1>
        <p className="text-slate-400">Natural language payment processing</p>
      </div>

      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-cyan-300 flex items-center gap-2">
          <MessageSquare className="w-6 h-6" strokeWidth={1.5} />
          Chat Interface
        </h2>
        <div className="flex items-center gap-3">
          <div className={`w-2.5 h-2.5 rounded-full ${agents.length > 0 ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`}></div>
          <span className="text-sm text-slate-400">{agents.length > 0 ? 'Ready' : 'No agents'}</span>
        </div>
      </div>

      <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl mb-8">
        <div className="flex-1 overflow-y-auto p-6 space-y-4 max-h-[28rem]">
          {messages.map((message, index) => (
            <div key={index} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-xs lg:max-w-md px-4 py-3 rounded-xl transition-all duration-300 ${
                message.type === 'user' 
                  ? 'bg-blue-600 text-white shadow-lg' 
                  : 'bg-slate-700/50 text-slate-200 border border-slate-600'
              }`}>
                <div className="flex items-start gap-2 mb-2">
                  {message.type === 'user' ? (
                    <User className="w-4 h-4 mt-0.5 flex-shrink-0" strokeWidth={1.5} />
                  ) : (
                    <Bot className="w-4 h-4 mt-0.5 flex-shrink-0 text-cyan-300" strokeWidth={1.5} />
                  )}
                  <div className="flex-1">
                    <p className="text-sm leading-relaxed whitespace-pre-line">{message.content}</p>
                    <span className="text-xs text-slate-400 mt-2 block">
                      {formatTime(message.timestamp)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {isProcessing && (
            <div className="flex justify-start">
              <div className="bg-slate-700/50 text-slate-200 border border-slate-600 px-4 py-3 rounded-xl max-w-xs">
                <div className="flex space-x-1 items-center">
                  <Bot className="w-4 h-4 text-cyan-300 mr-2" strokeWidth={1.5} />
                  <span className="text-xs text-cyan-300 mr-2">Processing...</span>
                  <div className="w-2 h-2 bg-pink-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                  <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        <form onSubmit={handleSubmit} className="p-6 border-t border-slate-700/50">
          <div className="flex gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a payment command... (e.g., 'pay 100 STX to SAM')"
              disabled={isProcessing}
              className="flex-1 px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button 
              type="submit" 
              disabled={!input.trim() || isProcessing}
              className="px-6 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-blue-500/25 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" strokeWidth={1.5} />
              {isProcessing ? 'Sending...' : 'Send'}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 mb-8">
        <h3 className="text-lg font-semibold text-cyan-300 mb-6 flex items-center gap-2">
          <Zap className="w-5 h-5" strokeWidth={1.5} />
          Quick Commands
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <button 
            className="text-left p-3 rounded-xl bg-slate-700/40 border border-slate-600 hover:bg-slate-700 transition-colors disabled:opacity-50"
            onClick={() => setInput('pay 100 STX to SAM for dinner')}
            disabled={isProcessing}
          >
            <div className="text-xs text-cyan-300 mb-1">EXAMPLE 1</div>
            <div className="text-sm text-slate-200">pay 100 STX to SAM for dinner</div>
          </button>
          <button 
            className="text-left p-3 rounded-xl bg-slate-700/40 border border-slate-600 hover:bg-slate-700 transition-colors disabled:opacity-50"
            onClick={() => setInput('send 50 STX to ALICE')}
            disabled={isProcessing}
          >
            <div className="text-xs text-cyan-300 mb-1">EXAMPLE 2</div>
            <div className="text-sm text-slate-200">send 50 STX to ALICE</div>
          </button>
          <button 
            className="text-left p-3 rounded-xl bg-slate-700/40 border border-slate-600 hover:bg-slate-700 transition-colors disabled:opacity-50"
            onClick={() => setInput('transfer 25 STX for hosting fees')}
            disabled={isProcessing}
          >
            <div className="text-xs text-cyan-300 mb-1">EXAMPLE 3</div>
            <div className="text-sm text-slate-200">transfer 25 STX for hosting fees</div>
          </button>
        </div>
      </div>

      {contacts.length === 0 && (
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 text-center">
          <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <MessageSquare className="w-6 h-6 text-emerald-400" strokeWidth={1.5} />
          </div>
          <h3 className="text-lg font-semibold text-emerald-400 mb-2">Enhance your experience</h3>
          <p className="text-slate-400">Add contacts in the Contacts tab to use nicknames like "SAM" or "ALICE" in your commands!</p>
        </div>
      )}
    </div>
  )
}
