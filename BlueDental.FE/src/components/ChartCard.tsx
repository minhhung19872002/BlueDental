import type { ReactNode } from "react";
import { brand } from "@/theme/index";

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
        <div style={{ fontWeight: 700, fontSize: 14, color: brand.ink }}>
          {title}
        </div>
        {subtitle && (
          <div style={{ fontSize: 12, color: brand.dim, marginTop: 2 }}>
            {subtitle}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}
