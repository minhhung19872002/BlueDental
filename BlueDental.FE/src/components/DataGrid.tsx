import type { CSSProperties, ReactNode } from "react";

export interface DataGridColumn<T> {
  key: string;
  /** Header label. Leave empty for a column that needs no heading. */
  title?: string;
  /** Any grid track size: "80px", "1.7fr", "minmax(0, 1fr)". */
  width: string;
  render: (row: T, index: number) => ReactNode;
  /** Applies the shared ellipsis / min-width-0 cell wrapper. Default true. */
  clip?: boolean;
}

interface DataGridProps<T> {
  columns: DataGridColumn<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string;
  onRowClick?: (row: T) => void;
  /** Rendered in place of the rows when there are none. */
  empty?: ReactNode;
  /** Horizontal floor, for grids with more columns than a laptop fits. */
  minWidth?: number;
  className?: string;
}

/**
 * The list shape BlueDental.dc.html uses everywhere: a rounded card with a
 * tinted header strip and CSS-grid rows, rather than table markup.
 *
 * Columns declare their own track size, so a screen that needs more columns
 * than the design happened to draw can add them without inventing a second
 * look for its list.
 */
export function DataGrid<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  empty,
  minWidth,
  className,
}: DataGridProps<T>) {
  const template = columns.map((c) => c.width).join(" ");
  const gridStyle: CSSProperties = { gridTemplateColumns: template };
  const innerStyle: CSSProperties = minWidth ? { minWidth } : {};

  return (
    <div className={["dg", className].filter(Boolean).join(" ")}>
      <div className="dg-scroll">
        <div style={innerStyle}>
          <div className="dg-head" style={gridStyle}>
            {columns.map((c) => (
              <span key={c.key}>{c.title ?? ""}</span>
            ))}
          </div>

          {rows.length === 0 ? (
            <div className="dg-empty">{empty}</div>
          ) : (
            rows.map((row, i) => (
              <div
                key={rowKey(row, i)}
                className="dg-row"
                style={{ ...gridStyle, cursor: onRowClick ? "pointer" : undefined }}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map((c) => (
                  <div key={c.key} className={c.clip === false ? undefined : "dg-cell"}>
                    {c.render(row, i)}
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
