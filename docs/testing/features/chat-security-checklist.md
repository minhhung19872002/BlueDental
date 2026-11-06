# Chat nội bộ (F-89 / R-1157) — Checklist nghiệm thu bảo mật & chuẩn

Dùng để rà lại khi session đang làm chat báo xong. Mỗi mục: **kiểm thế nào** → **đạt khi nào**.

**Rà theo code — 2026-11-06** (code chat chưa commit, session khác vẫn đang làm).
Chỉ đọc code, **chưa chạy runtime** — mọi ✅ ở đây là "code đúng", vẫn phải chạy thật mới tính là đạt.
Có `e2e/chat-api.spec.ts` (6 test, gọi API thật, không `page.route`) — chưa chạy trong lần rà này.

**Cập nhật 2026-11-06 — R-1158 (hardening) + R-1159 (sửa tin, F5), đã chạy thật** trên host + PostgreSQL + MinIO + ClamAV thật:
- `chat-api` 7/7, `chat` 3/3;
- `chat-r1158-r1159-api` 15/15;
- `chat-edit` 4/4 (UI, 2 trình duyệt).

Các ô ghi *(R-1158)* / *(R-1159)* là kết quả sau lần này.

Ký hiệu: ✅ code đạt · ❌ chưa có / sai · ⚠ đạt một phần / có rủi ro · ❓ phải chạy thật mới biết · ⚪ đã chốt / không áp dụng

---

## A. Xác thực & phân quyền

| # | Yêu cầu | Kiểm thế nào | Đạt khi | Theo code 2026-11-06 |
|---|---|---|---|---|
| A1 | Mọi API chat và SignalR hub bắt buộc đăng nhập | Gọi `/api/v1/app/chat/*` và kết nối hub không đăng nhập | 401 | ✅ `[Authorize]` ở app service + hub |
| A2 | Có permission chức năng riêng (vd. `BlueDental.Chat.Use`), tắt được theo vai trò | Tắt quyền cho 1 role → gọi API | 403; menu chat ẩn trên FE | ⚪ Chủ dự án đã chốt: mọi tài khoản đăng nhập đều chat được, không có quyền riêng (ghi trong `ChatAppService`) |
| A3 | Người không phải thành viên KHÔNG đọc / gửi / sửa / thu hồi / tải file được | User C gọi bằng id cuộc trò chuyện, id tin, id file của A–B | 404 (không lộ là có tồn tại) | ✅ `GetVisibleAsync` → 404; có test e2e |
| A4 | Giới hạn chi nhánh ở server | User chỉ thuộc CN2 gửi `X-Clinic-Branch-Id` = CN1 rồi list/đọc/tạo | Không thấy dữ liệu CN1, không tạo được ở CN1 | ✅ theo code (`BranchAccessChecker` theo phân công chi nhánh) + có test e2e — ❓ chưa chạy |
| A5 | Chỉ mời được người đủ điều kiện (đang hoạt động, thuộc chi nhánh) | Tạo nhóm/thêm người với user CN khác hoặc user bị khoá | Lỗi `Chat:MemberNotInBranch` | ✅ `ChatParticipantPolicy` |
| A6 | Bị xoá khỏi nhóm / bị khoá tài khoản → mất quyền NGAY | Xoá B khỏi nhóm → B đọc lại tin cũ, tải file cũ | 404 | ⚠ *(R-1158)* Có xoá thành viên: chỉ chủ nhóm (0021), không tự xoá mình (0022). Người bị xoá nhận 404 khi đọc và khi gửi; có test `chat-r1158-r1159-api`. Còn mở: tài khoản bị khoá — `GetVisibleAsync` không kiểm `IsActive`, phụ thuộc việc phiên cookie bị thu hồi |
| A7 | File chỉ gắn được vào tin của chính người upload, cùng cuộc trò chuyện, 1 lần | Gửi tin kèm `attachmentId` của người khác / cuộc trò chuyện khác / đã gắn rồi | Lỗi `Chat:AttachmentUnavailable` | ✅ `ChatAttachment.AttachTo` |
| A8 | Chỉ người gửi được sửa / thu hồi tin của mình | B sửa/thu hồi tin của A | Bị từ chối | ✅ `NotSender` trong domain; có test e2e. *(R-1159)* Sửa chỉ được trong 15 phút (0023); có test |
| A9 | SignalR chỉ đẩy tới đúng thành viên, không mang nội dung | Bắt frame websocket của người ngoài nhóm khi có tin mới | Người ngoài không nhận gì; thành viên chỉ nhận `conversationId` | ✅ chỉ đẩy `conversationId` vào group `user:{id}` |

## B. Mã hoá & bảo vệ dữ liệu

| # | Yêu cầu | Kiểm thế nào | Đạt khi | Theo code 2026-11-06 |
|---|---|---|---|---|
| B1 | Nội dung tin mã hoá khi lưu | `SELECT` bảng tin nhắn trong PostgreSQL | Chỉ thấy `v1:<base64>` | ✅ AES-256-GCM; test e2e có kiểm |
| B2 | Tên file mã hoá khi lưu | `SELECT` bảng attachment | Không thấy tên file gốc | ✅ |
| B3 | File trong MinIO đã mã hoá, tên blob không lộ tên gốc | Tải blob `chat/...` trực tiếp từ MinIO, mở thử | Không mở được; tên dạng `<guid>.enc` | ✅ `chat/{branch}/{conv}/{id}.enc` |
| B4 | **Audit log ABP KHÔNG chứa nội dung tin** | Gửi / sửa tin có chuỗi dễ nhận ("CANARY-xyz") → `SELECT * FROM "AbpAuditLogActions" WHERE "Parameters" LIKE '%CANARY%'` | 0 dòng | ✅ (R-1157) — đã thấy rò thật trong `Parameters` (cả nội dung lẫn tên file qua Upload). Sửa: `[DisableAuditing]` trên `Content` của Send/Edit + trên action Upload; test canary trong `chat-api.spec` (audit log + `AbpEntityPropertyChanges` = 0 dòng). *(R-1159, đã chạy thật)* Bản cũ khi sửa nằm ở `bd_chat_message_revisions`, mã hoá `v1:`, AAD = id bản cũ. Canary của nội dung cũ lẫn mới không có trong audit log hay `AbpEntityPropertyChanges`. Chép ciphertext sang bản cũ khác thì không đọc ra. *(R-1158)* Từ khoá tìm kiếm cũng không vào audit log. Test: `chat-r1158-r1159-api` |
| B5 | Application log (Serilog) không ghi nội dung tin / tên file (PHI) | grep log sau khi gửi tin "CANARY" | Không thấy | ✅ code chat không ghi log; hub chỉ log connection id + user id |
| B6 | Ciphertext gắn với id dòng (copy sang dòng khác không mở được) | Copy cột nội dung tin X sang tin Y trong DB → đọc Y | Lỗi giải mã, không hiện nội dung X | ✅ AAD = row id |
| B7 | Thiếu / sai key thì báo lỗi rõ, không lưu plaintext dự phòng | Bỏ `RECEIPT_VAULT_KEY` → gửi tin | Lỗi `ReceiptVaultKeyMissing`, không có dòng plaintext nào được ghi | ✅ |
| B8 | Truyền tải qua HTTPS/TLS 1.2+, websocket là `wss://` | DevTools trên staging | Không có request `http://` / `ws://` | ❓ chạy trên staging |
| B9 | Ghi rõ trong tài liệu: đây là mã hoá lúc lưu (server giải mã được), KHÔNG phải E2E | Đọc docs feature | Có ghi | ✅ `features/chat.md` mục "Mã hoá — đúng phạm vi" |

