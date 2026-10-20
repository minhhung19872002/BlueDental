# F-75 — Quyền "Tài chính / Kế toán › Chi phí › Xem" (BA P2010)

Nguồn: `P2010.drawio` của BA (2026-10-20). BlueDental riêng, bản gốc không có
quyền này. Regression id R-1003. Định hình lại phạm vi phiếu R-961.

Status: xem `01-feature-verification-registry.md` dòng F-75.

## Yêu cầu BA

1. **Màn Phân quyền**
   - Thêm nhóm cấp cao "Tài chính / Kế toán", đặt cuối cùng, sau "Hướng dẫn và
     hỗ trợ".
   - Chuyển "Thanh toán" (Xem / Thêm / Sửa / Xoá / Xuất dữ liệu / Chốt phiếu)
     từ "Khách hàng" sang nhóm mới.
   - Thêm "Chi phí" với một quyền "Xem".
2. **Ý nghĩa**
   - Có quyền: xem chi phí của các bác sĩ trong nhóm / phòng ban bên dưới.
   - Không có quyền: chỉ xem chi phí của khách hàng mà mình là bác sĩ tiếp
     nhận. Ví dụ: trưởng nhóm thấy 15.000 = 10.000 + 5.000, thành viên thấy 5.000.
3. **Tab Hồ sơ, 7 thẻ tiền**: không có quyền thì chỉ cộng các phiếu mình là
   bác sĩ tiếp nhận.
4. **Tab Kế hoạch điều trị**: có quyền thì thấy mọi phiếu (trong phạm vi sơ đồ
   tổ chức); không có quyền thì chỉ thấy phiếu có bác sĩ tiếp nhận là mình.
5. **/patient, cột SỐ TIỀN / THỰC THU / CÔNG NỢ**: không có quyền thì che hết;
   có quyền thì giữ nguyên.

## Đã dựng

### Quyền

- `BlueDental.TreatmentCost.Read`: subject `TreatmentCost` trong
  `BlueDentalAbilities`, hằng `BlueDentalAbilityPermissions.TreatmentCost.Read`.
- Cây quyền (`PermissionTreeBuilder`): group `finance-accounting`
  (`BE:Perm:FinanceAccounting` = "Tài chính / Kế toán") là group cuối.
  - Bên trong có group `payment`, giữ nguyên 6 lá và id cũ, nên quyền đã cấp
    không mất.
  - Và group `treatmentCost` (`BE:Perm:TreatmentCost` = "Chi phí"), có một lá
    `treatmentCost.read` "Xem".
- Seeder tự cấp cho role tĩnh: admin, Quản lý phòng khám, Quản lý chi nhánh.
  Role tuỳ chỉnh không được cấp sẵn.
- `TreatmentCostAccess.SeesCostsAsync()`: true khi là role `admin` hoặc được
  cấp lá. Kết quả cache trong một scope.

### Phạm vi phiếu: `OrgChartScope.VisibleSlips`

Thay `VisibleTreatingDentists` của R-961.

| Người đăng nhập | Thấy |
|---|---|
| role `admin` | mọi phiếu |
| không có "Chi phí › Xem" (kể cả khi làm trưởng nhóm) | chỉ phiếu có Bác sĩ tiếp nhận là mình |
| có quyền, không phải bác sĩ (kế toán, lễ tân…) | mọi phiếu |
| có quyền, bác sĩ trưởng gốc | mọi phiếu |
| có quyền, bác sĩ trưởng Phòng ban / Team | phiếu của mình (lên đầu) + cả cây con |
| có quyền, bác sĩ khác | phiếu của mình |

- "Phiếu của X" khi không có quyền: chỉ xét `TreatmentPlan.DentistId` (Bác sĩ
  tiếp nhận). Bác sĩ điều trị của một dòng **không** được tính
  (`SlipScope.ReceivedOnly`).
- Khi có quyền: xét Bác sĩ tiếp nhận hoặc bác sĩ của bất kỳ dòng nào, như R-961.
- Áp cho:
  - tab "Kế hoạch điều trị" (`GetListAsync` với `TreatingScope`);
  - mở trang phiếu bằng link (`GetInTreatingScopeAsync`, ngoài phạm vi thì 403
    `Treatment:0052`).
