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
  date: "Patient:Advise:Column:Date",
  service: "Patient:Advise:Column:Service",
  diagnosis: "Patient:Advise:Column:Diagnosis",
  staff: "Patient:Advise:Column:Consultant1",
  secondStaff: "Patient:Advise:Column:Consultant2",
  diagnosisStaff: "Patient:Advise:Column:DiagnosisDoctor1",
  secondDiagnosis: "Patient:Advise:Column:Diagnosis2",
  quantity: "Patient:Advise:Column:Quantity",
  price: "Patient:Advise:Column:UnitPrice",
  discount: "Patient:Advise:Column:Discount",
  amount: "Patient:Advise:Column:Amount",
  note: "Patient:Advise:Column:Note",
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