## C. File đính kèm

| # | Yêu cầu | Kiểm thế nào | Đạt khi | Theo code 2026-11-06 |
|---|---|---|---|---|
| C1 | Allowlist đuôi file (không phải blocklist) | Upload `.exe`, `.html`, `.svg`, `.js` | Từ chối | ✅ 14 đuôi |
| C2 | Kiểm magic bytes — file đổi đuôi bị từ chối | Đổi `x.exe` → `x.pdf`, `x.html` → `x.png` rồi upload | Từ chối | ✅ — `.txt/.csv` chỉ kiểm "không có byte NUL" (chấp nhận được vì luôn tải về, không hiển thị) |
| C3 | Giới hạn dung lượng ở cả Kestrel lẫn AppService | Upload 21 MB | Từ chối, server không bị đọc hết vào RAM | ✅ *(R-1158)* Giới hạn 50 MB: Kestrel 51 MB, nginx 55m, AppService đọc tối đa 50 MB; ClamAV `StreamMaxLength` 60M |
| C4 | Giới hạn số file mỗi tin | Gửi 11 file | Từ chối | ✅ 10 |
| C5 | **Quét virus bằng ClamAV trước khi lưu** | Upload file EICAR (đổi đuôi `.txt`/`.pdf`/`.docx`) | Từ chối, không có blob nào được ghi | ✅ *(R-1158)* quét ClamAV trước khi mã hoá + lưu. EICAR `.txt` → `Chat:0018`, không có blob; có test |
| C6 | ClamAV hỏng / timeout thì chặn upload (fail-closed), không cho qua | Tắt container ClamAV → upload | Lỗi rõ, không lưu file | ✅ *(R-1158)* không quét được → `Chat:0019`, không lưu (fail-closed theo code) — ❓ chưa chạy kịch bản stop container. Lưu ý: không đặt `MalwareScan:Host` (máy dev) thì không quét, chỉ log cảnh báo; compose đặt `clamav` |
| C7 | Tên file bị làm sạch (bỏ đường dẫn, ký tự điều khiển) | Upload tên `../../a.pdf`, tên có `\r\n` | Lưu thành `a.pdf`; header tải về không bị chèn | ✅ `Path.GetFileName`; `File()` của ASP.NET tự mã hoá header nên không chèn header được — nhưng ký tự điều khiển vẫn giữ trong tên (xem H2.6) |
| C8 | Tải về luôn `Content-Disposition: attachment` + `X-Content-Type-Options: nosniff` | Xem response header khi tải file trên staging (qua Caddy) | Có đủ 2 header | ⚠ `attachment` ✅; nosniff: location `/api/v1/app/chat/` không có `add_header` riêng nên kế thừa snippet cấp server — cần `curl -I` xác nhận |
| C9 | Không render file người dùng như HTML; ảnh preview chỉ qua `<img>` | Review FE | Không có `iframe`/`object`/`innerHTML` với file chat | ✅ ảnh qua `<img>`, file khác chỉ tải về |
| C10 | File thu hồi / tin bị thu hồi thì không tải được nữa | Thu hồi tin → gọi lại URL tải | 404 | ✅ |
| C11 | Dọn file upload nhưng không gửi (orphan) | Upload rồi không gửi; chạy job | Blob + dòng DB bị xoá sau thời hạn đã chốt | ✅ *(R-1158)* `ChatOrphanAttachmentWorker`: chưa gắn vào tin quá 24 h thì xoá blob + dòng (quét mỗi giờ). Test: file 23 h còn, 25 h mất |
| C12 | Chốt có cho `.doc/.xls/.ppt` (định dạng cũ, hay chứa macro) không | Hỏi chủ dự án | Có quyết định ghi lại | ❓ code đang cho phép — chờ chủ dự án |

## D. Chống lạm dụng

| # | Yêu cầu | Kiểm thế nào | Đạt khi | Theo code 2026-11-06 |
|---|---|---|---|---|
| D1 | Rate limit gửi tin / upload / tạo nhóm theo user | Bắn 100 request/giây | 429 sau ngưỡng | ✅ *(R-1158)* ASP.NET rate limiter theo user, cửa sổ 30 giây: gửi + sửa 30, upload 30, tìm 20. Vượt → 429 `Chat:0020` + `Retry-After`; có test. Tạo nhóm chưa giới hạn. Bộ đếm nằm trong bộ nhớ của từng host |
| D2 | Giới hạn độ dài tin, tên nhóm, số thành viên, page size | Gửi vượt từng giới hạn | 400 với lỗi rõ | ✅ 4000 / 100 / 100 / 100 |
| D3 | Hub SignalR không cho client gọi method tuỳ ý; giới hạn kích thước message | Review hub | Chỉ server đẩy xuống | ✅ |

## E. Hiển thị (XSS) & quyền riêng tư trên màn hình

| # | Yêu cầu | Kiểm thế nào | Đạt khi | Theo code 2026-11-06 |
|---|---|---|---|---|
| E1 | Nội dung tin hiện dạng text, không `dangerouslySetInnerHTML` | Gửi `<img src=x onerror=alert(1)>` | Hiện nguyên chuỗi, không chạy script | ✅ text React; grep `dangerouslySetInnerHTML` = 0 |
| E2 | Link trong tin có `rel="noopener noreferrer"`; server không tự fetch preview link (SSRF) | Gửi link, xem DOM + log server | Đạt | ✅ R-1160: chỉ Kho lưu trữ tab Link render link (`<a target="_blank" rel="noopener noreferrer">`, http/https, không HTML thô); trong luồng tin vẫn là text; server không fetch preview — e2e `chat-r1160-library` kiểm `rel`/`target` |
| E3 | Thông báo / toast / badge không hiện nội dung tin (màn quầy lễ tân) | Nhận tin khi đang ở trang khác | Chỉ hiện "Tin nhắn mới từ …" hoặc số chưa đọc | ✅ badge chỉ hiện số |
| E4 | Mọi chữ hiển thị qua i18n (vi/en) | Đổi ngôn ngữ | Không còn chuỗi cứng | ✅ 47 key `Chat:*` có đủ ở vi lẫn en — ❓ đổi ngôn ngữ khi chạy |

## F. Vòng đời dữ liệu — cần chủ dự án quyết định

