import type { ReactNode } from "react";

interface Props {
  title: string;
  actions?: ReactNode;
}

/**
 * BA (R-993, R-994): no visible page title or subtitle — the page body starts
 * right under the app header. The name stays as a screen-reader heading, and a
 * page's own buttons keep a row of their own, right-aligned.
 */
export function PageHeader({ title, actions }: Props) {
  return (
    <>
      <h1 className="bd-sr-only">{title}</h1>
      {actions && <div className="page-actions">{actions}</div>}
    </>
  );
}
