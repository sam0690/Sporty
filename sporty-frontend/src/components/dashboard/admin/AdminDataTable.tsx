"use client";

import type { ReactNode } from "react";

export type AdminColumn<T> = {
  key: string;
  header: string;
  align?: "left" | "right";
  render: (row: T) => ReactNode;
};

type AdminDataTableProps<T> = {
  columns: AdminColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  emptyMessage?: string;
};

export function AdminDataTable<T>({
  columns,
  rows,
  rowKey,
  emptyMessage = "No results.",
}: AdminDataTableProps<T>) {
  return (
    <section className="overflow-hidden rounded-[3px] border border-white/8 bg-surface-1">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead className="bg-surface-3">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-5 py-3 font-barlow-condensed text-[10px] font-700 uppercase tracking-[3px] text-[#666] ${
                    col.align === "right" ? "text-right" : "text-left"
                  }`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-5 py-8 text-center text-sm text-fg-3"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={rowKey(row)} className="text-sm transition-colors hover:bg-surface-3">
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-5 py-3 text-fg-1 ${col.align === "right" ? "text-right" : ""}`}
                    >
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