| # | Câu hỏi | Code hiện đang làm | Quyết định |
|---|---|---|---|
| F1 | Giữ lịch sử chat bao lâu? Tự xoá sau N tháng? | Giữ mãi | |
| F2 | Nhân viên nghỉ việc: tin cũ giữ / ẩn tên / xoá? | Tin giữ nguyên; user bị xoá hiện tên "—" | |
| F3 | Có ai (admin) được đọc chat của người khác không? Nếu có thì mỗi lần đọc phải có audit | Không có đường nào cho admin đọc | |
| F4 | Thu hồi tin: chỉ ẩn hay xoá luôn blob file? | Chỉ ẩn; blob vẫn nằm trong MinIO nhưng API chặn tải | |
| F5 | Sửa tin có giữ lịch sử bản cũ không? | ✅ *(R-1159, đã chạy thật)* Giữ mọi bản cũ, mã hoá. Server chặn: 0023 quá hạn, 0024 xung đột, 0004 không phải người gửi, 0005 đã thu hồi. `GET messages/{id}/revisions`: 404 với người ngoài nhóm / khác chi nhánh, `[]` khi đã thu hồi. DTO có `canEdit` + `editableUntil`; nhãn "đã chỉnh sửa" bấm được để xem bản cũ. Test: `chat-r1158-r1159-api`, `chat-edit` | **Chốt 2026-11-06:** giữ mọi bản cũ (mã hoá), thành viên xem được qua "đã chỉnh sửa"; chỉ sửa trong 15 phút sau khi gửi; chỉ sửa chữ, không sửa file |
| F6 | Mất `RECEIPT_VAULT_KEY` = mất toàn bộ chat + chứng từ — đã có bản backup key ngoài VM chưa? | — | |

## G. Test bắt buộc (theo chuẩn dự án: API thật + PostgreSQL thật, không mock)

Hiện trạng: `BlueDental.BE/test` chưa có test chat nào. Có `BlueDental.FE/e2e/chat-api.spec.ts`
(gọi API thật qua Playwright, 6 test: danh bạ theo chi nhánh, chat 1-1 + lưu mã hoá, người chi nhánh khác bị chặn,
sửa/thu hồi chỉ người gửi, file tải về đúng từng byte + bị chặn file xấu, nhóm/rời nhóm). Chưa chạy trong lần rà này.

- [ ] BE integration: A3, A4, A5, A6, A7, A8 — mỗi mục 1 test HTTP thật *(A3, A4, A8 + rời nhóm đã có ở `chat-api.spec`)*
- [ ] BE integration: B1, B2, B4 — đọc thẳng DB sau khi gửi, không thấy chuỗi canary ở bất kỳ bảng nào *(B1, B2, B4 đã có ở `chat-api.spec`, chạy trên Playwright + DB thật thay vì xUnit)*
- [ ] BE integration: C1, C2, C3, C5 (EICAR), C10 *(C1/C2 đã có một phần; chưa có C5)*
- [ ] Playwright (không `page.route`, đăng nhập thật): A gửi tin + file → B nhận realtime → reload vẫn còn → B tải file đúng nội dung *(phần lớn có ở `chat.spec`: gửi tin + file, B reload thấy tin, tải file khớp nội dung; chưa kiểm nhận realtime không reload)*
- [ ] Playwright: C không thấy cuộc trò chuyện của A–B; user CN2 không thấy chat CN1
- [ ] Playwright: E1 chuỗi XSS hiện dạng text
- [ ] Retest Level 3 (đụng `NotificationHub`, DbContext dùng chung): chạy lại các spec dùng SignalR (Tiếp nhận, chuông mời lên R-1144)
- [x] Registry: thêm F-89 vào `01-feature-verification-registry.md`, R-1157 vào `03-regression-log.md`
- [ ] `/security-review` trước khi lên staging

## H. Phía FE (`BlueDental.FE/src/features/chat/`)

### H1. Xác thực, phiên đăng nhập, dữ liệu còn sót lại trên máy

| # | Yêu cầu | Kiểm thế nào | Đạt khi | Theo code 2026-11-06 |
|---|---|---|---|---|
| H1.1 | Gọi API chỉ qua cookie HttpOnly (axios `withCredentials`), không tự cầm token trong JS | Review `chatApi.ts`, DevTools → Application | Không có token chat trong localStorage/sessionStorage | ✅ dùng `api` chung |
| H1.2 | Đăng xuất → xoá cache tin nhắn đã giải mã + ngắt kết nối hub chat | Mở chat → đăng xuất → đăng nhập user khác cùng tab | User mới không thấy tin của user cũ, kể cả thoáng qua | ✅ `queryClient.clear()`; `ChatDock` unmount thì dừng hub |
| H1.3 | Không lưu nội dung tin / bản nháp xuống localStorage, IndexedDB hay service worker cache | DevTools → Application sau khi chat | Không thấy nội dung tin | ✅ không persist; bản nháp chỉ ở state |
| H1.4 | Đổi chi nhánh → danh sách chat làm mới, không còn cuộc trò chuyện của chi nhánh cũ | Đổi branch picker khi đang mở chat | Danh sách đúng chi nhánh mới | ✅ `ChatPanel key={branchId}`, query key có chi nhánh |
| H1.5 | Bị xoá khỏi nhóm khi đang mở cuộc trò chuyện → UI đóng / báo "không còn quyền", không treo | A xoá B khi B đang mở | B thấy thông báo rõ, khung chat đóng | ✅ *(R-1158)* 404 → "Bạn không còn ở trong cuộc trò chuyện này" (`Chat:NoLongerMember`) — ❓ chưa có test UI |
| H1.6 | Ẩn lối vào chat khi không có quyền (A2) — chỉ cho UX, server vẫn là chốt chặn | Tắt quyền → reload | Không thấy icon/menu chat | ⚪ theo A2 |

### H2. File đính kèm phía trình duyệt

