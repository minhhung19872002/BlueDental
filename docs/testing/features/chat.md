# F-89 — Chat nội bộ có đính kèm file (R-1157)

Trạng thái: `VERIFIED` 2026-11-06 trên develop: R-1157 e1566669, R-1158 hardening, R-1159 sửa tin. Rà bảo mật chi tiết: `chat-security-checklist.md`.

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
- Bản cũ khi sửa tin (R-1159) cũng được mã hoá như vậy, trong bảng `bd_chat_message_revisions`, với AAD là id của bản cũ.
- Tìm theo nội dung (R-1158): không thể dùng index vì DB chỉ có ciphertext. Server giải mã từng lô tin trong bộ nhớ, tối đa 5.000 tin mới nhất của cuộc trò chuyện, và trả về ≤ 50 kết quả.
  - Tìm không phân biệt dấu ("ha my" khớp "Hà My").
  - Bỏ qua tin đã thu hồi.
  - `isComplete=false` khi vượt 5.000 tin hoặc 50 kết quả.

## Giới hạn

| Mục | Giá trị |
|---|---|
| Độ dài tin | 4.000 ký tự |
| File / tin | 10 |
| Dung lượng file | 50 MB (R-1158). nginx location chat 55 MB; ClamAV `StreamMaxLength` 60M |
| Thành viên nhóm | 100 |
| Danh bạ | 50 người, tìm trên server |
| Trang tin | 30 (tối đa 100), nút "Tải tin cũ hơn" |
| Sửa tin | Chỉ người gửi, trong 15 phút kể từ lúc gửi, chỉ chữ (R-1159) |
| Tần suất / người / 30 giây | gửi + sửa 30, tải file 30, tìm 20. Vượt thì nhận 429, mã `Chat:0020`, kèm header `Retry-After` |
| File tải lên mà không gửi | xoá sau 24 giờ (worker quét mỗi giờ: `Chat:OrphanAttachmentHours`, `Chat:OrphanSweepSeconds`) |
| Đuôi file | jpg, jpeg, png, gif, webp, pdf, docx, xlsx, pptx, doc, xls, ppt, txt, csv. Kiểm magic bytes; txt/csv chỉ cần không có byte NUL |

## Quyền

- Không có permission riêng: ai đăng nhập cũng chat được trong chi nhánh của mình.
- Server kiểm tư cách thành viên ở mọi API. Không phải thành viên thì nhận 404, kể cả khi đổi header `X-Clinic-Branch-Id`.
- Xoá thành viên khỏi nhóm (R-1158): chỉ chủ nhóm (người tạo) được xoá (`Chat:0021`). Không được tự xoá mình (`Chat:0022`); muốn ra thì dùng "Rời nhóm".
  - Người bị xoá nhận 404 ở mọi API của nhóm đó.
  - Khi chủ nhóm rời, quyền chủ nhóm chuyển cho thành viên vào nhóm sớm nhất.
- Sửa tin (R-1159):
  - Chỉ người gửi được sửa (`Chat:0004`), và chỉ trong 15 phút (`Chat:0023`). Tin đã thu hồi thì không sửa được (`Chat:0005`).
  - Client gửi kèm `expectedEditedAt`; nếu tin đã bị sửa ở tab khác thì nhận `Chat:0024`.
  - Mọi thành viên xem được các bản cũ qua `GET messages/{id}/revisions` (mới nhất trước). Khi tin bị thu hồi, endpoint này trả `[]`.
  - Gửi lại đúng nội dung cũ thì không tạo bản cũ.
  - Ô soạn: Enter lưu, Shift+Enter xuống dòng, Esc huỷ, ↑ khi ô trống thì sửa tin mới nhất của mình. Bấm nhãn "đã chỉnh sửa" để xem các bản cũ.

## Triển khai

- Chạy DbMigrator để áp 3 migration: `ChatR1157`, `ChatOwnerR1158` (cột `OwnerId`) và `ChatRevisionsR1159` (bảng bản cũ).
- `RECEIPT_VAULT_KEY` đã có trên cả 2 VM.
- Rebuild FE: nginx có location `/api/v1/app/chat/` với `client_max_body_size 55m`.
- ClamAV: `docker-compose.yml` đặt `CLAMD_CONF_StreamMaxLength: 60M`. Phải recreate container `clamav`, nếu không clamd từ chối file > 25 MB.
  - Upload chat **fail closed**: ClamAV không chạy thì upload nhận `Chat:0019`; có virus thì nhận `Chat:0018`.
  - Ngoại lệ: nếu không đặt `MalwareScan:Host` thì upload **không được quét**, chỉ ghi cảnh báo vào log. Đây là trường hợp máy dev không có ClamAV.
  - `docker-compose.yml` đã đặt `MalwareScan__Host: clamav`, nên staging và production luôn quét.

## Chưa làm / còn mở

Xem mục ❌/⚠ trong `chat-security-checklist.md`:
- Owner chưa quyết có giữ `.doc/.xls/.ppt` (định dạng cũ, có thể chứa macro) hay không.
- Rate limit đếm trong bộ nhớ của một container API. Nếu chạy nhiều host thì mỗi host đếm riêng.
- R-1160 "Kho lưu trữ" (Ảnh/Video, File, Link của cuộc trò chuyện): đang làm.

Đã làm trong R-1158:
- quét ClamAV, rate limit, dọn file mồ côi, xoá thành viên;
- tên file bỏ mọi ký tự định dạng vô hình (Unicode Cf, gồm U+202E) và ký tự điều khiển;
- tìm theo nội dung tin, file 50 MB, hiện % tiến độ upload.

## Test

Chạy trên DB và host thật:

```
E2E_BASE_URL=<preview> E2E_DB_NAME=<db của host> npx playwright test e2e/chat-api.spec.ts e2e/chat.spec.ts e2e/chat-r1158-r1159-api.spec.ts e2e/chat-edit.spec.ts
```

- `chat-api.spec.ts` (7) đọc thẳng PostgreSQL (`docker exec psql`) và MinIO (`/data/<bucket>/host/<blob>/xl.meta`) để chứng minh chỉ có ciphertext.
- `chat.spec.ts` (3) đăng nhập 2 người qua màn login.
- `chat-r1158-r1159-api.spec.ts` (15) chạy qua HTTP thật, gồm:
  - sửa tin: bản cũ chỉ có ciphertext; trùng nội dung; xung đột 0024; hết hạn 0023; không phải người gửi 0004; tin đã thu hồi 0005;
  - cách ly chi nhánh và người ngoài nhóm khi xem bản cũ (404);
  - canary không xuất hiện trong audit log; chép ciphertext sang bản cũ khác thì không giải mã được;
  - EICAR bị chặn 0018; U+202E bị lọc khỏi tên file; dọn file mồ côi (23 h còn, 25 h mất);
  - xoá thành viên 0021/0022/204/404; chuyển quyền chủ nhóm;
  - tìm kiếm; rate limit 429.
  - Host cần `MalwareScan__Host` trỏ tới clamd. Đặt `Chat__OrphanSweepSeconds=5` để test dọn file không phải chờ.
- `chat-edit.spec.ts` (4), hai trình duyệt thật:
  - sửa tin qua menu, người kia thấy ngay qua SignalR và mở được bản cũ;
  - ↑ / Esc / Hủy sửa giữ bản nháp;
  - quá 15 phút thì mất nút Sửa;
  - tên file dài không tràn khung chip upload.
