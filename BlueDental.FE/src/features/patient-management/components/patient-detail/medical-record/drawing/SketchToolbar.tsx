import type { CSSProperties } from "react";
import { Popover } from "antd";
import { ChevronDown, Eraser, Highlighter, PenLine, Redo2, Shapes, Trash2, Undo2, type LucideIcon } from "lucide-react";
import { t } from "@/lib/i18n";
import { SketchToolOptions } from "./SketchToolOptions";
import type { SketchSettings, SketchTool } from "./sketch";

const TOOLS: ReadonlyArray<{ tool: SketchTool; icon: LucideIcon; label: string }> = [
  { tool: "pen", icon: PenLine, label: "Patient:MedRecord:Pen" },
  { tool: "highlighter", icon: Highlighter, label: "Patient:MedRecord:Highlighter" },
  { tool: "eraser", icon: Eraser, label: "Patient:MedRecord:Eraser" },
  { tool: "shape", icon: Shapes, label: "Patient:MedRecord:Shapes" },
];

/** The colour bar under a tool's icon, as Snipping Tool shows it. */
function colorOf(tool: SketchTool, settings: SketchSettings): string | undefined {
  if (tool === "pen") return settings.pen.color;
  if (tool === "highlighter") return settings.highlighter.color;
  if (tool === "shape") return settings.shapeStyle.color;
  return undefined;
}

interface Props {
  settings: SketchSettings;
  onChange: (next: SketchSettings) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
}

/**
 * The row of tools above the page. Each tool is picked with its button and set
 * up with the arrow beside it; undo, redo and "Xoá tất cả" sit at the end.
 */
export function SketchToolbar({ settings, onChange, canUndo, canRedo, onUndo, onRedo, onClear }: Props) {
  return (
    <div className="sketch-toolbar" role="toolbar" aria-label={t("Patient:MedRecord:DrawingTools")}>
      {TOOLS.map(({ tool, icon: Icon, label }) => {
        const active = settings.tool === tool;
        const color = colorOf(tool, settings);
        return (
          <div key={tool} className={["sketch-tool", active && "sketch-tool--active"].filter(Boolean).join(" ")}>
            <button
              type="button"
              className="sketch-tool-pick"
              aria-pressed={active}
              aria-label={t(label)}
              title={t(label)}
              onClick={() => onChange({ ...settings, tool })}
            >
              <Icon size={20} />
              {color && (
                <span className="sketch-tool-color" style={{ "--tool-color": color } as CSSProperties} />
              )}
            </button>
            <Popover
              trigger="click"
              placement="bottomLeft"
              arrow={false}
              content={<SketchToolOptions tool={tool} settings={settings} onChange={onChange} />}
              onOpenChange={(open) => open && onChange({ ...settings, tool })}
            >
              <button
                type="button"
                className="sketch-tool-more"
                aria-label={`${t(label)} — ${t("Patient:MedRecord:ToolOptions")}`}
              >
                <ChevronDown size={14} />
              </button>
            </Popover>
          </div>
        );
      })}

      <span className="sketch-toolbar-gap" />

      <button
        type="button"
        className="sketch-action"
        aria-label={t("Patient:MedRecord:Undo")}
        title={`${t("Patient:MedRecord:Undo")} (Ctrl+Z)`}
        disabled={!canUndo}
        onClick={onUndo}
      >
        <Undo2 size={18} />
      </button>
      <button
        type="button"
        className="sketch-action"
        aria-label={t("Patient:MedRecord:Redo")}
        title={`${t("Patient:MedRecord:Redo")} (Ctrl+Y)`}
        disabled={!canRedo}
        onClick={onRedo}
      >
        <Redo2 size={18} />
      </button>
      <button type="button" className="sketch-action sketch-action--danger" onClick={onClear}>
        <Trash2 size={16} />
        {t("Patient:MedRecord:ClearDrawing")}
      </button>
    </div>
  );
}
