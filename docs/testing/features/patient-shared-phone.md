# F-82 — Nhiều hồ sơ dùng chung một số điện thoại

Status: `VERIFIED` (chưa commit) · Nguồn: BA P2710_02 (`P2710_02.drawio`), 2026-10-28 · Nhật ký hồi quy: R-1057

Đây không phải tính năng clone từ bản gốc. app.nfcdental.com không có phần này: BA thêm vào dialog "Tạo hồ sơ" / "Chỉnh sửa hồ sơ" và tab Hồ sơ của trang chi tiết bệnh nhân. Tính năng này thay luật bug 29 ("1 số = 1 hồ sơ / chi nhánh", R-784, `Patient:0021`).

## Phạm vi

Chỉ làm phần khung đỏ của mock (chủ phòng khám: "ngoài khung đỏ thì k quan tâm").

- **Ô Điện thoại** (dialog hồ sơ, mọi nơi mở dialog đó):
  - Số đã có hồ sơ dùng: badge "N hồ sơ" nằm trong ô.
  - Số chỉ khớp người giám hộ chưa có hồ sơ: badge "N giám hộ".
  - Bấm badge thì mở/đóng danh sách. Esc hoặc bấm ra ngoài thì đóng danh sách, dialog vẫn mở.
  - Danh sách "Những người đang dùng số điện thoại này" nổi đè lên các ô bên dưới, không đẩy form xuống.
    - Đầu danh sách: "SĐT … đã có N hồ sơ · Khách là ai?".
    - Mỗi dòng gồm: avatar theo giới tính, tên, nhãn "Chủ số" hoặc "… của …", mã hồ sơ, "Khám gần nhất …", nút "Mở hồ sơ ›".
    - Dòng người giám hộ gồm: "Người giám hộ của …" và "Chưa có hồ sơ". Không có nút mở hồ sơ.
    - Chân danh sách: "Người mới, dùng chung số này" (tạo mới) hoặc "Hồ sơ này dùng chung số này" (sửa hồ sơ).
- **Khối "Liên kết người dùng chung SĐT"** hiện khi số đã có hồ sơ khác dùng và người dùng giữ số đó:
  - Gồm "Là … (quan hệ)" và "của …".
  - Chỉ có một người được chọn thì "của …" hiện sẵn tên người đó.
  - Chưa chọn quan hệ thì hiện "Chọn quan hệ để lưu." và Lưu bị khoá.
  - 8 quan hệ theo thứ tự BA: Con, Vợ/Chồng, Bố/Mẹ, Anh/Chị/Em, Ông/Bà, Cháu, Người giám hộ khác, Người quen dùng nhờ số.
- **Tab Hồ sơ, khối "Người dùng chung SĐT (N)"** đứng trước khối người giám hộ:
  - Mỗi thẻ gồm: avatar, tên, Chủ số / "… của …", mã hồ sơ, Khám gần nhất, Nợ …, chevron › (mở hồ sơ đó, cùng tab).
  - Dòng "Tổng dư nợ cả nhóm:" cộng cả chính hồ sơ đang xem. Tiền theo quyền "Chi phí › Xem": không có quyền thì hiện `*********`.
  - Chưa có ai khác dùng số thì hiện "Chưa có hồ sơ nào khác dùng số này.".
  - Nút + "Thêm người dùng chung số điện thoại" mở Tạo hồ sơ với số điền sẵn, danh sách đóng sẵn, "của" là hồ sơ đang xem.
- **Thẻ người giám hộ** đã có hồ sơ riêng:
  - Hiện mã hồ sơ, và có chevron "Mở hồ sơ …" mở hồ sơ đó.
  - Chưa có hồ sơ thì không hiện mã.
  - Bút chì, thùng rác và việc bấm thân thẻ để gập/mở vẫn như cũ.

Không làm: chip tên, chip "Dùng chung · N hồ sơ", "Lịch hẹn của người cùng SĐT", dòng "Liên hệ:".

## Quyết định (chủ phòng khám / BA, 2026-10-28)

