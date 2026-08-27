import { useState, type ReactNode } from "react";

interface Props {
  label: string;
  /** Whether the label should sit on the border rather than inside the field. */
  floated: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * A floating label for a control that is not inside a Form.
 *
 * {@link FloatingField} does the same job for `Form.Item` fields, reading the
 * value through `Form.useWatch`. Filter bars have no form to watch, so this
 * takes `floated` from the caller instead and shares the same
 * `.floating-field` styling, keeping one look across both.
 */
export function FloatingLabel({ label, floated, className, children }: Props) {
  const [focused, setFocused] = useState(false);
  const isFloated = floated || focused;

  return (
    <div
      className={[
        "floating-field",
        isFloated && "floating-field--floated",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={() => setFocused(false)}
    >
      {children}
      {/* Not aria-hidden: it is the control's only visible name. */}
      <span className="floating-field-label">{label}</span>
    </div>
  );
}
