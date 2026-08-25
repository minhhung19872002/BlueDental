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
 * field never loses its name the way a placeholder-only input does.
 */
export function SearchField({ id, label, value, onChange, className, inputClassName }: Props) {
  return (
    <div className={cn("relative", className)}>
      <span className="pointer-events-none absolute top-1/2 left-4 flex size-5 -translate-y-1/2 items-center justify-center text-app-label">
        <Search className="size-4" aria-hidden="true" />
      </span>

      <input
        id={id}
        type="text"
        value={value}
        placeholder=" "
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          "peer h-10 w-full min-w-0 rounded-lg border border-app-line bg-white py-0 pr-3 pl-11 text-[14px] text-app-ink",
          "outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-transparent",
          "hover:border-app-line-strong focus-visible:border-app-primary focus-visible:ring-[3px] focus-visible:ring-app-primary/20",
          inputClassName,
        )}
      />

      <label
        htmlFor={id}
        className={cn(
          "pointer-events-none absolute top-0 left-4 z-10 max-w-[calc(100%-1rem)] -translate-y-1/2 truncate",
          "bg-white px-1 text-[13px] font-medium text-app-label transition-all duration-200",
          "peer-placeholder-shown:top-1/2 peer-placeholder-shown:left-11 peer-placeholder-shown:bg-transparent",
          "peer-placeholder-shown:px-0 peer-placeholder-shown:text-[14px] peer-placeholder-shown:text-app-label/80",
          "peer-focus:top-0 peer-focus:left-4 peer-focus:bg-white peer-focus:px-1 peer-focus:text-[13px] peer-focus:text-app-primary",
        )}
      >
        {label}
      </label>
    </div>
  );
}
