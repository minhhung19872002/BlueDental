import { useEffect, useState } from "react";
import { Button, Input, Tag } from "antd";
import { MinusOutlined, PlusOutlined } from "@ant-design/icons";
import { toast } from "sonner";
import { useCreateAllocation } from "../api/allocationApi";
import { AppDialog } from "@/components/AppDialog";
import { t } from "@/lib/i18n";

/** One material about to be issued, and how much of it there is to issue. */
export interface AllocationDraftLine {
  inventoryItemId: string;
  name: string;
  /** What the clinic holds; nothing more than this can go out. */
  onHand: number;
}

interface Props {
  open: boolean;
  lines: AllocationDraftLine[];
  departmentId: string | null;
  departmentName?: string;
  onClose: () => void;
  /** Called once the voucher is saved, so the table can drop its ticks. */
  onAllocated: () => void;
}

type Quantities = Record<string, number>;

/** The reference starts every line at one. */
const DEFAULT_QUANTITY = 1;

function errorFor(quantity: number, onHand: number): string | null {
  if (!quantity || quantity < 1) return t("SL phải ≥ 1");
  if (quantity > onHand) return t("Vượt tồn kho ({0})", onHand);
  return null;
}

/**
 * "Phân bổ vật tư" — a quantity per material, and one note for the whole issue.
 *
 * The reference puts this over the selection bar rather than in a modal, and
 * caps each line at what the clinic actually holds. Both matter: the cap is the
 * rule its own form states, and one note per voucher is why the note belongs
 * here and not on each line.
 */
export function AllocationDialog({
  open,
  lines,
  departmentId,
  departmentName,
  onClose,
  onAllocated,
}: Props) {
  const createAllocation = useCreateAllocation();
  const [quantities, setQuantities] = useState<Quantities>({});
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!open) return;

    // Keep whatever was already typed for a material still in the selection,
    // so ticking one more does not reset the rest.
    setQuantities((current) => {
      const next: Quantities = {};
      for (const line of lines) {
        next[line.inventoryItemId] = current[line.inventoryItemId] ?? DEFAULT_QUANTITY;
      }
      return next;
    });
  }, [open, lines]);

  useEffect(() => {
    if (open) setNote("");
  }, [open]);

  const step = (line: AllocationDraftLine, by: number) => {
    setQuantities((current) => {
      let next = (current[line.inventoryItemId] ?? DEFAULT_QUANTITY) + by;
      if (next < 1) next = 1;
      if (next > line.onHand) next = line.onHand;
      return { ...current, [line.inventoryItemId]: next };
    });
  };

  const type = (line: AllocationDraftLine, raw: string) => {
    const parsed = Number.parseInt(raw.replace(/\D/g, ""), 10);
    setQuantities((current) => ({
      ...current,
      [line.inventoryItemId]: Number.isFinite(parsed) ? parsed : 0,
    }));
  };

  const invalid = lines.some((line) =>
    errorFor(quantities[line.inventoryItemId] ?? 0, line.onHand),
  );

  const submit = async () => {
    if (!departmentId) return;

    try {
      await createAllocation.mutateAsync({
        departmentId,
        items: lines.map((line) => ({
          inventoryItemId: line.inventoryItemId,
          quantity: quantities[line.inventoryItemId] ?? DEFAULT_QUANTITY,
        })),
        note: note.trim() || undefined,
      });
      toast.success(t("Đã tạo phiếu phân bổ"));
      onAllocated();
      onClose();
    } catch {
      // queryClient reports the failure; nothing to add here.
    }
  };

  return (
    <AppDialog
      open={open}
      title={t("Phân bổ vật tư")}
      subtitle={t("Nhập số lượng phân bổ cho từng vật tư")}
      width={1100}
      canSave={lines.length > 0 && !invalid}
      saving={createAllocation.isPending}
      saveLabel={t("Xác nhận")}
      cancelLabel={t("Huỷ")}
      onSave={() => void submit()}
      onClose={onClose}
      titleExtra={
        departmentName ? <Tag className="bd-alloc-chip">{departmentName}</Tag> : undefined
      }
      footerLeft={
        <span className="bd-alloc-count">
          <strong>{lines.length}</strong> {t("vật tư")}
        </span>
      }
    >
      <div className="bd-alloc-lines">
        {lines.map((line) => {
          const quantity = quantities[line.inventoryItemId] ?? DEFAULT_QUANTITY;
          const error = errorFor(quantity, line.onHand);

          return (
            <div className="bd-alloc-line" key={line.inventoryItemId}>
              <div className="bd-min0 bd-flex1">
                <p className="bd-alloc-line-name">{line.name}</p>
                <p className="bd-alloc-line-stock">
                  {t("Tồn kho:")}{" "}
                  <span className={line.onHand <= 0 ? "bd-alloc-empty" : "bd-mat-issued"}>
                    {line.onHand}
                  </span>
                  {error ? <span className="bd-alloc-error"> · {error}</span> : null}
                </p>
              </div>

              <div className="bd-alloc-stepper">
                <Button
                  size="small"
                  icon={<MinusOutlined />}
                  aria-label={t("Giảm")}
                  disabled={quantity <= 1}
                  onClick={() => step(line, -1)}
                />
                <Input
                  className="bd-alloc-qty"
                  inputMode="numeric"
                  aria-label={t("Số lượng phân bổ {0}", line.name)}
                  status={error ? "error" : undefined}
                  value={String(quantity)}
                  onChange={(event) => type(line, event.target.value)}
                />
                <Button
                  size="small"
                  icon={<PlusOutlined />}
                  aria-label={t("Tăng")}
                  disabled={quantity >= line.onHand}
                  onClick={() => step(line, 1)}
                />
              </div>
            </div>
          );
        })}
      </div>

      <Input.TextArea
        className="bd-alloc-note"
        rows={2}
        maxLength={1000}
        placeholder={t("Ghi chú đợt phân bổ...")}
        aria-label={t("Ghi chú đợt phân bổ")}
        value={note}
        onChange={(event) => setNote(event.target.value)}
      />
    </AppDialog>
  );
}
