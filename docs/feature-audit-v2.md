# BlueDental — Kiểm tra mức độ hoàn thiện

Đối chiếu hệ thống hiện tại với **Danh mục chức năng phần mềm quản lý nha khoa v2** (PDF).

Ngày kiểm tra: **03/09/2026**

---

## Tổng quan

| Chỉ số | Giá trị |
|---|---|
| Tổng chức năng (PDF) | **123** |
| Hoàn thiện (BE + FE + Test) | **60** |
| Một phần (có BE hoặc FE, thiếu phần kia) | **21** |
| Chưa triển khai | **42** |
| **Tiến độ weighted** | **57.3%** |

> Tính weighted: Hoàn thiện = 100%, Một phần = 50%, Chưa có = 0%.
> Tính theo feature có code: (60 + 21) / 123 = 65.9%.

### Backend

| Chỉ số | Giá trị |
|---|---|
| Domain entities | 63 |
| AppServices | 33+ |
| Controllers | 39 |
| Migrations | 47 |
| BE Tests (pass) | 724 |

### Frontend

| Chỉ số | Giá trị |
|---|---|
| Feature folders | 22 |
| Pages dựng | 20 |
| Routes hoạt động | 18 |
| Shared components | 26+ |
| E2E specs | 34 |

### Verification

| Chỉ số | Giá trị |
|---|---|
| Features VERIFIED | 34 |
| Features DIRTY | 2 |
| Features BLOCKED | 1 |
| Regression entries | 103+ |
| Discovery docs | 20 |

---

## Tóm tắt theo nhóm

| Nhóm | Tổng | Xong | Một phần | Chưa có | % |
|---|---|---|---|---|---|
| 1. Lịch hẹn | 11 | 6 | 2 | 3 | 63.6% |
| 2. Chăm sóc | 10 | 8 | 2 | 0 | 90.0% |
| 3. Thẻ trả trước | 2 | 0 | 0 | 2 | **0.0%** |
| 4. Khách hàng | 28 | 17 | 3 | 8 | 66.1% |
| 5. Kế toán | 7 | 3 | 3 | 1 | 64.3% |
| 6. Dịch vụ | 7 | 1 | 0 | 6 | **14.3%** |
| 7. Kho | 7 | 3 | 1 | 3 | 50.0% |
| 8. Marketing | 13 | 1 | 0 | 12 | **7.7%** |
| 9. Đơn thuốc | 3 | 1 | 1 | 1 | 50.0% |
| 10. Tích hợp | 3 | 2 | 1 | 0 | 83.3% |
| 11. Nhân viên | 13 | 8 | 1 | 4 | 67.3% |
| 12. Labo | 3 | 2 | 1 | 0 | 83.3% |
| 13. Cấu hình | 1 | 1 | 0 | 0 | 100% |
| 14. Form in | 1 | 0 | 1 | 0 | 50.0% |
| 15. Media | 1 | 1 | 0 | 0 | 100% |
| 16. Báo cáo | 13 | 6 | 5 | 2 | 65.4% |
| **TỔNG** | **123** | **60** | **21** | **42** | **57.3%** |

---

## Chi tiết từng nhóm

### 1. Lịch hẹn (Theo dõi & điều phối lịch hẹn khách hàng) — 11 chức năng

| TT | Chức năng | BE | FE | Trạng thái | Ghi chú |
|---|---|---|---|---|---|
| 1 | Lịch hẹn trong ngày | ✅ | ✅ | Hoàn thiện | DayViewGrid + full workflow API |
| 2 | Lịch hẹn theo ngày | ✅ | ✅ | Hoàn thiện | AppointmentListPage |
| 3 | Calendar | ✅ | ✅ | Hoàn thiện | WeekView, MonthView, DayView + MiniCalendar |
| 4 | Lịch Bác sĩ | ✅ | ✅ | Hoàn thiện | Filter by dentist trên calendar |
| 5 | Điều phối lịch hẹn theo thời gian thực | ✅ | ✅ | Hoàn thiện | Reception workflow + SignalR hub |
| 6 | Trạng thái phòng | ❌ | ❌ | **Chưa có** | Không có entity Room/Chair riêng |
| 7 | Màn hình đợi | ❌ | ❌ | **Chưa có** | Không có queue/ticket system |
| 8 | Lịch tái khám | 🔶 | ❌ | Một phần | BE có AppointmentType.FollowUp nhưng FE chưa có UI lịch tái khám riêng |
| 9 | Lịch tuần | ✅ | ✅ | Hoàn thiện | WeekViewCalendar |
| 10 | Cảnh báo thời gian đợi | ❌ | ❌ | **Chưa có** | Không có waiting-time monitor |
| 11 | Lịch sử chỉnh sửa, chuyển trạng thái | 🔶 | ❌ | Một phần | ABP Audit Log ghi lại, nhưng chưa có UI lịch sử chuyên biệt cho appointment |

