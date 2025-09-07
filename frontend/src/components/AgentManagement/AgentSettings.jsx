import React, { useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import PermissionsPanel from './PermissionsPanel';

export default function AgentSettings({ apiBase = '/api', wsUrl, agentId, owner }) {
  const [agent, setAgent] = useState(null);
  const [daily, setDaily] = useState('0');
  const [monthly, setMonthly] = useState('0');
  const [perms, setPerms] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [logs, setLogs] = useState([]);
  const wsRef = useRef(null);

  const canSaveLimits = useMemo(() => Number(daily) >= 0 && Number(monthly) >= 0, [daily, monthly]);

  // Load agent snapshot and activity logs
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [agentsRes, logsRes] = await Promise.all([
          fetch(`${apiBase}/agents?owner=${encodeURIComponent(owner || '')}`),
          fetch(`${apiBase}/payments/recent?owner=${encodeURIComponent(owner || '')}&agentId=${encodeURIComponent(agentId || '')}`)
        ]);
        const [agentsJson, logsJson] = await Promise.all([agentsRes.json().catch(()=>({ agents: [] })), logsRes.json().catch(()=>({ items: [] }))]);
        if (!mounted) return;
        const found = (agentsJson.agents || []).find(a => a.id === agentId) || { id: agentId, status: 'unknown' };
        setAgent(found);
        setDaily(String(found.dailyLimit ?? '0'));
        setMonthly(String(found.monthlyLimit ?? '0'));
        setPerms(found.permissions || []);
        setLogs(logsJson.items || []);
      } catch (e) {
        setError('Failed to load agent');
      }
    })();
    return () => { mounted = false; };
  }, [apiBase, agentId, owner]);

  // Realtime updates
  useEffect(() => {
    const url = wsUrl || (window.location.origin.replace('http', 'ws') + '/');
    const ws = new WebSocket(url);
    wsRef.current = ws;
    ws.onmessage = (evt) => {
      try {
        const { event, payload } = JSON.parse(evt.data);
        if (event?.startsWith('agent:') && payload.agentId === agentId) {
          setAgent((prev) => ({ ...(prev || {}), ...payload }));
        }
        if (event?.startsWith('payment:') && (payload.agentId === agentId)) {
          setLogs((prev) => [{ ts: Date.now(), event, ...payload }, ...prev].slice(0, 100));
        }
      } catch {}
    };
    return () => ws.close();
  }, [wsUrl, agentId]);

  const saveLimits = async () => {
    try {
      setSaving(true); setError('');
      const d = Math.max(0, Number(daily || '0'));
      const m = Math.max(0, Number(monthly || '0'));
      const body = { token: '', agentId, daily: d, monthly: m };
      const res = await fetch(`${apiBase}/agents/limits`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error('Failed to save limits');
      setAgent((a) => ({ ...(a || {}), dailyLimit: d, monthlyLimit: m }));
    } catch (e) {
      setError(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const toggleAuth = async () => {
    try {
      setSaving(true); setError('');
      const action = agent?.status === 'authorized' ? 'deauthorize' : 'authorize';
      const res = await fetch(`${apiBase}/agents/authorize`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: '', agentId, action }) });
      if (!res.ok) throw new Error('Failed to update status');
      setAgent((a) => ({ ...(a || {}), status: action === 'authorize' ? 'authorized' : 'deauthorized' }));
    } catch (e) {
      setError(e.message || 'Status update failed');
    } finally { setSaving(false); }
  };

  return (
    <section className="space-y-4" aria-label="Agent Settings">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium">Agent Settings</h2>
          <p className="text-xs opacity-70">{agentId}</p>
        </div>
        <div className="space-x-2">
          <span className={`px-2 py-0.5 rounded text-xs ${agent?.status === 'authorized' ? 'bg-green-100 text-green-800' : agent?.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>{agent?.status || 'unknown'}</span>
          <button onClick={toggleAuth} disabled={saving} className="px-3 py-1 border rounded text-sm disabled:opacity-50">{agent?.status === 'authorized' ? 'Disable' : 'Enable'}</button>
        </div>
      </header>

      {error && <div role="alert" className="text-sm text-red-700">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <div className="p-4 border rounded bg-white dark:bg-neutral-900">
            <h3 className="font-medium mb-3">Spending Limits</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm mb-1">Daily (uSTX)</label>
                <input type="number" min="0" value={daily} onChange={(e)=> setDaily(e.target.value)} className="w-full border rounded px-2 py-1" />
              </div>
              <div>
                <label className="block text-sm mb-1">Monthly (uSTX)</label>
                <input type="number" min="0" value={monthly} onChange={(e)=> setMonthly(e.target.value)} className="w-full border rounded px-2 py-1" />
              </div>
            </div>
            <div className="mt-3">
              <button onClick={saveLimits} disabled={!canSaveLimits || saving} className="px-3 py-1 rounded bg-indigo-600 text-white text-sm disabled:opacity-50">Save Limits</button>
            </div>
          </div>

          <div className="p-4 border rounded bg-white dark:bg-neutral-900">
            <h3 className="font-medium mb-3">Permissions</h3>
            <PermissionsPanel available={['payments:execute','payments:read','agents:read']} value={perms} onChange={setPerms} disabled />
            <p className="text-xs opacity-70 mt-2">Permission updates require backend endpoint (update-permissions) and are currently read-only here.</p>
          </div>

          <div className="p-4 border rounded bg-white dark:bg-neutral-900">
            <h3 className="font-medium mb-3">Emergency Controls</h3>
            <div className="space-x-2">
              <button disabled className="px-3 py-1 rounded bg-red-600/30 text-red-800 text-sm cursor-not-allowed" title="Not wired to backend">Halt Agent Payments</button>
              <button disabled className="px-3 py-1 rounded bg-green-600/30 text-green-800 text-sm cursor-not-allowed" title="Not wired to backend">Resume Agent Payments</button>
            </div>
            <p className="text-xs opacity-70 mt-2">Requires payment-processor halting endpoints in backend.</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="p-4 border rounded bg-white dark:bg-neutral-900">
            <h3 className="font-medium mb-3">Activity Logs</h3>
            <ul className="text-sm max-h-72 overflow-auto divide-y">
              {logs.length === 0 && <li className="py-2 opacity-60">No recent activity.</li>}
              {logs.map((l, i) => (
                <li key={i} className="py-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs opacity-70">{new Date(l.ts || Date.now()).toLocaleString()}</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800">{l.event || l.status || 'event'}</span>
                  </div>
                  <div className="text-xs break-all mt-1">{l.txId ? `tx: ${l.txId}` : ''}</div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

AgentSettings.propTypes = {
  apiBase: PropTypes.string,
  wsUrl: PropTypes.string,
  agentId: PropTypes.string.isRequired,
  owner: PropTypes.string,
};