| # | Yêu cầu | Kiểm thế nào | Đạt khi | Theo code 2026-11-06 |
|---|---|---|---|---|
| H2.1 | Ô chọn file có `accept` theo đúng danh sách đuôi server cho phép; kiểm trước đuôi + dung lượng + số file (chỉ cho UX) | Chọn `.exe`, file 25 MB, 11 file | Báo lỗi ngay, không gửi request | ✅ — thiếu chặn file 0 byte (I1.13) |
| H2.2 | Kéo-thả và dán ảnh (Ctrl+V) đi qua đúng bước kiểm như nút chọn file | Dán ảnh chụp màn hình, kéo file `.exe` vào | Ảnh qua được, `.exe` bị chặn | ⚠ dán ảnh ✅ qua cùng bước kiểm; chưa hỗ trợ kéo-thả |
| H2.3 | **Không mở blob file ở tab mới / iframe với kiểu do người dùng quyết định** — blob URL cùng origin với app, nếu là HTML thì chạy được script | Review code mở/xem file | Ảnh: chỉ `<img src=blob:>`. File khác: chỉ tải về (`download`) | ✅ |
| H2.4 | Tạo `Blob` với kiểu lấy từ allowlist phía FE, không tin header `Content-Type` một cách mù quáng | Review | Kiểu không nằm trong allowlist → ép `application/octet-stream` | ⚠ dùng Content-Type server trả về — rủi ro thấp vì chỉ ảnh mới hiển thị, và chỉ qua `<img>` |
| H2.5 | `URL.revokeObjectURL` sau khi dùng; không giữ blob mãi trong bộ nhớ | Mở 50 ảnh, xem Memory | Bộ nhớ không tăng mãi | ✅ revoke ở cleanup; cache blob `gcTime` 5 phút |
| H2.6 | Tên file hiển thị an toàn: cắt ngắn, bỏ ký tự điều khiển, **bỏ ký tự đảo chiều U+202E** (`hoadon‮fdp.exe` hiện thành `hoadonexe.pdf`) | Upload file tên chứa U+202E | Hiện đúng tên thật, không bị đảo | ✅ *(R-1158)* BE `CleanFileName` bỏ mọi ký tự Unicode Format (Cf, gồm U+202A–E, U+2066–9) và Control trước khi lưu; FE `displayFileName` lọc lại cho tên cũ. Có test |
| H2.7 | Có tiến trình upload, huỷ được; nút Gửi bị khoá khi file chưa upload xong | Upload file 20 MB qua mạng chậm (DevTools throttle) | Không gửi được tin thiếu file | ⚠ Gửi bị khoá khi đang upload ✅. *(R-1158)* Chip hiện % (role `progressbar`); tới 100% thì hiện "Đang xử lý" trong lúc quét + mã hoá; tên dài không tràn khung (test `chat-edit`). Còn thiếu: chưa huỷ được (I1.9) |
| H2.8 | Ảnh lớn hiện thumbnail giới hạn kích thước, không vỡ layout | Gửi ảnh 8000×8000 | Ảnh co trong khung | ✅ rộng 200 |

### H3. Hiển thị nội dung (bổ sung cho mục E)

| # | Yêu cầu | Kiểm thế nào | Đạt khi | Theo code 2026-11-06 |
|---|---|---|---|---|
| H3.1 | Tin hiện bằng text React (`white-space: pre-wrap`), không `dangerouslySetInnerHTML`, không thư viện markdown chưa sanitize | `grep dangerouslySetInnerHTML src/features/chat` | 0 kết quả | ✅ |
| H3.2 | Tự nhận link chỉ cho `http:`/`https:`; chặn `javascript:`, `data:`, `vbscript:` | Gửi `javascript:alert(1)` | Hiện dạng chữ, không thành link | ⚪ không có linkify |
| H3.3 | Tiêu đề tab / badge / toast / Notification của trình duyệt chỉ hiện số hoặc tên người gửi, không hiện nội dung | Nhận tin khi ở trang khác / tab khác | Không lộ nội dung | ✅ |
| H3.4 | Không `console.log` nội dung tin, tên file, response API | `grep console src/features/chat` + xem console khi chat | Chỉ log lỗi kỹ thuật | ✅ chỉ có `console.warn` lỗi kết nối |
| H3.5 | Tin đã thu hồi: biến mất ở mọi máy đang mở (qua push), không còn trong cache | A thu hồi khi B đang mở | B thấy "Tin nhắn đã thu hồi", không tải được file | ✅ push + server chặn tải |

### H4. Realtime & tình trạng mạng

| # | Yêu cầu | Kiểm thế nào | Đạt khi | Theo code 2026-11-06 |
|---|---|---|---|---|
| H4.1 | Push chỉ là tín hiệu, nội dung luôn lấy lại qua API (đã có quyền kiểm) | Review `useChatLive` | Đúng | ✅ |
| H4.2 | Mất mạng → có lại thì tự lấy tin bị lỡ | Tắt mạng 1 phút, người kia gửi 3 tin, bật lại | Thấy đủ 3 tin, không cần reload | ✅ `onreconnected` (nhưng xem I5.3) |
| H4.3 | Không gửi trùng khi bấm nhiều lần / Enter giữ lâu / mạng chậm | Bấm Gửi 5 lần nhanh | Chỉ 1 tin | ⚠ khoá khi `busy`, nhưng 2 lần Enter trong cùng một tick vẫn có thể gửi 2 lần |
| H4.4 | Gửi lỗi → tin giữ lại trong ô nhập, có nút gửi lại, không mất chữ đã gõ | Tắt BE rồi gửi | Báo lỗi, chữ vẫn còn | ✅ chữ + file chỉ bị xoá khi gửi thành công |
| H4.5 | Chỉ đánh dấu "đã đọc" khi tab đang hiện (`document.visibilityState`) và đang mở đúng cuộc trò chuyện | Mở chat ở tab nền | Không tự đánh dấu đã đọc | ❌ không kiểm `visibilityState` |
| H4.6 | Số kết nối hub mỗi tab hợp lý | Đếm websocket trong DevTools | Chấp nhận được, hoặc gộp 1 kết nối dùng chung | ⚠ 3 kết nối / tab (`useChatLive`, `useAppointmentLiveUpdates`, `useReceiptSigningLive`) |

### H5. Header bảo mật trình duyệt (nginx FE / Caddy)

| # | Yêu cầu | Kiểm thế nào | Đạt khi | Theo code 2026-11-06 |
|---|---|---|---|---|
| H5.1 | Có **Content-Security-Policy**: `script-src 'self'`, `object-src 'none'`, `frame-ancestors 'self'`, `img-src 'self' blob: data:`, `connect-src 'self' wss:` | `curl -I` trang staging | Có header, app vẫn chạy bình thường | ❌ `docker/security-headers.conf` chưa có CSP (ảnh hưởng toàn app, không riêng chat) |
| H5.2 | `nosniff`, `X-Frame-Options`, HSTS có ở cả response FE lẫn response API tải file | `curl -I` cả hai | Đủ | ✅ FE / ⚠ API kế thừa từ cấp server — cần `curl -I` |

### H6. Chuẩn code dự án (CLAUDE.md §4, §14, §16)