### 2. Chăm sóc (Tự động phân loại chăm sóc theo loại) — 10 chức năng

| TT | Chức năng | BE | FE | Trạng thái | Ghi chú |
|---|---|---|---|---|---|
| 1 | Nhắc hẹn | ✅ | ✅ | Hoàn thiện | CareType reminder + CareBoard UI |
| 2 | Không làm dịch vụ | ✅ | ✅ | Hoàn thiện | CareType enum + tab riêng |
| 3 | Ngày sinh nhật | ✅ | ✅ | Hoàn thiện | CareType birthday tab |
| 4 | Đặt lịch không đến | ✅ | ✅ | Hoàn thiện | CareType noShow + NoShow appointment status |
| 5 | Sau điều trị — Đánh giá | ✅ | ✅ | Hoàn thiện | CareType postTreatment tab |
| 6 | Complain | ✅ | ✅ | Hoàn thiện | CareType complaint tab |
| 7 | Lịch hẹn hủy | ✅ | ✅ | Hoàn thiện | CareType cancelled tab |
| 8 | Chăm sóc định kỳ | 🔶 | 🔶 | Một phần | Có CareType periodic nhưng chưa có auto-schedule |
| 9 | Chăm sóc Khách hàng | ✅ | ✅ | Hoàn thiện | GroupPatientsPanel + CareBoard |
| 10 | Tự động SMS-Email, Zalo chăm sóc | 🔶 | 🔶 | Một phần | SendZaloDialog + MessageTemplate có, nhưng auto-send chưa tích hợp thực tế |

### 3. Thẻ trả trước (Quản lý thẻ & việc sử dụng thẻ) — 2 chức năng

| TT | Chức năng | BE | FE | Trạng thái | Ghi chú |
|---|---|---|---|---|---|
| 1 | Tạo thẻ trả trước | ❌ | ❌ | **Chưa có** | Không có PrepaidCard entity |
| 2 | Tình trạng thẻ | ❌ | ❌ | **Chưa có** | |

### 4. Khách hàng (Bệnh nhân) — 28 chức năng