| Câu hỏi | Quyết định |
|---|---|
| Trùng tên | Cùng số, không phân biệt hoa thường và khoảng trắng, **có** phân biệt dấu ("Hà My" ≠ "Ha My") → `Patient:0035`. CCCD vẫn duy nhất trong chi nhánh (`0012`). |
| "Mở hồ sơ ›" | Mở trang chi tiết hồ sơ đó. Trong luồng (Lịch hẹn, Lịch tạm, Tạo tiếp nhận, Hộp thư Zalo, tức các nơi truyền `onCreated`) thì mở **tab mới**; bấm thân dòng thì dùng hồ sơ đó cho luồng và đóng dialog. Ở trang Bệnh nhân và khi sửa hồ sơ thì cả hai cách đều chuyển trang ngay tại tab đang mở. Không bao giờ tạo trùng. |
| Ai được chọn ở "của …" | Người trên 18 tuổi (năm nay − năm sinh > 18) hoặc chưa có ngày sinh. Bố/Mẹ, Ông/Bà, Người giám hộ khác được chọn cả người dưới 18. Không ai đủ điều kiện thì hiện hết. Server kiểm lại (`0034`). |
| Người giám hộ chưa có hồ sơ | Có dòng trong danh sách khi số khớp (chỉ khi tạo mới). Chọn dòng đó thì chép thông tin vào form 1 lần (tên, CCCD, ngày sinh, giới tính, email, nghề nghiệp, địa chỉ). Lưu thì tạo hồ sơ mới mã bình thường; mọi dòng giám hộ cùng CCCD trong chi nhánh được gắn `LinkedPatientId`. Không đồng bộ hai chiều. Chỉ tìm thấy qua danh sách theo số, không qua CCCD hay Quét CCCD. |
| Quan hệ khi chọn người giám hộ | Điền sẵn: Bố/Mẹ (Father/Mother) → Bố/Mẹ; Ông/Bà → Ông/Bà; Anh/Chị/Em → Anh/Chị/Em; Cô/Dì/Chú/Bác, Người giám hộ hợp pháp, Khác → Người giám hộ khác. |
| Số chỉ khớp người giám hộ | Không bắt buộc liên kết. |
| Sửa hồ sơ | Đổi sang số hồ sơ khác đang dùng thì xử lý như tạo mới. Giữ nguyên số thì không hỏi lại (chỉ còn kiểm trùng tên khi đổi tên). |
| Chủ số | Hồ sơ tạo sớm nhất trên số đó. |
| Gia đình | "Người giám hộ khác" tính là gia đình (vào Hồ sơ nhóm); "Người quen dùng nhờ số" thì không. |
| Không đổi | Nhập Excel danh sách vẫn từ chối số trùng (`0021`). Tài khoản bị "Ẩn số điện thoại" vẫn thấy Alert cũ và nhận `0021`, vì không được xem ai đang dùng số. Zalo tự nối vẫn cần khớp đúng 1 hồ sơ. |
| Thẻ người giám hộ | Giữ bút chì và thùng rác, thêm chevron › mở hồ sơ liên kết. Bấm thân thẻ vẫn gập/mở. Các nút "thêm mới" vẫn mở popup cũ. |
| Thứ tự khối ở tab Hồ sơ | "Người giám hộ" trên, "Người dùng chung SĐT" dưới, như mock (chủ phòng khám, 2026-10-28). |
| Một số, nhiều cách gõ | Số VN gõ thiếu 0 ("902472111" bên cờ +84) hoặc có 84 đứng trước, kể cả không có "+" như Zalo ("84902472111"), vẫn là cùng một số: BE và FE cùng thêm lại số 0. Hồ sơ cũ đã lưu thiếu 0 vẫn được tìm thấy. Số nước ngoài là dạng E.164: cùng dãy chữ số nhưng khác mã nước là người khác (lỗi người dùng báo 2026-10-28). |

## API

