# Nhánh `wip/zalo-inbox-f79` — tóm tắt

Hộp thư Zalo, mẫu ZNS trong khung chat và Lịch sử chăm sóc khách hàng, theo
`save/P2210.drawio` của BA. Mã feature dự kiến **F-80**. Regression id còn trống:
`main` đã dùng tới R-1019, nên bắt đầu từ R-1021.

> **Trạng thái: đang làm dở, chưa xác minh.** Chưa chạy trên stack thật, chưa
> có e2e, migration chưa apply vào DB nào. Đừng merge.

Nhánh được rebase lên `origin/main` ở `e3c5d3e8` (2026-10-23), rồi push lên origin.

| Commit | Nội dung |
|---|---|
| `b7991737` | Bản nháp đầu: Hộp thư Zalo, ZNS trong chat, API lịch sử chăm sóc |
| `6741fc9a` | Sinh lại migration cho `bd_care_notes`; `CareNoteController` có route ở cấp class |
| `0db3e3fc` | FE ghi chú chuyển sang API care-note dùng chung, thêm tag Đã liên hệ / Không nghe máy |
| `3dc0e114` | Tab Chăm sóc KH của hồ sơ: nút Mở chat Zalo / Gửi tin và khối Lịch sử chăm sóc |

Tổng cộng 88 file. Gần 11.000 dòng trong số đó là file Designer EF tự sinh.

---

## 1. Phạm vi so với file BA

| Đoạn trong P2210 | Trạng thái |
|---|---|
| Lấy danh sách tin nhắn của khách từ Zalo OA | Đã làm: webhook + đồng bộ |
| Nhận xử lý, khoá cho 1 người, tự nhả sau 15 phút | Đã làm |
| 2 trạng thái Chưa trả lời / Đã chăm sóc | Đã làm |
| Chuyển cho người khác, Nhả hội thoại | Đã làm |
| Hiện tin ZNS trong khung chat, đồng bộ lịch sử chat | Đã làm |
| Tag nhập tự do | Đã làm |
| Ghi chú: tạo / sửa / xoá, có log | Đã làm |
| Mẫu ZNS: 3 mẫu mới nhất, Xem thêm, chọn thì đổ dữ liệu khách | Đã làm (cách làm: quyết định 6) |
| Chiến dịch CSKH, Tạm dừng, trang thống kê chiến dịch | **Không làm**: nằm ngoài đoạn được yêu cầu |
| Nút Mở chat Zalo / Gửi tin trên tab Chăm sóc KH | Đã làm |
| Lịch sử chăm sóc: đồng bộ với ghi chú chat, ô nhập, tag nhanh | Đã làm |
| Chưa liên hệ / Đã liên hệ theo 90 ngày | Đã làm |
| Tóm tắt chi phí trong 1 năm + bộ lọc ngày (mặc định tất cả) | Đã làm |

---

## 2. Backend

### Domain

- **`ZaloConversation`** (`bd_zalo_conversations`): mỗi người dùng Zalo × chi nhánh có một hội thoại. Bản ghi giữ:
  - tin cuối, trạng thái, người đang giữ và thời hạn giữ (`HeldUntil`);
  - tag;
  - hồ sơ khách đã liên kết, số điện thoại khách chia sẻ.
- **`ZaloChatMessage`** (`bd_zalo_chat_messages`): từng tin nhắn. Unique theo `(chi nhánh, msg_id Zalo)`, nên một tin đến từ webhook, từ sync hay từ echo của chính mình gửi đều chỉ lưu một lần.
- **`CareNote`** + **`CareNoteRevision`** (`bd_care_notes`, `bd_care_note_revisions`):
  - một ghi chú gắn với hội thoại, với hồ sơ, hoặc cả hai;
  - mỗi lần tạo / sửa / xoá đều ghi một dòng log: ai, lúc nào, nội dung trước và sau;
  - xoá chỉ gạch ngang, không dùng `ISoftDelete`.
- **Mã lỗi** `BlueDental:ZaloInbox:0001..0013`, có câu vi / en.

### Zalo API (gọi qua `ZaloOaGateway`, có log tích hợp)

| Endpoint | Dùng cho |
|---|---|
| `POST /v3.0/oa/message/cs` | Trả lời bằng "tin tư vấn" (chỉ trong 48 giờ) |
| `GET /v2.0/oa/conversation` | Lịch sử một hội thoại, 10 tin / lần |
| `GET /v2.0/oa/listrecentchat` | Các hội thoại gần đây (5 trang = 50) |
| `GET /v3.0/oa/user/detail` | Tên, ảnh, `shared_info.phone` |
| Webhook `user_send_*` / `oa_send_*` | Tin đến / tin OA gửi đi |
| Webhook `user_received_message` (ZNS) | Đánh dấu đã nhận, liên kết user Zalo với hồ sơ |

