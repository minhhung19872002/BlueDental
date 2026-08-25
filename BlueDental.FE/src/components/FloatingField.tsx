import React, { useId, useState } from "react";
import { Form } from "antd";
import type { FormItemProps } from "antd";

/**
 * What this wrapper hands down to the control it wraps. React 19 types a bare
 * ReactElement's props as unknown, so naming them is what lets the handlers be
 * chained and cloneElement type-check.
 */
interface FloatingFieldChildProps {
  id?: string;
  placeholder?: string;
  onFocus?: (...args: unknown[]) => void;
  onBlur?: (...args: unknown[]) => void;
  /** Ant Design's Select and DatePicker report their panel this way. */
  onOpenChange?: (open: boolean) => void;
}

interface FloatingFieldProps extends Omit<FormItemProps, "label"> {
  label: string;
  children: React.ReactElement<FloatingFieldChildProps>;
}

export function FloatingField({ label, children, className, ...rest }: FloatingFieldProps) {
  const id = useId();
  const [focused, setFocused] = useState(false);
  const form = Form.useFormInstance();
  const watchedValue = Form.useWatch(rest.name, form);

  const hasValue = Array.isArray(watchedValue)
    ? watchedValue.length > 0
    : watchedValue !== undefined && watchedValue !== null && watchedValue !== "";
  const floated = focused || hasValue;

  const child = React.cloneElement<FloatingFieldChildProps>(children, {
    id,
    placeholder: " ",
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
    <div className={`floating-field ${floated ? "floating-field--floated" : ""}`}>
      <Form.Item {...rest} label={undefined} className={className}>
        {child}
      </Form.Item>
      <label htmlFor={id} className="floating-field-label" aria-hidden>
        {label}
        {rest.required && <span className="floating-field-required">*</span>}
      </label>
    </div>
  );
}
