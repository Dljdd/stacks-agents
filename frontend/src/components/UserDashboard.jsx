import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { showConnect } from '@stacks/connect';
import { AppConfig, UserSession } from '@stacks/auth';
import { StacksTestnet } from '@stacks/network';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

// Basic Error Boundary
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('Dashboard error', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div role="alert" className="p-4 border rounded bg-red-50 text-red-800">
          <strong>Something went wrong.</strong>
          <pre className="whitespace-pre-wrap text-xs mt-2" aria-live="polite">{String(this.state.error)}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

ErrorBoundary.propTypes = { children: PropTypes.node };

// Theming helpers
const prefersDark = () => window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

// Subcomponents
function DashboardHeader({ connected, onConnect, address, theme, onToggleTheme, loading }) {
  return (
    <header className="flex items-center justify-between p-4 border-b sticky top-0 bg-white dark:bg-neutral-900 z-10">
      <nav className="flex items-center gap-4">
        <h1 className="text-xl font-semibold">Stacks Agents</h1>
        <a className="text-sm opacity-80 hover:opacity-100" href="#settings" onClick={(e)=>e.preventDefault()} aria-label="Settings access">Settings</a>
      </nav>
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleTheme}
          className="px-3 py-1 text-sm rounded border hover:bg-neutral-50 dark:hover:bg-neutral-800"
          aria-pressed={theme === 'dark'}
        >{theme === 'dark' ? 'Dark' : 'Light'}</button>
        {connected ? (
          <div className="text-sm" aria-live="polite">{loading ? 'Loading…' : address}</div>
        ) : (
          <button onClick={onConnect} className="px-3 py-1 rounded bg-indigo-600 text-white text-sm hover:bg-indigo-500">
            Connect Wallet
          </button>
        )}
      </div>
    </header>
  );
}

function AgentCard({ agent }) {
  const statusColor = agent.status === 'authorized' ? 'bg-green-100 text-green-800' : agent.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800';
  return (
    <div className="p-4 border rounded-lg bg-white dark:bg-neutral-900">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-medium">{agent.name || agent.id}</h3>
        <span className={`text-xs px-2 py-0.5 rounded ${statusColor}`} aria-label={`status ${agent.status}`}>{agent.status}</span>
      </div>
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <div><dt className="opacity-60">Daily Limit</dt><dd>{agent.dailyLimit ?? '—'}</dd></div>
        <div><dt className="opacity-60">Monthly Limit</dt><dd>{agent.monthlyLimit ?? '—'}</dd></div>
        <div><dt className="opacity-60">Spent (30d)</dt><dd>{agent.spent30d ?? '—'}</dd></div>
        <div><dt className="opacity-60">Permissions</dt><dd title={(agent.permissions||[]).join(', ')}>{(agent.permissions||[]).slice(0,3).join(', ') || '—'}</dd></div>
      </dl>
    </div>
  );
}

AgentCard.propTypes = { agent: PropTypes.object.isRequired };

function AgentOverviewGrid({ agents }) {
  return (
    <section aria-label="Agent Overview" className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
      {agents.map((a)=> <AgentCard key={a.id} agent={a} />)}
      {agents.length === 0 && (
        <div className="p-6 border rounded bg-neutral-50 dark:bg-neutral-800 text-neutral-600" role="note">
          No agents yet. Create one from Quick Actions.
        </div>
      )}
    </section>
  );
}

AgentOverviewGrid.propTypes = { agents: PropTypes.array.isRequired };

function TransactionFeed({ txs }) {
  return (
    <section aria-label="Recent Transactions" className="space-y-2">
      <h2 className="text-lg font-medium">Recent Activity</h2>
      <ul className="divide-y" role="list">
        {txs.map((t)=> (
          <li key={t.id || t.txId} className="py-2 flex items-center justify-between">
            <div>
              <div className="text-sm">{t.agentId} → {t.recipient}</div>
              <div className="text-xs opacity-60">{t.amount} STX · {t.status || 'submitted'}</div>
            </div>
            {t.txId && <a className="text-xs text-indigo-600 hover:underline" href={`https://explorer.stacks.co/txid/${t.txId}?chain=testnet`} target="_blank" rel="noreferrer">View</a>}
          </li>
        ))}
        {txs.length === 0 && <li className="py-4 text-sm opacity-70">No recent transactions.</li>}
      </ul>
    </section>
  );
}

TransactionFeed.propTypes = { txs: PropTypes.array.isRequired };

function QuickActionsPanel({ onCreateAgent, onSendPayment, disabled }) {
  return (
    <section aria-label="Quick Actions" className="p-4 border rounded-lg bg-white dark:bg-neutral-900 flex gap-3 flex-wrap">
      <button onClick={onCreateAgent} disabled={disabled} className="px-3 py-2 text-sm rounded bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-800 dark:hover:bg-neutral-700 disabled:opacity-50">New Agent</button>
      <button onClick={onSendPayment} disabled={disabled} className="px-3 py-2 text-sm rounded bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50">Send Payment</button>
    </section>
  );
}

QuickActionsPanel.propTypes = { onCreateAgent: PropTypes.func, onSendPayment: PropTypes.func, disabled: PropTypes.bool };

function AnalyticsWidget({ dataPoints }) {
  const data = useMemo(()=> ({
    labels: dataPoints.map(d=> d.label),
    datasets: [{
      label: 'Spending (STX)',
      data: dataPoints.map(d=> d.value),
      borderColor: 'rgb(99, 102, 241)',
      backgroundColor: 'rgba(99, 102, 241, 0.2)'
    }]
  }), [dataPoints]);
  const options = { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } };
  return (
    <section aria-label="Spending Analytics" className="p-4 border rounded-lg bg-white dark:bg-neutral-900">
      <h2 className="text-lg font-medium mb-2">Spending Analytics</h2>
      <Line data={data} options={options} aria-label="Spending over time" />
    </section>
  );
}

