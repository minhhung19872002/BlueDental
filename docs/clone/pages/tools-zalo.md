# Công cụ ▸ Zalo OA

Route: `/tools/zalo-oa`

## Sub-tabs

| Sub-tab | URL param | Content |
|---|---|---|
| Cấu hình | (default, no param) | Zalo OA connection panel |
| Mẫu ZBS | `?subTab=template` | ZNS template list from Zalo |
| Danh sách tin Zalo | `?subTab=campaign` | Sent message list with stats |

## Cấu hình (config)

### Not connected

- Avatar circle "OA" (80px, `bd-zalo-avatar`)
- Title "Chưa kết nối Zalo OA"
- Tag "Chưa kích hoạt" (default color)
- Last error (if any, red text)
- Primary button "Kết nối Zalo OA" (disabled when AppId not configured)
- Secondary button "Nhập token đã cấu hình" (visible when bootstrap tokens exist)
- Hint "Chưa cấu hình App ID / Secret Key..." when canConnect=false

### Connected

- Avatar: OA image or fallback "OA"
- OA name as title
- Status tag: Đang hoạt động (green) / Lỗi làm mới token (red) / Token đã hết hạn (orange)
- Facts grid: OA ID, Gói dịch vụ, Kết nối lúc, Token hết hạn
- Toggle: Kích hoạt gửi ZNS (Switch)
- Buttons: Làm mới token, Ngắt kết nối (danger, with confirm dialog)

## Mẫu ZBS (templates)

Hint: "Danh sách mẫu ZBS được lấy trực tiếp từ Zalo — tạo, chỉnh sửa mẫu trên Zalo Business Manager."

Columns:
- Tên mẫu
- Zalo Template ID (width 180)
- Trạng thái: Tag with color (ENABLE=green, PENDING_REVIEW=gold, REJECT=red, DISABLE=default)
- Chất lượng (width 140)
- Ngày tạo (width 130, formatDate)

Pager: 5/10/20/25/50/100 (default 20)
Empty: "Chưa có mẫu ZBS nào"
Error: shows extractApiError

## Danh sách tin Zalo (campaign)

Toolbar:
- Status filter dropdown (Đang chờ / Đã gửi / Đã nhận / Thất bại)
- Counter buttons: Tổng số / Thành công / Thất bại (toggleable outcome filter)

Columns:
- Số điện thoại (width 140)
- Nội dung (ellipsis)
- Trạng thái: Tag with Tooltip on error (Pending=default, Sent=green, Delivered=blue, Failed=red)
- Chi phí (width 110, right-aligned, formatVND)
- Ngày gửi (width 160, formatDateTime of sentAt or creationTime)

Pager: 5/10/20/25/50/100 (default 20)
Empty: "Chưa có tin nhắn"

## CSKH ▸ Gửi ZBS dialog

The "Gửi ZBS qua Zalo" dialog in the CSKH tabs (nhắc lịch, sinh nhật) sends a ZNS
message. It posts `{ careRecordId, templateId }` to `POST /zalo/messages`; the server
fills template params from the patient and the record.

Fields:
- Khách hàng (read-only)
- Mẫu ZBS (SearchSelect, loads templates with DISABLE filtered out, client-side name search)

## API endpoints

See `docs/clone/api.md` for the full list.
