import type { ReactNode } from "react";
import { Popover } from "antd";
import {
  ChevronDown,
  Eraser,
  Highlighter,
  MousePointer2,
  PenLine,
  Redo2,
  Shapes,
  Trash2,
  Type,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import { t } from "@/lib/i18n";
import { SketchToolOptions } from "./SketchToolOptions";
import type { SizedTool, SketchSettings, SketchTool } from "./sketch";

const TOOLS: ReadonlyArray<{ tool: SketchTool; icon: LucideIcon; label: string; sized?: SizedTool }> = [
  { tool: "select", icon: MousePointer2, label: "Patient:MedRecord:SelectTool" },
  { tool: "pen", icon: PenLine, label: "Patient:MedRecord:Pen", sized: "pen" },
  { tool: "highlighter", icon: Highlighter, label: "Patient:MedRecord:Highlighter", sized: "highlighter" },
  { tool: "eraser", icon: Eraser, label: "Patient:MedRecord:Eraser", sized: "eraser" },
  { tool: "shape", icon: Shapes, label: "Patient:MedRecord:Shapes", sized: "shape" },
  { tool: "text", icon: Type, label: "Patient:MedRecord:TextTool" },
];

export interface SketchHistoryActions {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
}

interface Props {
  settings: SketchSettings;
  onChange: (next: SketchSettings) => void;
  history: SketchHistoryActions;
  /** The shared colour box, between the tools and the history buttons. */
  children: ReactNode;
}

/**
 * The row along the top of the pad: the tools — each that draws with a size
 * has an arrow to its size — the colour box, then undo, redo and "Xoá tất cả".
 */
export function SketchToolbar({ settings, onChange, history, children }: Props) {
  return (
    <div className="sketch-toolbar" role="toolbar" aria-label={t("Patient:MedRecord:DrawingTools")}>
      <div className="sketch-tools">
        {TOOLS.map(({ tool, icon: Icon, label, sized }) => {
          const active = settings.tool === tool;
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
              </button>
              {sized && (
                <Popover
                  trigger="click"
                  placement="bottomLeft"
                  arrow={false}
                  content={<SketchToolOptions tool={sized} settings={settings} onChange={onChange} />}
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
              )}
            </div>
          );
        })}
      </div>

      {children}

      <div className="sketch-history">
        <button
          type="button"
          className="sketch-action"
          aria-label={t("Patient:MedRecord:Undo")}
          title={`${t("Patient:MedRecord:Undo")} (Ctrl+Z)`}
          disabled={!history.canUndo}
          onClick={history.onUndo}
        >
          <Undo2 size={18} />
        </button>
        <button
          type="button"
          className="sketch-action"
          aria-label={t("Patient:MedRecord:Redo")}
          title={`${t("Patient:MedRecord:Redo")} (Ctrl+Y)`}
          disabled={!history.canRedo}
          onClick={history.onRedo}
        >
          <Redo2 size={18} />
        </button>
        <button type="button" className="sketch-action sketch-action--danger" onClick={history.onClear}>
          <Trash2 size={16} />
          {t("Patient:MedRecord:ClearDrawing")}
        </button>
      </div>
    </div>
  );
}