| # | Yêu cầu | Đạt khi | Theo code 2026-11-06 |
|---|---|---|---|
| H6.1 | Không `any`, không `as` lách kiểu | `grep -E ": any\|as any\|as unknown as" src/features/chat` = 0 | ✅ |
| H6.2 | Không import chéo feature (chat không import từ `cskh`, `reception`…) | Chỉ import `@/components`, `@/hooks`, `@/lib` | ✅ |
| H6.3 | Gọi API chỉ qua `api/`; component không gọi axios | Đúng cấu trúc `chatApi` / `chatQueries` / `chatMutations` | ✅ |
| H6.4 | Container / Presenter, mỗi component ≤ 150 dòng, hook một việc | Đếm dòng từng file | ✅ file lớn nhất 104 dòng |
| H6.5 | Danh sách tin > 50 dòng phải virtualize (`@tanstack/react-virtual`), tải thêm khi cuộn lên | Cuộc trò chuyện 2.000 tin vẫn mượt | ❌ không virtualize; tải thêm bằng nút "Tải tin cũ hơn" |
| H6.6 | Route lazy-load + bọc `ErrorBoundary` | Review router | ⚠ chat là dock trong `AppLayout`, không phải route, không có ErrorBoundary riêng → lỗi render chat rơi vào `RouteErrorBoundary` gốc, sập cả layout |
| H6.7 | CSS riêng `features/chat/components/chat.css`, dùng token `--bd-*`, không inline style, không hex trong tsx | Review | ✅ grep `style=` = 0 |
| H6.8 | Mọi chữ qua i18n vi/en, đổi ngôn ngữ không reload | Đổi ngôn ngữ khi đang mở chat | ✅ key đủ — ❓ chạy thật |
| H6.9 | Nút Gửi / Tải lên / Tạo nhóm / Rời nhóm / Thu hồi: khoá + spinner khi đang gọi API, toast chỉ hiện sau khi có kết quả (§16.18) | Mạng chậm, bấm từng nút | ❓ Gửi / Tải lên đã khoá; các nút còn lại chưa kiểm |
| H6.10 | Bàn phím: Enter gửi, Shift+Enter xuống dòng, Esc đóng, Tab đúng thứ tự; tin mới đọc được bằng screen reader (`aria-live`) | Thao tác không dùng chuột | ⚠ Enter / Shift+Enter / gõ IME ✅. *(R-1159)* Khi sửa: Enter lưu, Esc huỷ, ↑ ở ô trống sửa tin mới nhất (có test). Không có `aria-live` |
| H6.11 | Lỗi phân biệt rõ: "Bạn không còn quyền xem cuộc trò chuyện này" (404/403) và "Lỗi hệ thống" | Giả lập từng loại | ✅ *(R-1158)* 404 → `Chat:NoLongerMember`; lỗi khác → `Chat:LoadError` + Thử lại |
| H6.12 | Giao diện theo khung chung của hệ thống (memory *match system style*), có trạng thái trống / đang tải / lỗi | So với màn Labo / Danh mục | ❓ cần so trên màn hình |

### H7. Test FE bắt buộc (Playwright thật — không `page.route`, đăng nhập qua màn login)

Hiện trạng (2026-11-06): `chat.spec.ts` 3 test UI thật (vị trí dock, gửi tin + file → người nhận thấy badge + tải file đúng nội dung, sửa + thu hồi còn sau reload). Các ô dưới chưa đánh dấu là chưa có test.

- [ ] 2 trình duyệt (A, B): A gửi tin + ảnh + PDF → B nhận không cần reload → B tải PDF, nội dung khớp → reload vẫn còn
- [ ] A thu hồi → B thấy "đã thu hồi" ngay, link tải file trả lỗi
- [ ] Đăng xuất A → đăng nhập C cùng tab → không thấy dữ liệu của A
- [ ] User CN2 không thấy chat CN1
- [ ] Chuỗi XSS trong tin và trong tên file hiện dạng chữ (H3.1, H2.6)
- [ ] File `.exe` đổi đuôi `.pdf` bị chặn với thông báo đúng
- [ ] Mất mạng rồi có lại → đủ tin (H4.2); bấm Gửi nhiều lần → 1 tin (H4.3)
- [ ] Chạy trên bản build production (`vite preview`), không dùng dev server (StrictMode mount 2 lần gây đỏ giả)

## I. Tình huống lỗi & biên (mất mạng, gián đoạn, tranh chấp)

Cách tạo lỗi mạng: DevTools → Network → **Offline** / **Slow 3G** / throttle tuỳ chỉnh;
Playwright `context.setOffline(true)`; tắt container (`docker compose stop api|minio|clamav|redis`).
Đây là môi trường local/staging — không làm trên app.nfcdental.com.

### I1. Upload file bị gián đoạn

| # | Tình huống | Cách tạo | Kỳ vọng | Theo code 2026-11-06 |
|---|---|---|---|---|
| I1.1 | **Đang upload thì mất mạng** | Throttle Slow 3G, chọn file 15 MB, đến ~50% thì bật Offline | File báo "Tải lên thất bại — mất kết nối" + nút **Thử lại** / **Bỏ**; nút Gửi bị khoá; chữ đã gõ còn nguyên; không treo spinner mãi | ❌ hiện toast lỗi chung rồi chip file **biến mất**, không có Thử lại; chữ đã gõ vẫn còn ✅ |
| I1.2 | Mất mạng rồi có lại, bấm Thử lại | Tiếp I1.1, tắt Offline, bấm Thử lại | Upload lại từ đầu thành công, gửi được; DB chỉ có **1** attachment gắn vào tin | ⚠ không có Thử lại — phải chọn lại file; DB vẫn chỉ gắn 1 file |
| I1.3 | Server không nhận đủ file (kết nối đứt giữa chừng) | I1.1 rồi xem DB + MinIO | Không có dòng attachment, không có blob `.enc` nào của lần dở dang | ✅ BE đọc hết vào buffer rồi mới lưu |
| I1.4 | Mạng chập chờn (bật/tắt liên tục) | Offline 2 giây / Online 2 giây lặp lại trong khi upload 3 file | Mỗi file có trạng thái riêng; file nào xong thì giữ, chỉ thử lại file lỗi | ⚠ mỗi file một chip riêng, file xong thì giữ; file lỗi bị bỏ, không thử lại |
| I1.5 | Upload xong nhưng **gửi tin** thì mất mạng | Upload xong 2 file → Offline → bấm Gửi | Báo lỗi gửi; file đã upload vẫn nằm trong ô soạn; có lại mạng bấm Gửi → 1 tin kèm đủ 2 file, không upload lại | ✅ chữ + file chỉ bị xoá khi gửi thành công — ❓ chạy thật |
| I1.6 | Request Gửi đã tới server nhưng mất mạng **trước khi nhận response** | Tắt mạng ngay sau khi request đi → có lại → bấm Gửi lại | **Không ra 2 tin trùng** | ❌ không có idempotency key: tin chỉ có chữ → **ra 2 tin**; tin có file → lần 2 báo `AttachmentUnavailable` khó hiểu |
| I1.7 | Đang upload thì **đóng tab / reload / chuyển trang** | Upload 15 MB rồi F5 | Có cảnh báo `beforeunload`; nếu rời thì upload huỷ, không gắn vào đâu | ❌ không có `beforeunload` |
| I1.8 | Đang upload thì **chuyển sang cuộc trò chuyện khác** | Upload ở cuộc A, bấm sang cuộc B | File không bị gửi nhầm sang B | ✅ ô soạn reset theo cuộc trò chuyện (`key={activeId}`); file dở thành orphan (C11) |
| I1.9 | Đang upload thì **bấm Huỷ** | Bấm ✕ trên file đang tải | Request bị abort (`AbortController`), không gắn vào tin | ❌ chip chỉ đóng được khi đã upload xong; không có AbortController |
| I1.10 | Upload file vừa đúng giới hạn 20 MB | File đúng 20.971.520 byte, đi qua nginx | Không bị nginx trả 413 HTML | ✅ *(R-1158)* giới hạn mới 50 MB: location `/api/v1/app/chat/` `client_max_body_size 55m`, Kestrel 51 MB — ❓ chưa chạy qua nginx thật với file 50 MB |
| I1.11 | Upload chậm quá lâu | Throttle 50 KB/s, file 20 MB (~7 phút) | Không bị timeout âm thầm; nếu có timeout thì báo rõ | ❓ nginx `proxy_read_timeout 120s` — cần chạy thật |
| I1.12 | File bị đổi / xoá trên ổ đĩa sau khi chọn, trước khi upload | Chọn file trên USB rồi rút USB | Báo lỗi đọc file, không crash | ❓ |
| I1.13 | File 0 byte | Chọn file rỗng | FE chặn trước; BE cũng từ chối | ⚠ BE từ chối ✅; FE không chặn trước |
| I1.14 | 2 file trùng tên trong cùng 1 tin | Chọn `a.pdf` từ 2 thư mục | Cả 2 được nhận, hiển thị và tải về đúng từng file | ✅ mỗi file một id riêng |

