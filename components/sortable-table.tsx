"use client";

import { useMemo, type ReactNode } from "react";
import { usePersisted } from "./persisted";

export type Column = {
  label: ReactNode;
  align?: "left" | "right";
  title?: string;
  /** Direction used the first time this column is clicked (numbers usually "desc"). */
  firstDir?: "asc" | "desc";
  /** Class for this column's cells, e.g. "wrap-cell" for long text. */
  className?: string;
};

export type Row = {
  key: string;
  cells: ReactNode[];
  /** One sort value per column; null sorts last in either direction. */
  sort: (string | number | null)[];
  title?: string;
};

type Sort = { col: number; dir: "asc" | "desc" } | null;

/**
 * A table whose headers sort the rows. Cells arrive pre-rendered from the
 * server; only the order changes here. The chosen sort is remembered per
 * table (see persisted.ts). With no sort chosen, rows keep the server order.
 */
export function SortableTable({
  columns,
  rows,
  storageKey,
  scrollStyle,
}: {
  columns: Column[];
  rows: Row[];
  storageKey?: string;
  scrollStyle?: React.CSSProperties;
}) {
  const [sort, setSort] = usePersisted<Sort>(storageKey && `${storageKey}:sort`, null, {
    encode: (v) => v,
    decode: (raw) => {
      const r = raw as Sort;
      return r === null || (r && Number.isInteger(r.col) && r.col < columns.length && (r.dir === "asc" || r.dir === "desc"))
        ? r
        : undefined;
    },
  });

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const sign = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const x = a.sort[sort.col];
      const y = b.sort[sort.col];
      if (x == null && y == null) return 0;
      if (x == null) return 1;
      if (y == null) return -1;
      if (typeof x === "number" && typeof y === "number") return (x - y) * sign;
      return String(x).localeCompare(String(y), undefined, { numeric: true }) * sign;
    });
  }, [rows, sort]);

  const clickHeader = (i: number) =>
    setSort((s) => {
      if (s?.col === i) return { col: i, dir: s.dir === "asc" ? "desc" : "asc" };
      return { col: i, dir: columns[i].firstDir ?? "asc" };
    });

  return (
    <div className="table-scroll" style={scrollStyle}>
      <table className="sortable">
        <thead>
          <tr>
            {columns.map((c, i) => {
              const active = sort?.col === i;
              return (
                <th
                  key={i}
                  style={{ textAlign: c.align ?? (i === 0 ? "left" : "right") }}
                  aria-sort={active ? (sort!.dir === "asc" ? "ascending" : "descending") : "none"}
                  title={c.title}
                >
                  <button type="button" onClick={() => clickHeader(i)} className={active ? "active" : undefined}>
                    {c.label}
                    <span className="sort-ind" aria-hidden="true">
                      {active ? (sort!.dir === "asc" ? "▲" : "▼") : "↕"}
                    </span>
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.key} title={r.title}>
              {r.cells.map((cell, i) => (
                <td key={i} className={columns[i].className} style={{ textAlign: columns[i].align ?? (i === 0 ? "left" : "right") }}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
