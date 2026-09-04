# BlueDental — Backlog chức năng chưa hoàn thành

Sắp xếp theo thứ tự thực hiện: feature không phụ thuộc → feature có phụ thuộc.
Mỗi feature ghi rõ scope BE/FE cần làm để có thể bắt tay vào mà không cần hỏi thêm.

Ngày tạo: **03/09/2026**
Nguồn: Danh mục chức năng phần mềm quản lý nha khoa v2 (PDF)

---

## Ký hiệu

- **MỚI** — Chưa có code, làm từ đầu
- **BỔ SUNG** — Có một phần (BE hoặc FE), cần hoàn thiện phần còn lại

---

## Đợt 1 — Không phụ thuộc feature mới nào

Chỉ cần các module đã hoàn thiện (Catalogs, Patient, Staff, TreatmentManagement, Billing, Inventory, Labo).

### 1. [BỔ SUNG] Lịch tái khám (PDF 1.8)

**Hiện trạng:** BE có `AppointmentType.FollowUp`, FE chưa có UI riêng.

**BE:** Không cần thêm — đã có type.

**FE:**
- Thêm tab/view "Lịch tái khám" trong trang Calendar hoặc Patient profile
- Filter appointments theo `type = FollowUp`, group theo tháng
- Cho phép tạo lịch tái khám nhanh từ TreatmentStage (sau khi hoàn thành giai đoạn điều trị)
- Auto-fill thông tin bệnh nhân + bác sĩ + dịch vụ từ lần điều trị trước

---

### 2. [BỔ SUNG] Lịch sử chỉnh sửa lịch hẹn (PDF 1.11)

**Hiện trạng:** ABP Audit Log ghi lại mọi thay đổi, FE chưa có UI xem lịch sử appointment.

**BE:** Thêm endpoint `GET /api/appointments/{id}/history` — query ABP AuditLog theo entity type `Appointment` + entity id, trả về danh sách thay đổi (ai sửa, sửa gì, lúc nào).

**FE:**
- Thêm tab "Lịch sử" trong AppointmentDetailDrawer
- Table: Thời gian | Người sửa | Thay đổi (old → new) | Trạng thái

---

### 3. [BỔ SUNG] Chăm sóc định kỳ — auto-schedule (PDF 2.8)

**Hiện trạng:** CareType periodic có, nhưng chưa tự động tạo CareRecord theo chu kỳ.

**BE:**
- Thêm entity `CareScheduleRule` (PatientId, CareType, IntervalDays, StartDate, NextDueDate, IsActive)
- Background worker `CareScheduleWorker` — chạy hàng ngày, tạo CareRecord cho những rule đến hạn
- AppService: CRUD CareScheduleRule

**FE:**
- Dialog "Tạo lịch chăm sóc định kỳ" trong CareBoard — chọn bệnh nhân, loại, chu kỳ (1 tháng / 3 tháng / tùy chỉnh)
- Hiển thị badge "Định kỳ" trên CareRecord được auto-generate

---

### 4. [BỔ SUNG] Tự động gửi SMS/Email/Zalo (PDF 2.10)

**Hiện trạng:** SendZaloDialog + MessageTemplate có, chưa auto-send.

**BE:**
- Thêm `MessageQueue` entity (RecipientId, Channel, TemplateId, ScheduledAt, SentAt, Status, Error)
- Background worker `MessageSendWorker` — poll queue, gọi external API (SMS/Zalo/Email)
- Config: SMTP settings, Zalo OA token, SMS gateway API key trong ClinicConfigure

**FE:**
- Cấu hình kênh gửi trong Settings (SMTP host/port, Zalo token, SMS API key)
- Toggle "Tự động gửi" trên từng CareType
- Log tin nhắn đã gửi: MessageLogView đã có, kết nối với MessageQueue

---

### 5. [MỚI] Xét nghiệm (PDF 4.13–4.15) — 3 chức năng

**BE:**
- Entity `LabTestCatalog` (Name, Code, Unit, ReferenceRange, TaxonomyId, ClinicBranchId)
- Entity `LabTestOrder` (PatientId, DentistId, OrderDate, Status: Ordered/SampleCollected/Processing/Completed/Cancelled)
- Entity `LabTestResult` (LabTestOrderId, LabTestCatalogId, Value, Unit, IsAbnormal, Note, ResultDate)
- AppService: CRUD LabTestCatalog, CreateOrder, UpdateResult, GetPatientLabHistory
- Status workflow: Ordered → SampleCollected → Processing → Completed

