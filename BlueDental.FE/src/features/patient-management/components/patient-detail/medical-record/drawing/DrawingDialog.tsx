import { useEffect, useState } from "react";
import { Alert, Spin } from "antd";
import { CheckOutlined } from "@ant-design/icons";
import { AppDialog } from "@/components/AppDialog";
import { t } from "@/lib/i18n";
import { SketchToolbar } from "./SketchToolbar";
import { DEFAULT_SKETCH_SETTINGS, SKETCH_HEIGHT, SKETCH_WIDTH } from "./sketch";
import { useSketchCanvas } from "./useSketchCanvas";
import "./drawing.css";

interface Props {
  /** The drawing the cell holds now, drawn over; empty for a fresh one. */
  source: string;
  /** The finished PNG, or "" when the page was left bare. */
  onApply: (png: string) => void;
  onClose: () => void;
}

/**
 * Drawing "Lược đồ phẫu thuật/thủ thuật": the tools along the top, the page
 * below in the cell's own proportions, and "Áp dụng" to put the picture on the
 * sheet. It is kept with the sheet when the sheet is saved — this dialog
 * stores nothing on its own.
 *
 * Mounted only while open, so every opening starts from the cell's picture.
 */
export function DrawingDialog({ source, onApply, onClose }: Props) {
  const [settings, setSettings] = useState(DEFAULT_SKETCH_SETTINGS);
  const pad = useSketchCanvas(settings, source);
  const { undo, redo } = pad;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLowerCase();
      if (key === "z" && !event.shiftKey) undo();
      else if (key === "y" || (key === "z" && event.shiftKey)) redo();
      else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  const handleApply = () => onApply(pad.toPng());

  return (
    <AppDialog
      open
      centered
      width={1080}
      className="sketch-dialog"
      title={t("Patient:MedRecord:DrawingTitle")}
      subtitle={t("Patient:MedRecord:DrawingHint")}
      canSave={pad.changed && !pad.loading}
      saveLabel={t("Patient:MedRecord:ApplyDrawing")}
      saveIcon={<CheckOutlined />}
      cancelLabel={t("Patient:Misc:CancelVN")}
      onSave={handleApply}
      onClose={onClose}
    >
      <SketchToolbar
        settings={settings}
        onChange={setSettings}
        canUndo={pad.canUndo}
        canRedo={pad.canRedo}
        onUndo={undo}
        onRedo={redo}
        onClear={pad.clear}
      />

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
        </div>
      </Spin>
    </AppDialog>
  );
}
