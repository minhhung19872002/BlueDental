/**
 * Which columns "Phiếu tư vấn" offers behind `Cột hiển thị`, and in what order.
 *
 * The order is the user's: the reference's panel drags its rows, so the setting
 * is a list rather than a set of flags. `key` doubles as the id.
 */
export const OPTIONAL_COLUMNS = [
  "date",
  "service",
  "diagnosis",
  "staff",
  "secondStaff",
  "diagnosisStaff",
  "secondDiagnosis",
  "quantity",
  "price",
  "discount",
  "amount",
  "note",
] as const;

export type OptionalColumn = (typeof OPTIONAL_COLUMNS)[number];

export const COLUMN_LABELS: Record<OptionalColumn, string> = {
  date: "Ngày",
  service: "Dịch vụ",
  diagnosis: "Chẩn đoán",
  staff: "Nhân sự tư vấn 1",
  secondStaff: "Nhân sự tư vấn 2",
  diagnosisStaff: "Bác sĩ chẩn đoán 1",
  secondDiagnosis: "Chẩn đoán 2",
  quantity: "Số lượng",
  price: "Đơn giá",
  discount: "Giảm giá",
  amount: "Thành tiền",
  note: "Ghi chú tư vấn",
};

/** One row of the `Cột hiển thị` panel: a column, and whether it is drawn. */
export interface ColumnSetting {
  key: OptionalColumn;
  on: boolean;
}

/** Everything on, in the reference's own order. */
export const DEFAULT_COLUMN_SETTINGS: ColumnSetting[] = OPTIONAL_COLUMNS.map((key) => ({
  key,
  on: true,
}));