**FE:**
- Tab "Xét nghiệm" trong Taxonomy — quản lý danh mục xét nghiệm
- Tab "Xét nghiệm" trong PatientProfilePage — danh sách đơn XN + kết quả
- Dialog "Chỉ định xét nghiệm" — multi-select từ catalog, chọn BS chỉ định
- Dialog "Trả kết quả" — nhập giá trị, đánh dấu bất thường, in phiếu (QuestPDF)

---

### 6. [MỚI] Bảo hành dịch vụ (PDF 4.27)

**Hiện trạng:** `CatalogServiceConfig` đã có field `WarrantyDays`.

**BE:**
- Entity `WarrantyClaim` (PatientId, TreatmentServiceId, ServiceName, WarrantyStartDate, WarrantyEndDate, ClaimDate, Status: Active/Claimed/Expired, ClaimNote, ResolvedDate, ResolutionNote)
- Logic: khi TreatmentService complete → auto-create WarrantyClaim nếu service có WarrantyDays > 0
- AppService: GetList (filter active/expired/claimed), Claim, Resolve

**FE:**
- Tab "Bảo hành" trong PatientProfilePage — list dịch vụ đang bảo hành + đã hết hạn
- Badge cảnh báo khi dịch vụ sắp hết bảo hành (< 30 ngày)
- Dialog "Yêu cầu bảo hành" — ghi nhận lý do, tạo lịch hẹn tái khám liên kết

---

### 7. [MỚI] Trả góp (PDF 4.28)

**BE:**
- Entity `InstallmentPlan` (PatientId, InvoiceId, TotalAmount, DownPayment, NumberOfTerms, IntervalDays, StartDate, Status: Active/Completed/Defaulted)
- Entity `InstallmentPayment` (InstallmentPlanId, TermNumber, DueDate, Amount, PaidDate, PaidAmount, Status: Pending/Paid/Overdue)
- AppService: Create (từ Invoice), GetList, RecordPayment, GetOverdueList
- Background worker: đánh dấu Overdue hàng ngày

**FE:**
- Tab "Trả góp" trong PatientProfilePage — list gói trả góp + tiến độ thanh toán
- Dialog "Tạo gói trả góp" từ PatientAccountPanel — chọn invoice, nhập số kỳ + tiền trước
- Bảng kỳ thanh toán: Kỳ | Ngày đến hạn | Số tiền | Trạng thái | Ngày trả
- Cảnh báo quá hạn trên Dashboard

---

### 8. [MỚI] Combo dịch vụ (PDF 6.1)

**BE:**
- Entity `ServiceCombo` (Name, Code, Description, ClinicBranchId, IsActive, TotalPrice, DiscountPercent)
- Entity `ServiceComboItem` (ServiceComboId, CatalogEntryId, Quantity, UnitPrice)
- AppService: CRUD ServiceCombo, GetAvailable (filter by branch)
- Khi lên dịch vụ cho bệnh nhân → option "Chọn combo" → auto-add tất cả items với giá combo

**FE:**
- Tab "Combo" trong Taxonomy (hoặc mục Dịch vụ riêng)
- Dialog tạo/sửa combo — multi-select services, set giá combo
- Nút "Thêm combo" trong TreatmentPlanPanel — popup chọn combo → add tất cả service items

---

### 9. [MỚI] Order mua hàng (PDF 7.6)

**BE:**
- Entity `PurchaseOrder` (SupplierId, OrderDate, ExpectedDeliveryDate, Status: Draft/Submitted/Approved/Received/Cancelled, TotalAmount, Note, ClinicBranchId, CreatedByStaffId)
- Entity `PurchaseOrderLine` (PurchaseOrderId, InventoryItemId, Quantity, UnitPrice)
- AppService: CRUD, Submit, Approve, Receive (auto AdjustStock khi nhận hàng), Cancel
- Workflow: Draft → Submitted → Approved → Received

**FE:**
- Tab "Đặt hàng" trong Materials page
- Table danh sách PO: Mã | NCC | Ngày | Tổng tiền | Trạng thái
- Dialog tạo PO — chọn NCC (từ LaboSupplier hoặc thêm mới), thêm items từ InventoryItem
- Nút "Nhận hàng" → auto cập nhật tồn kho

---

