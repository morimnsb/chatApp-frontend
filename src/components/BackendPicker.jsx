// src/components/BackendPicker.jsx (یا هر اسمی که هست)
import React from 'react';
import { BACKENDS } from '@/backend/choice';

const LABELS = {
  reverb: 'Laravel + Reverb (real-time)',
  django: 'Django',
};

export default function BackendPicker({ value, onChange }) {
  return (
    <div style={{ padding: '4px 8px', fontSize: 12 }}>
      <label>
        Backend:&nbsp;
        <select value={value} onChange={onChange}>
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
