# F-59 — Báo cáo Telesale (16.8) & Chăm sóc khách hàng (16.11)

Status: `VERIFIED` · Verified commit: chưa commit · See `01-feature-verification-registry.md`

## Scope

BlueDental-local: hai tab mới trên `/report`, không có bản gốc tương ứng.
Thiết kế và định nghĩa số liệu: `docs/clone/pages/report.md`, mục
"Tab Telesale & CSKH".

## Evidence (2026-10-08)

| Kiểm tra | Kết quả |
|---|---|
| Backend API (thật, qua trình duyệt đăng nhập màn login) | `e2e/report-customer.spec.ts` — 5 ca API xanh |
| Frontend trình duyệt thật (bản build `vite preview`) | 2 ca UI xanh: tab Telesale, tab CSKH (đổi tab bảng) |
| Lưu DB | Ticket tạo mới làm Tổng / Mới / kênh Nhập tay / cột hôm nay tăng đúng 1; chuyển Không tiềm năng → Mới −1, Không tiềm năng +1; xoá ticket → về số cũ |
| Khớp board CSKH | Tổng từng loại = `totalCount` của `/care-records?type=…` cùng kỳ, cùng chi nhánh |
| Phân quyền | Bác sĩ không có quyền báo cáo → 403 cả 4 endpoint |
| Cách ly chi nhánh | User chi nhánh 2: 200 chi nhánh mình, 403 chi nhánh 1; ticket chi nhánh 1 không làm đổi số chi nhánh 2 |
| Excel | Cả hai file 200, `spreadsheetml`, > 1 KB |
| Hồi quy | `e2e/cskh*` + `patient-care` + report 28/28; `BlueDentalAbilitiesTests` 26/26 |
| Mức retest | 3 (`CareRecordWindow` dùng chung với board CSKH) |

## Ghi chú

- Sau khi thêm quyền và chạy DbMigrator phải xoá cache quyền trong Redis
  (R-827), nếu không admin vẫn 403.
- Giới hạn kỳ > 62 ngày: xem report.md.
