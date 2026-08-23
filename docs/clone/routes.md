# Routes — Reference Application

Source: https://app.nfcdental.com
Observed: 2026-08-21 / 2026-08-22
All routes require `?branchId=<24-char-hex>` query parameter.

## Route Map

### Primary Navigation (Sidebar)

| Route | Label (VI) | Default Sub-Route | Screenshot |
|-------|-----------|------------------|------------|
| /reception | Tiếp nhận | (same) | reception-01.png |
| /patient | Danh sách bệnh nhân | (same) | patient-list.png |
| /calendar | Lịch hẹn | (same) | calendar-main.png |
| /cskh-grouping | CSKH - Phân nhóm | (same) | cskh-grouping.png |
| /labo | Labo | /labo/mau-labo | labo-main.png |
| /operations | Quản trị vận hành | /operations/overview?overviewSubTab=home | operations-main.png |
| /report | Báo cáo | + ?report_dateMode=day&report_date=YYYY-MM-DD | report-main.png |
| /staff | Nhân viên | (same) | staff-main.png |
| /materials | Vật tư | /materials/clinic | materials-main.png |
| /taxonomy | Danh mục | /taxonomy/service | taxonomy-main.png |
| /tools | Công cụ | /tools/call | tools-main.png |

External link:
| https://nfcdental.com/ | Hướng dẫn & hỗ trợ | External |

### Patient

| Route | Description |
|-------|-------------|
| /patient | Patient list |
| /patient/:patientId | Patient detail |
| /patient/:patientId?tab=consulting | Tab: Chẩn đoán & Tư vấn |
| /patient/:patientId?tab=treatment-plan | Tab: Kế hoạch điều trị |
| /patient/:patientId?tab=appointment | Tab: Lịch hẹn |
| /patient/:patientId?tab=image | Tab: Hình ảnh |
| /patient/:patientId?tab=labo | Tab: Labo |
| /patient/:patientId?tab=prescription | Tab: Đơn thuốc |
| /patient/:patientId?tab=care | Tab: Chăm sóc KH |
| /patient/:patientId?tab=invoice | Tab: Hóa đơn |
| /patient/:patientId?tab=debt | Tab: Lịch sử dư nợ |

### Labo Sub-Routes

| Route | Description |
|-------|-------------|
| /labo/mau-labo | Mẫu Labo (Labo samples) |
| /labo/supplier | Nhà cung cấp Labo |
| /labo/bite | Khớp cắn Labo |
| /labo/finish-line | Đường hoàn tất |
| /labo/nhip | Kiểu nhịp Labo |
| /labo/service-material | Dịch vụ - vật liệu |

### Operations Sub-Routes

| Route | Description |
|-------|-------------|
| /operations/overview | Quản trị vận hành (default) |
| /operations/assistant | Khối trợ lý |
| /operations/reception | Khối lễ tân |
| /operations/cskh | Khối CSKH |
| /operations/marketing | Khối Marketing |
| /operations/security | Khối bảo vệ |
| /operations/treatment | Khối điều trị |
| /operations/finance | Khối tài chính |

### Materials Sub-Routes

| Route | Description |
|-------|-------------|
| /materials/clinic | Vật tư phòng khám (default) |
| /materials/allocation | Phân bổ vật tư |
| /materials/department | Phòng ban |

### Taxonomy Sub-Routes

| Route | Description |
|-------|-------------|
| /taxonomy/service | Dịch vụ (services/procedures) |
| /taxonomy/diagnosis | Chẩn đoán |
| /taxonomy/medicine | Loại thuốc |
| /taxonomy/consulting | Dữ liệu tư vấn |
| /taxonomy/source | Nguồn đến |
| /taxonomy/history | Lịch sử bệnh |
| /taxonomy/prescription-template | Đơn thuốc mẫu |
| /taxonomy/medical-record-template | Bệnh án mẫu |
| /taxonomy/tags | Thẻ hồ sơ |
| /taxonomy/payment-method | Phương thức thanh toán |
| /taxonomy/occupation | Nghề nghiệp |

### Tools Sub-Routes

| Route | Description |
|-------|-------------|
| /tools/call | Gọi thoại (voice calls) |
| /tools/message | Tin nhắn (messages) |
| /tools/zalo-oa | Zalo OA |
| /tools/invoice | Hóa đơn (invoice tools) |

### Other Routes (not in sidebar)

| Route | Description |
|-------|-------------|
| /voucher | Vouchers — observed in network prefetch, NOT in sidebar |

## Routes BlueDental adds (not observed on the reference)

| Route | Screen | Where it comes from |
|-------|--------|---------------------|
| /billing | Thanh toán & hoá đơn | The Claude Design file `BlueDental.dc.html`, which gives invoices a clinic-wide screen. The reference keeps invoices only under `/patient/:id?tab=invoice`. |
| /settings | Cài đặt phòng khám | Same design file; reached from the account menu. |
| /dashboard | Tổng quan | BlueDental's own, kept for internal use. |

These are additions, not clone gaps. Nothing here was inferred from the
reference, and the reference's own screens are unchanged by them.


## URL Parameter Conventions

| Parameter | Required | Format | Example |
|-----------|----------|--------|---------|
| branchId | Yes (all routes) | 24-char hex MongoDB ObjectId | 6a7909122bbcbb000133e6bb |
| tab | Patient detail only | slug string | consulting, treatment-plan, appointment, image, labo, prescription, care, invoice, debt |
| report_dateMode | Report only | day \| week \| month \| year | day |
| report_date | Report only | YYYY-MM-DD | 2026-08-22 |
| overviewSubTab | Operations only | home \| (others unknown) | home |

## Technical Notes

- Framework: Next.js with React Server Components (RSC)
- API: Separate backend at https://api.nfcdental.com/api/v1/
- Route prefetch: All sidebar routes prefetched via `?_rsc=<token>` on page load
- Redirect pattern: Multi-section pages redirect to default sub-route on navigate
