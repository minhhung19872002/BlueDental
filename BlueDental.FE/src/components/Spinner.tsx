import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

interface Props {
  size?: "sm" | "default" | "lg";
  className?: string;
  label?: string;
}

const sizeMap = {
  sm: "size-4",
  default: "size-6",
  lg: "size-8",
} as const;

export function Spinner({ size = "default", className, label }: Props) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2", className)}>
      <Loader2 className={cn("animate-spin text-primary", sizeMap[size])} />
      {label && <span className="text-sm text-muted-foreground">{label}</span>}
    </div>
  );
}

export function PageSpinner({ label }: { label?: string }) {
  return (
    <div className="grid min-h-[200px] place-items-center">
      <Spinner size="lg" label={label} />
    </div>
  );
}
