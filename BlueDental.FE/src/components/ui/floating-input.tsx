import * as React from "react";
import { cn } from "@/lib/cn";

interface FloatingInputProps
  extends Omit<React.ComponentProps<"input">, "placeholder"> {
  label: string;
}

function FloatingInput({ label, className, id, required, ...props }: FloatingInputProps) {
  const innerId = id ?? React.useId();
  const hasValue =
    props.value !== undefined && props.value !== null && String(props.value) !== "";
  const floated = hasValue || props.type === "time" || props.type === "date";

  return (
    <div className="relative">
      <input
        id={innerId}
        data-slot="input"
        placeholder=" "
        required={required}
        className={cn(
          "peer h-10 w-full min-w-0 rounded-lg border border-input bg-transparent px-3 text-sm shadow-xs transition-[color,box-shadow] outline-none",
          "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
          "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
          "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
          "dark:bg-input/30",
          className,
        )}
        {...props}
      />
      <label
        htmlFor={innerId}
        className={cn(
          "pointer-events-none absolute left-2.5 bg-white px-1 transition-all duration-150 dark:bg-background",
          "top-1/2 -translate-y-1/2 text-sm",
          "peer-focus:top-0 peer-focus:-translate-y-1/2 peer-focus:text-xs",
          floated && "top-0 -translate-y-1/2 text-xs",
          "text-muted-foreground peer-focus:text-primary",
          "peer-aria-invalid:text-destructive peer-aria-invalid:peer-focus:text-destructive",
        )}
      >
        {label}
        {required && <span className="text-destructive">*</span>}
      </label>
    </div>
  );
}

interface FloatingTextareaProps
  extends Omit<React.ComponentProps<"textarea">, "placeholder"> {
  label: string;
}

function FloatingTextarea({
  label,
  className,
  id,
  required,
  ...props
}: FloatingTextareaProps) {
  const innerId = id ?? React.useId();
  const hasValue =
    props.value !== undefined && props.value !== null && String(props.value) !== "";

  return (
    <div className="relative">
      <textarea
        id={innerId}
        data-slot="textarea"
        placeholder=" "
        required={required}
        className={cn(
          "peer min-h-[80px] w-full min-w-0 resize-y rounded-lg border border-input bg-transparent px-3 pt-4 pb-2 text-sm shadow-xs transition-[color,box-shadow] outline-none",
          "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
          "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
          "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
          "dark:bg-input/30",
          className,
        )}
        {...props}
      />
      <label
        htmlFor={innerId}
        className={cn(
          "pointer-events-none absolute left-2.5 bg-white px-1 text-muted-foreground transition-all duration-150 dark:bg-background",
          "top-4 -translate-y-1/2 text-sm",
          "peer-focus:top-0 peer-focus:-translate-y-1/2 peer-focus:text-xs peer-focus:text-primary",
          hasValue && "top-0 -translate-y-1/2 text-xs",
        )}
      >
        {label}
        {required && <span className="text-destructive">*</span>}
      </label>
    </div>
  );
}

export { FloatingInput, FloatingTextarea };