```
GET  /api/v1/app/patients/check-phone?phone=&excludeId=
     → { exists, owners: [{ id, patientCode, patientName, gender, dateOfBirth, lastVisitAt,
                             isPhoneOwner, isAdult, relationType?, relatedToName? }],
         guardians: [{ guardianId, relation, fullName, nationalId, dateOfBirth, gender, email,
                       occupationEntryId, address, provinceCode, wardCode,
                       wards: [{ patientId, patientCode, fullName }] }] }
     (tài khoản bị che số: chỉ có exists)
POST /api/v1/app/patients        + sharedPhoneLink?: { anchorPatientId, relation }, sourceGuardianId?
PUT  /api/v1/app/patients/{id}   + sharedPhoneLink?: { anchorPatientId, relation }
GET  /api/v1/app/patients/{id}/linked-people           (patient.read, kiểm chi nhánh)
     → { sharedPhone: [{ id, patientCode, fullName, gender, dateOfBirth, lastVisitAt, totalDebt,
                         isPhoneOwner, relationType?, relatedToName? }],
         groupDebt, moneyHidden, canAddSharedPhone,
         guardians: [{ guardianId, patientId, patientCode, lastVisitAt }] }
```

Mã lỗi:
- `Patient:0033`: số đã có hồ sơ, thiếu liên kết.
- `Patient:0034`: "của …" không dùng số này hoặc không chọn được cho quan hệ đó.
- `Patient:0035`: trùng tên trên cùng số.
- `PatientRelation:0003`: quan hệ không nằm trong 8 lựa chọn.
- `Patient:0021`: tài khoản bị che số; nhập Excel danh sách.

Liên kết được ghi vào bảng quan hệ (`bd_patient_relationships`, 4.8), nên tab Mối quan hệ cũng thấy. Cặp đã có quan hệ thì sửa dòng đó. Quan hệ giám hộ đã nói đúng như vậy thì không ghi thêm.

Không có migration: cột `LinkedPatientId` của `bd_patient_guardians` có từ F-50. Các giá trị enum mới (`OtherGuardian` 11, `Ward` 12, `PhoneBorrower` 13, `PhoneLender` 14) lưu trong cột int sẵn có.

## Code

- BE:
  - `PatientSharedPhoneRule` (Application/PatientManagement).
  - `PatientAppService`: `CreateAsync` / `UpdateAsync` / `CheckPhoneAsync` / `GetLinkedPeopleAsync`.
  - `Patient.LinkGuardianTo`, `PatientGuardian.LinkTo` (internal).
  - `PatientRelationTypes.SharedPhoneChoices` / `MayLinkToMinor`.
- FE:
  - `components/shared-phone/*`.
  - `hooks/usePhoneHolders`, `useSharedPhoneLink`, `useHolderNavigation`, `usePatientNameCasing`.
  - `utils/patientEditorForm.ts`.
  - `patient-detail/PatientSharedPhoneSection.tsx`, `PatientGuardianCard.tsx`, `PatientGuardianSection.tsx`.
  - `api/patientQueries.ts` (`useLinkedPeople`).

## Test

Toàn bộ chạy trên build production `vite preview` :8080 (`dist-f82`) → host thật :5000 → PostgreSQL thật. Không chặn request, đăng nhập qua màn hình thật.

`e2e/patient-shared-phone-api.spec.ts` (7):
1. Số đã có hồ sơ:
   - Không gửi liên kết thì `0033`.
   - "của" một người không dùng số thì `0034`.
   - Quan hệ "Bạn bè" (không nằm trong 8 lựa chọn) thì `PatientRelation:0003`.
   - Gửi liên kết thì lưu được, và Mối quan hệ (GET riêng) đọc được cả hai chiều (Bố/Mẹ ↔ Con, Vợ/Chồng).
   - `check-phone`: Chủ số (cũ nhất) đứng đầu, kèm nhãn "… của …". Hồ sơ đang sửa bị loại khỏi danh sách, nhưng Chủ số vẫn là Chủ số.
2. Luật "của …":
   - 18 tuổi theo năm chưa phải trên 18, 19 tuổi thì phải; chưa có ngày sinh thì tính là đủ tuổi.
   - Vợ/Chồng của người dưới 18 thì `0034`, Bố/Mẹ thì được.
   - Số không có ai trên 18 thì ai cũng chọn được.
3. Trùng tên và CCCD:
   - Trùng tên cùng số (khác hoa thường) thì `0035`; khác dấu thì được. CCCD trùng thì `0012`.
   - Sửa hồ sơ giữ nguyên số thì không hỏi liên kết, nhưng đổi tên vẫn bị kiểm trùng tên.
   - Đổi sang số đã có thì như tạo mới (`0033`, rồi lưu được với Anh/Chị/Em).
