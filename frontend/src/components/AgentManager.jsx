import React, { useState, useEffect } from 'react'
import { getAgentAddress, isSignedIn } from '../utils/walletSession'

export default function AgentManager({ api }) {
  const [agents, setAgents] = useState([])
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    owner: 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG',
    dailyLimit: 2000000,
    monthlyLimit: 5000000,
    permissions: ['stx:transfer']
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadAgents()
    // Prefill owner with connected wallet address if available
    try {
      if (isSignedIn()) {
        const addr = getAgentAddress({ network: 'testnet' })
        if (addr) {
          setFormData((prev) => ({ ...prev, owner: addr }))
        }
      }
    } catch {}
  }, [])

  async function loadAgents() {
    try {
      const response = await api.get('/agents/list')
      setAgents(response.data.items || [])
    } catch (error) {
      console.error('Failed to load agents:', error)
    }
  }

  async function createAgent(e) {
    e.preventDefault()
    setLoading(true)
    try {
      await api.post('/agents/create', {
        name: formData.name,
        owner: formData.owner,
        limits: {
          daily: parseInt(formData.dailyLimit),
          monthly: parseInt(formData.monthlyLimit)
        },
        permissions: formData.permissions
      })
      setShowCreateForm(false)
      setFormData({
        name: '',
        owner: 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG',
        dailyLimit: 2000000,
        monthlyLimit: 5000000,
        permissions: ['stx:transfer']
      })
      await loadAgents()
    } catch (error) {
      console.error('Failed to create agent:', error)
      alert('Failed to create agent: ' + (error.response?.data?.error?.message || error.message))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="agent-manager">
      <div className="section-header">
        <h2>Payment Agents</h2>
        <button 
          className="btn btn-primary"
          onClick={() => setShowCreateForm(true)}
        >
          + Create Agent
        </button>
      </div>

      {showCreateForm && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Create New Agent</h3>
              <button 
                className="close-btn"
                onClick={() => setShowCreateForm(false)}
              >
                ×
              </button>
            </div>
            <form onSubmit={createAgent} className="agent-form">
              <div className="form-group">
                <label>Agent Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="e.g., Hosting Payment Agent"
                  required
                />
              </div>
              <div className="form-group">
                <label>Owner Address</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                  type="text"
                  value={formData.owner}
                  onChange={(e) => setFormData({...formData, owner: e.target.value})}
                  placeholder="ST..."
                  required
                  style={{ flex: 1 }}
                />
                  {isSignedIn() && (
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => {
                        const addr = getAgentAddress({ network: 'testnet' })
                        if (addr) setFormData((prev) => ({ ...prev, owner: addr }))
                      }}
                    >
                      Use Connected Wallet
                    </button>
                  )}
                </div>
                {isSignedIn() && (
                  <small>Connected wallet will be the agent owner by default.</small>
                )}
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Daily Limit (microSTX)</label>
                  <input
                    type="number"
                    value={formData.dailyLimit}
                    onChange={(e) => setFormData({...formData, dailyLimit: e.target.value})}
                    min="0"
                  />
                  <small>{(formData.dailyLimit / 1000000).toFixed(2)} STX</small>
                </div>
                <div className="form-group">
                  <label>Monthly Limit (microSTX)</label>
                  <input
                    type="number"
                    value={formData.monthlyLimit}
                    onChange={(e) => setFormData({...formData, monthlyLimit: e.target.value})}
                    min="0"
                  />
                  <small>{(formData.monthlyLimit / 1000000).toFixed(2)} STX</small>
                </div>
              </div>
              <div className="form-actions">
                <button type="button" onClick={() => setShowCreateForm(false)}>
                  Cancel
                </button>
                <button type="submit" disabled={loading} className="btn btn-primary">
                  {loading ? 'Creating...' : 'Create Agent'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="agents-grid">
        {agents.map(agent => (
          <div key={agent.id} className="agent-card">
            <div className="agent-header">
              <h3>{agent.name}</h3>
              <div className={`status-badge status-${agent.status}`}>
                {agent.status}
              </div>
            </div>
            <div className="agent-details">
              <div className="detail-row">
                <span>Owner:</span>
                <span className="mono">{agent.owner?.slice(0, 12)}...</span>
              </div>
              <div className="detail-row">
                <span>Daily Limit:</span>
                <span>{(agent.limits?.daily / 1000000 || 0).toFixed(2)} STX</span>
              </div>
              <div className="detail-row">
                <span>Monthly Limit:</span>
                <span>{(agent.limits?.monthly / 1000000 || 0).toFixed(2)} STX</span>
              </div>
              <div className="detail-row">
                <span>Permissions:</span>
                <span>{agent.permissions?.join(', ') || 'None'}</span>
              </div>
            </div>
            <div className="agent-actions">
              <button className="btn btn-sm">View Details</button>
              <button className="btn btn-sm btn-outline">Edit</button>
            </div>
          </div>
        ))}
      </div>

      {agents.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">🤖</div>
          <h3>No agents yet</h3>
          <p>Create your first payment agent to get started</p>
          <button 
            className="btn btn-primary"
            onClick={() => setShowCreateForm(true)}
          >
            Create Agent
          </button>
        </div>
      )}
    </div>
  )
}
