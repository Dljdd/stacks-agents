import React, { useState, useEffect } from 'react'

export default function Dashboard({ api }) {
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
      const [agentsRes, paymentsRes, analyticsRes] = await Promise.all([
        api.get('/agents/list'),
        api.get('/payments/history?limit=5'),
        api.get('/analytics/spending').catch(() => ({ data: { agentPerformance: [] } }))
      ])

      const agents = agentsRes.data.items || []
      const payments = paymentsRes.data.items || []
      const analytics = analyticsRes.data.agentPerformance || []

      setStats({
        totalAgents: agents.length,
        totalPayments: payments.length,
        totalVolume: payments.reduce((sum, p) => sum + (p.amount || 0), 0),
        successRate: analytics.length > 0 ? analytics[0].successRate * 100 : 95
      })

      setRecentActivity(payments.map(p => ({
        id: p.id,
        type: 'payment',
        description: `Payment of ${(p.amount / 1000000).toFixed(2)} STX to ${p.recipient?.slice(0, 8)}...`,
        status: p.status,
        timestamp: p.createdAt
      })))
    } catch (error) {
      console.error('Failed to load dashboard data:', error)
    }
  }

  return (
    <div className="dashboard">
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{stats.totalAgents}</div>
          <div className="stat-label">Active Agents</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.totalPayments}</div>
          <div className="stat-label">Total Payments</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{(stats.totalVolume / 1000000).toFixed(2)} STX</div>
          <div className="stat-label">Total Volume</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.successRate.toFixed(1)}%</div>
          <div className="stat-label">Success Rate</div>
        </div>
      </div>

      <div className="recent-activity">
        <h3>Recent Activity</h3>
        <div className="activity-list">
          {recentActivity.map(activity => (
            <div key={activity.id} className="activity-item">
              <div className="activity-icon">
                {activity.type === 'payment' ? '💰' : '🤖'}
              </div>
              <div className="activity-content">
                <div className="activity-description">{activity.description}</div>
                <div className="activity-timestamp">
                  {new Date(activity.timestamp).toLocaleString()}
                </div>
              </div>
              <div className={`activity-status status-${activity.status}`}>
                {activity.status}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
