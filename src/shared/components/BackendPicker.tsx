// chatApp-frontend/src/shared/components/BackendPicker.tsx
import React from "react";
import { BACKENDS, BACKEND_REGISTRY, type BackendKey } from "@/shared/backend";

type Props = {
  value: BackendKey;
  onChange?: (next: BackendKey) => void;
  label?: string;
};

export default function BackendPicker({ value, onChange, label = "Backend:" }: Props) {
  return (
    <div className="backend-picker">
      <label className="backend-picker__label">
        {label}
        <select
          className="backend-picker__select"
          value={value}
          onChange={(e) => onChange?.(e.target.value as BackendKey)}
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