### 10. [BỔ SUNG] Bảo hiểm — UI frontend (PDF 4.26)

**Hiện trạng:** BE InsuranceClaim có full workflow (Submit→Approve→Reject→Settle). FE chỉ có PaymentModal.

**FE:**
- Tab "Bảo hiểm" trong PatientProfilePage — list yêu cầu bảo lãnh
- Dialog "Tạo yêu cầu bảo lãnh" — chọn InsurancePlan, nhập số tiền, đính kèm chứng từ
- Workflow buttons: Submit → Under Review → Approved/Rejected
- Khi Approved → auto cập nhật số tiền bảo hiểm chi trả vào PatientAccount

---

### 11. [BỔ SUNG] Đính kèm chứng từ thu chi (PDF 5.2)

**Hiện trạng:** FileAttachment entity có, FE chưa có UI.

**FE:**
- Thêm FileUploader vào CashflowEntryModal — upload ảnh chứng từ khi tạo phiếu thu/chi
- Hiển thị thumbnail ảnh đính kèm trong danh sách phiếu
- Click xem ảnh full-size trong lightbox

---

### 12. [BỔ SUNG] Thanh toán nhà cung cấp (PDF 5.4)

**Hiện trạng:** InventoryItem có nhập kho nhưng chưa track công nợ NCC riêng.

**BE:**
- Entity `SupplierPayment` (SupplierId, Amount, PaymentDate, Method, Note, PurchaseOrderId?)
- Thêm field `TotalDebt` computed trên Supplier (hoặc query từ PO chưa thanh toán)
- AppService: GetSupplierDebt, RecordPayment, GetPaymentHistory

**FE:**
- Tab "Công nợ NCC" trong Materials page
- Table: NCC | Tổng nợ | Đã trả | Còn lại
- Dialog "Ghi nhận thanh toán" — chọn NCC, nhập số tiền, phương thức

---

### 13. [BỔ SUNG] Chốt ca (PDF 5.6)

**BE:**
- Entity `ShiftClose` (ClinicBranchId, ShiftDate, ShiftType: Morning/Afternoon/FullDay, OpeningBalance, ClosingBalance, CashIn, CashOut, ClosedByStaffId, ClosedAt, Note)
- AppService: OpenShift, CloseShift (tính tự động CashIn/CashOut từ CashflowEntry trong ca), GetShiftHistory

**FE:**
- Nút "Chốt ca" trên Finance page hoặc toolbar
- Dialog chốt ca — hiển thị tổng thu/chi trong ca, số dư mở/đóng, người chốt
- Lịch sử chốt ca: table theo ngày

---

### 14. [BỔ SUNG] Tra cứu biến động kho (PDF 7.4)

**Hiện trạng:** GetStats có, FE chưa có UI chi tiết.

**FE:**
- Tab "Biến động" trong Materials page
- Filter: Nguyên vật liệu | Khoảng thời gian | Loại (nhập/xuất/điều chỉnh)
- Table: Ngày | Loại | Số lượng | Trước | Sau | Người thực hiện | Ghi chú
- Export Excel

---

### 15. [BỔ SUNG] Bán thuốc — POS UI (PDF 9.2)

**Hiện trạng:** BE Prescription.Dispense() có. FE chưa có POS.

**FE:**
- Tab "Bán thuốc" trong Prescription page hoặc mục riêng
- Chọn đơn thuốc → hiển thị danh sách thuốc + số lượng + giá
- Nút "Bán" → gọi Dispense → trừ kho tự động
- In hóa đơn bán thuốc (QuestPDF)

---

### 16. [BỔ SUNG] Labo — detail modal + đính kèm (PDF 12.3)

**Hiện trạng:** FE labo order detail modal chưa hoàn thiện.

**FE:**
- Hoàn thiện LaboOrderDetailModal — hiển thị full thông tin: NCC, loại labo, trạng thái, file đính kèm
- FileUploader cho đính kèm file theo đơn hàng
- Nút in phiếu labo

---

### 17. [BỔ SUNG] Cấu hình mẫu in (PDF 14.1)

**Hiện trạng:** QuestPDF có cho đơn thuốc + hóa đơn. Chưa có template editor.

**BE:**
- Entity `PrintTemplate` (Name, Type: Prescription/Invoice/LabResult/MedicalRecord, HtmlContent, IsDefault, ClinicBranchId)
- AppService: CRUD, GetByType, SetDefault

