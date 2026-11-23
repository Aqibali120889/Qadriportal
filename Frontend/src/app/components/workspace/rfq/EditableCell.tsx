import React, { useState, useRef, useEffect } from "react";

export interface EditableCellProps {
  value: string | number | boolean | null | undefined;
  onSave?: (value: string | number | boolean | null) => void | Promise<void>;
  type?: "text" | "number" | "percent" | "bool" | "select";
  align?: "left" | "center" | "right";
  options?: Array<string | { label: string; value: string }>;
  prefix?: string;
  suffix?: string;
  readOnly?: boolean;
  modified?: boolean;
  style?: React.CSSProperties;
}

export default function EditableCell({
  value,
  onSave,
  type = "text",
  align = "left",
  options = [],
  prefix = "",
  suffix = "",
  readOnly = false,
  modified = false,
  style = {},
}: EditableCellProps) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState<string | number | boolean>(value ?? "");
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement | null>(null);

  useEffect(() => {
    setVal(value !== null && value !== undefined ? value : "");
  }, [value]);

  useEffect(() => {
    if (editing && type !== "select" && inputRef.current && "select" in inputRef.current) {
      (inputRef.current as HTMLInputElement).select();
    }
  }, [editing, type]);

  const fmt = (v: string | number | boolean | null | undefined): string => {
    if (v == null || v === "") return "—";
    let formatted: string | number = v as string | number;
    if (type === "number") {
      const num = Number(v);
      formatted = isNaN(num) ? String(v) : num.toLocaleString("en-PK");
    } else if (type === "percent") {
      const num = Number(v);
      formatted = isNaN(num) ? String(v) : (num * 100).toFixed(1) + "%";
    } else if (type === "bool") {
      formatted = v ? "Yes" : "No";
    }
    return `${prefix}${formatted}${suffix}`;
  };

  const commit = async (newVal?: string | number | boolean) => {
    setEditing(false);
    if (!onSave) return;

    const commitVal = newVal !== undefined ? newVal : val;
    let parsed: string | number | boolean | null;

    if (type === "number" || type === "percent") {
      if (commitVal === "" || commitVal == null) {
        parsed = null;
      } else {
        const cleaned = String(commitVal).replace(/[^0-9.-]/g, "");
        parsed = cleaned === "" ? null : parseFloat(cleaned);
      }
    } else if (type === "bool") {
      parsed = String(commitVal).toLowerCase() === "yes" || String(commitVal) === "true";
    } else {
      parsed = commitVal as string;
    }

    if (String(parsed) !== String(value ?? "")) {
      await onSave(parsed);
    }
  };

  if (readOnly) {
    return (
      <td
        style={{
          ...cellStyle,
          textAlign: align,
          background: "#eff6ff",
          color: "#1d4ed8",
          fontWeight: 600,
          cursor: "not-allowed",
          ...style,
        }}
      >
        <span>{fmt(value)}</span>
      </td>
    );
  }

  return (
    <td
      style={{
        ...cellStyle,
        textAlign: align,
        background: modified ? "#fef9c3" : "transparent",
        cursor: "default",
        position: "relative",
        ...style,
      }}
      onDoubleClick={() => !readOnly && setEditing(true)}
      onClick={() => !readOnly && type === "select" && setEditing(true)}
    >
      {modified && <span style={dotStyle} title="Modified" />}
      {editing ? (
        type === "select" ? (
          <select
            ref={inputRef as React.RefObject<HTMLSelectElement>}
            value={String(val)}
            onChange={(e) => {
              setVal(e.target.value);
              commit(e.target.value);
            }}
            onBlur={() => setEditing(false)}
            style={{ ...inputStyle, textAlign: align, cursor: "pointer" }}
            autoFocus
          >
            {options.map((opt) => {
              const optVal = typeof opt === "object" ? opt.value : opt;
              const optLabel = typeof opt === "object" ? opt.label : opt;
              return (
                <option key={optVal} value={optVal}>
                  {optLabel}
                </option>
              );
            })}
          </select>
        ) : (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            value={String(val)}
            onChange={(e) => setVal(e.target.value)}
            onBlur={() => commit()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === "Tab") {
                e.preventDefault();
                commit();
              }
              if (e.key === "Escape") {
                setEditing(false);
                setVal(value !== null && value !== undefined ? value : "");
              }
            }}
            style={{ ...inputStyle, textAlign: align }}
            autoFocus
          />
        )
      ) : (
        <span style={type === "select" ? { borderBottom: "1px dashed #9ca3af", cursor: "pointer" } : {}}>
          {fmt(value)} {type === "select" ? "▾" : ""}
        </span>
      )}
    </td>
  );
}

const cellStyle: React.CSSProperties = {
  padding: "8px 10px",
  fontSize: 13,
  verticalAlign: "middle",
  whiteSpace: "nowrap",
  borderBottom: "1px solid #f3f4f6",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  border: "2px solid #3b82f6",
  borderRadius: 4,
  padding: "2px 6px",
  fontSize: 13,
  outline: "none",
  background: "#fff",
};

const dotStyle: React.CSSProperties = {
  position: "absolute",
  top: 5,
  right: 3,
  width: 6,
  height: 6,
  borderRadius: "50%",
  background: "#f59e0b",
  display: "inline-block",
};
