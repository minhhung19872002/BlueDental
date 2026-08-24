import { cn } from "@/lib/cn";

interface SegmentedControlOption<T extends string> {
  key: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div className={cn("flex h-10 rounded-[10px] border border-border overflow-hidden", className)}>
      {options.map((opt) => (
        <button
          key={opt.key}
          type="button"
          onClick={() => onChange(opt.key)}
          className={cn(
            "px-4 h-full text-[13px] font-semibold border-r border-border last:border-r-0 transition-colors",
            value === opt.key
              ? "bg-primary text-primary-foreground"
              : "bg-white text-foreground hover:bg-muted",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