**FE:**
- Trang "Mẫu in" trong Settings
- List template theo loại
- Editor: rich text editor (RichTextField đã có) để chỉnh sửa template HTML
- Preview: render template với data mẫu
- Chọn template mặc định cho từng loại

---

### 18. [BỔ SUNG] Email tích hợp SMTP (PDF 10.1)

**Hiện trạng:** MessageTemplate + MessagingAppService có, chưa gửi thật.

**BE:**
- Thêm `IEmailSender` implementation dùng SMTP (MailKit)
- Config SMTP trong ClinicConfigure (Host, Port, Username, Password, FromEmail)
- Kết nối với MessageQueue (đợt 1 item 4)

**FE:**
- Form cấu hình SMTP trong Settings → tab "Email"
- Nút "Gửi test" để kiểm tra kết nối
- Ghi nhận trạng thái gửi trong MessageLog

---

### 19. [BỔ SUNG] Công việc điều trị chi tiết (PDF 4.22)

**Hiện trạng:** MaterialAllocation có nhưng UI chưa đầy đủ cho quy trình chuẩn bị điều trị.

**FE:**
- Thêm section "Công việc chuẩn bị" trong StageModal
- Checklist: vật tư cần chuẩn bị (auto từ MaterialAllocation), vô trùng, phòng/ghế
- Toggle hoàn thành từng bước
- Hiển thị trạng thái chuẩn bị trên TreatmentStagePanel

---

### 20. [BỔ SUNG] Quy định giảm giá (PDF 11.12)

**Hiện trạng:** ApplyDiscount method có, chưa có rules.

**BE:**
- Entity `DiscountRule` (RoleId, MaxDiscountPercent, MaxDiscountAmount, RequiresApproval, ApproverId, ClinicBranchId)
- Validate trong PatientAdviseAppService.ApplyVoucher / ApplyDiscount — kiểm tra user có quyền giảm theo rule

**FE:**
- Trang "Quy định giảm giá" trong Settings
- Table: Vai trò | % tối đa | Số tiền tối đa | Cần duyệt
- Dialog thêm/sửa rule

---

### 21. [BỔ SUNG] Cấu hình nâng cao khách hàng (PDF 4.4)

**Hiện trạng:** ClinicConfigure entity có, FE chưa expose.

**FE:**
- Thêm tab "Cấu hình khách hàng" trong Settings
- Toggle: auto checked-in khi chưa tư vấn → lên dịch vụ
- Toggle: cho phép trùng SĐT
- Cấu hình mã hồ sơ tự động (prefix, số chữ số)

---

### 22. [BỔ SUNG] Báo cáo tổng hợp bổ sung (PDF 16.5, 16.6, 16.9, 16.13)

**FE:**
- **Báo cáo công nợ tổng hợp (16.5):** Trang report mới — tổng hợp công nợ tất cả KH + NCC, filter theo khoảng thời gian
- **Báo cáo kế toán kho (16.6):** Trang report — tổng hợp xuất/nhập/tồn theo NVL, theo tháng
- **Báo cáo khuyến mãi/voucher (16.9):** Trang report — thống kê voucher phát hành/sử dụng/hết hạn
- **Báo cáo khác (16.13):** Bổ sung báo cáo Bộ y tế, sử dụng phòng

---

## Đợt 2 — Phụ thuộc feature mới từ Đợt 1

### 23. [MỚI] Hoa hồng nhân viên (PDF 6.4–6.6) — 3 chức năng

> Phụ thuộc: Staff + Catalogs + TreatmentManagement (đã có)

**BE:**
- Entity `CommissionRule` (StaffId?, RoleId?, CatalogEntryId?, CommissionType: Percent/FixedAmount, Value, DeductLabCost, DeductMaterialCost, DeductVAT, ClinicBranchId)
- Entity `CommissionRecord` (StaffId, TreatmentServiceId, PatientId, ServiceAmount, DeductionAmount, CommissionAmount, CalculatedAt, Status: Pending/Approved/Paid)
- Logic: khi TreatmentService complete → auto calculate commission theo rules
- AppService: CRUD CommissionRule, GetStaffCommissions, Approve, MarkPaid, GetReport

