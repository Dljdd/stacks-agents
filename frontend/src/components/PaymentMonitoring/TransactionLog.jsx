import React, { useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';

export default function TransactionLog({ apiBase = '/api', wsUrl, owner }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [agent, setAgent] = useState('all');
  const [status, setStatus] = useState('all');
  const [q, setQ] = useState('');
  const [minAmt, setMinAmt] = useState('');
  const [maxAmt, setMaxAmt] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [agents, setAgents] = useState([]);
  const wsRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const [txRes, agentsRes] = await Promise.all([
          fetch(`${apiBase}/payments/recent?owner=${encodeURIComponent(owner || '')}`),
          fetch(`${apiBase}/agents?owner=${encodeURIComponent(owner || '')}`)
        ]);
        const [txJson, agJson] = await Promise.all([txRes.json().catch(()=>({ items: [] })), agentsRes.json().catch(()=>({ agents: [] }))]);
        if (!mounted) return;
        setItems(txJson.items || []);
        setAgents(agJson.agents || []);
      } catch (e) {
        setError('Failed to load transactions');
      } finally {
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [apiBase, owner]);

  // realtime
  useEffect(() => {
    const url = wsUrl || (window.location.origin.replace('http', 'ws') + '/');
    const ws = new WebSocket(url);
    wsRef.current = ws;
    ws.onmessage = (evt) => {
      try {
        const { event, payload } = JSON.parse(evt.data);
        if (event?.startsWith('payment:')) {
          const entry = { ts: Date.now(), status: payload.status || event.replace('payment:', ''), ...payload };
          setItems((prev) => [entry, ...prev].slice(0, 500));
        }
      } catch {}
    };
    return () => ws.close();
  }, [wsUrl]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const min = minAmt ? Number(minAmt) : null;
    const max = maxAmt ? Number(maxAmt) : null;
    const fromTs = from ? new Date(from).getTime() : null;
    const toTs = to ? new Date(to).getTime() : null;
    return items.filter((it) => {
      const sOk = status === 'all' || (it.status || '').toLowerCase().includes(status);
      const aOk = agent === 'all' || it.agentId === agent;
      const qOk = !needle || Object.values(it).join(' ').toLowerCase().includes(needle);
      const amt = Number(it.amount || 0);
      const amtOk = (min === null || amt >= min) && (max === null || amt <= max);
      const ts = Number(it.ts || Date.now());
      const tOk = (fromTs === null || ts >= fromTs) && (toTs === null || ts <= toTs);
      return sOk && aOk && qOk && amtOk && tOk;
    });
  }, [items, status, agent, q, minAmt, maxAmt, from, to]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageItems = filtered.slice((page - 1) * pageSize, page * pageSize);

  const exportCSV = () => {
    const headers = ['ts','agentId','recipient','amount','status','txId'];
    const rows = filtered.map(i => [i.ts, i.agentId, i.recipient, i.amount, i.status, i.txId]);
    const csv = [headers.join(','), ...rows.map(r => r.map(String).map(s => '"' + s.replace(/"/g,'""') + '"').join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `transactions-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = () => {
    // Simple print-to-PDF via browser print dialog
    window.print();
  };

  return (
    <section className="space-y-3" aria-label="Transaction Log">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-medium">Transaction Log</h2>
        <div className="space-x-2">
          <button onClick={exportCSV} className="px-3 py-1 border rounded text-sm">Export CSV</button>
          <button onClick={exportPDF} className="px-3 py-1 border rounded text-sm">Export PDF</button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
        <div className="md:col-span-2">
          <label className="block text-xs mb-1">Search</label>
          <input value={q} onChange={e=> setQ(e.target.value)} className="w-full border rounded px-2 py-1" placeholder="Search any field" />
        </div>
        <div>
          <label className="block text-xs mb-1">Agent</label>
          <select value={agent} onChange={e=> { setAgent(e.target.value); setPage(1); }} className="w-full border rounded px-2 py-1">
            <option value="all">All</option>
            {agents.map(a => <option key={a.id} value={a.id}>{a.name || a.id}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs mb-1">Status</label>
          <select value={status} onChange={e=> { setStatus(e.target.value); setPage(1); }} className="w-full border rounded px-2 py-1">
            <option value="all">All</option>
            <option value="queued">Queued</option>
            <option value="processing">Processing</option>
            <option value="submitted">Submitted</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
            <option value="timeout">Timeout</option>
          </select>
        </div>
        <div>
          <label className="block text-xs mb-1">Min Amount</label>
          <input type="number" min="0" value={minAmt} onChange={e=> setMinAmt(e.target.value)} className="w-full border rounded px-2 py-1" />
        </div>
        <div>
          <label className="block text-xs mb-1">Max Amount</label>
          <input type="number" min="0" value={maxAmt} onChange={e=> setMaxAmt(e.target.value)} className="w-full border rounded px-2 py-1" />
        </div>
        <div>
          <label className="block text-xs mb-1">From</label>
          <input type="date" value={from} onChange={e=> setFrom(e.target.value)} className="w-full border rounded px-2 py-1" />
        </div>
        <div>
          <label className="block text-xs mb-1">To</label>
          <input type="date" value={to} onChange={e=> setTo(e.target.value)} className="w-full border rounded px-2 py-1" />
        </div>
        <div>
          <label className="block text-xs mb-1">Page size</label>
          <select value={pageSize} onChange={e=> { setPageSize(Number(e.target.value)); setPage(1); }} className="w-full border rounded px-2 py-1">
            {[10,25,50,100].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>

      {error && <div role="alert" className="text-sm text-red-700">{error}</div>}

      <div className="overflow-x-auto border rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-50">
            <tr>
              <th className="text-left p-2">Time</th>
              <th className="text-left p-2">Agent</th>
              <th className="text-left p-2">Recipient</th>
              <th className="text-left p-2">Amount</th>
              <th className="text-left p-2">Status</th>
              <th className="text-left p-2">Tx</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6" className="p-3">Loading…</td></tr>
            ) : pageItems.length ? pageItems.map((i, idx) => (
              <tr key={(i.id||i.txId||idx) + '-' + idx} className="border-t">
                <td className="p-2 text-xs whitespace-nowrap">{new Date(i.ts || Date.now()).toLocaleString()}</td>
                <td className="p-2">{i.agentId}</td>
                <td className="p-2 break-all">{i.recipient}</td>
                <td className="p-2">{i.amount}</td>
                <td className="p-2">
                  <span className={`px-2 py-0.5 rounded text-xs ${i.status === 'success' ? 'bg-green-100 text-green-800' : i.status === 'failed' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>{i.status}</span>
                </td>
                <td className="p-2">
                  {i.txId ? <a className="text-indigo-600 text-xs hover:underline" href={`https://explorer.stacks.co/txid/${i.txId}?chain=testnet`} target="_blank" rel="noreferrer">View</a> : '—'}
                </td>
              </tr>
            )) : (
              <tr><td colSpan="6" className="p-3">No transactions</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-xs">Page {page} / {totalPages}</div>
        <div className="space-x-2">
          <button onClick={()=> setPage(Math.max(1, page-1))} disabled={page<=1} className="px-2 py-1 border rounded text-xs disabled:opacity-50">Prev</button>
          <button onClick={()=> setPage(Math.min(totalPages, page+1))} disabled={page>=totalPages} className="px-2 py-1 border rounded text-xs disabled:opacity-50">Next</button>
        </div>
      </div>
    </section>
  );
}

TransactionLog.propTypes = {
  apiBase: PropTypes.string,
  wsUrl: PropTypes.string,
  owner: PropTypes.string,
};