Nguồn tra cứu: tài liệu của SDK `@warriorteam/redai-zalo-sdk`, bản mô tả lại API Zalo. Trang developers.zalo.me không đọc được bằng công cụ.

### API của BlueDental

`api/v1/app/zalo-inbox` — quyền `cskhInbox.read`; các thao tác thay đổi cần `cskhInbox.update`:

| Method | Path |
|---|---|
| GET | `/conversations`, `/counts`, `/conversations/{id}`, `/conversations/{id}/messages` |
| POST | `/sync`, `/conversations/{id}/sync` |
| POST | `/conversations/{id}/claim` · `/release` · `/transfer` · `/messages` |
| GET | `/assignees`, `/tags`, `/patients`, `/zns-templates` |
| PUT | `/conversations/{id}/tags`, `/conversations/{id}/patient` |
| POST | `/conversations/{id}/zns/preview`, `/conversations/{id}/zns` |

Ghi chú (`CareNoteController`):

| Method | Path | Quyền |
|---|---|---|
| GET / POST | `zalo-inbox/conversations/{id}/notes` | `cskhInbox.read` / `update` |
| GET / POST | `patients/{id}/care-notes` | `treatmentCskh.read` / `create` |
| PUT / DELETE | `care-notes/{id}` | `cskhInbox.update` **hoặc** `treatmentCskh.update` |

Lịch sử chăm sóc — quyền `treatmentCskh.read`:

- `GET patients/{id}/care-history?fromDate&toDate&kind`: gộp chat Zalo, ZNS / SMS / email, cuộc gọi, ghi chú và thay đổi trạng thái CSKH (`CareContactLog`).
- `GET patients/{id}/care-history/overview`: trạng thái liên hệ 90 ngày, hội thoại Zalo, tóm tắt chi phí năm nay.

### Quyền

- Subject mới `cskhInbox` gồm Xem và **Xử lý hội thoại**, nằm trong cây Phân quyền dưới CSKH.
- Seeder tự cấp cho các role tĩnh. Role tuỳ chỉnh phải cấp tay.

### Migration

`20261023023050_ZaloInbox` chỉ tạo 4 bảng nói trên, không sửa bảng cũ. Trên staging cần chạy DbMigrator rồi xoá cache quyền trong Redis.

---

## 3. Frontend

- **Tab "Hộp thư Zalo"** trên `/cskh-grouping?tab=inbox&conversation=<id>`. Badge trên tab là số hội thoại chưa trả lời.
  - **Cột trái:** ô tìm, 4 chip Chưa trả lời / Tôi đang giữ / Đã trả lời / Tất cả. Viền vàng khi khách chờ ≥ 15 phút, đỏ khi ≥ 60 phút.
  - **Cột giữa:**
    - tiêu đề hội thoại, các nút Nhận xử lý / Chuyển cho… / Nhả hội thoại;
    - tin nhắn, kể cả ZNS;
    - "Tải tin cũ hơn";
    - hàng mẫu ZNS và thẻ xem trước ZNS;
    - ô trả lời: 2.000 ký tự, đếm ngược khung 48 giờ, Ctrl+Enter để gửi.
  - **Cột phải:**
    - khách: mã, tên, SĐT, tag, liên kết / đổi hồ sơ;
    - Lịch hẹn;
    - Dịch vụ đang điều trị + bác sĩ;
    - Công nợ (chỉ hiện khi có quyền "Chi phí › Xem");
    - Ghi chú nội bộ.
- **Tab Chăm sóc KH của hồ sơ:**
  - nút **Mở chat Zalo**: mở thẳng hội thoại của khách; bị khoá nếu khách chưa nhắn OA;
  - nút **Gửi tin**: mở màn Gửi tin nhắn, mặc định SMS, vẫn đổi được kênh, khách bị khoá;
  - khối **Lịch sử chăm sóc khách hàng** dưới bảng.
- **Code:**
  - api: `inboxApi.ts`, `careNoteApi.ts`, `careHistoryApi.ts`;
  - component: `components/inbox/`, `components/notes/` (dùng chung), `components/history/`;
  - CSS: `cskh-inbox.css` (`.ibx-`), `cskh-notes.css` (`.cn-`), `cskh-history.css` (`.ch-`).
- Màn hình tự lấy lại dữ liệu theo chu kỳ: danh sách 10 giây, khung chat 5 giây. Chưa có SignalR.

---

## 4. Quyết định mình tự đặt — cần anh / chị chốt

