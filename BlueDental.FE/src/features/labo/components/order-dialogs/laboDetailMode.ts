/**
 * Which screen opened "Thông tin chung" and what it may do there. Staging's
 * detail dialog takes `canUpdate` (`laboTemplate:update`: the Trạng thái
 * select, the Tải ảnh well, Lưu) and `canCreateAppointment`
 * (`appointment:create`: Tạo Lịch Hẹn Mới) on Mẫu Labo; the patient's Labo
 * tab shows the facts and ends in Đóng (docs/clone/pages/labo.md §2.6).
 */
export type LaboDetailMode =
  | { variant: "patient" }
  | { variant: "orders"; canUpdate: boolean; canCreateAppointment: boolean };

export const PATIENT_DETAIL_MODE: LaboDetailMode = { variant: "patient" };
