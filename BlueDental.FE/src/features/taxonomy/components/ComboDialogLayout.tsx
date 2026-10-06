import type { ReactNode } from "react";

interface Props {
  /** The service picker; null for a single service, which keeps its one column. */
  picker: ReactNode | null;
  children: ReactNode;
}

/** A combo puts the service picker in a column left of the usual form. */
export function ComboDialogLayout({ picker, children }: Props) {
  if (!picker) return children;
  return (
    <div className="bd-combo-layout">
      {picker}
      <div className="bd-combo-main">{children}</div>
    </div>
  );
}
