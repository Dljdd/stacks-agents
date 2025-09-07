import React, { useState, useEffect } from 'react'

export default function Analytics({ api }) {
  const [analytics, setAnalytics] = useState({
    trend: [],
    byCategory: [],
    agentPerformance: []
  })
  const [timeframe, setTimeframe] = useState('week')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadAnalytics()
  }, [timeframe])

  async function loadAnalytics() {
    setLoading(true)
    try {
      const response = await api.get(`/analytics/spending?period=${timeframe}`)
      setAnalytics(response.data)
    } catch (error) {
      console.error('Failed to load analytics:', error)
      // Mock data for demo
      setAnalytics({
        trend: [
          { date: '2025-09-01', amount: 3500000 },
          { date: '2025-09-02', amount: 2800000 },
          { date: '2025-09-03', amount: 4200000 }
        ],
        byCategory: [
          { name: 'hosting', amount: 5200000 },
          { name: 'services', amount: 3100000 },
          { name: 'utilities', amount: 2200000 }
        ],
        agentPerformance: [
          { agentId: 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG', successRate: 0.98, totalAmount: 8500000 },
          { agentId: 'ST3TESTOWNER', successRate: 0.95, totalAmount: 2000000 }
        ]
      })
    } finally {
      setLoading(false)
    }
  }

  const totalVolume = analytics.byCategory.reduce((sum, cat) => sum + cat.amount, 0)
  const avgSuccessRate = analytics.agentPerformance.length > 0 
    ? analytics.agentPerformance.reduce((sum, agent) => sum + agent.successRate, 0) / analytics.agentPerformance.length
    : 0

  return (
    <div className="analytics">
      <div className="section-header">
        <h2>Analytics & Insights</h2>
        <div className="timeframe-selector">
          <select value={timeframe} onChange={(e) => setTimeframe(e.target.value)}>
            <option value="day">Last 24 Hours</option>
            <option value="week">Last Week</option>
            <option value="month">Last Month</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="loading-state">Loading analytics...</div>
      ) : (
        <>
          <div className="analytics-overview">
            <div className="overview-card">
              <div className="overview-value">{(totalVolume / 1000000).toFixed(2)} STX</div>
              <div className="overview-label">Total Volume</div>
            </div>
            <div className="overview-card">
              <div className="overview-value">{analytics.agentPerformance.length}</div>
              <div className="overview-label">Active Agents</div>
            </div>
            <div className="overview-card">
              <div className="overview-value">{(avgSuccessRate * 100).toFixed(1)}%</div>
              <div className="overview-label">Avg Success Rate</div>
            </div>
            <div className="overview-card">
              <div className="overview-value">{analytics.trend.length}</div>
              <div className="overview-label">Days Tracked</div>
            </div>
          </div>

          <div className="analytics-charts">
            <div className="chart-container">
              <h3>Volume Trend</h3>
              <div className="trend-chart">
                {analytics.trend.map((point, index) => (
                  <div key={index} className="trend-bar">
                    <div 
                      className="bar"
                      style={{ 
                        height: `${(point.amount / Math.max(...analytics.trend.map(p => p.amount))) * 100}%` 
                      }}
                    ></div>
                    <div className="bar-label">
                      {new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="chart-container">
              <h3>Spending by Category</h3>
              <div className="category-chart">
                {analytics.byCategory.map((category, index) => (
                  <div key={index} className="category-item">
                    <div className="category-info">
                      <span className="category-name">{category.name}</span>
                      <span className="category-amount">
                        {(category.amount / 1000000).toFixed(2)} STX
                      </span>
                    </div>
                    <div className="category-bar">
                      <div 
                        className="bar-fill"
                        style={{ 
                          width: `${(category.amount / totalVolume) * 100}%`,
                          backgroundColor: `hsl(${index * 120}, 70%, 50%)`
                        }}
                      ></div>
                    </div>
                    <div className="category-percentage">
                      {((category.amount / totalVolume) * 100).toFixed(1)}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="agent-performance">
            <h3>Agent Performance</h3>
            <div className="performance-table">
              <div className="table-header">
                <div>Agent</div>
                <div>Total Volume</div>
                <div>Success Rate</div>
                <div>Status</div>
              </div>
              {analytics.agentPerformance.map((agent, index) => (
                <div key={index} className="table-row">
                  <div className="agent-id">
                    {agent.agentId.slice(0, 12)}...
                  </div>
                  <div className="agent-volume">
                    {(agent.totalAmount / 1000000).toFixed(2)} STX
                  </div>
                  <div className="agent-success">
                    <div className="success-bar">
                      <div 
                        className="success-fill"
                        style={{ width: `${agent.successRate * 100}%` }}
                      ></div>
                    </div>
                    <span>{(agent.successRate * 100).toFixed(1)}%</span>
                  </div>
                  <div className={`agent-status ${agent.successRate > 0.95 ? 'excellent' : agent.successRate > 0.9 ? 'good' : 'needs-attention'}`}>
                    {agent.successRate > 0.95 ? 'Excellent' : agent.successRate > 0.9 ? 'Good' : 'Needs Attention'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