1. **Giữ hội thoại 15 phút** theo lời BA. Mock ghi 10 phút. Hạn 15 phút tính từ lúc Nhận xử lý hoặc từ lần trả lời cuối. Hết hạn thì hội thoại tự coi là trống, không cần job dọn.
2. **Chỉ người đang giữ** mới trả lời, gửi ZNS, chuyển hoặc nhả được. Nút Chuyển cho chỉ hiện khi chính mình đang giữ.
3. **Tag lưu theo hội thoại**, không dùng danh mục Thẻ hồ sơ, để không đụng màn `/taxonomy`. Tối đa 10 tag, mỗi tag 30 ký tự. Ô nhập có gợi ý các tag chi nhánh đã dùng.
4. **Ghi chú:** ai có quyền xử lý cũng sửa / xoá được ghi chú của người khác. Log ghi lại ai làm.
5. **Ghi chú chat và ghi chú hồ sơ là cùng một dữ liệu.** Ghi trong chat thì hiện ở hồ sơ, và ngược lại.
6. **ZNS không chèn vào ô soạn tin.** ZNS là mẫu Zalo đã duyệt, chỉ thay tham số, không sửa được chữ. Vì vậy khi chọn mẫu, màn hiện thẻ xem trước từng tham số đã đổ dữ liệu khách, nằm ngay dưới khung chat. Chọn mẫu khác thì thẻ cũ được thay (đúng nhánh "xoá cái cũ" của BA).
   - ZNS gửi tới SĐT của hồ sơ đã liên kết.
   - Mỗi lần gửi được ghi vào `MessageLog`, nên có trong Thống kê CSKH.
7. **Tin tư vấn chỉ gửi trong 48 giờ** từ tin cuối của khách. Đây là quy định của Zalo và khớp mock. Quá 48 giờ thì chỉ gửi được ZNS.
8. **Liên kết user Zalo với hồ sơ**, theo thứ tự:
   - SĐT khách chia sẻ khớp đúng 1 hồ sơ;
   - webhook ZNS đã nhận;
   - nhân viên chọn tay.
9. **Một OA nối với nhiều chi nhánh:** tin nhắn vào chi nhánh nối sớm nhất.
10. **"Đã liên hệ" theo 90 ngày** chỉ tính tin nhắn CSKH gửi thành công: ZNS / SMS / email và trả lời chat. Đây là quy tắc BA ghi; dòng chữ trong mock có nhắc thêm "gọi được", mình không tính.
11. **Tóm tắt chi phí** tính theo năm dương lịch. Bộ lọc ngày chỉ áp cho dòng thời gian, mặc định tất cả thời gian.
12. **Cuộc gọi** khớp theo SĐT, vì log cuộc gọi không có `PatientId`.
13. **Không làm:**
    - nút "Gọi điện": BA chỉ yêu cầu 2 nút, và app chưa có click-to-call;
    - khối "Lịch sử chăm sóc" ở cột phải Hộp thư;
    - dòng "Không nhận tin (R08)";
    - các dòng hệ thống kiểu "Phát sinh đợt điều trị mới".

Một số giả định về Zalo **chưa kiểm được với OA thật**:

- trong webhook ZNS đã nhận, `recipient.id` là user_id;
- echo `oa_send_text` mang đúng `message_id` mà API gửi tin tư vấn trả về;
- trong API hội thoại, `src` = 0 nghĩa là tin do OA gửi.

---

## 5. Đã kiểm tra đến đâu

| Mức | Kết quả |
|---|---|
| Domain.Tests | 1085/1085, ở `6741fc9a` |
| Application.Tests | 816/816, ở `6741fc9a`. Chỉ là contract test về quyền, chưa có test chạy với DB |
| HttpApi.Host.Tests | 24/24, ở `6741fc9a` |
| FE `tsc` + `eslint` các file mới | sạch, ở `3dc0e114` |
| Chạy thật (API + PostgreSQL + trình duyệt) | **chưa** |
| E2E Playwright | **chưa có** |
| So ảnh với mock BA | **chưa** |

---

## 6. Còn phải làm

1. Apply migration vào DB local, chạy BE + FE, bấm thử từng luồng.
2. Thêm vào `e2e/fixtures/zalo-stub.mjs`: `message/cs`, `conversation`, `listrecentchat`, `user/detail`. Viết spec e2e:
   - webhook có chữ ký;
   - nhận xử lý / chuyển / nhả;
   - trả lời, ZNS, tag, ghi chú;
   - quyền, cách ly chi nhánh;
   - tab Chăm sóc KH.
3. Viết test BE chạy với PostgreSQL thật cho API mới (luật dự án yêu cầu).
4. Tài liệu:
   - `docs/testing/features/zalo-inbox.md`;
   - dòng F-80 trong registry;
   - R-1021 trong regression log;
   - impact map;
   - `docs/clone/unknowns.md` (các quyết định ở mục 4).
5. Chạy `/simplify`, `/security-review` trước khi đưa lên staging.

### Vấn đề có sẵn từ trước, không phải của nhánh này

- `BlueDental.HttpApi.Host/appsettings.json` đang chứa AppSecret và WebhookSecret thật của Zalo trong git.
- Key `Treatment:Service:EditServiceDialog` bị trùng trong `vi.json` và `en.json`.
- `CskhGroupingPage.tsx` có comment `eslint-disable` trỏ tới rule `react-hooks/exhaustive-deps`, nhưng rule đó không được cấu hình.