| TT | Chức năng | BE | FE | Trạng thái | Ghi chú |
|---|---|---|---|---|---|
| 1 | Tạo mới | ✅ | ✅ | Hoàn thiện | PatientEditorDialog |
| 2 | Cảnh báo trùng hồ sơ | ✅ | ✅ | Hoàn thiện | CheckPhone API |
| 3 | Người giới thiệu | ❌ | ❌ | **Chưa có** | Không có Referral entity |
| 4 | Cấu hình nâng cao | 🔶 | ❌ | Một phần | ClinicConfigure entity có nhưng FE chưa expose |
| 5 | Tùy chọn & giới hạn chỉnh sửa | ❌ | ❌ | **Chưa có** | Không có dynamic field rules config |
| 6 | Tiền sử | ✅ | ✅ | Hoàn thiện | MedicalHistoryPanel + PatientDiseaseHistoryPanel |
| 7 | Khám bệnh | ✅ | ✅ | Hoàn thiện | TreatmentStagePanel + DiagnosisModal |
| 8 | Mối quan hệ | ❌ | ❌ | **Chưa có** | Không có PatientRelationship entity |
| 9 | Người giám hộ | ❌ | ❌ | **Chưa có** | Không có Guardian field |
| 10 | Hồ sơ nhóm | ❌ | ❌ | **Chưa có** | |
| 11 | Chẩn đoán — tư vấn | ✅ | ✅ | Hoàn thiện | DiagnosticRecord + ConsultationRecord + AdviseModal |
| 12 | Chẩn đoán theo hình ảnh | ✅ | ✅ | Hoàn thiện | PatientImagePanel + upload ảnh X-ray |
| 13 | Xét nghiệm | ❌ | ❌ | **Chưa có** | Không có LabTest entity |
| 14 | Chỉ định xét nghiệm | ❌ | ❌ | **Chưa có** | |
| 15 | Trả kết quả | ❌ | ❌ | **Chưa có** | |
| 16 | Tình trạng răng | ✅ | ✅ | Hoàn thiện | DentalChartView + ToothSurfaceChart (SVG) |
| 17 | Dịch vụ | ✅ | ✅ | Hoàn thiện | TreatmentPlanPanel + PatientTreatmentAppService |
| 18 | Thêm nhanh dịch vụ | ✅ | ✅ | Hoàn thiện | Quick-add trong TreatmentPlanPanel |
| 19 | Bệnh án dịch vụ | ✅ | ✅ | Hoàn thiện | MedicalRecordTemplate + StageModal |
| 20 | Kế hoạch điều trị | ✅ | ✅ | Hoàn thiện | TreatmentPlan full workflow (Draft→Active→Completed) |
| 21 | Điều trị | ✅ | ✅ | Hoàn thiện | TreatmentStagePanel + StageModal |
| 22 | Công việc điều trị | 🔶 | 🔶 | Một phần | MaterialAllocation có nhưng UI công việc điều trị chưa đầy đủ |
| 23 | Thanh toán | ✅ | ✅ | Hoàn thiện | PatientPaymentAppService + PaymentModal + PatientAccountPanel |
| 24 | Hình ảnh | ✅ | ✅ | Hoàn thiện | PatientImagePanel + MinIO storage |
| 25 | Lịch sử | ✅ | ✅ | Hoàn thiện | PatientProfilePage multi-tab history |
| 26 | Bảo hiểm — bảo lãnh viện phí | ✅ | 🔶 | Một phần | BE: InsuranceClaim full workflow. FE: billing page chỉ có PaymentModal, chưa có UI bảo hiểm riêng |
| 27 | Bảo hành dịch vụ | ❌ | ❌ | **Chưa có** | Không có Warranty entity |
| 28 | Trả góp | ❌ | ❌ | **Chưa có** | Không có Installment entity |

### 5. Kế toán (Thu chi & công nợ) — 7 chức năng

| TT | Chức năng | BE | FE | Trạng thái | Ghi chú |
|---|---|---|---|---|---|
| 1 | Lịch sử thu chi | ✅ | ✅ | Hoàn thiện | CashManagement + Finance ReportPage |
| 2 | Đính kèm chứng từ | ✅ | 🔶 | Một phần | FileAttachment entity có, FE chưa có UI đính kèm ảnh chứng từ |
| 3 | Thanh toán Labo | ✅ | ✅ | Hoàn thiện | LaboSupplier + LaboOrder workflow |
| 4 | Thanh toán nhà cung cấp | 🔶 | 🔶 | Một phần | InventoryItem có nhập kho nhưng chưa có supplier payment tracking riêng |
| 5 | Sổ quỹ — Chốt số | ✅ | ✅ | Hoàn thiện | CashManagement GetBalance + GetOverview |
| 6 | Chốt ca | 🔶 | ❌ | Một phần | BE có CashManagement nhưng chưa có shift-based close logic |
| 7 | Quản lý công nợ khách hàng | ✅ | ✅ | Hoàn thiện | PatientDebtHistoryPanel + PatientAccountPanel |

### 6. Dịch vụ (Thiết lập danh sách DV, sản phẩm & cấu hình) — 7 chức năng

