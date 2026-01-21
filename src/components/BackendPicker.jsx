// src/components/BackendPicker.jsx
import React from 'react';
import { BACKENDS } from '@/backend/choice';

const LABELS = {
  reverb: 'Laravel + Reverb (real-time)',
  django: 'Django',
};

export default function BackendPicker({ value, onChange }) {
  return (
    <div className="backend-picker">
      <label className="backend-picker__label">
        Backend:
        <select className="backend-picker__select" value={value} onChange={onChange}>
          {BACKENDS.map((k) => (
            <option key={k} value={k}>
              {LABELS[k] || k}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
