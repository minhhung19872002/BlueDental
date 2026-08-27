import React, { useState } from "react";

/**
 * What this wrapper hands down to the control it wraps — the same contract the
 * shared FloatingField uses, so AntD inputs/pickers and SearchSelect all fit.
 */
interface MessageFieldChildProps {
  placeholder?: string;
  /** The floating label is visual only — the control's accessible name. */
  "aria-label"?: string;
  onFocus?: (...args: unknown[]) => void;
  onBlur?: (...args: unknown[]) => void;
  /** AntD's pickers and SearchSelect report their panel this way. */
  onOpenChange?: (open: boolean) => void;
}

interface MessageFieldProps {
  label: string;
  required?: boolean;
  /** Whether the wrapped control holds a value — keeps the label floated. */
  hasValue: boolean;
  children: React.ReactElement<MessageFieldChildProps>;
}

/**
 * FloatingField's look for the CSKH dialogs and toolbar filters, which hold
 * state themselves instead of through an AntD Form: the label rests inside the
 * field as its placeholder and floats to the border on focus or value.
 */
export function MessageField({ label, required, hasValue, children }: MessageFieldProps) {
  const [focused, setFocused] = useState(false);
  const floated = focused || hasValue;

  const child = React.cloneElement<MessageFieldChildProps>(children, {
    placeholder: " ",
    "aria-label": label,
    onFocus: (...args: unknown[]) => {
      setFocused(true);
      children.props.onFocus?.(...args);
    },
    onBlur: (...args: unknown[]) => {
      setFocused(false);
      children.props.onBlur?.(...args);
    },
    onOpenChange: (open: boolean) => {
      setFocused(open);
      children.props.onOpenChange?.(open);
    },
  });

  return (
    <div
      className={["floating-field", floated && "floating-field--floated", "cskh-message-field"]
        .filter(Boolean)
        .join(" ")}
    >
      {child}
      <span className="floating-field-label">
        {label}
        {required && <span className="floating-field-required">*</span>}
      </span>
    </div>
  );
}
