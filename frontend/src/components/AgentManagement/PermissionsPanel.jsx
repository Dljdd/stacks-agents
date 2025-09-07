import React from 'react';
import PropTypes from 'prop-types';

export default function PermissionsPanel({ available = [], value = [], onChange, disabled }) {
  const toggle = (perm) => {
    if (disabled) return;
    const set = new Set(value);
    if (set.has(perm)) set.delete(perm); else set.add(perm);
    onChange?.(Array.from(set));
  };
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">Permissions</legend>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {available.map((p) => (
          <label key={p} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="accent-indigo-600"
              checked={value.includes(p)}
              onChange={() => toggle(p)}
              disabled={disabled}
            />
            <span>{p}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

PermissionsPanel.propTypes = {
  available: PropTypes.array,
  value: PropTypes.array,
  onChange: PropTypes.func,
  disabled: PropTypes.bool,
};
