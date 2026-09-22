import type { ReactNode } from "react";

export interface ConvertFact {
  label: string;
  value: ReactNode;
}

/**
 * A heading of the conversion dialog: an icon and one uppercase line, the way
 * the reference sets every block of it.
 */
export function ConvertHead({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <h3 className="cvt-head">
      {icon}
      {children}
    </h3>
  );
}

/**
 * The label/value rows both columns are built from — a fixed 150px label
 * column, the value taking the rest.
 */
export function ConvertFacts({ facts, tight }: { facts: ConvertFact[]; tight?: boolean }) {
  return (
    <div className={tight ? "cvt-facts cvt-facts--tight" : "cvt-facts"}>
      {facts.map((fact) => (
        <div key={fact.label} className="cvt-fact">
          <span className="cvt-fact-label">{fact.label}</span>
          <span className="cvt-fact-value">{fact.value}</span>
        </div>
      ))}
    </div>
  );
}
