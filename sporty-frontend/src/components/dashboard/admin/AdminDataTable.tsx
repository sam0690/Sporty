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
    <section className="overflow-hidden rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117]">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead className="bg-[#1d1d26]">
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
          <tbody className="divide-y divide-[rgba(255,255,255,0.05)]">
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-5 py-8 text-center text-sm text-[#555560]"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={rowKey(row)} className="text-sm transition-colors hover:bg-[#1d1d26]">
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-5 py-3 text-[#f0f0f0] ${col.align === "right" ? "text-right" : ""}`}
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
