import React, { useState, useEffect } from 'react'
import { openContractCall } from '@stacks/connect'
import { principalCV, uintCV, someCV, noneCV, stringAsciiCV, stringUtf8CV, cvToHex } from '@stacks/transactions'
import { signExecutePayment } from '../utils/stacksWallet'
import { isSignedIn, connectWallet, getUserSession } from '../utils/walletSession'

export default function PaymentProcessor({ api }) {
  const [agents, setAgents] = useState([])
  const [payments, setPayments] = useState([])
  const [selectedAgent, setSelectedAgent] = useState('')
  const [lastSigningPayload, setLastSigningPayload] = useState(null)
  const [contracts, setContracts] = useState({ paymentProcessor: null })
  const [contractsReady, setContractsReady] = useState(false)
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    recipient: '',
    memo: '',
    naturalLanguage: ''
  })
  const [useNaturalLanguage, setUseNaturalLanguage] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadAgents()
    loadContracts()
  }, [])

  useEffect(() => {
    loadPayments()
  }, [selectedAgent])

  async function loadAgents() {
    try {
      const response = await api.get('/agents/list')
      setAgents(response.data.items || [])
      if (response.data.items?.length > 0 && !selectedAgent) {
        setSelectedAgent(response.data.items[0].id)
      }
    } catch (error) {
      console.error('Failed to load agents:', error)
    }
  }

  async function loadContracts() {
    try {
      const res = await api.get('/contracts/info')
      const data = res.data || {}
      setContracts(data)
      setContractsReady(Boolean(data.paymentProcessor))
      return data
    } catch (e) {
      console.error('Failed to load contracts info:', e)
      setContractsReady(false)
      return {}
    }
  }

  async function loadPayments() {
    try {
      const query = selectedAgent ? `/payments/history?agentId=${encodeURIComponent(selectedAgent)}&limit=20` : '/payments/history?limit=20'
      const response = await api.get(query)
      setPayments(response.data.items || [])
    } catch (error) {
      console.error('Failed to load payments:', error)
    }
  }

  async function processPayment(e) {
    e.preventDefault()
    console.log('[Payments] Submit clicked')
    if (!selectedAgent) {
      alert('Please select an agent')
      return
    }
    if (!paymentForm.recipient || !paymentForm.recipient.startsWith('ST')) {
      alert('Please enter a valid recipient Stacks address (starts with ST...)')
      return
    }
    if (!contracts.paymentProcessor) {
      alert('Contracts not loaded yet. Please wait a moment and try again.')
      return
    }

    setLoading(true)
    try {
      // Ensure wallet provider/session is present before attempting popup
      const hasWallet = typeof window !== 'undefined' && (window.StacksProvider || window.LeatherProvider)
      if (!hasWallet || !isSignedIn()) {
        // Prompt connect flow; browser popup must be from this click context
        const connected = await connectWallet({})
        if (connected) {
          alert('Wallet connected. Please click "Process Payment" again to sign the transaction.')
        }
        setLoading(false)
        return
      }

      // Build signing payload client-side and open wallet immediately on submit
      // HOTFIX: override wrong contract id coming from backend if detected
      const FALLBACK_CONTRACT_ID = 'ST23Z1N1XD66CM151FM7NFPJ1VXPE6RT51XH4CG7.payment-processor-1'
      let contractId = contracts.paymentProcessor
      if (!contractId || contractId.startsWith('ST3CSS0') || contractId.endsWith('.payment-processor')) {
        console.warn('[Payments] Using fallback contract id:', FALLBACK_CONTRACT_ID)
        contractId = FALLBACK_CONTRACT_ID
      }
      if (!contractId) {
        throw new Error('Payment Processor contract ID unavailable')
      }

      const amountNum = Number(paymentForm.amount)
      if (!Number.isFinite(amountNum) || !Number.isInteger(amountNum) || amountNum <= 0) {
        alert('Amount must be a positive integer in microSTX (no decimals).')
        return
      }
      const amount = amountNum
      const [contractAddress, contractName] = String(contractId).split('.')
      console.log('[Payments] About to open wallet', { contractAddress, contractName, amount, selectedAgent, recipient: paymentForm.recipient })

      // Prefer Leather direct provider API when available to bypass any popup blockers
      const provider = typeof window !== 'undefined' && (window.LeatherProvider || window.StacksProvider)
      if (provider && typeof provider.request === 'function') {
        try {
          console.log('[Payments] Using LeatherProvider.request')
          const argsHex = [
            cvToHex(principalCV(selectedAgent)),
            cvToHex(principalCV(paymentForm.recipient)),
            cvToHex(uintCV(amount)),
            cvToHex(paymentForm.memo ? stringUtf8CV(String(paymentForm.memo)) : stringUtf8CV('')),
          ]
          const resp = await provider.request('stx_callContract', {
            contract: `${contractAddress}.${contractName}`,
            functionName: 'execute-payment',
            functionArgs: argsHex,
            postConditionMode: 'allow',
            postConditions: [],
          })
          
          const txId = resp?.result?.txid || resp?.txid || resp?.result?.txId || resp?.txId
          if (txId) {
            alert('Payment submitted! TXID: ' + txId)
            setTimeout(loadPayments, 4000)
            setPaymentForm({ amount: '', recipient: '', memo: '', naturalLanguage: '' })
            setLoading(false)
            return
          }
          console.log('[Payments] LeatherProvider request sent, no txId returned')
          setTimeout(loadPayments, 4000)
          setPaymentForm({ amount: '', recipient: '', memo: '', naturalLanguage: '' })
          setLoading(false)
          return
        } catch (err) {
          console.warn('[Payments] LeatherProvider.request failed, falling back to openContractCall', err)
        }
      }

      // Fallback: call openContractCall directly from the click handler per best practice
      openContractCall({
        contractAddress,
        contractName,
        functionName: 'execute-payment',
        functionArgs: [
          principalCV(selectedAgent),
          principalCV(paymentForm.recipient),
          uintCV(amount),
          paymentForm.memo ? someCV(stringAsciiCV(String(paymentForm.memo))) : noneCV(),
        ],
        // Use plain network object to avoid Vite bundling issues with @stacks/network
        network: { coreApiUrl: 'https://api.testnet.hiro.so' },
        userSession: getUserSession(),
        appDetails: { name: 'Stacks AI Payment Agents' },
        onFinish: (data) => {
          console.log('Wallet submitted tx:', data)
          alert('Transaction submitted! TXID: ' + (data?.txId || 'unknown'))
          setTimeout(loadPayments, 4000)
        },
        onCancel: () => {
          console.warn('User cancelled wallet signing')
        }
      })
      console.log('[Payments] openContractCall invoked')

      // Reset form
      setPaymentForm({
        amount: '',
        recipient: '',
        memo: '',
        naturalLanguage: ''
      })
      
      // No pre-submit modals. All feedback handled in onFinish/onCancel above.
    } catch (error) {
      console.error('Payment failed:', error)
      alert('Payment failed: ' + (error.response?.data?.error?.message || error.message))
    } finally {
      setLoading(false)
    }
  }

  function getStatusColor(status) {
    switch (status) {
      case 'success': return '#10b981'
      case 'pending': return '#f59e0b'
      case 'failed': return '#ef4444'
      default: return '#6b7280'
    }
  }

  return (
    <div className="payment-processor">
      <div className="section-header">
        <h2>Process Payments</h2>
        <div className="toggle-container">
          <label className="toggle">
            <input
              type="checkbox"
              checked={useNaturalLanguage}
              onChange={(e) => setUseNaturalLanguage(e.target.checked)}
            />
            <span className="toggle-slider"></span>
            Natural Language
          </label>
        </div>
      </div>

      <div className="payment-form-container">
        <form onSubmit={processPayment} className="payment-form">
          <div className="form-group">
            <label>Select Agent</label>
            <select
              value={selectedAgent}
              onChange={(e) => setSelectedAgent(e.target.value)}
              required
            >
              <option value="">Choose an agent...</option>
              {agents.map(agent => (
                <option key={agent.id} value={agent.id}>
                  {agent.name} ({agent.id.slice(0, 8)}...)
                </option>
              ))}
            </select>
          </div>

          {useNaturalLanguage ? (
            <div className="form-group">
              <label>Payment Instruction</label>
              <textarea
                value={paymentForm.naturalLanguage}
                onChange={(e) => setPaymentForm({...paymentForm, naturalLanguage: e.target.value})}
                placeholder="e.g., Send 1.5 STX to SP3RECIPIENT for hosting services"
                rows="3"
                required
              />
              <small>Describe the payment in natural language. The AI will parse the details.</small>
            </div>
          ) : (
            <>
              <div className="form-row">
                <div className="form-group">
                  <label>Amount (microSTX)</label>
                  <input
                    type="number"
                    value={paymentForm.amount}
                    onChange={(e) => setPaymentForm({...paymentForm, amount: e.target.value})}
                    placeholder="1500000"
                    min="1"
                    required
                  />
                  <small>{paymentForm.amount ? (paymentForm.amount / 1000000).toFixed(6) + ' STX' : ''}</small>
                </div>
                <div className="form-group">
                  <label>Recipient Address</label>
                  <input
                    type="text"
                    value={paymentForm.recipient}
                    onChange={(e) => setPaymentForm({...paymentForm, recipient: e.target.value})}
                    placeholder="ST..."
                    required
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Memo (Optional)</label>
                <input
                  type="text"
                  value={paymentForm.memo}
                  onChange={(e) => setPaymentForm({...paymentForm, memo: e.target.value})}
                  placeholder="Payment description"
                />
              </div>
            </>
          )}

          <button type="submit" disabled={loading || !contractsReady} className="btn btn-primary btn-large">
            {loading ? 'Processing...' : (isSignedIn() ? (contractsReady ? 'Process Payment' : 'Loading…') : 'Connect Wallet to Pay')}
          </button>
          {lastSigningPayload && (
            <>
              <button
                type="button"
                className="btn btn-secondary btn-large"
                onClick={async () => {
                  try {
                    const hasWallet = typeof window !== 'undefined' && (window.StacksProvider || window.LeatherProvider)
                    if (!hasWallet) {
                      const proceed = confirm('No Stacks wallet detected. Install Leather and try again?')
                      if (proceed) window.open('https://leather.io/','_blank')
                      return
                    }
                    await signExecutePayment(lastSigningPayload, {
                      onFinish: (data) => {
                        console.log('Wallet submitted tx:', data)
                        setLastSigningPayload(null)
                      },
                      onCancel: () => {
                        console.warn('User cancelled wallet signing')
                      }
                    })
                  } catch (err) {
                    console.error('Wallet signing failed:', err)
                    alert('Wallet signing failed: ' + (err?.message || String(err)))
                  }
                }}
                style={{ marginLeft: '12px' }}
              >
                Open Wallet to Sign
              </button>
              {!window.StacksProvider && !window.LeatherProvider && (
                <span style={{ marginLeft: 12, color: '#ef4444' }}>
                  Wallet not detected
                </span>
              )}
            </>
          )}
        </form>
      </div>

      <div className="payments-section">
        <div className="section-header">
          <h3>Recent Payments</h3>
          <button onClick={loadPayments} className="btn btn-sm">
            Refresh
          </button>
        </div>
        
        <div className="payments-list">
          {payments.map(payment => (
            <div key={payment.id} className="payment-item">
              <div className="payment-main">
                <div className="payment-amount">
                  {(payment.amount / 1000000).toFixed(6)} STX
                </div>
                <div className="payment-details">
                  <div className="payment-recipient">
                    To: {payment.recipient?.slice(0, 12)}...
                  </div>
                  <div className="payment-memo">
                    {payment.memo || 'No memo'}
                  </div>
                  <div className="payment-time">
                    {new Date(payment.createdAt).toLocaleString()}
                  </div>
                </div>
              </div>
              <div className="payment-status">
                <div 
                  className="status-dot"
                  style={{ backgroundColor: getStatusColor(payment.status) }}
                ></div>
                <span className="status-text">{payment.status}</span>
                {payment.txId && (
                  <a 
                    href={`https://explorer.stacks.co/txid/${payment.txId}?chain=testnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-sm explorer-btn"
                  >
                    🔍 Explorer
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>

        {payments.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">💸</div>
            <h3>No payments yet</h3>
            <p>Process your first payment to see it here</p>
          </div>
        )}
      </div>
    </div>
  )
}