4. Người giám hộ trên số:
   - Một người được khai hai lần (cho 2 con) hiện thành 1 dòng ghi cả 2 con, bản khai mới nhất trước.
   - Tạo hồ sơ từ dòng đó (`sourceGuardianId`) thì cả 2 thẻ giám hộ được gắn `linkedPatientId`, và `linked-people` trả mã hồ sơ.
   - Quan hệ giám hộ đã nói Bố/Mẹ thì không ghi thêm dòng quan hệ thứ hai.
   - Sau đó người này được đề xuất như một hồ sơ, không còn là người giám hộ.
   - CCCD của người giám hộ đã nằm trên một hồ sơ khác (khác số): dòng giám hộ vẫn hiện; tạo hồ sơ từ dòng đó thì `0012`, thẻ giám hộ không bị gắn, dòng vẫn còn (lỗi người dùng báo 2026-10-28: trước đây dòng bị ẩn nên gõ số không thấy gì).
5. Một số, nhiều cách gõ:
   - Gõ thiếu 0 thì lưu có 0. `check-phone` với dạng có 0, thiếu 0, `84…`, `+84 …`, `0084…` đều trả đúng người đó.
   - Người thứ hai gõ `84…` vẫn phải liên kết (`0033`), lưu xong số có 0.
   - Số Úc gõ `0061 4…` thì lưu `+614…`. `+61 …` tìm thấy người đó; `+64…` (New Zealand) và `04…` (VN) thì không.
6. Tài khoản bị che số, quyền Chi phí và chi nhánh:
   - Tài khoản bị che số: `check-phone` chỉ trả `exists`, không có danh sách người; lưu thì `0021`; `canAddSharedPhone = false`.
   - Không có "Chi phí › Xem": vẫn thấy danh sách nhóm, nhưng `moneyHidden`, nợ = 0.
   - Chi nhánh khác: `check-phone` trả `exists = false`; `linked-people` trả 403 hoặc 404.

`e2e/patient-shared-phone-ui.spec.ts` (6):
1. Người mới trên số đã có: badge, dòng Chủ số, "Người mới", khối liên kết với "của <chủ số>", Lưu khoá tới khi chọn Vợ/Chồng. Sau khi lưu, tab Hồ sơ của cả hai bên hiện nhau (nhãn, mã hồ sơ, Tổng dư nợ cả nhóm, chevron chuyển trang); reload vẫn còn.
2. Nút + ở tab Hồ sơ: dialog có số điền sẵn, danh sách đóng, "của" là hồ sơ đang xem. Badge mở danh sách; **Esc đóng danh sách mà dialog vẫn mở**. Lưu với quan hệ Con thì số người tăng lên 1, reload vẫn còn.
3. Trang Bệnh nhân: "Mở hồ sơ" và bấm thân dòng đều đóng dialog, chuyển tới hồ sơ đó, không tạo trùng.
4. Lịch tạm trên số đã có: "Mở hồ sơ" mở tab mới và dialog vẫn còn. Bấm thân dòng thì gọi `attach-patient` với đúng hồ sơ đó; lịch hẹn hết là lịch tạm; không có hồ sơ thứ hai.
5. Người giám hộ (Mẹ) dùng số khác số của con: badge "1 giám hộ", dòng "Người giám hộ của …" / "Chưa có hồ sơ". Chọn dòng đó thì điền tên + CCCD; không có khối liên kết. Lưu xong thì thẻ giám hộ của con có `linkedPatientId`, hiện mã hồ sơ, và chevron mở hồ sơ mẹ.
6. Một số, nhiều cách gõ:
   - Bên cờ +84, gõ thiếu 0 thì badge "1 hồ sơ" hiện và ô giữ nguyên chữ đã gõ. Gõ `84…` thì ô đổi thành dạng có 0.
   - Số của người giám hộ gõ thiếu 0 vẫn hiện "1 giám hộ".
   - Chọn Úc rồi gõ `04…`, `4…` hoặc dán `+61…`: ô đều là `4…` và badge "1 hồ sơ" hiện.

Kết quả và hồi quy mức 3: xem R-1057.

## Còn treo

- Các điểm tự chọn khi BA chưa ghi rõ: xem `docs/clone/unknowns.md` (F-82).
