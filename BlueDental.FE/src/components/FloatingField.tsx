import React, { useId, useState } from "react";
import { Form } from "antd";
import type { FormItemProps } from "antd";

interface FloatingFieldProps extends Omit<FormItemProps, "label"> {
  label: string;
  children: React.ReactElement;
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

  const child = React.cloneElement(children, {
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
