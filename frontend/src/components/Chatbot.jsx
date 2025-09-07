import React, { useState, useEffect, useRef } from 'react'

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
    // Normalize text
    const normalized = text.toLowerCase().trim()
    
    // Extract amount patterns
    const amountPatterns = [
      /(\d+(?:\.\d+)?)\s*stx/i,
      /(\d+(?:\.\d+)?)\s*(?:micro)?stx/i,
      /pay\s+(\d+(?:\.\d+)?)/i,
      /send\s+(\d+(?:\.\d+)?)/i,
      /transfer\s+(\d+(?:\.\d+)?)/i
    ]
    
    let amount = null
    for (const pattern of amountPatterns) {
      const match = normalized.match(pattern)
      if (match) {
        amount = parseFloat(match[1])
        // Convert STX to microSTX if needed
        if (normalized.includes('stx') && amount < 1000) {
          amount = amount * 1000000
        }
        break
      }
    }

    // Extract recipient patterns
    let recipient = null
    let recipientName = null

    // Check for contact nicknames first
    for (const contact of contacts) {
      const nicknames = [contact.nickname, contact.name.split(' ')[0]].filter(Boolean)
      for (const nickname of nicknames) {
        if (nickname && normalized.includes(nickname.toLowerCase())) {
          recipient = contact.address
          recipientName = contact.name
          break
        }
      }
      if (recipient) break
    }

    // If no contact found, look for Stacks address
    if (!recipient) {
      const addressMatch = text.match(/(ST[A-Z0-9]{39}|SP[A-Z0-9]{39})/i)
      if (addressMatch) {
        recipient = addressMatch[1]
      }
    }

    // Extract memo patterns
    let memo = ''
    const memoPatterns = [
      /(?:for|memo|note|message)\s+(.+?)(?:\s|$)/i,
      /with\s+memo\s+(.+?)(?:\s|$)/i
    ]
    
    for (const pattern of memoPatterns) {
      const match = text.match(pattern)
      if (match) {
        memo = match[1].trim()
        break
      }
    }

    // If no explicit memo, try to extract context
    if (!memo && recipient) {
      const parts = text.split(/(?:to|for)/i)
      if (parts.length > 2) {
        memo = parts[parts.length - 1].trim()
      }
    }

    return {
      amount,
      recipient,
      recipientName,
      memo: memo || 'Chatbot payment',
      isValid: amount && recipient
    }
  }

  async function processCommand(text) {
    setIsProcessing(true)
    addMessage('user', text)

    try {
      // Parse the command
      const parsed = parsePaymentCommand(text)
      
      if (!parsed.isValid) {
        addMessage('bot', "I couldn't understand that command. Please try:\n• 'pay 100 STX to SAM'\n• 'send 50 to SP3ABC...'\n• Make sure you have contacts set up for nicknames")
        return
      }

      // Check if we have agents
      if (agents.length === 0) {
        addMessage('bot', "No payment agents available. Please create an agent first in the Agents tab.")
        return
      }

      // Confirm the payment
      const confirmMsg = `💰 Payment Details:\n• Amount: ${(parsed.amount / 1000000).toFixed(6)} STX\n• To: ${parsed.recipientName || parsed.recipient}\n• Memo: ${parsed.memo}\n\nProcessing payment...`
      addMessage('bot', confirmMsg)

      // Process the payment
      const response = await api.post('/payments/process', {
        agentId: agents[0].id, // Use first available agent
        amount: Math.floor(parsed.amount),
        recipient: parsed.recipient,
        memo: parsed.memo
      })

      const successMsg = `✅ Payment processed successfully!\n• Payment ID: ${response.data.paymentId}\n• Status: ${response.data.status}\n• Transaction: ${response.data.txId}`
      addMessage('bot', successMsg)

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
    <div className="chatbot">
      <div className="section-header">
        <h2>💬 Payment Assistant</h2>
        <div className="chatbot-status">
          <div className={`status-dot ${agents.length > 0 ? 'online' : 'offline'}`}></div>
          <span>{agents.length > 0 ? 'Ready' : 'No Agents'}</span>
        </div>
      </div>

      <div className="chat-container">
        <div className="messages-container">
          {messages.map(message => (
            <div key={message.id} className={`message ${message.type}`}>
              <div className="message-content">
                <div className="message-text">
                  {message.content.split('\n').map((line, i) => (
                    <div key={i}>{line}</div>
                  ))}
                </div>
                <div className="message-time">
                  {formatTime(message.timestamp)}
                </div>
              </div>
            </div>
          ))}
          {isProcessing && (
            <div className="message bot">
              <div className="message-content">
                <div className="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSubmit} className="chat-input-form">
          <div className="chat-input-container">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a payment command... (e.g., 'pay 100 STX to SAM')"
              disabled={isProcessing}
              className="chat-input"
            />
            <button 
              type="submit" 
              disabled={!input.trim() || isProcessing}
              className="chat-send-btn"
            >
              {isProcessing ? '⏳' : '📤'}
            </button>
          </div>
        </form>
      </div>

      <div className="chat-suggestions">
        <h4>💡 Try these commands:</h4>
        <div className="suggestion-chips">
          <button 
            className="suggestion-chip"
            onClick={() => setInput('pay 100 STX to SAM for dinner')}
            disabled={isProcessing}
          >
            pay 100 STX to SAM for dinner
          </button>
          <button 
            className="suggestion-chip"
            onClick={() => setInput('send 50 STX to ALICE')}
            disabled={isProcessing}
          >
            send 50 STX to ALICE
          </button>
          <button 
            className="suggestion-chip"
            onClick={() => setInput('transfer 25 STX for hosting fees')}
            disabled={isProcessing}
          >
            transfer 25 STX for hosting fees
          </button>
        </div>
      </div>

      {contacts.length === 0 && (
        <div className="chat-notice">
          <p>💡 <strong>Tip:</strong> Add contacts in the Contacts tab to use nicknames like "SAM" or "ALICE" in your commands!</p>
        </div>
      )}
    </div>
  )
}
