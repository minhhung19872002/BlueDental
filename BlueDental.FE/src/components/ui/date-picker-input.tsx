import { useState } from "react";
import { Calendar } from "lucide-react";
import dayjs, { type Dayjs } from "dayjs";
import { cn } from "@/lib/cn";
import { t } from "@/lib/i18n";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarPanel } from "@/components/ui/calendar";

interface DatePickerInputProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  format?: string;
  min?: string;
  max?: string;
  disabled?: boolean;
  className?: string;
}

export function DatePickerInput({
  value,
  onChange,
  placeholder = "DD/MM/YYYY",
  format: displayFormat = "DD/MM/YYYY",
  min,
  max,
  disabled,
  className,
}: DatePickerInputProps) {
  const [open, setOpen] = useState(false);

  const parsed = value ? dayjs(value) : null;
  const isValid = parsed?.isValid() ?? false;
  const displayValue = isValid ? parsed!.format(displayFormat) : "";

  const minDate = min ? dayjs(min) : undefined;
  const maxDate = max ? dayjs(max) : undefined;

  const handleSelect = (d: Dayjs) => {
    onChange?.(d.format("YYYY-MM-DD"));
    setOpen(false);
  };

  const handleToday = () => {
    onChange?.(dayjs().format("YYYY-MM-DD"));
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <button
          type="button"
          className={cn(
            "flex h-10 w-full items-center gap-2 rounded-md border border-input bg-transparent px-3 text-[13px] shadow-xs transition-[color,box-shadow] outline-none",
            "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
            "disabled:cursor-not-allowed disabled:opacity-50",
            !displayValue && "text-muted-foreground",
            className,
          )}
        >
          <Calendar className="size-4 shrink-0 text-muted-foreground" />
          <span className="flex-1 text-left truncate">
            {displayValue || placeholder}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-auto p-0"
      >
        <CalendarPanel
          value={isValid ? parsed! : dayjs()}
          mode="day"
          onSelect={handleSelect}
          onReset={handleToday}
          resetLabel={t("Hôm nay")}
          minDate={minDate}
          maxDate={maxDate}
        />
      </PopoverContent>
    </Popover>
  );
}