**FE:**
- Trang "Hoa hồng" trong menu hoặc sub-tab Staff
- Tab "Cấu hình" — table rules: DV | Vai trò/NV | Loại | Giá trị | Khấu trừ
- Tab "Chi tiết" — table commission records theo tháng: NV | DV | Doanh thu | Khấu trừ | Hoa hồng
- Nút duyệt + đánh dấu đã trả
- Export Excel

---

### 24. [MỚI] Bảng lương (PDF 11.5)

> Phụ thuộc: Timekeeping (đã có) + CommissionRule (item 23)

**BE:**
- Entity `PayrollPeriod` (Month, Year, ClinicBranchId, Status: Draft/Finalized, FinalizedAt, FinalizedByStaffId)
- Entity `PayrollEntry` (PayrollPeriodId, StaffId, BaseSalary, Allowance, OvertimePay, CommissionTotal, Deductions, NetSalary, Note)
- AppService: Generate (tính tự động từ Timekeeping + CommissionRecord), Adjust, Finalize, Export

**FE:**
- Trang "Bảng lương" trong menu Staff
- Filter: Tháng/Năm
- Table: NV | Lương cơ bản | Phụ cấp | Tăng ca | Hoa hồng | Khấu trừ | Thực nhận
- Nút "Tính lương" → auto generate
- Nút "Chốt lương" → finalize
- Export Excel

---

### 25. [MỚI] Thẻ trả trước (PDF 3.1–3.2) — 2 chức năng

> Phụ thuộc: Patient + Billing + CatalogEntry (đã có)

**BE:**
- Entity `PrepaidCard` (CardNumber, PatientId, FamilyGroupId?, Balance, TotalLoaded, Status: Active/Suspended/Expired, ExpiryDate, ClinicBranchId)
- Entity `PrepaidCardTransaction` (PrepaidCardId, Type: Topup/Deduction/Refund, Amount, BalanceBefore, BalanceAfter, ReferenceId?, Note, TransactedAt, StaffId)
- Entity `PrepaidCardServiceScope` (PrepaidCardId, CatalogEntryId) — DV nào được dùng thẻ
- AppService: Create, Topup, Deduct (khi thanh toán DV), GetBalance, GetTransactionHistory, Suspend, Reactivate

**FE:**
- Trang "Thẻ trả trước" trong menu (hoặc sub-tab Patient)
- Table: Mã thẻ | KH | Số dư | Trạng thái | Ngày hết hạn
- Dialog tạo thẻ — chọn KH, nhập giá trị, chọn DV áp dụng
- Dialog nạp tiền (Topup)
- Tab lịch sử giao dịch
- Tích hợp vào PaymentModal — option "Thanh toán bằng thẻ trả trước"

---

### 26. [MỚI] Marketing / Ticket (PDF 8.1–8.8) — 8 chức năng

> Phụ thuộc: Patient + Staff (đã có)

**BE:**
- Entity `Ticket` (Code, PatientId?, PatientName, PatientPhone, Source: Website/Facebook/Zalo/Phone/WalkIn, AssignedToStaffId, Status: New/Contacted/Converted/Closed/Deleted, Priority, Note, ClinicBranchId)
- Entity `TicketTag` (Name, Color, ClinicBranchId)
- Entity `TicketTagMapping` (TicketId, TicketTagId)
- Entity `TicketComment` (TicketId, StaffId, Content, CreatedAt)
- AppService: CRUD Ticket, Assign, ChangeStatus, BulkAssign, Import (Excel), GetByTag, GetDeleted, Restore, CRUD TicketTag

**FE:**
- Trang "Marketing" trong menu — sub-tabs: Ticket | Tag | File import | Đã xóa
- Table ticket: Mã | KH | SĐT | Nguồn | NV phụ trách | Tag | Trạng thái
- Filter: tag, nguồn, NV, trạng thái, khoảng thời gian
- Dialog tạo/sửa ticket
- Dialog chuyển ticket (bulk assign cho NV/nhóm)
- Import Excel: upload file → validate → preview → import
- Tab "Đã xóa" — soft delete + restore
- Kết nối với Ticket Website (API endpoint nhận ticket từ landing page)

---

### 27. [MỚI] Chương trình khuyến mãi (PDF 8.10)

> Phụ thuộc: Voucher (đã có) + CatalogEntry (đã có)

**BE:**
- Entity `PromotionCampaign` (Name, Description, StartDate, EndDate, DiscountType: Percent/FixedAmount, DiscountValue, ApplyTo: AllServices/SpecificServices, MaxUsage, CurrentUsage, Status: Draft/Active/Expired/Cancelled, ClinicBranchId)
- Entity `PromotionCampaignService` (CampaignId, CatalogEntryId)
- AppService: CRUD, Activate, Cancel, CheckEligibility, GetReport

