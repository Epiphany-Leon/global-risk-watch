"use client";

import { FIELDS, Mapping } from "@/lib/schema";

const NONE = "__none__";

export default function ColumnMapping({
  columns,
  mapping,
  onChange,
}: {
  columns: string[];
  mapping: Mapping;
  onChange: (m: Mapping) => void;
}) {
  return (
    <div className="space-y-2 rounded-lg border border-edge bg-panel/60 p-3">
      <p className="text-xs text-muted">
        将你的数据列对应到标准字段（带 * 为必填）。 Map your columns to the canonical fields.
      </p>
      <div className="grid grid-cols-1 gap-2">
        {FIELDS.map((f) => (
          <label key={f.key} className="flex items-center justify-between gap-2 text-xs">
            <span className="text-fg/80">
              {f.label}
              {f.required ? " *" : ""}
            </span>
            <select
              className="w-40 rounded border border-edge bg-ink px-1.5 py-1 text-fg/90"
              value={mapping[f.key] ?? NONE}
              onChange={(e) =>
                onChange({ ...mapping, [f.key]: e.target.value === NONE ? null : e.target.value })
              }
            >
              <option value={NONE}>（无 / none）</option>
              {columns.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
    </div>
  );
}