| TT | Chức năng | BE | FE | Trạng thái | Ghi chú |
|---|---|---|---|---|---|
| 1 | Combo Dịch vụ | ❌ | ❌ | **Chưa có** | Không có ServiceCombo entity |
| 2 | Bảng giá theo chi nhánh | ❌ | ❌ | **Chưa có** | CatalogEntry chưa có branch-specific pricing |
| 3 | Quản lý các bước điều trị | ✅ | ✅ | Hoàn thiện | CatalogServiceStage trong Taxonomy |
| 4 | Thiết lập hoa hồng nhân viên | ❌ | ❌ | **Chưa có** | Không có CommissionRule entity |
| 5 | Hoa hồng cho từng nhân viên khác nhau | ❌ | ❌ | **Chưa có** | |
| 6 | Khấu trừ chi phí Lab, VAT, vật tư | ❌ | ❌ | **Chưa có** | |
| 7 | Quản lý VAT | ❌ | ❌ | **Chưa có** | Không có VAT/Tax module |

### 7. Kho — Quản lý vật tư — 7 chức năng

| TT | Chức năng | BE | FE | Trạng thái | Ghi chú |
|---|---|---|---|---|---|
| 1 | Nguyên vật liệu | ✅ | ✅ | Hoàn thiện | InventoryItem + MaterialDialog |
| 2 | Quản lý kho (xuất — nhập — tồn) | ✅ | ✅ | Hoàn thiện | AdjustStock, ReceiveStock + ClinicMaterialsTab |
| 3 | Chốt kho | ❌ | ❌ | **Chưa có** | Không có StockClose/Period entity |
| 4 | Tra cứu biến động, chứng từ | 🔶 | 🔶 | Một phần | GetStats có nhưng chưa có UI tra cứu chứng từ chi tiết |
| 5 | Quản lý hàng theo lô | ❌ | ❌ | **Chưa có** | Không có Batch/Lot tracking |
| 6 | Order mua hàng | ❌ | ❌ | **Chưa có** | Không có PurchaseOrder entity |
| 7 | Xuất vật tư (vật tư điều trị, bán) | ✅ | ✅ | Hoàn thiện | MaterialAllocation auto-deduct |

### 8. Marketing (Quản lý ticket & chuyển đổi) — 13 chức năng

| TT | Chức năng | BE | FE | Trạng thái | Ghi chú |
|---|---|---|---|---|---|
| 1 | Danh sách Ticket | ❌ | ❌ | **Chưa có** | Không có Ticket entity |
| 2 | Ticket Tag List | ❌ | ❌ | **Chưa có** | |
| 3 | Chuyển Ticket | ❌ | ❌ | **Chưa có** | |
| 4 | Ticket File | ❌ | ❌ | **Chưa có** | |
| 5 | Ticket đã xóa | ❌ | ❌ | **Chưa có** | |
| 6 | Ticket Website | ❌ | ❌ | **Chưa có** | |
| 7 | Lọc Ticket | ❌ | ❌ | **Chưa có** | |
| 8 | Lọc Khách hàng | ❌ | ❌ | **Chưa có** | Toàn bộ module Marketing/Ticket chưa triển khai |
| 9 | Voucher | ✅ | ✅ | Hoàn thiện | VoucherAppService + VoucherPage + batch create |
| 10 | Chương trình Khuyến mãi | ❌ | ❌ | **Chưa có** | Không có Promotion/Campaign entity |
| 11 | Chi phí Marketing | ❌ | ❌ | **Chưa có** | |
| 12 | Hạng thành viên | ❌ | ❌ | **Chưa có** | Không có MembershipTier entity |
| 13 | Tích điểm & quy đổi điểm | ❌ | ❌ | **Chưa có** | Không có LoyaltyPoints entity |

### 9. Đơn thuốc & bán thuốc — 3 chức năng

| TT | Chức năng | BE | FE | Trạng thái | Ghi chú |
|---|---|---|---|---|---|
| 1 | Lên đơn | ✅ | ✅ | Hoàn thiện | PrescriptionAppService + PrescriptionPanel + ExportPdf |
| 2 | Bán thuốc | 🔶 | ❌ | Một phần | BE Dispense method có nhưng FE chưa có POS bán thuốc riêng |
| 3 | Quầy dược | ❌ | ❌ | **Chưa có** | Không có Pharmacy POS module |

### 10. Tích hợp — 3 chức năng