### I2. Server / dịch vụ phụ trợ hỏng

| # | Tình huống | Cách tạo | Kỳ vọng | Theo code 2026-11-06 |
|---|---|---|---|---|
| I2.1 | **MinIO tắt** khi upload | `docker compose stop minio` → upload | Báo lỗi rõ; **không có dòng attachment mồ côi** | ✅ lưu blob trước, ghi dòng DB sau |
| I2.2 | MinIO tắt khi tải file cũ | Stop minio → bấm tải | Báo "Không tải được tệp, thử lại sau", không màn trắng | ⚠ toast lỗi chung — ❓ chạy thật |
| I2.3 | **ClamAV tắt / timeout** | Stop clamav → upload | Chặn upload (fail-closed) | ✅ *(R-1158)* `Chat:0019` (C6) — ❓ chưa chạy kịch bản stop |
| I2.4 | BE restart giữa chừng (deploy) | Restart container `api` khi đang upload / đang mở chat | Upload báo lỗi + Thử lại; hub tự kết nối lại; tự lấy tin bị lỡ | ⚠ hub tự kết nối lại nếu BE lên trong ~47 giây; lâu hơn → I5.3. Upload lỗi không có Thử lại (I1.1) |
| I2.5 | Redis tắt | Stop redis | Chat vẫn đọc/gửi được hoặc báo lỗi rõ — không treo | ❓ |
| I2.6 | DB lỗi khi lưu tin sau khi file đã lên MinIO | Giả lập lỗi DB lúc Send / lúc ghi attachment | Không có tin nửa vời; file chưa gắn được job dọn | ⚠ ghi DB lỗi sau khi lưu blob thì blob vẫn mồ côi (không có dòng DB nên worker C11 không thấy) — rủi ro thấp. Dòng attachment chưa gắn thì đã được dọn *(R-1158)* |
| I2.7 | Thiếu / sai `RECEIPT_VAULT_KEY` sau khi deploy | Deploy với key sai | Không gửi được + lỗi rõ; tin cũ không bị ghi đè; admin biết ngay | ✅ lỗi `ReceiptVaultKeyMissing`, không đụng dòng cũ — ❓ cảnh báo cho admin |

### I3. Phiên đăng nhập & quyền thay đổi giữa chừng

| # | Tình huống | Cách tạo | Kỳ vọng | Theo code 2026-11-06 |
|---|---|---|---|---|
| I3.1 | **Phiên hết hạn khi đang upload** | Rút ngắn thời gian sống của cookie → upload file lớn | 401 → về màn đăng nhập, không báo lỗi khó hiểu; chữ đã gõ nên được giữ | ⚠ interceptor 401 chung đưa về `/login` ✅; chữ đang gõ bị mất |
| I3.2 | Phiên hết hạn khi đang mở chat lâu | Mở chat, chờ quá hạn phiên, gửi tin | Về đăng nhập; hub không kết nối lại vô hạn bằng phiên chết | ✅ request kế tiếp 401 → `/login`; hub tự dừng sau 5 lần thử |
| I3.3 | **Bị xoá khỏi nhóm khi đang upload / đang soạn** | B rời nhóm ở tab khác khi đang upload ở tab này | Nhận 404 → thấy "Bạn không còn trong cuộc trò chuyện này" | ✅ *(R-1158)* có xoá thành viên; 404 → "Bạn không còn ở trong cuộc trò chuyện này"; gửi sau khi bị xoá → 404 (test API) |
| I3.4 | Tài khoản bị khoá khi đang dùng chat | Admin khoá B | Request kế tiếp của B bị từ chối, hub ngắt | ❓ phụ thuộc phiên cookie bị thu hồi — chat không tự kiểm `IsActive` |
| I3.5 | Bị chuyển sang chi nhánh khác khi đang chat | Đổi phân công chi nhánh của B | Không còn thấy chat chi nhánh cũ | ✅ kiểm chi nhánh ở mỗi request — ❓ cache quyền Redis |
| I3.6 | Đăng xuất ở tab khác | 2 tab, đăng xuất ở tab 1 | Tab 2 không còn hiện / gửi được tin | ⚠ tab 2 vẫn hiện tin đã tải cho tới request kế tiếp (401 → `/login`) |

### I4. Tranh chấp giữa nhiều người / nhiều tab

| # | Tình huống | Cách tạo | Kỳ vọng | Theo code 2026-11-06 |
|---|---|---|---|---|
| I4.1 | A **thu hồi** tin trong khi B đang **tải file** của tin đó | B bấm tải file 20 MB, A thu hồi ngay | Lần tải sau của B bị 404; giao diện B cập nhật "đã thu hồi" | ✅ |
| I4.2 | A sửa tin trong khi tin vừa bị thu hồi (2 tab của A) | Tab 1 thu hồi, tab 2 bấm Lưu bản sửa | Bản sửa bị từ chối với lỗi rõ | ✅ `MessageRecalled` (0005), *(R-1159)* đã chạy thật. Thêm: 2 tab cùng sửa → tab sau nhận `Chat:0024` EditConflict (`expectedEditedAt`); có test |
| I4.3 | 2 người gửi cùng lúc | A và B bấm Gửi cùng giây | Cả 2 tin hiện, thứ tự giống nhau trên mọi máy | ✅ sắp theo giờ server + id — nhưng xem lỗi phân trang I6.6 |
| I4.4 | Cùng 1 người mở 2 tab / 2 máy | A mở chat ở 2 nơi, gửi ở tab 1 | Tab 2 hiện tin ngay; số chưa đọc đúng ở cả 2 | ✅ đẩy tới group `user:{id}` (mọi kết nối) |
| I4.5 | 2 người cùng thêm thành viên / đổi tên nhóm | A và B đổi tên nhóm cùng lúc | Kết quả cuối nhất quán, không lỗi 500 | ⚠ đổi tên: người sau ghi đè. 2 người cùng mở chat 1-1 với nhau một lúc → đụng unique index, nhiều khả năng **500** |
| I4.6 | Thành viên cuối rời nhóm | Mọi người rời nhóm | Không lỗi; nhóm rỗng xử lý theo quyết định | ❓ nhóm rỗng vẫn nằm trong DB |
| I4.7 | Thêm người thứ 101 | Thêm vượt giới hạn | Lỗi rõ, không thêm được một nửa | ✅ `EnsureRoom` kiểm trước khi thêm |

