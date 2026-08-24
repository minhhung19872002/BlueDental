import { useCallback, useState, type DragEvent, type ChangeEvent } from "react";
import { Upload } from "lucide-react";
import { cn } from "@/lib/cn";
import { t } from "@/lib/i18n";

interface Props {
  accept?: string;
  multiple?: boolean;
  hint?: string;
  onFiles?: (files: File[]) => void;
  className?: string;
}

export function FileUploader({ accept, multiple, hint, onFiles, className }: Props) {
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragOver(false);
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) onFiles?.(files);
    },
    [onFiles],
  );

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      if (files.length > 0) onFiles?.(files);
      e.target.value = "";
    },
    [onFiles],
  );

  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-8 text-center transition-colors",
        dragOver
          ? "border-primary bg-primary/5"
          : "border-muted-foreground/25 hover:border-primary/50",
        className,
      )}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      <Upload className="size-8 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">
        {t("Kéo thả hoặc nhấp để chọn tệp")}
      </p>
      {hint && <p className="text-xs text-muted-foreground/70">{hint}</p>}
      <input
        type="file"
        accept={accept}
        multiple={multiple}
        className="absolute inset-0 cursor-pointer opacity-0"
        onChange={handleChange}
      />
    </div>
  );
}
