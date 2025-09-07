import React, { useCallback, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import PermissionsPanel from './PermissionsPanel';

const DEFAULT_PERMS = ['payments:execute', 'payments:read', 'agents:read'];

export default function CreateAgent({ apiBase = '/api', owner, onCreated }) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [permissions, setPermissions] = useState(['payments:execute']);
  const [dailyLimit, setDailyLimit] = useState('0');
  const [monthlyLimit, setMonthlyLimit] = useState('0');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const canNext1 = useMemo(() => name.trim().length >= 3, [name]);
  const canNext2 = useMemo(() => permissions.length > 0, [permissions]);

  const submit = useCallback(async () => {
    setError('');
    setSubmitting(true);
    try {
      // 1) Register agent (using agentId=owner for simplified model; adjust as needed)
      const registerBody = { token: '', agentId: owner, permissions };
      const res1 = await fetch(`${apiBase}/agents/register`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(registerBody)
      });
      if (!res1.ok) throw new Error('register_failed');

      // 2) Authorize
      const authorizeBody = { token: '', agentId: owner, action: 'authorize' };
      const res2 = await fetch(`${apiBase}/agents/authorize`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(authorizeBody)
      });
      if (!res2.ok) throw new Error('authorize_failed');

      // 3) Set spending limits
      const d = Math.max(0, Number(dailyLimit || '0'));
      const m = Math.max(0, Number(monthlyLimit || '0'));
      const limitsBody = { token: '', agentId: owner, daily: d, monthly: m };
      const res3 = await fetch(`${apiBase}/agents/limits`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(limitsBody)
      });
      if (!res3.ok) throw new Error('limits_failed');

      onCreated?.({ id: owner, name, description, permissions, dailyLimit: d, monthlyLimit: m, status: 'authorized' });
      setStep(1); setName(''); setDescription(''); setPermissions(['payments:execute']); setDailyLimit('0'); setMonthlyLimit('0');
    } catch (e) {
      setError(e.message || 'failed');
    } finally {
      setSubmitting(false);
    }
  }, [apiBase, dailyLimit, monthlyLimit, name, owner, permissions, onCreated]);

  return (
    <section className="p-4 border rounded-lg bg-white dark:bg-neutral-900 space-y-4" aria-label="Create Agent">
      <h2 className="text-lg font-medium">Create Agent</h2>
      {error && <div role="alert" className="text-sm text-red-700">{error}</div>}

      {step === 1 && (
        <div className="space-y-3">
          <div>
            <label className="block text-sm mb-1">Agent name</label>
            <input value={name} onChange={(e)=> setName(e.target.value)} className="w-full border rounded px-2 py-1" placeholder="My Trading Agent" aria-required="true" />
            <p className="text-xs opacity-70 mt-1">3+ characters</p>
          </div>
          <div>
            <label className="block text-sm mb-1">Description</label>
            <textarea value={description} onChange={(e)=> setDescription(e.target.value)} className="w-full border rounded px-2 py-1" rows={3} placeholder="What does this agent do?" />
          </div>
          <div className="flex justify-end">
            <button disabled={!canNext1} onClick={()=> setStep(2)} className="px-3 py-1 rounded bg-indigo-600 text-white disabled:opacity-50">Next</button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          <PermissionsPanel available={DEFAULT_PERMS} value={permissions} onChange={setPermissions} />
          <div className="flex justify-between">
            <button onClick={()=> setStep(1)} className="px-3 py-1 rounded border">Back</button>
            <button disabled={!canNext2} onClick={()=> setStep(3)} className="px-3 py-1 rounded bg-indigo-600 text-white disabled:opacity-50">Next</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm mb-1">Daily Limit (uSTX)</label>
              <input type="number" min="0" value={dailyLimit} onChange={(e)=> setDailyLimit(e.target.value)} className="w-full border rounded px-2 py-1" />
            </div>
            <div>
              <label className="block text-sm mb-1">Monthly Limit (uSTX)</label>
              <input type="number" min="0" value={monthlyLimit} onChange={(e)=> setMonthlyLimit(e.target.value)} className="w-full border rounded px-2 py-1" />
            </div>
          </div>
          <div className="flex justify-between">
            <button onClick={()=> setStep(2)} className="px-3 py-1 rounded border">Back</button>
            <button onClick={submit} disabled={submitting} className="px-3 py-1 rounded bg-green-600 text-white disabled:opacity-50">{submitting ? 'Creating…' : 'Create Agent'}</button>
          </div>
        </div>
      )}
    </section>
  );
}

CreateAgent.propTypes = {
  apiBase: PropTypes.string,
  owner: PropTypes.string.isRequired,
  onCreated: PropTypes.func,
};
