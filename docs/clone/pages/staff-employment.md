# Hồ sơ công việc nhân viên — Nhân viên → dialog Tạo / Cập nhật nhân viên

**BlueDental-local.** The reference's staff dialog has none of these fields.
Source: the function list `Danh-muc-chuc-nang-nha-khoa-v2`, cluster 11 item 1:
*"Thông tin lương, phụ cấp, chức vụ, chứng chỉ hành nghề, loại hợp đồng."*
Lương and phụ cấp live in Bảng lương (`payroll.md`, kept apart so staff
pickers never carry a salary); this page covers the rest. Choices made on
2026-10-08 in place of an answer from the owner.

## Decisions (assumed, not observed)

| Field | Chosen |
|-------|--------|
| Chức vụ | Free text (≤ 100), with suggestions from the chức vụ already used in the clinic (`GET /api/v1/app/staff/positions`) — no separate catalogue to maintain |
| Chứng chỉ hành nghề | Số (≤ 50), ngày cấp (not after today), nơi cấp (≤ 200). All optional — not every staff member practises |
| Loại hợp đồng | Thử việc · Có thời hạn · Không thời hạn · Thời vụ / cộng tác viên, plus ngày bắt đầu and ngày kết thúc (end on or after start; no end required, e.g. Không thời hạn) |
| Where | A "Hồ sơ công việc" block in the staff dialog; stored on the account like the other profile fields; read with `staff.read`, written with `staff.create` / `staff.update` |

Errors: `BlueDental:Staff:0009` contract ends before it starts · `0010`
certificate issued in the future · `0011` unknown contract type.

## Open — owner decisions

- Reminders when a contract or a certificate is about to expire.
- A chức vụ column on the staff list (the list is a clone of the reference and
  left as it is).
