# Chat nội bộ — gắn khách bằng `#` (đề xuất R-1161, thuộc F-89)

Nguồn: BA (anh Định) trong chat ngày 2026-11-06: "thêm tag để hiển thị thông tin khách
trong ngày luôn nha — ví dụ #DanhPham thì hiển thị thông tin khách và gửi đi — tên hay mã
gì cũng được". Chủ dự án chốt theo đề xuất (2026-11-06).

> R-id: R-1161 là số trống lúc viết; session làm chat kiểm lại regression log + origin/main +
> origin/develop trước khi nhận.

## 1. Quyết định đã chốt

| # | Câu hỏi | Chốt |
|---|---|---|
| Q1 | Gợi ý khách nào | Khách **hôm nay** lên đầu (có lịch hẹn hoặc đã tiếp nhận hôm nay, theo giờ VN), sau đó vẫn tìm được mọi khách khác của chi nhánh |
| Q2 | Thẻ hiện gì | Tên, Mã KH, Năm sinh, Giờ hẹn hôm nay, Bác sĩ, Trạng thái hôm nay (Đã hẹn / Đã đến / Đang khám / Hoàn tất…), Nội dung đặt lịch. **Không** SĐT, **không** tiền sử bệnh / dị ứng / chẩn đoán |
| Q3 | Bấm thẻ | Mở hồ sơ bệnh nhân, như bấm thẻ ở Tiếp nhận |
| Q4 | Dữ liệu thẻ | Luôn **mới nhất** — đọc lúc hiển thị, không chép vào tin |
| Q5 | Người xem không có quyền xem bệnh nhân | Chỉ thấy Tên + Mã KH, thẻ không bấm được |
| Q6 | Số khách / tin | Tối đa **5** |
| Q7 | Phạm vi | Chỉ khách thuộc **chi nhánh của cuộc trò chuyện** |

## 2. Hành vi

1. Trong ô soạn tin, gõ `#` ở đầu tin hoặc sau khoảng trắng → mở danh sách gợi ý.
   Gõ tiếp → lọc theo tên hoặc mã KH, **không phân biệt dấu** (như ô tìm kiếm khác, R-1051).
2. Mỗi dòng gợi ý: Tên (năm sinh) · Mã KH · nhãn "Hôm nay HH:mm" nếu có lịch hôm nay.
   ↑/↓ chọn, Enter/Tab chèn, Esc đóng. Không có kết quả → "Không tìm thấy khách".
3. Chọn → trong ô soạn hiện chip `#Tên khách` (xoá được bằng Backspace như một khối).
4. Gửi → tin hiện chữ như bình thường, chip `#Tên` thành thẻ khách bên dưới nội dung
   (mỗi khách một thẻ, theo thứ tự gắn).
5. Thẻ khách đã bị xoá / không còn xem được → "Khách không còn tồn tại", không lỗi.
6. Sửa tin (R-1159): được thêm/bớt khách trong 15 phút như sửa chữ; bản cũ giữ danh sách khách cũ.
7. Thu hồi tin: thẻ biến mất cùng nội dung.
8. Tìm tin (R-1158): tìm theo chữ trong tin; tên khách trong chip là chữ của tin nên tìm được.
9. Kho lưu trữ (R-1160): không đưa khách vào tab Link/File.

## 3. Thiết kế đề xuất

**Lưu trữ** — tin chỉ giữ **mã định danh**, không giữ thông tin khách:

- Bảng `ChatMessagePatientRefs (MessageId, PatientId, Position)`, unique (MessageId, PatientId);
  hoặc cột `PatientIds` trên tin. Cột này **không mã hoá** (chỉ là Guid) nhưng không chứa PHI.
- Nội dung tin (đã mã hoá) giữ token `#[Tên](patient:{id})` hoặc giữ chữ `#Tên` + vị trí —
  session tự chọn, miễn render lại đúng chip.

**API**

| Endpoint | Ghi chú |
|---|---|
| `GET chat/conversations/{id}/patient-suggestions?text=` | Thành viên của cuộc mới gọi được (404 nếu không). Khách hôm nay trước, rồi khách khác; tối đa 10 dòng; `text` ≤ 50 ký tự; rate limit như tìm tin (20/30s). Trả Tên, Mã KH, Năm sinh, giờ hẹn hôm nay — không SĐT |
| `SendChatMessageInput.PatientIds` / `EditChatMessageInput.PatientIds` | ≤ 5, không trùng; mọi id phải thuộc chi nhánh của cuộc, sai → lỗi nghiệp vụ mới (không 500) |
| `ChatMessageDto.Patients[]` | Thẻ dựng **lúc đọc** theo quyền của người xem: có `Patients.View` → đủ trường Q2 + `canOpen=true`; không → chỉ Tên + Mã KH, `canOpen=false`; khách đã xoá → `{ id, missing: true }` |

Dựng thẻ theo lô cho cả trang tin (một truy vấn cho mọi PatientId của trang), không N+1.

## 4. Bảo mật — đạt khi