**FE:**
- Tab "Khuyến mãi" trong trang Marketing hoặc Voucher
- Table: Tên | Thời gian | Giảm | Áp dụng | Đã dùng/Tối đa | Trạng thái
- Dialog tạo/sửa — multi-select DV, set giá trị giảm, thời hạn

---

## Đợt 3 — Tính năng nâng cao / ưu tiên thấp

### 28. [MỚI] Hạng thành viên (PDF 8.12)

**BE:** Entity `MembershipTier` + auto-upgrade logic theo tổng chi tiêu.

### 29. [MỚI] Tích điểm & quy đổi (PDF 8.13)

**BE:** Entity `LoyaltyPoint` + `PointTransaction` + quy đổi sang tiền.

### 30. [MỚI] Chi phí Marketing (PDF 8.11)

**BE:** Entity `MarketingExpense` — track chi phí theo campaign.

### 31. [MỚI] Trạng thái phòng (PDF 1.6)

**BE:** Entity `Room`/`Chair` + realtime status via SignalR.

### 32. [MỚI] Màn hình đợi (PDF 1.7)

**BE:** Entity `QueueTicket` + auto-numbering + TV display page.

### 33. [MỚI] Cảnh báo thời gian đợi (PDF 1.10)

**BE:** Background worker monitor waiting time + push notification.

### 34. [MỚI] Người giới thiệu (PDF 4.3)

**BE:** Entity `Referral` + hoa hồng giới thiệu (phụ thuộc CommissionRule).

### 35. [MỚI] Mối quan hệ / Người giám hộ / Hồ sơ nhóm (PDF 4.8–4.10)

**BE:** Entity `PatientRelationship` + Guardian field trên Patient.

### 36. [MỚI] Tùy chọn & giới hạn chỉnh sửa thông tin KH (PDF 4.5)

**BE:** Entity `FieldRule` — dynamic required/optional/hidden per field per role.

### 37. [MỚI] Bảng giá theo chi nhánh (PDF 6.2)

**BE:** Entity `BranchPrice` (CatalogEntryId, ClinicBranchId, Price, Currency).

### 38. [MỚI] Quản lý VAT (PDF 6.7)

**BE:** Entity `TaxConfig` + tính VAT trên Invoice.

### 39. [MỚI] Chốt kho (PDF 7.3)

**BE:** Entity `StockClosePeriod` + import số dư đầu kỳ.

### 40. [MỚI] Quản lý hàng theo lô (PDF 7.5)

**BE:** Entity `InventoryBatch` (ItemId, BatchNumber, ExpiryDate, Quantity).

### 41. [MỚI] Quầy dược (PDF 9.3)

**BE:** Full Pharmacy POS module — bán thuốc lẻ, không cần đơn.

### 42. [MỚI] Chế tài nhân viên (PDF 11.4)

**BE:** Entity `DisciplinaryAction` (StaffId, Type, Amount, Reason, Date).

### 43. [MỚI] Xác thực IP theo chi nhánh (PDF 11.11)

**BE:** Entity `BranchIpWhitelist` + middleware check.

### 44. [MỚI] Quản lý thời gian sử dụng (PDF 11.13)

**BE:** Config login time window per branch + middleware check.

### 45. [MỚI] Báo cáo hoa hồng (PDF 16.4)

> Phụ thuộc: CommissionRule (item 23)

### 46. [MỚI] Báo cáo trả góp/bảo hành/bảo hiểm (PDF 16.7)

> Phụ thuộc: Installment (item 7) + Warranty (item 6)

### 47. [MỚI] Báo cáo telesale/follow (PDF 16.8)

> Phụ thuộc: Ticket (item 26)

---

## Tổng kết

| Đợt | Số items | Mô tả |
|---|---|---|
| **Đợt 1** | 22 | Không phụ thuộc feature mới — làm ngay được |
| **Đợt 2** | 5 | Phụ thuộc 1–2 feature từ Đợt 1 |
| **Đợt 3** | 20 | Tính năng nâng cao, ưu tiên thấp |
| **Tổng** | **47** | Bao gồm 42 feature mới + 21 bổ sung (gộp thành 47 work items) |
