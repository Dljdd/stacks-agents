import React, { useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';

export default function PaymentLimits({ apiBase = '/api', wsUrl, agentId, owner }) {
  const [daily, setDaily] = useState('0');
  const [monthly, setMonthly] = useState('0');
  const [status, setStatus] = useState('unknown');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState(null);
  const wsRef = useRef(null);

  const canSave = useMemo(() => Number(daily) >= 0 && Number(monthly) >= 0, [daily, monthly]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch(`${apiBase}/agents?owner=${encodeURIComponent(owner || '')}`);
        const json = await res.json().catch(()=>({ agents: [] }));
        const ag = (json.agents || []).find(a => a.id === agentId) || {};
        if (!mounted) return;
        setDaily(String(ag.dailyLimit ?? '0'));
        setMonthly(String(ag.monthlyLimit ?? '0'));
        setStatus(ag.status || 'unknown');
        setInfo(ag);
      } catch (e) {
        setError('Failed to load limits');
      }
    })();
    return () => { mounted = false; };
  }, [apiBase, agentId, owner]);

  useEffect(() => {
    const url = wsUrl || (window.location.origin.replace('http', 'ws') + '/');
    const ws = new WebSocket(url);
    wsRef.current = ws;
    ws.onmessage = (evt) => {
      try {
        const { event, payload } = JSON.parse(evt.data);
        if (event === 'agent:limits' && payload.agentId === agentId) {
          setDaily(String(payload.daily));
          setMonthly(String(payload.monthly));
        }
        if (event === 'agent:auth-changed' && payload.agentId === agentId) {
          setStatus(payload.action === 'authorize' ? 'authorized' : 'deauthorized');
        }
      } catch {}
    };
    return () => ws.close();
  }, [wsUrl, agentId]);

  const save = async () => {
    try {
      setSaving(true); setError('');
      const d = Math.max(0, Number(daily || '0'));
      const m = Math.max(0, Number(monthly || '0'));
      const body = { token: '', agentId, daily: d, monthly: m };
      const res = await fetch(`${apiBase}/agents/limits`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error('Failed to save limits');
    } catch (e) {
      setError(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="p-4 border rounded bg-white dark:bg-neutral-900 space-y-3" aria-label="Payment Limits">
      <header className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Payment Limits</h2>
        <span className={`px-2 py-0.5 rounded text-xs ${status === 'authorized' ? 'bg-green-100 text-green-800' : status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>{status}</span>
      </header>

      {error && <div role="alert" className="text-sm text-red-700">{error}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm mb-1">Daily Limit (uSTX)</label>
          <input type="number" min="0" value={daily} onChange={(e)=> setDaily(e.target.value)} className="w-full border rounded px-2 py-1" />
        </div>
        <div>
          <label className="block text-sm mb-1">Monthly Limit (uSTX)</label>
          <input type="number" min="0" value={monthly} onChange={(e)=> setMonthly(e.target.value)} className="w-full border rounded px-2 py-1" />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-xs opacity-70">Agent: {agentId}</div>
        <button onClick={save} disabled={!canSave || saving} className="px-3 py-1 rounded bg-indigo-600 text-white text-sm disabled:opacity-50">{saving ? 'Saving…' : 'Save Limits'}</button>
      </div>

      {info && (
        <div className="text-xs opacity-70">
          <div>Spent (30d): {info.spent30d ?? '—'}</div>
          <div>Permissions: {(info.permissions||[]).join(', ') || '—'}</div>
        </div>
      )}
    </section>
  );
}

PaymentLimits.propTypes = {
  apiBase: PropTypes.string,
  wsUrl: PropTypes.string,
  agentId: PropTypes.string.isRequired,
  owner: PropTypes.string,
};
