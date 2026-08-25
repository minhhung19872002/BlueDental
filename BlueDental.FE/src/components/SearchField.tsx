import { Search } from "lucide-react";
import { cn } from "@/lib/cn";

interface Props {
  id: string;
  /** Doubles as the resting placeholder and the floated label. */
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  inputClassName?: string;
}

/**
 * Search box with a floating label.
 *
 * The label sits inside the field next to the magnifier while the field is
 * empty, and lifts onto the border once the field is focused or filled — so the
 * field never loses its name the way a placeholder-only input does. The lift is
 * driven by :placeholder-shown, which is why the input carries a single space
 * as its placeholder: it must never look empty to the selector once filled.
 */
export function SearchField({ id, label, value, onChange, className, inputClassName }: Props) {
  return (
    <div className={cn("bd-search", className)}>
      <span className="bd-search-icon" aria-hidden="true">
        <Search className="bd-icon" aria-hidden="true" />
      </span>

      <input
        id={id}
        type="text"
        value={value}
        placeholder=" "
        onChange={(event) => onChange(event.target.value)}
        className={cn("bd-search-input", inputClassName)}
      />

      <label htmlFor={id} className="bd-search-label">
        {label}
      </label>
    </div>
  );
}
