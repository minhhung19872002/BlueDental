# F-75 — Quyền "Tài chính / Kế toán › Chi phí › Xem" (BA P2010)

Nguồn: `P2010.drawio` của BA (2026-10-20). BlueDental riêng, bản gốc không có
quyền này. Regression id R-1003. Định hình lại phạm vi phiếu R-961. Bug 40 của
BA (2026-10-21) mở rộng phạm vi theo dòng dịch vụ được giao: R-1006 (R-1005 là
của session khác, Giờ giải lao).

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
6. **Bug 40 (2026-10-21)**: "Trưởng nhóm thấy cả phiếu của nhóm khác khi mình
   là bác sĩ điều trị 1 dịch vụ trong phiếu". BA định hình lại:
   - tab KHĐT hiện cả phiếu có dịch vụ được giao cho bác sĩ ("Nếu dc assign bác
     sĩ điều trị / bác sĩ tư vấn e cho họ coi lun nha"), tiền chỉ tính các dịch
     vụ được giao ("Chỉ hiển thị tiền của dịch vụ mà dc assign á");
   - trang chi tiết phiếu: hiện tiền dịch vụ được giao, che các dịch vụ khác;
   - "Dc assign mà ko có quyền xem thì masking lại hết": được giao mà không có
     quyền Chi phí vẫn thấy phiếu, nhưng **mọi** số tiền bị che, kể cả dòng của
     chính mình.

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

Thay `VisibleTreatingDentists` của R-961. Trả về `SlipScope(Staff)`: tập người
mà phiếu / dòng của họ được hiện (`null` = không giới hạn).

| Người đăng nhập | Tập người trong phạm vi |
|---|---|
| role `admin` | không giới hạn |
| không có "Chi phí › Xem" (kể cả khi làm trưởng nhóm) | chỉ mình |
| có quyền, không phải bác sĩ (kế toán, lễ tân…) | không giới hạn |
| có quyền, bác sĩ trưởng gốc | không giới hạn |
| có quyền, bác sĩ trưởng Phòng ban / Team | mình + cả cây con |
| có quyền, bác sĩ khác | chỉ mình |

Một phiếu hiện theo một trong hai cách (`SlipScopeReading`):

- **Cả phiếu**: Bác sĩ tiếp nhận (`TreatmentPlan.DentistId`) nằm trong tập.
  Mọi dòng và toàn bộ tiền đều hiện. Phiếu của chính mình lên đầu.
- **Theo dòng** (bug 40): Bác sĩ tiếp nhận nằm ngoài tập, nhưng có dòng được
  giao cho người trong tập. "Được giao" (`TreatmentPlan.AssigneesOf`) là một
  trong ba trường:
  - Bác sĩ điều trị của dòng (`line.DentistId`);
  - Bác sĩ tư vấn của dòng, hoặc của phiếu khi dòng không ghi
    (`line.ConsultantStaffId ?? plan.ConsultantStaffId`);
  - Bác sĩ tư vấn 2 (`line.SecondConsultantStaffId`).

  Bác sĩ chẩn đoán **không** tính.

Phạm vi áp cho:

- tab "Kế hoạch điều trị" (`GetListAsync` với `TreatingScope`);
- mở trang phiếu bằng link (`GetInTreatingScopeAsync`; ngoài phạm vi thì 403
  `Treatment:0052`).

Thay đổi so với R-961: người không phải bác sĩ trước đây không thấy phiếu nào.
Nay họ thấy mọi phiếu nếu có quyền; nếu không có quyền, họ thấy phiếu mình tiếp
nhận và phiếu có dòng giao cho mình.

### Phiếu thấy theo dòng (bug 40)

Dòng nào được hiện tiền:

| Người xem | Dòng được giao (của mình / của nhóm) | Dòng khác |
|---|---|---|
| có "Chi phí › Xem" | hiện tiền | che |
| không có quyền | **che** | che |

- **Phạm vi** (`OrgChartScope`, `SlipScopeReading`):
  - `SlipScope(Staff, ShowsLineMoney)`. Nhánh "không có quyền" trả
    `ShowsLineMoney = false`; các nhánh có quyền trả `true`.
  - `OwnLinesOf(slip)`: các dòng được giao, tức các dòng được thao tác.
  - `MoneyLinesOf(slip)`: `null` = cả phiếu; dòng được giao khi
    `ShowsLineMoney`; rỗng khi không có quyền.
- **Server** (`PatientTreatmentAppService.NarrowToLines(dto, plan, ownLines,
  moneyLines, payments)`):
  - DTO phiếu có `SeenThroughLines = true`. `MoneyHidden = true` khi không dòng
    nào được hiện tiền.
  - Dòng được giao có `AssignedToViewer = true`.
  - Dòng ngoài `moneyLines` có `MoneyHidden = true`, và mọi số tiền của dòng
    (giá, giảm giá, thành tiền, đã trả) bị gán 0. Số thật không ra khỏi API.
  - `Payment` của phiếu chỉ cộng các dòng được hiện tiền
    (`TreatmentPlan.MoneyOfLines` → `SlipLinesMoney`); không có quyền thì = 0.
    Mỗi dòng tính theo số thực thu trên phiếu, tức đã trừ phần chia giảm giá
    phiếu và voucher, nên cộng các dòng lại bằng cả phiếu.
  - "Đã trả" = phân bổ của các phiếu thu vào chính các dòng đó, trừ hoàn tiền.
- **FE**:
  - `LineMoney` hiện `*********` (`.tp-money-hidden`) thay số tiền của dòng bị
    che, ở các chỗ:
    - bảng "Chi tiết điều trị" và thẻ trên điện thoại;
    - dialog "Chi tiết dịch vụ";
    - dialog "Danh sách dịch vụ" (nút mắt) trên tab KHĐT.
  - `SlipMoney` (mới) che cột tiền của dòng KHĐT và thẻ phiếu trên điện thoại
    khi phiếu `moneyHidden`.
  - Trang phiếu chỉ còn tab "Chi tiết điều trị", không có dải số tiền.
  - Toolbar ẩn "Thêm dịch vụ phát sinh", "In Hóa Đơn" và nút in phiếu.
  - Dòng của người khác chỉ còn nút mắt: không đổi trạng thái, sửa hay xoá.
  - Dòng của mình mà bị che tiền: **không** có bút chì và "Chuyển đổi". Tiền
    về 0 nên không biết dòng đã trả chưa, dialog sửa sẽ lưu giá 0, dialog
    chuyển đổi xoay quanh số đã trả. Vẫn còn "Hoàn thành", "Hủy dịch vụ", "Xóa".
  - Dòng KHĐT ẩn "Phiếu thu" và "Xoá phiếu điều trị".
- Phiếu nhận trong phạm vi (của mình / của team) giữ nguyên toàn bộ tiền, kể cả
  khi không có quyền (P2010). Xem "Còn treo".

### 7 thẻ tiền: `PatientPaymentAppService.GetAccountAsync`

- `Payment` chỉ cộng các phiếu trong `VisibleSlips`, cùng các phiếu thu / hoàn
  tiền của chính những phiếu đó. Phiếu thấy theo dòng chỉ cộng các dòng được
  hiện tiền (`PatientMoneyCalculator.ForLines` với `MoneyLinesOf`). Không có
  quyền thì phiếu thấy theo dòng không cộng gì.
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

- Domain:
  - `BlueDentalAbilitiesTests` (subject mới);
  - `OrgChartTests` (bảng `VisibleSlips`);
  - `SlipSeenThroughLinesTests` (10 test bug 40): ai được tính là được giao,
    dòng không ghi tư vấn lấy của phiếu, tiền dòng được giao chỉ hiện khi có
    quyền Chi phí, không dòng nào thì không tiền nào, tiền các dòng cộng lại
    bằng cả phiếu, chỉ dòng hoàn thành mới tính là đã làm, đã trả = phân bổ trừ
    hoàn tiền.
  - 2026-10-21: 125/125 xanh (lọc OrgChart / SlipSeenThroughLines /
    PatientMoneyCalculator / TreatmentPlan). Sau khi đổi sang che hết khi không
    có quyền: `OrgChartTests` + `SlipSeenThroughLinesTests` **41/41**.
- E2E thật `e2e/plan-treating-scope.spec.ts` (18 test; 2026-10-21 18/18 xanh
  trên bản build production):
  - Dữ liệu:
    - 6 tài khoản đăng nhập qua màn login: head / member / clerk (Team A), chief
      / outsider (Team B), accountant. Head có Chi phí, chief thì không.
    - Role tuỳ chỉnh: base, base + Chi phí, cùng quyền thao tác (phiếu thu, xoá
      dòng, xoá phiếu) để so member với chief.
    - Bệnh nhân 1: 4 phiếu, 1 phiếu thu 100.000 trên phiếu của head, 1 tạm ứng
      50.000.
    - Bệnh nhân 2 (bug 40): 3 phiếu, mỗi phiếu 2 dòng (răng 16, răng 26):
      - X: chief tiếp nhận; dòng 2 do member điều trị; dòng 1 đã trả 30.000.
      - Y: outsider tiếp nhận; dòng 2 do head tư vấn, member chỉ chẩn đoán; dòng
        2 đã trả 100.000.
      - Z: outsider tiếp nhận, Bác sĩ tư vấn của phiếu là member; dòng 1 không
        ghi tư vấn (lấy của phiếu), dòng 2 ghi outsider.
  - 6 ca phạm vi trên bệnh nhân 1. Mỗi ca kiểm:
    - tab KHĐT (thứ tự: phiếu của head lên đầu);
    - API `treatingScope`, và danh sách không cờ vẫn đủ;
    - `summary` của account;
    - 3 thẻ "Tổng dự kiến thu" / "Đã thu" / "Tạm ứng" trên tab Hồ sơ;
    - tải lại trang.
  - 6 ca bug 40 trên bệnh nhân 2:

    | Tài khoản | Chi phí | Thấy | Tiền dòng được giao | Đã thu |
    |---|---|---|---|---|
    | member | không | X (dòng 2), Z (dòng 1), theo dòng; không thấy Y (chỉ chẩn đoán) | che (phiếu `moneyHidden`) | 0 |
    | head | có | X (dòng 2), Y (dòng 2), Z (dòng 1), theo dòng | hiện | 100.000 |
    | chief | không | X cả phiếu | (cả phiếu) | 30.000 |
    | outsider | không | Y, Z cả phiếu | (cả phiếu) | 100.000 |
    | clerk | không | không phiếu nào | — | 0 |
    | accountant | có | X, Y, Z cả phiếu | (cả phiếu) | 130.000 |

    Mỗi ca kiểm:
    - qua API: `seenThroughLines` + `moneyHidden` của phiếu; dòng nào
      `assignedToViewer` (phiếu thấy cả thì không dòng nào); `moneyHidden`,
      thành tiền và đã trả của từng dòng (dòng bị che = 0); `payment` của từng
      phiếu (chỉ cộng dòng được hiện tiền); `summary`;
    - thẻ Hồ sơ;
    - mã phiếu trên tab KHĐT;
    - tải lại.
  - Giao diện bug 40 trên phiếu X: member (theo dòng, không có Chi phí), head
    (theo dòng, có Chi phí, không có quyền thao tác xoá), chief (tiếp nhận, cả
    phiếu). Member và chief cùng quyền thao tác.

    | Chỗ kiểm | member | head | chief |
    |---|---|---|---|
    | Dòng KHĐT: số ô tiền che | 7 (mọi cột tiền) | 0 | 0 |
    | Dòng KHĐT: "Phiếu thu", "Xoá phiếu điều trị" | không có | không có | có |
    | Nút mắt, 2 dòng: số ô che | 4 | 2 | 0 |
    | Trang phiếu mở với `planTab=payment-v2` | chỉ tab "Chi tiết điều trị", không dải số tiền | như member | 4 tab, có dải số tiền |
    | Toolbar: "Thêm dịch vụ phát sinh", "In Hóa Đơn", in phiếu | không có | không có | có |
    | Dòng răng 16 (người khác điều trị): số ô che | 3 | 3 | 0 |
    | Dòng răng 16: đổi trạng thái, xoá | không có | không có | có |
    | Dòng răng 26 (của member): số ô che | 3 | 0 | 0 |
    | Dòng răng 26: đổi trạng thái / xoá / bút chì | có / có / **không** | có / không (không quyền) / có | có / có / có |
    | Dòng răng 26: menu đổi trạng thái | Hoàn thành, Hủy dịch vụ | Hoàn thành, Chuyển đổi, Hủy dịch vụ | như head |
    | "Chi tiết dịch vụ" dòng 16 / dòng 26 | 3 ô che / 3 ô che | 3 ô che / 0 | thấy 30.000 / 0 |

    Sau khi tải lại, số ô che trên hai dòng giữ nguyên.
  - Admin thấy mọi phiếu và toàn bộ tiền.
  - Link phiếu ngoài phạm vi trả 403 / 0052 trên `detail`, `payment-v2`, `debt`.
    Có 2 ca bug 40: member mở Y (chỉ chẩn đoán), clerk mở X.
  - /patient che tiền: kiểm API, màn hình và file Excel (member thì che,
    accountant thì không).
  - Phân quyền:
    - qua API: cây quyền, `finance-accounting` cuối cùng, sau `helpSupport`;
      `patient` không còn `payment.*`;
    - qua UI: nhãn nhóm, lá "Chi phí › Xem" đã tick.
  - Bút chì "Chỉnh sửa dịch vụ" (từ R-961, giữ nguyên).

## Còn treo / cần BA xác nhận

Bug 40, **cần chủ dự án / BA trả lời**:

- **Phiếu mình tiếp nhận, không có quyền Chi phí**: BA chỉ nói "dc assign mà ko
  có quyền xem thì masking lại hết" cho phiếu thấy theo dòng. Phiếu mình là Bác
  sĩ tiếp nhận vẫn hiện đủ tiền theo P2010 ("không có quyền: chỉ xem chi phí
  của khách hàng mà mình là bác sĩ tiếp nhận"). Chưa che, chờ xác nhận.
- **Dòng của mình bị che tiền**: bỏ bút chì "Chỉnh sửa" và "Chuyển đổi" (xem
  "Phiếu thấy theo dòng"). Giữ "Hoàn thành", "Hủy dịch vụ", "Xóa". Server
  chưa chặn sửa / chuyển đổi trên dòng bị che; FE chỉ ẩn nút.

Bug 40, mặc định đã chọn (owner đồng ý 2026-10-21, chờ BA xác nhận):

- **Bác sĩ chẩn đoán** không tính là "được giao". BA chỉ nêu bác sĩ điều trị /
  bác sĩ tư vấn.
- Trưởng nhóm có quyền Chi phí tính cả dòng giao cho thành viên trong nhóm (theo
  phạm vi P2010). Thành viên chỉ tính dòng của mình.
- Phiếu thấy theo dòng ẩn: tab Thanh toán / Hoàn tiền / Dư nợ, dải số tiền,
  "Thêm dịch vụ phát sinh", "In Hóa Đơn", in phiếu, "Phiếu thu", "Xoá phiếu".
  **Giữ** nút Đơn thuốc và "In bệnh án" trên dòng KHĐT.
- Trưởng nhóm có quyền Chi phí vẫn thấy cả phiếu do thành viên tiếp nhận (P2010).
  Bug 40 chỉ đổi phiếu của nhóm khác.

Bug 40, chỗ chưa thu hẹp:

- Dialog "Chi tiết dịch vụ" ở tab Hồ sơ (dòng "Tạo tái khám" → "Chi Tiết",
  `patient-management/.../stage/ServiceDetailDialog.tsx`) vẫn hiện đủ Thành tiền,
  Giảm giá, Đã thanh toán của mọi dòng, mọi phiếu. Nó đọc danh sách không có cờ
  `treatingScope`. Lỗ này có từ trước P2010. Bảng điều trị ở Hồ sơ không có cột
  tiền nên không lộ.
- Danh sách phiếu thu ở Hồ sơ và `PatientAccountDto.Plans` không thu hẹp. Chúng
  theo quyền Thanh toán, như trước.
- `GetAsync` (lấy phiếu theo id) và phản hồi của các thao tác trên dòng không
  thu hẹp.
- Server chưa chặn thao tác trên dòng của người khác ở phiếu thấy theo dòng; FE
  chỉ ẩn nút. Người có `treatmentConsultation.update` gọi API trực tiếp vẫn làm
  được.
- Tiền trên thẻ phiếu tư vấn (`PatientAdviseCard`) không đổi.
- Có từ trước: "Xoá" còn hiện trên dòng đã trả tiền nếu dòng vẫn ở trạng thái
  Đã tạo (`isLineDeletable` chỉ xét trạng thái).

Từ P2010:

- Cột tiền ở CSKH, Hồ sơ nhóm và báo cáo chưa che. BA chỉ nêu /patient.
- Có hai mục cùng tên "Chi phí": "Báo cáo › Quản lý thu chi › Chi phí" (của
  báo cáo, có từ trước) và "Tài chính / Kế toán › Chi phí" (P2010).
- Staging / production cần chạy DbMigrator (seed quyền mới cho role tĩnh) và
  xoá cache quyền trong Redis. Role tuỳ chỉnh (dentist, Kế toán, Tiếp nhận…) phải
  được cấp tay "Chi phí › Xem" thì mới thấy lại tiền và phạm vi cây con.