| # | Yêu cầu | Kiểm thế nào |
|---|---|---|
| J1 | Không lưu thông tin khách trong tin / bản sửa / audit log | Đọc DB: `ContentCipher` giải mã không có SĐT, năm sinh; audit log không có `PatientIds` kèm tên |
| J2 | Không gắn được khách chi nhánh khác | API test: gửi PatientId của chi nhánh 2 vào cuộc chi nhánh 1 → lỗi nghiệp vụ, tin không được lưu |
| J3 | Gợi ý chỉ trong chi nhánh, chỉ cho thành viên | Không phải thành viên → 404; tài khoản chi nhánh 2 không thấy khách chi nhánh 1 |
| J4 | Thẻ theo quyền **người xem**, không theo người gửi | Tài khoản không có `Patients.View` → chỉ Tên + Mã KH, không mở được hồ sơ; gọi thẳng API hồ sơ → 403 |
| J5 | Rút quyền / chuyển chi nhánh có hiệu lực ngay với tin cũ | Rút `Patients.View` → tải lại → tin cũ chỉ còn Tên + Mã |
| J6 | Không dò danh sách khách qua gợi ý | 21 lần gọi gợi ý trong 30s → 429; `text` rỗng chỉ trả khách hôm nay, tối đa 10 |
| J7 | Không lộ PHI qua hub / thông báo | Đẩy SignalR vẫn chỉ có conversationId; thông báo tin mới không chứa tên khách nếu có xem trước nội dung |
| J8 | Không log PHI | Log BE khi lỗi chỉ có Id, không tên khách |
| J9 | Hiển thị an toàn | Tên khách render như text (không `dangerouslySetInnerHTML`); tên có `<script>` hiện nguyên văn |

## 5. Test bắt buộc (API thật + PostgreSQL thật)

- API: gửi tin có 1 / 5 / 6 khách (6 → lỗi); khách chi nhánh khác; PatientId không tồn tại;
  sửa tin đổi khách + xem bản cũ; người xem không có quyền; khách bị xoá mềm; gợi ý thứ tự
  hôm nay trước; gợi ý không dấu ("ha my" ra "Hà My"); 429.
- E2E (vite preview, không `page.route`): gõ `#` → chọn bằng bàn phím → gửi → tài khoản thứ hai
  thấy thẻ → bấm mở đúng hồ sơ → tải lại trang vẫn còn; tài khoản không có quyền thấy thẻ rút gọn.

## 6. Rà theo code — 2026-11-06 (BE chưa commit, FE chưa làm)

Session chat chọn: cột `PatientIds uuid[]` trên `ChatMessage` + `ChatMessageRevision`, nội dung mã hoá
giữ token `#[Tên](patient:{id})`. Tên trong token là tên **lúc gửi** (nằm trong nội dung đã mã hoá); thẻ
thì đọc mới.

| # | Kết quả | Bằng chứng |
|---|---|---|
| Q1 | ✅ | `ChatPatientCards.SuggestAsync`: khách hôm nay (lịch hẹn hoặc tiếp nhận trong ngày VN, bỏ Lịch tạm) xếp theo giờ, sau đó khách khác theo tên; text rỗng → chỉ hôm nay |
| Q2 | ✅ | `ChatPatientCardDto`: tên, mã, năm sinh, giờ hẹn, bác sĩ, trạng thái, nội dung đặt lịch — không đọc SĐT / tiền sử |
| Q4 / J5 | ✅ | Thẻ dựng lúc đọc, quyền `Patients.View` kiểm mỗi lần đọc |
| Q5 / J4 | ✅ BE | Không quyền → chỉ tên + mã, `CanOpen=false`, không truy vấn lịch hẹn |
| Q6 | ✅ | `MaxPatientsPerMessage` 5 → 0025 |
| Q7 / J2 | ✅ | `ChatPatientTagger` lọc `p.BranchId == conversation.ClinicBranchId`, thiếu → 0026 (một lỗi chung cho không tồn tại / chi nhánh khác / đã xoá) |
| J3 | ✅ | Gợi ý qua `GetVisibleAsync` (404 nếu không phải thành viên), chỉ chi nhánh của cuộc |
| J6 | ✅ | 20/30s, ≤ 10 dòng, `text` ≤ 50 ký tự, `[DisableAuditing]` |
| J7 | ✅ | SignalR vẫn chỉ đẩy `conversationId` |
| J8 | ✅ | Không có log mới; log cũ chỉ có Id |
| Hành vi 5, 7, 8, 9 | ✅ | Missing → `{id, missing}`; tin thu hồi không dựng thẻ; tìm tin + Kho link chạy trên `ToDisplay` (bỏ token) |
| Hành vi 6 | ✅ | Sửa tin nhận `PatientIds`, bản cũ giữ danh sách cũ + có thẻ |
| Chống giả token | ✅ | `Normalize` ghi lại token theo tên thật; token có id không nằm trong `PatientIds` thành chữ `#tên` |
| Dựng theo lô | ✅ | Mỗi trang: 1 truy vấn khách + 1 lịch hẹn + 1 tên bác sĩ |
| K1 dò danh bạ khi không có quyền | ✅ chốt B (R-1163) | Trước: người **không** có `Patients.View` gõ `#a`, `#b`… lấy được tên + mã của mọi khách chi nhánh. Nay: Không có `Patients.View` → `#` chỉ gợi ý khách có lịch hẹn hoặc đã tiếp nhận hôm nay (Tên + Mã KH). Gửi / sửa tin gắn khách khác → 403 `Chat:0027`; sửa tin thì khách đã có sẵn trên tin được giữ, chỉ khách thêm mới phải là khách hôm nay |
| ⚠ K2 sửa tin có khách đã bị xoá | nhỏ | Sửa tin cũ mà một khách đã xoá / chuyển chi nhánh → 0026, phải bỏ khách đó mới lưu được. FE cần báo rõ |
| J9 | ⏳ FE chưa làm | |
| FE (gõ `#`, chip, thẻ, bấm mở hồ sơ) | ❌ chưa làm | Không có thay đổi trong `features/chat` |
| Test API + E2E § 5 | ❌ chưa có | Không có spec nào gọi `patient-suggestions` / `PatientIds` |
| Migration | ✅ | `20261106091243_ChatPatientTagsR1161`: 2 cột `uuid[]` mặc định `'{}'`, có Down |

