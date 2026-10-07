# Người giám hộ — dialog Tạo / Chỉnh sửa hồ sơ

**BlueDental-local.** The reference (app.nfcdental.com) has no guardian section
in its hồ sơ dialog, so nothing here is cloned. The source is the BA's spec
images (2026-10-07). The owner answered the open questions on the same day (see below).
Test record: `docs/testing/features/patient-guardian.md` (F-50, R-773).

## What the BA drew

The main dialog (Tạo hồ sơ / Chỉnh sửa hồ sơ):

- **Ngày sinh** carries an age chip ("9 tuổi"). Age = current year − birth year.
- A third pill **Người giám hộ** next to Thông tin cơ bản / Tiểu sử bệnh. It shows:
  - a red dot when the patient is under 16 and has no guardian;
  - a ✓ once guardians are entered.
- Under 16 with no guardian:
  - right under Ngày sinh, an orange banner "**Khách hàng dưới 16 tuổi.** Cần bổ sung người giám hộ trước khi lưu." with a people icon and a primary **Nhập ngay**;
  - the footer note "Chưa có thông tin người giám hộ";
  - **Lưu** disabled.
- The guardian pane shows one card per guardian:
  - avatar initials, name, a relation tag, phone;
  - Sửa / Xoá;
  - CCCD masked;
  - address, primary contact, treatment consent;
  - a dashed "Thêm người giám hộ" button.

The popup **Thông tin người giám hộ**:

- **Header**: ← back, the title, the breadcrumb "Tạo hồ sơ › Người giám hộ", and X.
- **Patient summary**: initials, "name · code", "gender · Ngày sinh dd/mm/yyyy", and the chip "9 tuổi · Bắt buộc có người giám hộ".
- **One guardian**: a single form, with "+ Thêm người giám hộ thứ 2" in the footer.
- **Two or three guardians**: a group view.
  - Header: "NHÓM NGƯỜI GIÁM HỘ (n)", "Tối đa 3 người · 1 người liên hệ chính", and an add button.
  - An accordion: one panel per guardian with its status "Đã nhập đủ thông tin" / "Đang nhập thông tin", a "Liên hệ chính" badge and delete.
  - Footer: "n người giám hộ trong nhóm".
- **Each form**:
  - The label "Tìm người giám hộ đã có hồ sơ"; the input "Nhập số điện thoại hoặc CCCD để tự động điền thông tin"; a pale-blue **Tìm & điền**.
  - Relation pills: Bố, Mẹ, Ông, Bà, Anh/Chị ruột, Cô/Dì/Chú/Bác, Người giám hộ hợp pháp, Khác.
    - **Khác** adds Ghi rõ quan hệ\*, Giấy tờ chứng minh quyền giám hộ\*, and an upload (JPG, PNG, PDF ≤ 5MB).
  - Họ và tên\*, Điện thoại\*, CCCD / Hộ chiếu\*.
  - Ngày sinh, Ngày cấp CCCD, Nơi cấp, Email, Nghề nghiệp, Giới tính.
  - "Cùng địa chỉ với khách hàng — Lấy theo: …" (otherwise an address box).
  - "Đặt làm người liên hệ chính (nhận SMS lịch hẹn, kết quả khám)".
- **Once for the group**: the required consent "Các người giám hộ xác nhận thông tin chính xác và đồng ý cho khách hàng được thăm khám, điều trị".
- **Footer buttons**: Hủy and **Lưu & quay lại hồ sơ**.

## Decisions

| Question | Answer | Who |
|---|---|---|
| Where guardians are stored | A separate table `bd_patient_guardians` with FK to the patient and an optional link to the guardian's own hồ sơ | Owner |
| Old under-16 records without a guardian | Blocked on save until one is added | Owner |
| Proof file for "Khác" | Not required for now. If required later, validate it on the FE | Owner |
| The pill | Always shown | Owner |
| Paper types | Giấy uỷ quyền · Quyết định công nhận giám hộ · Giấy khai sinh · Khác (constants, not a catalog) | Owner |
| Primary contact | Exactly one. The first guardian gets it; ticking another moves it. Only stored for now | Assumed, not objected |
| Relation → guardian gender | Not filled in automatically | Assumed, not objected |
| "Lưu & quay lại hồ sơ" | Hands the group back to the dialog; only the hồ sơ's Lưu writes to the DB. Hủy / X / ← drop the popup's edits | Assumed, not objected |
| Validation messages | Under the inputs, never toasts (R-307) | House rule |
| Detail page Hồ sơ tab | Does not show guardians | Assumed, not objected |

## Not decided / not built

- A cleanup job for papers uploaded in a popup that was then cancelled. They stay in MinIO.
- Sending reminders to the primary contact.