### I5. Kết nối realtime (SignalR)

| # | Tình huống | Cách tạo | Kỳ vọng | Theo code 2026-11-06 |
|---|---|---|---|---|
| I5.1 | Máy **ngủ / gập laptop** rồi mở lại | Sleep 10 phút, người khác gửi tin | Hub kết nối lại, thấy tin lỡ không cần F5 | ⚠ ngủ lâu hơn ~47 giây thì hub bỏ cuộc (I5.3); chỉ còn poll số chưa đọc 60 giây |
| I5.2 | Hub không kết nối được (proxy chặn websocket) | Chặn `/signalr/` | Chat vẫn dùng được qua API; có báo nhỏ "mất kết nối thời gian thực" | ⚠ API vẫn chạy; không có báo mất kết nối |
| I5.3 | Hub hết lượt thử kết nối lại | Tắt BE > 2 phút rồi bật | Có cơ chế thử lại tiếp hoặc nút "Kết nối lại" | ❌ `withAutomaticReconnect` 5 lần rồi dừng, không có `onclose` khởi động lại |
| I5.4 | Tin tới khi tab đang ẩn | Tab nền, nhận tin | Badge tăng; không tự đánh dấu đã đọc | ⚠ badge ✅; vẫn tự đánh dấu đã đọc nếu đang mở cuộc đó (H4.5) |
| I5.5 | Nhiều tin tới dồn dập | Script gửi 50 tin/10 giây | UI không giật, không refetch 50 lần liên tiếp | ⚠ mỗi push invalidate toàn bộ `chatKeys.all`, không debounce |

### I6. Dữ liệu & hiển thị biên

| # | Tình huống | Kỳ vọng | Theo code 2026-11-06 |
|---|---|---|---|
| I6.1 | Tin đúng 4000 ký tự / 4001 ký tự | 4000 gửi được; 4001 bị chặn ở FE (có bộ đếm) và BE | ⚠ FE `maxLength` 4000 + BE 4000 (cùng đếm UTF-16) ✅; không có bộ đếm |
| I6.2 | Tin chỉ có khoảng trắng / chỉ có xuống dòng, không file | Không gửi được | ✅ trim → `ContentRequired` |
| I6.3 | Tin chỉ có file, không chữ | Gửi được | ✅ |
| I6.4 | Emoji, tiếng Việt tổ hợp / dựng sẵn, chữ RTL, chuỗi rất dài không khoảng trắng | Hiện đúng, xuống dòng không tràn khung | ❓ chạy thật |
| I6.5 | Tên file rất dài (255 ký tự), có emoji / dấu tiếng Việt | Lưu và tải về đúng tên | ✅ giới hạn 255; ASP.NET tự sinh `filename*` UTF-8 |
| I6.6 | Cuộc trò chuyện 5.000 tin, cuộn lên tận đầu | Tải dần theo trang, không trùng / mất tin ở ranh giới trang | ❌ **lỗi**: con trỏ trang lọc `SentAt < pivot.SentAt` trong khi sắp xếp (SentAt, Id) → tin trùng `SentAt` nằm đúng ranh giới trang bị **mất**. Sửa: `SentAt < p \|\| (SentAt == p && Id < pivotId)` |
| I6.7 | Người dùng đã bị xoá / nghỉ việc vẫn có tin cũ | Tin cũ vẫn hiển thị, không lỗi null | ✅ hiện "—" |

---

## Tổng hợp lần rà 2026-11-06

> **Sau R-1158 / R-1159 (2026-11-06):**
> - Đã xong: B4, C5, C6 (theo code), C11, D1, H2.6, A6 (phần xoá thành viên), H1.5, H6.11, I2.3, I3.3, F5, I4.2.
> - H2.7 mới có tiến trình, chưa huỷ được.
> - Còn chặn trước staging: I1.1, I1.6, I6.6.

**Chặn trước staging — còn thiếu:** B4 (audit log rò nội dung), C5/C6 (ClamAV), D1 (rate limit), I1.1 (upload lỗi mất file, không Thử lại),
I1.6 (gửi lại ra tin trùng), I6.6 (mất tin ở ranh giới trang), H2.6 (U+202E trong tên file).
**Chặn trước staging — code đạt, còn chờ chạy thật:** A4, H1.2, H2.3, H3.1, H3.2 (không áp dụng), I1.5, I1.10, I2.1, I3.1 (một phần).
**Nên có trước production:** A6 (xoá thành viên / tài khoản bị khoá), C8 + H5.2 (`curl -I`), C11 + I2.6 (dọn orphan), H5.1 (CSP),
H4.3, H4.5, H6.5, H6.6, H6.11, I1.7, I1.9, I4.5 (500 khi mở chat 1-1 đồng thời), I5.3; chủ dự án chốt mục F và C12.
**Test:** chưa có test BE nào; `chat-api.spec.ts` (6 test API) chưa chạy; chưa có spec UI.

### Rà lại theo code — 2026-11-06, sau commit `695fed1a` (R-1158 + R-1159)

Đọc code, chưa chạy. R-1160 (Kho lưu trữ) rà xong khi làm FE — xem dòng H3.2.

