import React, { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Legend);

export default function PaymentAnalytics({ apiBase = '/api', owner }) {
  const [range, setRange] = useState('30d'); // 7d, 30d, 90d
  const [agentId, setAgentId] = useState('all');
  const [data, setData] = useState({ points: [], categories: [], agents: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true); setError('');
        const qs = new URLSearchParams({ owner: owner || '', range, agentId });
        const [trendRes, catRes, agRes] = await Promise.all([
          fetch(`${apiBase}/analytics/spending?${qs.toString()}`),
          fetch(`${apiBase}/analytics/categories?${qs.toString()}`),
          fetch(`${apiBase}/agents?owner=${encodeURIComponent(owner || '')}`),
        ]);
        const [trend, cats, ags] = await Promise.all([
          trendRes.json().catch(()=>({ points: [] })),
          catRes.json().catch(()=>({ items: [] })),
          agRes.json().catch(()=>({ agents: [] })),
        ]);
        if (!mounted) return;
        setData({ points: trend.points || [], categories: cats.items || [], agents: ags.agents || [] });
      } catch (e) {
        setError('Failed to load analytics');
      } finally { setLoading(false); }
    })();
    return () => { mounted = false; };
  }, [apiBase, owner, range, agentId]);

  const trendChart = useMemo(() => ({
    labels: data.points.map(p => p.label),
    datasets: [{ label: 'Spending (STX)', data: data.points.map(p => p.value), borderColor: 'rgb(99,102,241)', backgroundColor: 'rgba(99,102,241,0.2)' }],
  }), [data.points]);

  const categoryChart = useMemo(() => ({
    labels: data.categories.map(c => c.category || 'uncategorized'),
    datasets: [{ label: 'By Category', data: data.categories.map(c => c.total), backgroundColor: ['#6366f1','#22c55e','#f59e0b','#ef4444','#14b8a6','#a78bfa'] }],
  }), [data.categories]);

  const agentPerf = useMemo(() => {
    const byAgent = {};
    for (const p of data.points) {
      if (!p.agentId) continue;
      byAgent[p.agentId] = (byAgent[p.agentId] || 0) + (p.value || 0);
    }
    const labels = Object.keys(byAgent);
    const values = labels.map(k => byAgent[k]);
    return { labels, datasets: [{ label: 'Agent Total (STX)', data: values, backgroundColor: '#60a5fa' }] };
  }, [data.points]);

  return (
    <section className="space-y-4" aria-label="Payment Analytics">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-medium">Payment Analytics</h2>
        <div className="flex items-center gap-2">
          <select value={agentId} onChange={(e)=> setAgentId(e.target.value)} className="border rounded px-2 py-1 text-sm">
            <option value="all">All agents</option>
            {data.agents.map(a => <option key={a.id} value={a.id}>{a.name || a.id}</option>)}
          </select>
          <select value={range} onChange={(e)=> setRange(e.target.value)} className="border rounded px-2 py-1 text-sm">
            <option value="7d">Last 7d</option>
            <option value="30d">Last 30d</option>
            <option value="90d">Last 90d</option>
          </select>
        </div>
      </header>

      {error && <div role="alert" className="text-sm text-red-700">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 p-4 border rounded bg-white dark:bg-neutral-900">
          <h3 className="font-medium mb-2">Spending Trend</h3>
          {loading ? <div className="text-sm">Loading…</div> : <Line data={trendChart} options={{ responsive: true, plugins: { legend: { display: false } } }} />}
        </div>
        <div className="p-4 border rounded bg-white dark:bg-neutral-900">
          <h3 className="font-medium mb-2">Category Split</h3>
          {loading ? <div className="text-sm">Loading…</div> : <Doughnut data={categoryChart} options={{ responsive: true }} />}
        </div>
        <div className="lg:col-span-3 p-4 border rounded bg-white dark:bg-neutral-900">
          <h3 className="font-medium mb-2">Agent Performance</h3>
          {loading ? <div className="text-sm">Loading…</div> : <Bar data={agentPerf} options={{ responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }} />}
        </div>
      </div>
    </section>
  );
}

PaymentAnalytics.propTypes = {
  apiBase: PropTypes.string,
  owner: PropTypes.string,
};
