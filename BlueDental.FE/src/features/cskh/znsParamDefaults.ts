import type { ZnsTemplateParam } from "./api/templateApi";

/**
 * What a ZNS parameter most likely wants, by the names clinics give them —
 * the same aliases ZaloTemplateDataBuilder reads on the server, pointed at the
 * library's variables. Picking a ZNS template pre-fills its parameters from
 * here; the user can still change any of them.
 */
const PARAM_DEFAULTS: readonly (readonly [string, readonly string[]])[] = [
  ["{ten_khach_hang}", ["customer_name", "name", "ten", "ten_khach_hang", "khach_hang", "full_name", "fullname", "patient_name", "ho_ten"]],
  ["{so_dien_thoai}", ["phone", "phone_number", "sdt", "so_dien_thoai", "dien_thoai"]],
  ["{ma_khach_hang}", ["customer_code", "code", "ma_khach_hang", "ma_kh", "patient_code", "ma_benh_nhan", "order_code", "ma_ho_so"]],
  ["{ten_phong_kham}", ["clinic_name", "clinic", "branch", "branch_name", "chi_nhanh", "phong_kham", "ten_phong_kham", "oa_name"]],
  ["{hotline}", ["clinic_phone", "hotline", "branch_phone", "sdt_phong_kham"]],
  ["{ngay_hen}", ["date", "ngay", "appointment_date", "ngay_hen", "ngay_kham", "booking_date"]],
  ["{gio_hen}", ["time", "gio", "appointment_time", "gio_hen", "gio_kham", "booking_time"]],
  ["{gio_hen} {ngay_hen}", ["date_time", "datetime", "thoi_gian", "thoi_gian_hen", "appointment_datetime", "schedule_time", "lich_hen"]],
  ["{bac_si}", ["doctor_name", "doctor", "bac_si", "ten_bac_si", "dentist"]],
  ["{noi_dung_dich_vu}", ["service_name", "service", "dich_vu", "ten_dich_vu", "noi_dung_dich_vu"]],
  ["{email}", ["email"]],
  ["{ngay_sinh}", ["birthday", "dob", "ngay_sinh"]],
];

function defaultFor(paramName: string, variableKeys: readonly string[]): string | undefined {
  const name = paramName.toLowerCase();
  const aliased = PARAM_DEFAULTS.find(([, names]) => names.includes(name));
  if (aliased) return aliased[0];
  return variableKeys.includes(name) ? `{${name}}` : undefined;
}

/** One entry per parameter the aliases recognise; the others stay for the user to fill. */
export function prefillParamMap(
  params: readonly ZnsTemplateParam[],
  variableKeys: readonly string[],
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const param of params) {
    const value = defaultFor(param.name, variableKeys);
    if (value) map[param.name] = value;
  }
  return map;
}