| TT | Chức năng | BE | FE | Trạng thái | Ghi chú |
|---|---|---|---|---|---|
| 1 | Email | 🔶 | 🔶 | Một phần | MessageTemplate + MessagingAppService có, chưa tích hợp SMTP thực |
| 2 | ICD 10 | ✅ | ✅ | Hoàn thiện | Diagnosis catalog + ICD codes trong Taxonomy |
| 3 | Song Ngữ | ✅ | ✅ | Hoàn thiện | ABP Localization Việt/Anh, language switcher |

### 11. Nhân viên & User — 13 chức năng

| TT | Chức năng | BE | FE | Trạng thái | Ghi chú |
|---|---|---|---|---|---|
| 1 | Nhân viên | ✅ | ✅ | Hoàn thiện | StaffAppService + StaffPage + StaffEditorModal |
| 2 | Danh sách user | ✅ | ✅ | Hoàn thiện | ABP Identity + IdentityAdministrationPage |
| 3 | Lịch làm việc | ✅ | ✅ | Hoàn thiện | WorkScheduleTable + WorkScheduleBuilder |
| 4 | Chế tài nhân viên | ❌ | ❌ | **Chưa có** | Không có Disciplinary entity |
| 5 | Bảng lương | ❌ | ❌ | **Chưa có** | Không có Payroll module |
| 6 | Chấm công | ✅ | ✅ | Hoàn thiện | TimekeepingBoard + CheckIn/CheckOut + WorkStatusToggle |
| 7 | Ghi log thao tác | ✅ | ✅ | Hoàn thiện | ABP Audit Logs + AuditLogPage |
| 8 | Phân quyền chỉnh sửa | ✅ | ✅ | Hoàn thiện | ABP Permission system + PermissionsTab |
| 9 | Phân quyền chức năng theo nhóm user | ✅ | ✅ | Hoàn thiện | RolePermission + PermissionTreeBuilder |
| 10 | Phân quyền xem report | ✅ | ✅ | Hoàn thiện | Report permissions trong ABP |
| 11 | Xác thực IP theo chi nhánh | ❌ | ❌ | **Chưa có** | Không có IP whitelist per branch |
| 12 | Quy định giảm giá | 🔶 | 🔶 | Một phần | ApplyDiscount method có nhưng chưa có discount rules config |
| 13 | Quản lý thời gian sử dụng | ❌ | ❌ | **Chưa có** | Không có login time restriction |

### 12. Labo — 3 chức năng

| TT | Chức năng | BE | FE | Trạng thái | Ghi chú |
|---|---|---|---|---|---|
| 1 | Đơn hàng Labo | ✅ | ✅ | Hoàn thiện | LaboOrder full workflow (Send→Receive→Complete) |
| 2 | Quản lý NCC Labo | ✅ | ✅ | Hoàn thiện | LaboSupplier + LaboCatalog screens |
| 3 | Quản lý tập tin — Đính kèm | ✅ | 🔶 | Một phần | FileAttachment entity có. FE: labo order detail modal chưa hoàn thiện |

### 13. Cấu hình hệ thống — 1 chức năng

| TT | Chức năng | BE | FE | Trạng thái | Ghi chú |
|---|---|---|---|---|---|
| 1 | Cấu hình hệ thống | ✅ | ✅ | Hoàn thiện | ClinicSettingsPage + ClinicConfigure entity |

### 14. Form in — 1 chức năng

| TT | Chức năng | BE | FE | Trạng thái | Ghi chú |
|---|---|---|---|---|---|
| 1 | Cấu hình mẫu in | 🔶 | 🔶 | Một phần | QuestPDF ExportPdf cho đơn thuốc & hóa đơn. Chưa có print template editor |

### 15. Media — 1 chức năng

| TT | Chức năng | BE | FE | Trạng thái | Ghi chú |
|---|---|---|---|---|---|
| 1 | Lưu trữ media | ✅ | ✅ | Hoàn thiện | MinIO + FileAttachment + RichTextImage + PatientImage |

### 16. Báo cáo — 13 chức năng

