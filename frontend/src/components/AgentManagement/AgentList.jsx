import React, { useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';

export default function AgentList({ apiBase = '/api', wsUrl, owner }) {
  const [agents, setAgents] = useState([]);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const wsRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`${apiBase}/agents?owner=${encodeURIComponent(owner || '')}`);
        const json = await res.json();
        if (!mounted) return;
        setAgents(json.agents || []);
      } catch (e) {
        setError('Failed to load agents');
      } finally {
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [apiBase, owner]);

  useEffect(() => {
    const url = wsUrl || (window.location.origin.replace('http', 'ws') + '/');
    const ws = new WebSocket(url);
    wsRef.current = ws;
    ws.onmessage = (evt) => {
      try {
        const { event, payload } = JSON.parse(evt.data);
        if (!event) return;
        if (event.startsWith('agent:')) {
          setAgents((prev) => {
            const idx = prev.findIndex(a => a.id === payload.agentId);
            if (idx >= 0) {
              const cp = [...prev];
              cp[idx] = { ...cp[idx], ...payload };
              return cp;
            }
            return [{ id: payload.agentId, status: 'pending', ...payload }, ...prev];
          });
        }
      } catch (e) {}
    };
    return () => ws.close();
  }, [wsUrl]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return agents.filter(a => {
      const matchQ = !needle || (a.id?.toLowerCase().includes(needle) || a.name?.toLowerCase().includes(needle));
      const matchS = statusFilter === 'all' || (a.status || '').toLowerCase() === statusFilter;
      return matchQ && matchS;
    });
  }, [agents, q, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageItems = filtered.slice((page - 1) * pageSize, page * pageSize);

  const quick = async (agentId, action) => {
    try {
      const body = { token: '', agentId, action: action === 'delete' ? 'deauthorize' : action };
      await fetch(`${apiBase}/agents/authorize`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    } catch (e) {
      setError('Action failed');
    }
  };

  return (
    <section className="space-y-3" aria-label="Agents List">
      <div className="flex items-end gap-3 flex-wrap">
        <div className="flex-1 min-w-[220px]">
          <label className="block text-xs mb-1">Search</label>
          <input value={q} onChange={e=> setQ(e.target.value)} className="w-full border rounded px-2 py-1" placeholder="Search by name or id" aria-label="Search agents" />
        </div>
        <div>
          <label className="block text-xs mb-1">Status</label>
          <select value={statusFilter} onChange={e=> setStatusFilter(e.target.value)} className="border rounded px-2 py-1" aria-label="Filter by status">
            <option value="all">All</option>
            <option value="authorized">Active</option>
            <option value="deauthorized">Inactive</option>
            <option value="pending">Pending</option>
          </select>
        </div>
        <div>
          <label className="block text-xs mb-1">Page size</label>
          <select value={pageSize} onChange={e=> { setPageSize(Number(e.target.value)); setPage(1); }} className="border rounded px-2 py-1" aria-label="Page size">
            {[10,20,50].map(n=> <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>

      {error && <div role="alert" className="text-sm text-red-700">{error}</div>}

      <div className="overflow-x-auto border rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-50">
            <tr>
              <th className="text-left p-2">Agent</th>
              <th className="text-left p-2">Status</th>
              <th className="text-left p-2">Daily</th>
              <th className="text-left p-2">Monthly</th>
              <th className="text-left p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="5" className="p-3">Loading…</td></tr>
            ) : pageItems.length ? pageItems.map(a => (
              <tr key={a.id} className="border-t">
                <td className="p-2">
                  <div className="font-medium">{a.name || a.id}</div>
                  <div className="opacity-60 text-xs">{a.id}</div>
                </td>
                <td className="p-2">
                  <span className={`px-2 py-0.5 rounded text-xs ${a.status === 'authorized' ? 'bg-green-100 text-green-800' : a.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>{a.status || 'unknown'}</span>
                </td>
                <td className="p-2">{a.dailyLimit ?? '—'}</td>
                <td className="p-2">{a.monthlyLimit ?? '—'}</td>
                <td className="p-2 space-x-2">
                  <button onClick={()=> quick(a.id, a.status === 'authorized' ? 'deauthorize' : 'authorize')} className="px-2 py-1 border rounded text-xs">{a.status === 'authorized' ? 'Disable' : 'Enable'}</button>
                  <button onClick={()=> quick(a.id, 'delete')} className="px-2 py-1 border rounded text-xs">Delete</button>
                </td>
              </tr>
            )) : (
              <tr><td colSpan="5" className="p-3">No agents</td></tr>
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

AgentList.propTypes = {
  apiBase: PropTypes.string,
  wsUrl: PropTypes.string,
  owner: PropTypes.string,
};
