import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/cn";

export interface FloatingSelectOption {
  value: string;
  label: string;
}

interface Props {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: FloatingSelectOption[];
  required?: boolean;
  error?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Select with the same floating label as {@link FloatingField}, so a form can
 * mix inputs and selects without the labels sitting at two different heights —
 * which is how the reference draws its dialogs.
 *
 * The label floats permanently rather than on focus: a select always shows
 * either a value or its placeholder, so there is no empty state to fall back to.
 */
export function FloatingSelect({
  id,
  label,
  value,
  onChange,
  options,
  required,
  error,
  disabled,
  className,
}: Props) {
  return (
    <div className={cn("relative", className)}>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={cn(
            "h-11 w-full rounded-lg border bg-white px-3.5 text-[14px] text-app-ink",
            "focus-visible:ring-[3px]",
            error
              ? "border-app-danger focus-visible:border-app-danger focus-visible:ring-app-danger/20"
              : "border-app-line focus-visible:border-app-primary focus-visible:ring-app-primary/20",
          )}
        >
          <SelectValue placeholder=" " />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <label
        htmlFor={id}
        className="pointer-events-none absolute top-0 left-3 z-10 max-w-[calc(100%-1rem)] -translate-y-1/2 truncate bg-white px-1 text-[13px] font-medium text-app-label"
      >
        {label}
        {/* The reference writes the asterisk against the label, with no space. */}
        {required && <span className="text-app-danger">*</span>}
      </label>

      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1 text-xs text-app-danger">
          {error}
        </p>
      )}
    </div>
  );
}
