import type { ReactNode } from "react";

interface Props {
  title: string;
  subtitle?: string;
  children: ReactNode;
  style?: React.CSSProperties;
}

export function ChartCard({ title, subtitle, children, style }: Props) {
  return (
    <div className="page-card" style={style}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "#1A2744" }}>
          {title}
        </div>
        {subtitle && (
          <div style={{ fontSize: 12, color: "#5E748E", marginTop: 2 }}>
            {subtitle}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}