- Thay đổi so với R-961: người không phải bác sĩ trước đây không thấy phiếu
  nào; nay thấy mọi phiếu nếu có quyền, và chỉ phiếu mình tiếp nhận nếu không có.

### 7 thẻ tiền: `PatientPaymentAppService.GetAccountAsync`

- `Payment` chỉ cộng các phiếu trong `VisibleSlips`, cùng các phiếu thu / hoàn
  tiền của chính những phiếu đó.
- Tạm ứng không thuộc phiếu nào, nên khi bị thu hẹp thì Tạm ứng = 0.
- Các danh sách `Plans` / `Payments` trong account vẫn đầy đủ. Danh sách theo
  quyền Thanh toán, không theo quyền Chi phí.
- Cùng endpoint đó cấp số cho thẻ ở tab Thanh toán / Lịch sử dư nợ, nên thẻ ở
  hai tab này cũng bị thu hẹp theo.

### /patient: `PatientAppService`

- `HideMoneyIfRequiredAsync`: khi không có quyền, gán `TotalAmount`,
  `TotalRevenue`, `TotalDebt` = 0 và `MoneyHidden = true`. Số thật không ra
  khỏi API.
- FE (`PatientTable` → `Money`): `moneyHidden` thì hiện `*********`
  (`.bd-patient-money--hidden`, màu `--bd-muted`).
- Excel (`GET /api/v1/app/patients/excel`): ba cột ghi `*********`.
- Khi có quyền, /patient hiện tổng **toàn bộ** của bệnh nhân. Danh sách không
  thu hẹp theo sơ đồ tổ chức; BA chỉ yêu cầu che / không che.

## Test

- Domain: `BlueDentalAbilitiesTests` (subject mới), `OrgChartTests` (bảng
  `VisibleSlips`).
- E2E thật `e2e/plan-treating-scope.spec.ts` (11 test):
  - Dữ liệu:
    - 6 tài khoản đăng nhập qua màn login: head / member / clerk (Team A), chief
      / outsider (Team B), accountant.
    - 2 role tuỳ chỉnh: base, và base + Chi phí.
    - 4 phiếu, 1 phiếu thu 100.000 trên phiếu của head, 1 tạm ứng 50.000.
  - 6 ca phạm vi. Mỗi ca kiểm tab KHĐT (thứ tự: phiếu của head lên đầu), API
    `treatingScope`, danh sách không cờ vẫn đủ, `summary` của account, 3 thẻ
    "Tổng dự kiến thu" / "Đã thu" / "Tạm ứng" trên tab Hồ sơ, rồi tải lại trang.
  - Admin thấy mọi phiếu và toàn bộ tiền.
  - Link phiếu ngoài phạm vi trả 403 / 0052 trên `detail`, `payment-v2`, `debt`.
  - /patient che tiền: kiểm API, màn hình và file Excel (member thì che,
    accountant thì không).
  - Phân quyền:
    - qua API: cây quyền, `finance-accounting` cuối cùng, sau `helpSupport`;
      `patient` không còn `payment.*`;
    - qua UI: nhãn nhóm, lá "Chi phí › Xem" đã tick.
  - Bút chì "Chỉnh sửa dịch vụ" (từ R-961, giữ nguyên).

## Còn treo / cần BA xác nhận

- Cột tiền ở CSKH, Hồ sơ nhóm và báo cáo chưa che. BA chỉ nêu /patient.
- Có hai mục cùng tên "Chi phí": "Báo cáo › Quản lý thu chi › Chi phí" (của
  báo cáo, có từ trước) và "Tài chính / Kế toán › Chi phí" (P2010).
- Staging / production cần chạy DbMigrator (seed quyền mới cho role tĩnh) và
  xoá cache quyền trong Redis. Role tuỳ chỉnh (dentist, Kế toán, Tiếp nhận…) phải
  được cấp tay "Chi phí › Xem" thì mới thấy lại tiền và phạm vi cây con.
