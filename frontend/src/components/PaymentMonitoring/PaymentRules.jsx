import React, { useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';

const RULE_TEMPLATES = [
  { name: 'Amount Range', type: 'amount', params: { min: 0, max: 0 }, actions: 'block' },
  { name: 'Business Hours', type: 'time', params: { start: 9, end: 17, weekendAllowed: false }, actions: 'block' },
  { name: 'Velocity Control', type: 'velocity', params: { maxPerHour: 10 }, actions: 'flag' },
];

export default function PaymentRules({ apiBase = '/api', owner, agentId }) {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', type: 'amount', priority: 1, action: 'block', params: {} });
  const [testPayload, setTestPayload] = useState({ amount: 0, recipient: '', hour: undefined, day: undefined });

  // Load existing rules (expects backend to expose /rules?agentId=)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`${apiBase}/rules?agentId=${encodeURIComponent(agentId || '')}`);
        const json = await res.json().catch(() => ({ rules: [] }));
        if (!mounted) return;
        setRules(json.rules || []);
      } catch (e) {
        setError('Failed to load rules');
      } finally {
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [apiBase, agentId]);

  const applyTemplate = (tpl) => {
    setForm({ name: tpl.name, type: tpl.type, priority: (rules.length + 1), action: tpl.actions, params: tpl.params });
  };

  const createRule = async () => {
    try {
      setError('');
      if (!form.name || !form.type) throw new Error('Missing fields');
      const body = { agentId, name: form.name, type: form.type, priority: Number(form.priority||1), action: form.action, params: form.params };
      const res = await fetch(`${apiBase}/rules`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error('Create failed');
      const { rule } = await res.json().catch(()=>({}));
      setRules((prev) => [rule || { id: Date.now(), ...body }, ...prev]);
      setForm({ name: '', type: 'amount', priority: (rules.length + 2), action: 'block', params: {} });
    } catch (e) {
      setError(e.message || 'Create failed');
    }
  };

  const removeRule = async (ruleId) => {
    try {
      const res = await fetch(`${apiBase}/rules/${encodeURIComponent(ruleId)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      setRules((prev) => prev.filter((r) => r.id !== ruleId));
    } catch (e) {
      setError(e.message || 'Delete failed');
    }
  };

  const movePriority = async (ruleId, dir) => {
    const idx = rules.findIndex((r) => r.id === ruleId);
    if (idx < 0) return;
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= rules.length) return;
    const copy = [...rules];
    const [a, b] = [copy[idx], copy[swapIdx]];
    [a.priority, b.priority] = [b.priority, a.priority];
    [copy[idx], copy[swapIdx]] = [b, a];
    setRules(copy);
    // Persist priorities
    try {
      await fetch(`${apiBase}/rules/${encodeURIComponent(a.id)}/priority`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ priority: a.priority }) });
      await fetch(`${apiBase}/rules/${encodeURIComponent(b.id)}/priority`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ priority: b.priority }) });
    } catch {}
  };

  const testRuleEvaluation = async () => {
    try {
      setError('');
      const body = { agentId, paymentData: testPayload };
      const res = await fetch(`${apiBase}/rules/test`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const json = await res.json();
      alert(`Evaluation result: ${json.action || 'unknown'}`);
    } catch (e) {
      setError('Rule evaluation failed (ensure backend routes exist)');
    }
  };

  const paramFields = useMemo(() => {
    switch (form.type) {
      case 'amount':
        return (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs mb-1">Min</label>
              <input type="number" value={form.params.min||0} onChange={(e)=> setForm(f=> ({...f, params: { ...f.params, min: Number(e.target.value) }}))} className="w-full border rounded px-2 py-1" />
            </div>
            <div>
              <label className="block text-xs mb-1">Max</label>
              <input type="number" value={form.params.max||0} onChange={(e)=> setForm(f=> ({...f, params: { ...f.params, max: Number(e.target.value) }}))} className="w-full border rounded px-2 py-1" />
            </div>
          </div>
        );
      case 'time':
        return (
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs mb-1">Start hour</label>
              <input type="number" min="0" max="23" value={form.params.start||9} onChange={(e)=> setForm(f=> ({...f, params: { ...f.params, start: Number(e.target.value) }}))} className="w-full border rounded px-2 py-1" />
            </div>
            <div>
              <label className="block text-xs mb-1">End hour</label>
              <input type="number" min="0" max="23" value={form.params.end||17} onChange={(e)=> setForm(f=> ({...f, params: { ...f.params, end: Number(e.target.value) }}))} className="w-full border rounded px-2 py-1" />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={!!form.params.weekendAllowed} onChange={(e)=> setForm(f=> ({...f, params: { ...f.params, weekendAllowed: e.target.checked }}))} /> Weekend allowed</label>
            </div>
          </div>
        );
      case 'velocity':
        return (
          <div>
            <label className="block text-xs mb-1">Max tx per hour</label>
            <input type="number" min="1" value={form.params.maxPerHour||10} onChange={(e)=> setForm(f=> ({...f, params: { ...f.params, maxPerHour: Number(e.target.value) }}))} className="w-full border rounded px-2 py-1" />
          </div>
        );
      default:
        return null;
    }
  }, [form]);

  return (
    <section className="space-y-4" aria-label="Payment Rules">
      <header className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Payment Rules</h2>
        <div className="text-sm opacity-70">Agent: {agentId}</div>
      </header>

      {error && <div role="alert" className="text-sm text-red-700">{error}</div>}

      <div className="p-4 border rounded bg-white dark:bg-neutral-900 space-y-3">
        <div className="flex gap-2 flex-wrap">
          {RULE_TEMPLATES.map((t) => (
            <button key={t.name} onClick={()=> applyTemplate(t)} className="px-3 py-1 border rounded text-xs">Use {t.name}</button>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs mb-1">Name</label>
            <input value={form.name} onChange={(e)=> setForm(f=> ({...f, name: e.target.value}))} className="w-full border rounded px-2 py-1" placeholder="Rule name" />
          </div>
          <div>
            <label className="block text-xs mb-1">Type</label>
            <select value={form.type} onChange={(e)=> setForm(f=> ({...f, type: e.target.value}))} className="w-full border rounded px-2 py-1">
              <option value="amount">Amount</option>
              <option value="time">Time</option>
              <option value="velocity">Velocity</option>
            </select>
          </div>
          <div>
            <label className="block text-xs mb-1">Priority</label>
            <input type="number" min="1" value={form.priority} onChange={(e)=> setForm(f=> ({...f, priority: Number(e.target.value)}))} className="w-full border rounded px-2 py-1" />
          </div>
          <div>
            <label className="block text-xs mb-1">Action</label>
            <select value={form.action} onChange={(e)=> setForm(f=> ({...f, action: e.target.value}))} className="w-full border rounded px-2 py-1">
              <option value="allow">Allow</option>
              <option value="block">Block</option>
              <option value="flag">Flag</option>
            </select>
          </div>
        </div>
        {paramFields}
        <div className="text-right">
          <button onClick={createRule} className="px-3 py-1 rounded bg-indigo-600 text-white text-sm">Create Rule</button>
        </div>
      </div>

      <div className="p-4 border rounded bg-white dark:bg-neutral-900">
        <h3 className="font-medium mb-3">Existing Rules</h3>
        <ul className="divide-y">
          {loading && <li className="py-2 text-sm">Loading…</li>}
          {!loading && rules.length === 0 && <li className="py-2 text-sm opacity-70">No rules.</li>}
          {rules.map((r, idx) => (
            <li key={r.id || idx} className="py-2 flex items-center justify-between gap-3">
              <div>
                <div className="font-medium text-sm">{r.name || r.type} <span className="opacity-60">(prio {r.priority})</span></div>
                <div className="text-xs opacity-70">action: {r.action} · params: {JSON.stringify(r.params || {})}</div>
              </div>
              <div className="space-x-2">
                <button onClick={()=> movePriority(r.id, 'up')} className="px-2 py-1 border rounded text-xs">Up</button>
                <button onClick={()=> movePriority(r.id, 'down')} className="px-2 py-1 border rounded text-xs">Down</button>
                <button onClick={()=> removeRule(r.id)} className="px-2 py-1 border rounded text-xs">Delete</button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="p-4 border rounded bg-white dark:bg-neutral-900">
        <h3 className="font-medium mb-3">Test & Validate</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs mb-1">Amount</label>
            <input type="number" value={testPayload.amount} onChange={(e)=> setTestPayload(p=> ({...p, amount: Number(e.target.value)}))} className="w-full border rounded px-2 py-1" />
          </div>
          <div>
            <label className="block text-xs mb-1">Recipient</label>
            <input value={testPayload.recipient||''} onChange={(e)=> setTestPayload(p=> ({...p, recipient: e.target.value}))} className="w-full border rounded px-2 py-1" />
          </div>
          <div>
            <label className="block text-xs mb-1">Hour (0-23)</label>
            <input type="number" min="0" max="23" value={testPayload.hour ?? ''} onChange={(e)=> setTestPayload(p=> ({...p, hour: Number(e.target.value)}))} className="w-full border rounded px-2 py-1" />
          </div>
          <div>
            <label className="block text-xs mb-1">Day (0-6)</label>
            <input type="number" min="0" max="6" value={testPayload.day ?? ''} onChange={(e)=> setTestPayload(p=> ({...p, day: Number(e.target.value)}))} className="w-full border rounded px-2 py-1" />
          </div>
        </div>
        <div className="text-right mt-3">
          <button onClick={testRuleEvaluation} className="px-3 py-1 rounded bg-green-600 text-white text-sm">Run Test</button>
        </div>
      </div>
    </section>
  );
}

PaymentRules.propTypes = {
  apiBase: PropTypes.string,
  owner: PropTypes.string,
  agentId: PropTypes.string.isRequired,
};
