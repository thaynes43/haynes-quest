import { useEffect, useRef, useState } from "react";

export function NumberField({
  label,
  value,
  onCommit,
  min,
  max,
  step = 0.1,
  integer = false,
}: {
  label: string;
  value: number;
  onCommit(value: number): void;
  min?: number;
  max?: number;
  step?: number;
  integer?: boolean;
}) {
  const [text, setText] = useState(String(value));
  const editing = useRef(false);
  const cancelBlur = useRef(false);
  useEffect(() => {
    if (!editing.current) setText(String(value));
  }, [value]);
  const commit = () => {
    editing.current = false;
    if (cancelBlur.current) {
      cancelBlur.current = false;
      setText(String(value));
      return;
    }
    if (text.trim() === "") {
      setText(String(value));
      return;
    }
    const parsed = Number(text);
    if (
      !Number.isFinite(parsed) ||
      (integer && !Number.isInteger(parsed)) ||
      (min !== undefined && parsed < min) ||
      (max !== undefined && parsed > max)
    ) {
      setText(String(value));
      return;
    }
    setText(String(parsed));
    if (parsed !== value) onCommit(parsed);
  };
  return (
    <label className="editor-field">
      <span>{label}</span>
      <input
        inputMode="decimal"
        type="number"
        value={text}
        min={min}
        max={max}
        step={step}
        onFocus={() => {
          editing.current = true;
        }}
        onChange={(event) => setText(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
          if (event.key === "Escape") {
            cancelBlur.current = true;
            setText(String(value));
            event.currentTarget.blur();
          }
        }}
      />
    </label>
  );
}

export function TextField({
  label,
  value,
  onCommit,
  maxLength = 80,
}: {
  label: string;
  value: string;
  onCommit(value: string): void;
  maxLength?: number;
}) {
  const [text, setText] = useState(value);
  const editing = useRef(false);
  const cancelBlur = useRef(false);
  useEffect(() => {
    if (!editing.current) setText(value);
  }, [value]);
  const commit = () => {
    editing.current = false;
    if (cancelBlur.current) {
      cancelBlur.current = false;
      setText(value);
      return;
    }
    const normalized = text.trim();
    if (!normalized) {
      setText(value);
      return;
    }
    setText(normalized);
    if (normalized !== value) onCommit(normalized);
  };
  return (
    <label className="editor-field">
      <span>{label}</span>
      <input
        value={text}
        maxLength={maxLength}
        onFocus={() => {
          editing.current = true;
        }}
        onChange={(event) => setText(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
          if (event.key === "Escape") {
            cancelBlur.current = true;
            setText(value);
            event.currentTarget.blur();
          }
        }}
      />
    </label>
  );
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  onCommit,
}: {
  label: string;
  value: T;
  options: readonly T[];
  onCommit(value: T): void;
}) {
  return (
    <label className="editor-field">
      <span>{label}</span>
      <select
        value={value}
        onChange={(event) => onCommit(event.target.value as T)}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

export function PositionFields({
  position,
  onCommit,
}: {
  position: Readonly<{ x: number; y: number; z: number }>;
  onCommit(position: { x: number; y: number; z: number }): void;
}) {
  const field = (axis: "x" | "y" | "z", label: string) => (
    <NumberField
      label={label}
      value={position[axis]}
      onCommit={(value) => onCommit({ ...position, [axis]: value })}
    />
  );
  return (
    <div className="editor-field-grid editor-position-fields">
      {field("x", "X")}
      {field("y", "Y")}
      {field("z", "Z")}
    </div>
  );
}
