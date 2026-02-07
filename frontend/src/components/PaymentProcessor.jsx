import React, { useEffect, useMemo, useState } from 'react'
import { CreditCard, Send, Clock, CheckCircle, AlertCircle, DollarSign, Users, TrendingUp } from 'lucide-react'
import { AppConfig, UserSession, showConnect, openContractCall } from '@stacks/connect'
import { principalCV, uintCV, noneCV, someCV, stringUtf8CV } from '@stacks/transactions'

export default function PaymentProcessor({ api }) {
  const [paymentMode, setPaymentMode] = useState('structured')
  const [formData, setFormData] = useState({
    recipient: '',
    amount: '',
    memo: '',
    agent: ''
  })
  const [naturalLanguageInput, setNaturalLanguageInput] = useState('')
  const [processing, setProcessing] = useState(false)
  const [txInfo, setTxInfo] = useState({ status: null, txId: null, error: null })
  const [recentPayments, setRecentPayments] = useState([
    {
      id: 1,
      recipient: 'SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7',
      amount: '150 STX',
      status: 'completed',
      timestamp: '2 min ago',
      memo: 'Payment for services'
    },
    {
      id: 2,
      recipient: 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE',
      amount: '75 STX',
      status: 'pending',
      timestamp: '5 min ago',
      memo: 'Monthly subscription'
    },
    {
      id: 3,
      recipient: 'SP1K1A1PMGW2BQ2N4B2N4B2N4B2N4B2N4B2N4B2N',
      amount: '300 STX',
      status: 'failed',
      timestamp: '10 min ago',
      memo: 'Refund payment'
    }
  ])

  const dismissToast = () => setTxInfo({ status: null, txId: null, error: null })

  // Leather session
  const userSession = useMemo(() => new UserSession({ appConfig: new AppConfig(['store_write', 'publish_data']) }), [])

  useEffect(() => {
    if (userSession.isUserSignedIn()) {
      const data = userSession.loadUserData()
      const addr = data.profile?.stxAddress?.testnet || data.profile?.stxAddress?.mainnet
      if (addr && !formData.agent) setFormData((f) => ({ ...f, agent: addr }))
    }
  }, [userSession])

  // Explorer/confirmation helpers
  const HIRO_API = 'https://api.testnet.hiro.so'
  const EXPLORER_BASE = 'https://explorer.hiro.so/tx/'

  // Category guard helpers
  const ALLOWED = ['grocery', 'groceries', 'electronics']
  const BLOCKED = ['gambl', 'casino', 'bet', 'wager']
  function detectCategory(text = '') {
    const t = (text || '').toLowerCase()
    const isBlocked = BLOCKED.some(k => t.includes(k))
    const isAllowed = ALLOWED.some(k => t.includes(k))
    return { isBlocked, isAllowed }
  }

  // --- Refresh payments history ---
  async function refreshPayments() {
    try {
      const agentId = formData.agent
      const params = agentId ? { params: { agentId } } : undefined
      const res = await api.get('/payments/history', params)
      const items = res.data?.items || []
      // Map into UI-friendly objects
      const mapped = items.slice(0, 10).map((p) => ({
        id: p.id || `${p.txId || Math.random()}`,
        recipient: p.recipient,
        amount: `${(p.amount || 0) / 1_000_000} STX`,
        status: p.status === 'success' ? 'completed' : (p.status || 'pending'),
        timestamp: p.createdAt ? new Date(p.createdAt).toLocaleTimeString() : '',
        memo: p.memo || ''
      }))
      setRecentPayments(mapped)
    } catch (e) {
      console.warn('Failed to refresh payments', e)
    }
  }

  // --- Transaction confirmation polling ---
  async function pollTxConfirmation(txId) {
    try {
      let attempts = 0
      const maxAttempts = 60 // ~60s
      while (attempts < maxAttempts) {
        attempts++
        const res = await fetch(`${HIRO_API}/extended/v1/tx/${txId}`)
        if (res.ok) {
          const json = await res.json()
          const status = json?.tx_status || json?.status
          if (status === 'success') {
            setTxInfo({ status: 'success', txId, error: null })
            // Refresh recent payments from backend
            await refreshPayments()
            return
          }
          if (status === 'abort_by_response' || status === 'failed') {
            setTxInfo({ status: 'failed', txId, error: json?.tx_result?.repr || 'Transaction failed' })
            return
          }
        }
        await new Promise(r => setTimeout(r, 1000))
      }
      setTxInfo((t) => ({ ...t, status: 'pending', error: null }))
    } catch (e) {
      setTxInfo({ status: 'error', txId, error: e?.message || 'Unable to confirm transaction' })
    }
  }

  const handleStructuredSubmit = async (e) => {
    e.preventDefault()
    setProcessing(true)
    
    try {
      // Ensure wallet is connected
      if (!userSession.isUserSignedIn()) {
        await new Promise((resolve) =>
          showConnect({ userSession, appDetails: { name: 'AgentPay', icon: window.location.origin + '/neon-logo.svg' }, onFinish: resolve, onCancel: resolve })
        )
      }

      const agentId = formData.agent
      const recipient = formData.recipient.trim()
      const amountStx = parseFloat(formData.amount)
      if (!agentId || !recipient || !amountStx || amountStx <= 0) throw new Error('Please fill all required fields')

      // Category policy check from memo
      const { isBlocked } = detectCategory(formData.memo)
      if (isBlocked) {
        setTxInfo({ status: 'error', txId: null, error: 'Blocked category: gambling' })
        return
      }

      const amountMicro = Math.round(amountStx * 1_000_000)

      // 1) Ask backend for contract payload (validation + contract routing)
      const res = await api.post(
        '/payments/process',
        {
          agentId,
          recipient,
          amount: amountMicro,
          memo: formData.memo || null,
        },
        { headers: { Authorization: 'Bearer dev' } }
      )

      const { signingPayload } = res.data || {}
      if (!signingPayload?.contractId || !signingPayload?.functionName) throw new Error('Invalid signing payload')

      // 2) Prepare contract call for Leather
      const [contractAddress, contractName] = signingPayload.contractId.split('.')
      const [argAgent, argRecipient, argAmount, argMemo] = signingPayload.args

      const functionArgs = [
        principalCV(argAgent || agentId),
        principalCV(argRecipient || recipient),
        uintCV(argAmount || amountMicro),
        argMemo ? someCV(stringUtf8CV(argMemo)) : noneCV(),
      ]

      await openContractCall({
        userSession,
        contractAddress,
        contractName,
        functionName: signingPayload.functionName,
        functionArgs,
        appDetails: { name: 'AgentPay', icon: window.location.origin + '/neon-logo.svg' },
        onFinish: (data) => {
          // data.txId for mainnet/testnet; fall back to data.txId if available
          const txId = data?.txId || data?.transactionId || null
          setTxInfo({ status: 'submitted', txId, error: null })
          if (txId) pollTxConfirmation(txId)
        },
      })

      setFormData({ recipient: '', amount: '', memo: '', agent: agentId })
    } catch (error) {
      console.error('Payment failed:', error)
      setTxInfo({ status: 'error', txId: null, error: error?.message || 'Payment failed' })
    } finally {
      setProcessing(false)
    }
  }

  const handleNaturalLanguageSubmit = async (e) => {
    e.preventDefault()
    setProcessing(true)
    
    try {
      // Very basic parse: "send <amount> STX to <address> [memo <text>]"
      const match = naturalLanguageInput.match(/send\s+(\d+(?:\.\d+)?)\s*stx\s+to\s+([SP][A-Z0-9]+)(?:.*memo\s+(.+))?/i)
      if (!match) throw new Error('Could not parse. Try: "Send 100 STX to SPxxxxx memo Lunch"')
      const amountStx = parseFloat(match[1])
      const recipient = match[2]
      const memo = match[3]?.trim() || null

      // Category policy from natural language
      const { isBlocked } = detectCategory(naturalLanguageInput)
      if (isBlocked) {
        setTxInfo({ status: 'error', txId: null, error: 'Blocked category: gambling' })
        setNaturalLanguageInput('')
        return
      }

      setFormData((f) => ({ ...f, amount: String(amountStx), recipient, memo: memo || '' }))
      await handleStructuredSubmit({ preventDefault: () => {} })
      setNaturalLanguageInput('')
    } catch (error) {
      console.error('Payment failed:', error)
    } finally {
      setProcessing(false)
    }
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-emerald-400" />
      case 'pending':
        return <Clock className="w-4 h-4 text-orange-400" />
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-400" />
      default:
        return null
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'text-emerald-400 bg-emerald-500/10'
      case 'pending':
        return 'text-orange-400 bg-orange-500/10'
      case 'failed':
        return 'text-red-400 bg-red-500/10'
      default:
        return 'text-slate-400 bg-slate-500/10'
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Payment Processor</h1>
            <p className="text-slate-400">Send payments and manage transactions</p>
          </div>
        </div>

        {/* Transaction toast banner */}
        {txInfo.status && (
          <div className={`flex items-start justify-between p-4 rounded-xl border ${
            txInfo.status === 'success' ? 'bg-emerald-500/10 border-emerald-500/30' :
            txInfo.status === 'failed' || txInfo.status === 'error' ? 'bg-red-500/10 border-red-500/30' :
            txInfo.status === 'submitted' || txInfo.status === 'pending' ? 'bg-blue-500/10 border-blue-500/30' :
            'bg-slate-700/30 border-slate-600'
          }`}>
            <div className="space-y-1">
              <p className="text-white font-medium capitalize">{txInfo.status.replace('-', ' ')}</p>
              {txInfo.txId && (
                <a
                  className="text-blue-400 hover:text-blue-300 text-sm underline"
                  href={`${EXPLORER_BASE}${txInfo.txId}?chain=testnet`}
                  target="_blank" rel="noreferrer"
                >
                  View on Explorer
                </a>
              )}
              {txInfo.error && (
                <p className="text-red-300 text-sm">{txInfo.error}</p>
              )}
            </div>
            <button onClick={dismissToast} className="text-slate-400 hover:text-white">×</button>
          </div>
        )}

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <DollarSign className="w-5 h-5 text-blue-400" />
              <span className="text-slate-400 text-sm font-medium">Total Sent</span>
            </div>
            <p className="text-2xl font-bold text-white">1,250 STX</p>
          </div>
          
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <Send className="w-5 h-5 text-emerald-400" />
              <span className="text-slate-400 text-sm font-medium">Transactions</span>
            </div>
            <p className="text-2xl font-bold text-emerald-400">47</p>
          </div>
          
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <Users className="w-5 h-5 text-purple-400" />
              <span className="text-slate-400 text-sm font-medium">Recipients</span>
            </div>
            <p className="text-2xl font-bold text-purple-400">23</p>
          </div>
          
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="w-5 h-5 text-orange-400" />
              <span className="text-slate-400 text-sm font-medium">Success Rate</span>
            </div>
            <p className="text-2xl font-bold text-orange-400">94.7%</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Payment Form */}
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <CreditCard className="w-6 h-6 text-blue-400" />
              <h2 className="text-xl font-semibold text-white">Send Payment</h2>
            </div>

            {/* Mode Toggle */}
            <div className="flex bg-slate-700/30 rounded-xl p-1 mb-6">
              <button
                onClick={() => setPaymentMode('structured')}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  paymentMode === 'structured'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Structured Form
              </button>
              <button
                onClick={() => setPaymentMode('natural')}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  paymentMode === 'natural'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Natural Language
              </button>
            </div>

            {paymentMode === 'structured' ? (
              <form onSubmit={handleStructuredSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Recipient Address *</label>
                  <input
                    type="text"
                    value={formData.recipient}
                    onChange={(e) => setFormData({ ...formData, recipient: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Amount (STX) *</label>
                  <input
                    type="number"
                    step="0.000001"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="100"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Memo (Optional)</label>
                  <input
                    type="text"
                    value={formData.memo}
                    onChange={(e) => setFormData({ ...formData, memo: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Payment description"
                  />
                </div>

                <button
                  type="submit"
                  disabled={processing}
                  className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white rounded-xl transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-blue-500/25 font-semibold disabled:cursor-not-allowed"
                >
                  {processing ? 'Processing...' : 'Send Payment'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleNaturalLanguageSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Describe your payment</label>
                  <textarea
                    value={naturalLanguageInput}
                    onChange={(e) => setNaturalLanguageInput(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    placeholder="Send 100 STX to Alice for the consulting work"
                    rows={4}
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={processing}
                  className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white rounded-xl transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-blue-500/25 font-semibold disabled:cursor-not-allowed"
                >
                  {processing ? 'Processing...' : 'Process Payment'}
                </button>
              </form>
            )}
          </div>

          {/* Recent Payments */}
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
            <h2 className="text-xl font-semibold text-white mb-6">Recent Payments</h2>
            
            <div className="space-y-4">
              {recentPayments.map(payment => (
                <div key={payment.id} className="bg-slate-700/30 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(payment.status)}
                      <span className="text-white font-medium">{payment.amount}</span>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(payment.status)}`}>
                      {payment.status}
                    </span>
                  </div>
                  
                  <p className="text-slate-400 text-sm mb-1">
                    To: {payment.recipient.slice(0, 8)}...{payment.recipient.slice(-8)}
                  </p>
                  
                  {payment.memo && (
                    <p className="text-slate-300 text-sm mb-2">{payment.memo}</p>
                  )}
                  
                  <p className="text-slate-500 text-xs">{payment.timestamp}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
