import type { TreatmentServiceStatus } from "../../api/treatmentPlanApi";
import type { ToothPickerValue } from "../plan/toothPicker";

/** What a line holds while "Chỉnh sửa" has turned it into the inline row. */
export interface DraftServiceValues {
  status: TreatmentServiceStatus;
  diagnosisId: string | null;
  dentistId: string | null;
  teeth: ToothPickerValue;
  quantity: number;
  price: number;
  note: string;
  diagnoserStaffId: string | null;
  secondDiagnoserStaffId: string | null;
  consultantStaffId: string | null;
  secondConsultantStaffId: string | null;
}

/** The value fields that hold an id — the people and diagnosis pickers. */
export type DraftIdField = {
  [K in keyof DraftServiceValues]: DraftServiceValues[K] extends string | null ? K : never;
}[keyof DraftServiceValues];

/**
 * What a line **in treatment** keeps when it is edited — staging prints the
 * value with "Không thể đổi chẩn đoán/giá khi đang điều trị" under it.
 */
export interface DraftServiceLocks {
  diagnosisName: string | null;
  price: number;
}

/** Everything an inline cell needs: the values, how to change them, save and cancel. */
export interface DraftServiceController {
  service: { id: string; name: string };
  values: DraftServiceValues;
  /**
   * The giá gốc the unit price may not rise above — the line's own. 0 when
   * none is known.
   */
  originalPrice: number;
  /**
   * Thành tiền while nothing that prices the line has been touched yet — the
   * saved figure an edited line opens with. Once the price, quantity or teeth
   * change, staging shows đơn giá × số lượng instead.
   */
  savedAmount?: number;
  /** Names for the ids the row came in with, so a picker can print them. */
  labels?: Partial<Record<DraftIdField, string | null>>;
  /** Set on an edited line in treatment; see {@link DraftServiceLocks}. */
  locks?: DraftServiceLocks;
  /** A refusal of the last Lưu, printed under the cell it is about. */
  errors?: { teeth?: string; price?: string };
  update: <K extends keyof DraftServiceValues>(field: K, value: DraftServiceValues[K]) => void;
  openTeeth: () => void;
  save: () => void;
  /** Hủy: the line goes back to how it was saved. */
  cancel: () => void;
  saving: boolean;
}
