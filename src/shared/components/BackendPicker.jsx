// src/components/BackendPicker.jsx
import React from 'react';
import { BACKENDS, BACKEND_REGISTRY } from '@/shared/backend/choice';

export default function BackendPicker({ value, onChange }) {
  return (
    <div className="backend-picker">
      <label className="backend-picker__label">
        Backend:
        <select
          className="backend-picker__select"
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
        >
          {BACKENDS.map((k) => (
            <option key={k} value={k}>
              {BACKEND_REGISTRY[k]?.label || k}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