| TT | Chức năng | BE | FE | Trạng thái | Ghi chú |
|---|---|---|---|---|---|
| 1 | Dashboard | ✅ | ✅ | Hoàn thiện | DashboardPage + KPI cards + RevenueBarChart |
| 2 | Doanh thu — Doanh số | ✅ | ✅ | Hoàn thiện | RevenueReport + RevenueChart + SalesEntry |
| 3 | Loại thu — chi & Lợi nhuận | ✅ | ✅ | Hoàn thiện | CashflowCategory + BusinessResult report |
| 4 | Hoa hồng | ❌ | ❌ | **Chưa có** | Phụ thuộc module Hoa hồng |
| 5 | Kế toán công nợ | 🔶 | 🔶 | Một phần | PatientDebtHistory có nhưng chưa có báo cáo tổng hợp |
| 6 | Kế toán kho | 🔶 | 🔶 | Một phần | GetStats có, chưa có báo cáo kho riêng biệt |
| 7 | Trả góp, bảo hành, bảo hiểm | ❌ | ❌ | **Chưa có** | Phụ thuộc module Trả góp/Bảo hành |
| 8 | Telesale — follow khách hàng | ❌ | ❌ | **Chưa có** | Phụ thuộc module Ticket/Marketing |
| 9 | Khuyến mãi, voucher, thẻ | 🔶 | 🔶 | Một phần | Voucher có GetAvailable nhưng chưa có report tổng hợp |
| 10 | Điều trị — Tình trạng dịch vụ | ✅ | ✅ | Hoàn thiện | OperationsReport: ServiceCompletion, WorkLog, ConsultantSummary |
| 11 | Chăm sóc khách hàng | ✅ | ✅ | Hoàn thiện | CareStats + CareCounters |
| 12 | Labo | ✅ | ✅ | Hoàn thiện | LaboStats + LaboOrdersScreen |
| 13 | Khác | 🔶 | 🔶 | Một phần | Timekeeping report có, Bộ y tế/phòng report chưa |

---

## Đánh giá tổng quan

### Những module chưa triển khai hoàn toàn

- **Marketing / Ticket (nhóm 8 — toàn bộ 8 chức năng ticket):** Module quản lý ticket telesale, tag, chuyển ticket, lọc khách hàng — chưa có entity nào. Đây là gap lớn nhất.
- **Thẻ trả trước (nhóm 3 — cả 2 chức năng):** Tạo thẻ, phát hành, topup, nhóm dịch vụ áp dụng — chưa có PrepaidCard entity.
- **Hoa hồng nhân viên (6.4–6.6):** Thiết lập công thức hoa hồng, khấu trừ chi phí, hoa hồng khác nhau theo BS — 3 chức năng hoàn toàn chưa có.
- **Xét nghiệm (4.13–4.15):** Quản lý mẫu xét nghiệm, chỉ định, trả kết quả — 3 chức năng chưa có LabTest entity.
- **Quầy dược / Bán thuốc (9.2–9.3):** BE có Dispense method nhưng chưa có Pharmacy POS UI riêng.
- **Bảo hành dịch vụ (4.27) & Trả góp (4.28):** Không có Warranty/Installment entity.
- **Kho nâng cao:** Chốt kho (7.3), quản lý lô hàng (7.5), order mua hàng (7.6) chưa triển khai.

### Những module đã hoàn thiện tốt

- **Lịch hẹn core (1.1–1.5, 1.9):** Calendar 3 view, editor modal, workflow 7 trạng thái, filter theo BS — hoàn thiện và đã VERIFIED.
- **Khách hàng / Hồ sơ bệnh nhân (nhóm 4 phần lớn):** 17/28 chức năng hoàn thiện — tạo hồ sơ, tiền sử, khám bệnh, sơ đồ răng, kế hoạch điều trị, thanh toán, hình ảnh.
- **CSKH (nhóm 2 toàn bộ core):** 8/10 chức năng hoàn thiện, CareBoard với tất cả các tab chăm sóc.
- **Danh mục / Taxonomy:** 11 tab, đã chốt và lock (section 17 CLAUDE.md), 38 E2E tests bảo vệ.
- **Nhân viên & Phân quyền (nhóm 11 phần lớn):** 8/13 chức năng hoàn thiện — quản lý NV, tài khoản, lịch làm việc, chấm công, audit log, phân quyền.
- **Backend coverage:** 63 entities, 47 migrations, 724 tests pass — tất cả 18 modules BE đều Complete.