| Mục | Kết quả | Bằng chứng |
|---|---|---|
| B4 nội dung không vào audit log | ✅ code | `[DisableAuditing]` trên `Content` (gửi, sửa), `Text` (tìm); upload `[DisableAuditing]`. Còn test canary |
| C5/C6 ClamAV, fail-closed | ✅ | `deploy.sh` bật `clamav`; VM dùng `docker-compose.yml` + `.prod.yml`, có `MalwareScan__Host: clamav`. Lỗi socket / quá giờ → 0019. ⚠ Thiếu `Host` thì **cho qua không quét** (chỉ log cảnh báo) — nên đổi thành chặn khi `ASPNETCORE_ENVIRONMENT=Production` |
| C11 / I2.6 dọn file mồ côi | ✅ | `ChatOrphanAttachmentWorker`: `MessageId == null` + quá 24 h; xoá dòng trước (khoá đồng thời), rồi xoá blob. Blob lưu xong mà insert DB lỗi thì **không** dọn được (không còn dòng để tìm) — hiếm, ghi nhận |
| C 50 MB đi qua nginx / Kestrel | ✅ | nginx `/api/v1/app/chat/` 55m, timeout 300s; controller `RequestSizeLimit` 51 MB; clamd `StreamMaxLength 60M` |
| D1 giới hạn tần suất | ⚠ một phần | Có cho gửi + sửa (30/30s), upload (30/30s), tìm (20/30s), trả 429 + `Retry-After`. **Chưa có** cho tạo nhóm, thêm thành viên, mở chat 1-1, đổi tên, thu hồi |
| A6 tài khoản bị khoá / xoá thành viên | ✅ | Chủ nhóm xoá được (0021/0022); chọn người chỉ trong `IsActive`. Người đã khoá vẫn là thành viên cũ nhưng không đăng nhập được |
| H2.6 ký tự đảo chiều trong tên file | ✅ | BE `CleanFileName` + FE `displayFileName` bỏ `\p{Cf}\p{Cc}` trước khi xét đuôi; FE còn bỏ dấu chấm/cách cuối tên |
| H6.11 bị xoá khỏi nhóm | ✅ | 404 → "Chat:NoLongerMember", không có nút thử lại; lỗi khác → nút Thử lại |
| F5 sửa tin | ✅ | 15 phút, chỉ người gửi, giữ bản cũ mã hoá, `ExpectedEditedAt` → 0024, không đổi thì bỏ qua |
| **I6.6** mất tin ở ranh giới trang | ❌ **chưa sửa** | `ChatAppService.cs:163` vẫn `SentAt < pivot.SentAt` |
| **I1.6** gửi lại ra tin trùng | ❌ chưa có | Không có `ClientMessageId`; mất mạng sau khi server đã lưu → bấm gửi lại ra 2 tin |
| **I4.5** mở chat 1-1 cùng lúc | ❌ | Có unique index `(ClinicBranchId, DirectKey)` nên **không** ra 2 cuộc, nhưng request thua bị 500 thay vì trả cuộc đã có — cần bắt lỗi trùng rồi đọc lại |
| I1.1 upload lỗi | ⚠ | Chip biến mất + toast; không có nút Thử lại (phải chọn lại file) |
| I1.9 huỷ upload đang chạy | ❌ | Không có `AbortController`; bấm × chỉ ẩn chip, request vẫn chạy và file thành mồ côi (worker dọn sau 24 h) |
| I1.7 rời trang khi đang upload / có nháp | ❌ | Không có `beforeunload` |
| I5.3 mất kết nối hub hẳn | ⚠ | Có `onreconnected` → tải lại; không có `onclose` (hết lần thử lại thì im lặng, không báo, không tự nối lại) |
| H4.5 / I5.5 | ❌ | Không dùng `visibilityState`: tab ẩn vẫn đánh dấu đã đọc |
| H6.6 lỗi render trong chat | ⚠ | `ChatDock` nằm trong `AppLayout`, chỉ có `RouteErrorBoundary` → lỗi trong chat làm sập **cả trang**, không chỉ khung chat |
| H6.5 danh sách dài | ❌ | Không ảo hoá (dự án yêu cầu > 50 dòng phải dùng `@tanstack/react-virtual`); có phân trang nên chưa gấp |
| H5.1 CSP | ❌ | `security-headers.conf` chưa có `Content-Security-Policy` (cả app, không riêng chat) |
| I6.1 bộ đếm ký tự | ⚠ | Có `maxLength` 4000 nhưng không hiện số còn lại |
| H3.2 link | ✅ R-1160 | `ChatLinks.Find` (BE) chỉ giữ http/https có tên miền; `SharedLinkRow` render `<a target="_blank" rel="noopener noreferrer">`, không `dangerouslySetInnerHTML`; e2e `chat-r1160-library-api` (javascript:/ftp:/localhost bị bỏ) + `chat-r1160-library` (rel/target) |

**Chặn trước staging còn lại:** I6.6, I1.6, I4.5 (500), D1 phần còn thiếu.
**Tính năng mới đã chốt:** gắn khách bằng `#` (đề xuất R-1161) — yêu cầu + mục bảo mật J1–J9 ở
[chat-patient-tag.md](chat-patient-tag.md).

**Còn chờ chạy thật:** canary B4, upload EICAR → 0018, tắt clamav → 0019, 429 sau 30 tin, 2 tab mở 1-1 cùng lúc.

### Rà lại theo code — 2026-11-06, HEAD `db5be128` + phần chưa commit (R-1161 BE, R-1162 mới bắt đầu)

Đọc code; BE build 0 lỗi; chưa chạy test.

| Mục | Kết quả | Bằng chứng |
|---|---|---|
| I6.6 | ❌ vẫn chưa sửa | `ChatAppService.cs:163` vẫn `SentAt < pivot.SentAt` |
| I1.6 | ❌ vẫn chưa có | Không có `ClientMessageId` ở DTO / entity / FE |
| I4.5 | ❌ mới làm nửa | Đã thêm `IUniqueViolationDetector` + `PostgresUniqueViolationDetector`, nhưng **chưa nơi nào gọi** — `OpenDirectAsync` vẫn 500 khi thua |
| D1 | ⚠ không đổi | Chỉ thêm giới hạn cho `patient-suggestions` (Search). Vẫn thiếu: tạo nhóm, thêm thành viên, mở 1-1, đổi tên, thu hồi |
| Mục FE (I1.9, I1.7, I1.1, I5.3, H4.5, H6.6, H6.5, I6.1, H5.1) | không đổi | Chưa có thay đổi FE nào sau `db5be128` |
| R-1161 gắn khách | xem [chat-patient-tag.md § 6](chat-patient-tag.md) | BE gần đủ; FE và test chưa có |

Danh sách gốc khi viết checklist:
**Phải đạt trước staging (chặn):** B4, C5, C6, A4, D1, H2.3, H3.1, H3.2, H1.2, I1.1, I1.5, I1.6, I1.10, I2.1, I3.1, I3.3.
**Nên đạt trước production:** A2, A6, C8, C11, E3, H5.1, H4.3, H6.5, I1.7, I2.4, I4.1, I5.1, I5.3 và đã chốt mục F.

### R-1161 gắn khách bằng `#` — sau khi làm FE + test (2026-11-06)

| Mục | Kết quả | Bằng chứng |
|---|---|---|
| J1 không lưu PHI | ✅ chạy thật | `chat-r1161-patient-tag-api` ca J1: canary không có trong audit log của chat, cũng không có trong `ContentCipher` của tin / bản cũ |
| J2 khách chi nhánh khác | ✅ chạy thật | 0026, đếm tin trong DB không đổi |
| J3 gợi ý | ✅ chạy thật | Người ngoài nhóm → 404; gợi ý không ra khách chi nhánh 2 |
| J4 / J5 quyền người xem | ✅ chạy thật | Vai trò tạm không có `patient.read` → thẻ + gợi ý rút gọn; cấp → đủ; rút → rút gọn ngay. E2E: thẻ không phải link |
| J6 dò danh sách | ✅ chạy thật | 429 / `Chat:0020` |
| J7 / J8 | ✅ đọc code | Hub chỉ đẩy `conversationId`; không có log mới |
| J9 hiển thị | ✅ đọc code | `MessageText` / `PatientCard` render text; `features/chat` không có `dangerouslySetInnerHTML` |
| K1 | ⚠ chờ chủ dự án | Tạm thời: không có quyền vẫn được gợi ý, nhưng chỉ Tên + Mã KH |
| K2 | ✅ | 0026 hiện qua toast, ô sửa vẫn mở |

Còn mở như trước (làm trong R-1162): I6.6, I1.6, I4.5, D1 và các mục FE I1.9, I1.7, I1.1, I5.3, H4.5, H6.6, H6.5, I6.1, H5.1.
