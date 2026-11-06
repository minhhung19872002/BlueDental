# F-89 — Chat nội bộ có đính kèm file (R-1157)

Trạng thái: `VERIFIED` 2026-11-06 trên develop (chưa commit). Rà bảo mật chi tiết: `chat-security-checklist.md`.

## Quyết định của owner (2026-11-06)

1. Chỉ chat trong một chi nhánh. Muốn mở rộng thì sửa `ChatParticipantPolicy`, chỗ duy nhất quyết định ai chat được với ai.
2. Ai cũng tạo được nhóm, không có nhóm tự động.
3. Chưa gắn hồ sơ bệnh nhân.
4. Giữ tin vĩnh viễn.
5. Tin thu hồi vẫn hiện "Tin nhắn đã được thu hồi".

Yêu cầu BA về bố cục:
- Nút chat nổi ở góc phải dưới, nút Mời lên nằm ngay bên trái nó.
- Panel mở bên phải và đẩy cả hai nút sang trái panel.
- Làm bằng CSS `body:has(.chat-dock)` trong `chat.css`.

## Mã hoá — đúng phạm vi

- **Đây là mã hoá khi lưu (at rest) + TLS khi truyền, KHÔNG phải mã hoá đầu-cuối (E2E).** Server giải mã để trả cho người có quyền. Ai nắm được cả DB lẫn `RECEIPT_VAULT_KEY` thì đọc được.
- Thuật toán:
  - AES-256-GCM, nonce ngẫu nhiên cho từng giá trị.
  - AAD là id của dòng, nên không thể chép ciphertext sang dòng khác.
  - Lưu dạng `v1:` + base64.
- Khoá: HKDF-SHA256 từ `RECEIPT_VAULT_KEY`, info `bluedental/chat/v1`. Khoá con này tách biệt với khoá dùng cho phiếu thu, nhưng cùng một khoá gốc.
  - Khoá không nằm trong git.
  - **Mất khoá là mất toàn bộ chat và chứng từ.**
- Những gì được mã hoá:
  - nội dung tin
  - tên file
  - file: blob `chat/{chi nhánh}/{cuộc trò chuyện}/{id}.enc` trong MinIO
- Những gì không mã hoá: tên nhóm, ai gửi cho ai, lúc nào, kích thước và loại file.
- Audit log không chứa nội dung hay tên file (`[DisableAuditing]`, có test canary).
- Hệ quả: không tìm được theo nội dung tin ở server.

## Giới hạn

| Mục | Giá trị |
|---|---|
| Độ dài tin | 4.000 ký tự |
| File / tin | 10 |
| Dung lượng file | 20 MB (nginx location chat 25 MB) |
| Thành viên nhóm | 100 |
| Danh bạ | 50 người, tìm trên server |
| Trang tin | 30 (tối đa 100), nút "Tải tin cũ hơn" |
| Đuôi file | jpg, jpeg, png, gif, webp, pdf, docx, xlsx, pptx, doc, xls, ppt, txt, csv. Kiểm magic bytes; txt/csv chỉ cần không có byte NUL |

## Quyền

- Không có permission riêng: ai đăng nhập cũng chat được trong chi nhánh của mình.
- Server kiểm tư cách thành viên ở mọi API. Không phải thành viên thì nhận 404, kể cả khi đổi header `X-Clinic-Branch-Id`.

## Triển khai

- Chạy DbMigrator để tạo migration `ChatR1157`.
- `RECEIPT_VAULT_KEY` đã có trên cả 2 VM.
- Rebuild FE: nginx có thêm location `/api/v1/app/chat/`.

## Chưa làm / còn mở

Xem mục ❌/⚠ trong `chat-security-checklist.md`:
- Chưa quét virus bằng ClamAV, mới chỉ có allowlist đuôi + magic bytes.
- Chưa giới hạn tần suất gửi.
- Chưa dọn file đã tải lên nhưng không gửi.
- Chưa có chức năng xoá thành viên khỏi nhóm.
- Chưa lọc ký tự đảo chiều U+202E trong tên file.
- Owner chưa quyết có giữ `.doc/.xls/.ppt` (định dạng cũ, có thể chứa macro) hay không.

## Test

Chạy trên DB và host thật:

```
E2E_BASE_URL=<preview> E2E_DB_NAME=<db của host> npx playwright test e2e/chat-api.spec.ts e2e/chat.spec.ts
```

- `chat-api.spec.ts` (7) đọc thẳng PostgreSQL (`docker exec psql`) và MinIO (`/data/<bucket>/host/<blob>/xl.meta`) để chứng minh chỉ có ciphertext.
- `chat.spec.ts` (3) đăng nhập 2 người qua màn login.