## 7. Kết quả sau khi làm — 2026-11-06 (R-1161, develop)

FE xong, test chạy thật (host :5157 + PostgreSQL `BlueDental_chat`, bản build production :8157, không `page.route`):

- `e2e/chat-r1161-patient-tag-api.spec.ts` **11/11**:
  - 1 / 5 / 6 khách (6 → 0025, không lưu);
  - khách chi nhánh 2 và id lạ → 0026, không lưu;
  - sửa tin đổi khách, bản cũ giữ danh sách cũ, sửa với `patientIds: []` bỏ thẻ;
  - thu hồi bỏ thẻ;
  - xoá mềm → `missing`, sửa lại tin đó → 0026, tin không đổi;
  - gợi ý hôm nay trước, "ha my" ra "Hà My", tìm theo mã, thẻ có trạng thái / nội dung đặt lịch / bác sĩ;
  - người ngoài nhóm → 404;
  - tìm tin thấy `#Tên`, không thấy `patient:{id}`; Kho link không có token khách;
  - J1: chuỗi canary không có trong audit log của chat, cũng không có trong `ContentCipher` của tin và bản cũ;
  - J4/J5: vai trò không có `patient.read` → thẻ và gợi ý rút gọn; cấp quyền → đủ; rút lại → rút gọn;
  - J6: 429 / `Chat:0020`.
- `e2e/chat-r1161-patient-tag.spec.ts` **3/3** (đăng nhập qua màn login, hai trình duyệt):
  - gõ `#` → ↓ + Enter, rồi Tab chọn; Backspace xoá cả chip; "Không tìm thấy khách" + Esc;
  - gửi → chip + 2 thẻ đúng thứ tự; tải lại vẫn còn;
  - tài khoản thứ hai bấm thẻ → `/patient/{id}?tab=profile`;
  - tài khoản không có quyền thấy thẻ chỉ Tên + Mã KH, không phải link.
- Toàn bộ chat spec **53/53**.

Khác với đề xuất ở § 3 (đã chọn khi làm):

| Mục | Đề xuất | Đã làm | Lý do |
|---|---|---|---|
| Gợi ý | `GET …/patient-suggestions?text=` | `POST` với body `{ text }` | Chữ gõ có thể là tên khách; giữ ngoài URL, ngoài log truy cập và lịch sử proxy |
| K1 (R-1163) | Chỉ khách hôm nay, hoặc không cho gắn | Chốt B: Không có `Patients.View` → `#` chỉ gợi ý khách có lịch hẹn hoặc đã tiếp nhận hôm nay (Tên + Mã KH). Gửi / sửa tin gắn khách khác → 403 `Chat:0027`; sửa tin thì khách đã có sẵn trên tin được giữ, chỉ khách thêm mới phải là khách hôm nay | Owner chọn B 2026-11-06. Lễ tân / phụ tá vẫn gắn được khách đang ở phòng khám, nhưng không dò được danh bạ. Kiểm ở server, không chỉ ở gợi ý |
| K2 | FE báo rõ | 0026 hiện qua toast lỗi chung, ô sửa vẫn mở để bỏ khách rồi lưu lại | Thông báo 0026 đã nói rõ khách không còn |
| Chip trong ô soạn | chip | Chữ `#Tên` được tô nền như chip (lớp nền nằm sau textarea, màu theo token AntD), Backspace xoá cả khối | Giữ textarea thường: gõ tiếng Việt (IME), dán, Shift+Enter vẫn như cũ |
| Dòng gợi ý | 1 dòng | 2 dòng: Tên (năm sinh) / Mã KH · "Hôm nay HH:mm" | Panel chat hẹp, một dòng bị cắt tên |

J9: tên khách hiện bằng text React; `features/chat` không có `dangerouslySetInnerHTML`.

Ghi chú: sau khi chọn, ô soạn chèn `#Tên ` (có dấu cách). Backspace lần đầu xoá dấu cách, lần hai mới xoá cả chip.
