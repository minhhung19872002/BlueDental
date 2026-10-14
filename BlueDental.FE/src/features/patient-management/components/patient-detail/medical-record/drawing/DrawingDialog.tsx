import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Spin } from "antd";
import { CheckOutlined } from "@ant-design/icons";
import { AppDialog } from "@/components/AppDialog";
import { t } from "@/lib/i18n";
import { SketchColors, type ColorSlot } from "./SketchColors";
import { SketchSelectionBar } from "./SketchSelectionBar";
import { SketchTextBox } from "./SketchTextBox";
import { SketchTextToolbar } from "./SketchTextToolbar";
import { SketchToolbar } from "./SketchToolbar";
import { DEFAULT_SKETCH_SETTINGS, SKETCH_HEIGHT, SKETCH_WIDTH, type SketchSettings } from "./sketch";
import { useSketchCanvas } from "./useSketchCanvas";
import { useSketchShortcuts } from "./useSketchShortcuts";
import "./drawing.css";

interface Props {
  /** The drawing the cell holds now; empty for a fresh one. */
  source: string;
  /** The finished PNG, or "" when the page was left bare. */
  onApply: (png: string) => void;
  onClose: () => void;
}

/**
 * Drawing "Lược đồ phẫu thuật/thủ thuật": the tools and the shared colour box
 * along the top, the page below in the cell's own proportions, and "Áp dụng"
 * to put the picture on the sheet. It is kept with the sheet when the sheet is
 * saved — this dialog stores nothing on its own.
 *
 * Mounted only while open, so every opening starts from the cell's picture.
 */
export function DrawingDialog({ source, onApply, onClose }: Props) {
  const [settings, setSettings] = useState(DEFAULT_SKETCH_SETTINGS);
  const [custom, setCustom] = useState<string[]>([]);
  const adopt = useCallback((patch: Partial<SketchSettings>) => setSettings((now) => ({ ...now, ...patch })), []);
  const pad = useSketchCanvas(settings, source, adopt);
  const textInput = useRef<HTMLTextAreaElement>(null);
  useSketchShortcuts(pad);

  // Words still being typed are put down first; the picture is taken once they are on the page.
  const [applying, setApplying] = useState(false);
  const handleApply = () => {
    if (!pad.typing) return onApply(pad.toPng());
    pad.commitText();
    setApplying(true);
  };
  const { toPng } = pad;
  useEffect(() => {
    if (applying) onApply(toPng());
  }, [applying, onApply, toPng]);

  const { selected, updateSelected } = pad;
  const handlePick = useCallback(
    (slot: ColorSlot, color: string) => {
      adopt({ [slot]: color });
      if (selected) updateSelected(slot === "color" ? { color } : { fill: color });
    },
    [adopt, selected, updateSelected],
  );
  const handleAddCustom = useCallback(
    (color: string) => setCustom((now) => (now.includes(color) ? now : [...now, color].slice(-10))),
    [],
  );

  return (
    <AppDialog
      open
      centered
      width={1120}
      className="sketch-dialog"
      title={t("Patient:MedRecord:DrawingTitle")}
      subtitle={t("Patient:MedRecord:DrawingHint")}
      canSave={(pad.changed || Boolean(pad.typing)) && !pad.loading}
      saving={applying}
      saveLabel={t("Patient:MedRecord:ApplyDrawing")}
      saveIcon={<CheckOutlined />}
      cancelLabel={t("Patient:Misc:CancelVN")}
      onSave={handleApply}
      onClose={onClose}
    >
      <SketchToolbar
        settings={settings}
        onChange={setSettings}
        history={{ canUndo: pad.canUndo, canRedo: pad.canRedo, onUndo: pad.undo, onRedo: pad.redo, onClear: pad.clear }}
      >
        <SketchColors
          color={settings.color}
          fill={settings.fill}
          custom={custom}
          onPick={handlePick}
          onAddCustom={handleAddCustom}
        />
      </SketchToolbar>

      {pad.loadFailed && (
        <Alert className="sketch-alert" type="warning" showIcon message={t("Patient:MedRecord:DrawingLoadFailed")} />
      )}

      <Spin spinning={pad.loading}>
        <div className="sketch-page">
          <canvas ref={pad.pageRef} className="sketch-canvas" width={SKETCH_WIDTH} height={SKETCH_HEIGHT} />
          <canvas
            ref={pad.overlayRef}
            className={`sketch-canvas sketch-canvas--input sketch-canvas--${settings.tool}`}
            width={SKETCH_WIDTH}
            height={SKETCH_HEIGHT}
            role="img"
            aria-label={t("Patient:MedRecord:DrawingArea")}
            {...pad.handlers}
          />
          {pad.typing && (
            <>
              <SketchTextToolbar
                style={settings.text}
                at={{ x: pad.typing.at.x / SKETCH_WIDTH, y: pad.typing.at.y / SKETCH_HEIGHT }}
                onChange={(text) => adopt({ text })}
                onRefocus={() => textInput.current?.focus()}
              />
              <SketchTextBox
                draft={pad.typing}
                settings={settings}
                inputRef={textInput}
                onText={pad.setTypingText}
                onCommit={pad.commitText}
                onCancel={pad.cancelText}
              />
            </>
          )}
          {pad.selected && (
            <SketchSelectionBar
              key={pad.selected.id}
              item={pad.selected}
              onResize={(size) => updateSelected({ size })}
              onEditText={() => pad.selected && pad.startEditing(pad.selected)}
              onDelete={pad.deleteSelected}
            />
          )}
        </div>
      </Spin>
    </AppDialog>
  );
}