AnalyticsWidget.propTypes = { dataPoints: PropTypes.array.isRequired };

function NotificationBar({ notifications }) {
  return (
    <section aria-live="polite" className="p-3 border rounded bg-yellow-50 text-yellow-900 dark:bg-yellow-900 dark:text-yellow-100">
      {notifications.length === 0 ? 'No new notifications.' : (
        <ul className="list-disc ml-4">
          {notifications.map((n, i)=> <li key={i} className="text-sm">{n.message}</li>)}
        </ul>
      )}
    </section>
  );
}

NotificationBar.propTypes = { notifications: PropTypes.array.isRequired };

// Main Dashboard component
export default function UserDashboard() {
  const [theme, setTheme] = useState(() => (prefersDark() ? 'dark' : 'light'));
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState('');
  const [agents, setAgents] = useState([]);
  const [txs, setTxs] = useState([]);
  const [analytics, setAnalytics] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const wsRef = useRef(null);

  // Apply theme
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  const connectWallet = useCallback(() => {
    const appConfig = new AppConfig(['store_write', 'publish_data']);
    const userSession = new UserSession({ appConfig });

    showConnect({
      appDetails: {
        name: 'Stacks Agents',
        icon: window.location.origin + '/icon.png',
      },
      userSession,
      onFinish: () => {
        const addr = userSession.loadUserData()?.profile?.stxAddress?.testnet || 'connected';
        setAddress(addr);
        setConnected(true);
        setLoading(true);
        // fetch initial data
        void fetchInitial(addr);
      },
      onCancel: () => {},
    });
  }, []);

  // Fetch initial data from backend
  const fetchInitial = useCallback(async (addr) => {
    try {
      const apiBase = process.env.REACT_APP_API_BASE || '/api';
      const [agentsRes, txRes, analyticsRes] = await Promise.all([
        fetch(`${apiBase}/agents?owner=${addr}`),
        fetch(`${apiBase}/payments/recent?owner=${addr}`),
        fetch(`${apiBase}/analytics/spending?owner=${addr}`),
      ]);
      const [agentsJson, txJson, anJson] = await Promise.all([
        agentsRes.json().catch(()=>({ agents: [] })),
        txRes.json().catch(()=>({ items: [] })),
        analyticsRes.json().catch(()=>({ points: [] })),
      ]);
      setAgents(agentsJson.agents || []);
      setTxs(txJson.items || []);
      setAnalytics((anJson.points || []).map((p)=> ({ label: p.label, value: p.value })));
    } catch (e) {
      setNotifications((n)=> [{ message: 'Failed to load initial data' }, ...n]);
    } finally {
      setLoading(false);
    }
  }, []);

  // WebSocket realtime updates
  useEffect(() => {
    const url = process.env.REACT_APP_WS_URL || (window.location.origin.replace('http', 'ws') + '/');
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.addEventListener('open', () => {
      setNotifications((n)=> [{ message: 'Connected to realtime updates' }, ...n]);
    });
    ws.addEventListener('message', (evt) => {
      try {
        const { event, payload } = JSON.parse(evt.data);
        if (event === 'agent:registered' || event === 'agent:auth-changed' || event === 'agent:limits') {
          setAgents((prev) => {
            const idx = prev.findIndex(a => a.id === payload.agentId);
            if (idx >= 0) {
              const copy = [...prev];
              copy[idx] = { ...copy[idx], ...payload };
              return copy;
            }
            return [{ id: payload.agentId, status: 'pending', ...payload }, ...prev];
          });
        }
        if (event === 'payment:queued' || event === 'payment:processing' || event === 'payment:submitted' || event === 'payment:failed' || event === 'payment:status') {
          setTxs((prev) => [{ id: payload.jobId || payload.txId, ...payload }, ...prev].slice(0, 50));
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('WS parse error', e);
      }
    });
    ws.addEventListener('close', () => {
      setNotifications((n)=> [{ message: 'Realtime connection closed' }, ...n]);
    });

    return () => ws.close();
  }, []);

  // Quick actions handlers
  const handleCreateAgent = useCallback(async () => {
    try {
      const apiBase = process.env.REACT_APP_API_BASE || '/api';
      const body = { token: '', agentId: address, permissions: ['payments:execute'] };
      await fetch(`${apiBase}/agents/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    } catch (e) {
      setNotifications((n)=> [{ message: 'Failed to create agent' }, ...n]);
    }
  }, [address]);

  const handleSendPayment = useCallback(async () => {
    try {
      const apiBase = process.env.REACT_APP_API_BASE || '/api';
      const body = { token: '', agentId: address, recipient: address, amount: 1 };
      await fetch(`${apiBase}/payments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    } catch (e) {
      setNotifications((n)=> [{ message: 'Failed to enqueue payment' }, ...n]);
    }
  }, [address]);

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
        <DashboardHeader
          connected={connected}
          onConnect={connectWallet}
          address={address}
          theme={theme}
          onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
          loading={loading}
        />

        <main className="max-w-7xl mx-auto p-4 space-y-6">
          <NotificationBar notifications={notifications} />

          <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
              <AgentOverviewGrid agents={agents} />
              <TransactionFeed txs={txs} />
            </div>
            <div className="space-y-6">
              <QuickActionsPanel onCreateAgent={handleCreateAgent} onSendPayment={handleSendPayment} disabled={!connected || loading} />
              <AnalyticsWidget dataPoints={analytics} />
            </div>
          </div>
        </main>
      </div>
    </ErrorBoundary>
  );
}
