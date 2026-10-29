"use client";

import { useMemo, useRef, useState } from "react";

export type AdoptionCell = {
  text: string;
  sort: string | number;
};

export type AdoptionColumn = {
  key: string;
  label: string;
  numeric?: boolean;
};

export type AdoptionRow = {
  key: string;
  cells: AdoptionCell[];
};

function csvCell(value: string) {
  if (/[",\n]/.test(value)) return `"${value.replaceAll('"', '""')}"`;
  return value;
}

export function AdoptionTable({
  title,
  caption,
  file,
  period,
  columns,
  rows,
  empty,
}: {
  title: string;
  caption: string;
  file: string;
  period: number;
  columns: AdoptionColumn[];
  rows: AdoptionRow[];
  empty: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [dir, setDir] = useState<"asc" | "desc">("asc");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const dialogId = `adoption-${file}`;

  const visible = useMemo(() => {
    const matched = rows.filter((row) =>
      columns.every((column, index) => {
        const query = (filters[column.key] ?? "").trim().toLowerCase();
        if (!query) return true;
        const hay = row.cells[index]?.text.toLowerCase() ?? "";
        const tokens = query
          .split(",")
          .map((token) => token.trim())
          .filter(Boolean);
        if (tokens.length === 0) return true;
        return tokens.some((token) => hay.includes(token));
      }),
    );
    if (!sortKey) return matched;
    const index = columns.findIndex((column) => column.key === sortKey);
    if (index < 0) return matched;
    return [...matched].sort((left, right) => {
      const a = left.cells[index]?.sort ?? "";
      const b = right.cells[index]?.sort ?? "";
      const compared =
        typeof a === "number" && typeof b === "number"
          ? a - b
          : String(a).localeCompare(String(b), "en", {
              numeric: true,
              sensitivity: "base",
            });
      return dir === "asc" ? compared : -compared;
    });
  }, [columns, dir, filters, rows, sortKey]);

  function sortBy(key: string) {
    if (sortKey === key) setDir((current) => (current === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setDir("asc");
    }
  }

  function exportCsv() {
    const header = columns.map((column) => csvCell(column.label)).join(",");
    const body = visible
      .map((row) => row.cells.map((cell) => csvCell(cell.text)).join(","))
      .join("\n");
    const blob = new Blob([`\uFEFF${header}\n${body}`], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `adoption-${file}-${period}-days.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function table(clipped: boolean) {
    return (
      <div className={clipped ? "table-wrap" : "table-wrap adoption-full"}>
        <table>
          <caption>{caption}</caption>
          <thead>
            <tr>
              {columns.map((column) => {
                const active = sortKey === column.key;
                return (
                  <th
                    key={column.key}
                    className={column.numeric ? "num" : undefined}
                    aria-sort={
                      active ? (dir === "asc" ? "ascending" : "descending") : "none"
                    }
                  >
                    <div className="colhead">
                      <button type="button" className="sort" onClick={() => sortBy(column.key)}>
                        {column.label}
                        {active ? (dir === "asc" ? " ↑" : " ↓") : ""}
                      </button>
                    </div>
                    <input
                      className="col-filter"
                      aria-label={`Filter ${column.label}`}
                      title="Use commas for multiple values"
                      placeholder="e.g. A, B"
                      value={filters[column.key] ?? ""}
                      onChange={(event) =>
                        setFilters((current) => ({
                          ...current,
                          [column.key]: event.target.value,
                        }))
                      }
                    />
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="empty-row" colSpan={columns.length}>
                  {empty}
                </td>
              </tr>
            ) : visible.length === 0 ? (
              <tr>
                <td className="empty-row" colSpan={columns.length}>
                  No rows match these column filters.
                </td>
              </tr>
            ) : (
              visible.map((row) => (
                <tr key={row.key}>
                  {row.cells.map((cell, index) => (
                    <td
                      key={columns[index]?.key ?? index}
                      className={columns[index]?.numeric ? "num" : undefined}
                    >
                      {cell.text}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <section>
      <div className="adoption-head">
        <h2>{title}</h2>
        <div className="adoption-actions">
          <button
            type="button"
            onClick={() => {
              if (dialog.current && !dialog.current.open) dialog.current.showModal();
            }}
          >
            Open
          </button>
          <button type="button" onClick={exportCsv}>
            Export
          </button>
        </div>
      </div>
      {table(true)}
      <dialog
        id={dialogId}
        ref={dialog}
        className="adoption-dialog"
        aria-labelledby={`${dialogId}-title`}
        onClick={(event) => {
          if (event.target === event.currentTarget) event.currentTarget.close();
        }}
      >
        <h2 id={`${dialogId}-title`}>{title}</h2>
        {table(false)}
        <button type="button" onClick={() => dialog.current?.close()}>
          Close
        </button>
      </dialog>
    </section>
  );
}
