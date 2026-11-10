# F-80 — CSKH › Hộp thư Zalo + Lịch sử chăm sóc khách hàng (BA P2210)

Nguồn: `save/P2210.drawio` của BA. File có 4 ảnh màn Hộp thư Zalo, 3 ảnh tab
Chăm sóc KH của hồ sơ, và các ghi chú bên cạnh ảnh. Chủ dự án yêu cầu làm:

- từ đầu file tới hết đoạn "template ZNS";
- từ đoạn "Thêm 2 nút này" tới cuối file.

Phần Chiến dịch CSKH ở giữa hai đoạn đó **không** thuộc feature này. Phần đó là
F-79 (Chiến dịch đã gửi), làm song song; tab của nó đứng ngay sau Hộp thư Zalo.

BlueDental riêng, bản gốc không có màn này. Regression id R-1021. Nhánh
`wip/zalo-inbox-f79`.

Status: xem dòng F-80 trong `01-feature-verification-registry.md`.

## Đã dựng

### Hộp thư Zalo (`/cskh-grouping?tab=inbox&box=<chip>&conversation=<id>`)

Đây là tab thứ ba của /cskh-grouping, nằm sau "Phân nhóm CSKH". Tab có badge đếm số hội thoại chưa trả lời.

URL giữ chip đang chọn (`box` = `unreplied` / `mine` / `cared` / `all`) và hội thoại đang mở, nên tải lại trang vẫn ở đúng chip và dòng đó vẫn được chọn (R-1025). Link chỉ có `conversation` (ví dụ "Mở chat Zalo") mở ở chip Tất cả, vì đó là chip duy nhất chắc chắn có hội thoại. Nếu dòng đang mở nằm dưới vùng nhìn thấy, danh sách tự cuộn tới dòng đó.

**Bố cục:** 3 cột trong một thẻ.

- **Đầu thẻ:**
  - "Hộp thư Zalo · OA … · Bạn: …";
  - chú thích "Tự nhả sau 15 phút không trả lời" · "Vàng: chờ ≥ 15 phút" · "Đỏ: chờ ≥ 60 phút";
  - nút Đồng bộ.
- **Cột trái:**
  - ô "Tìm tên, số điện thoại": không dấu; tìm theo tên Zalo, SĐT khách chia sẻ, hoặc tên / mã / SĐT của hồ sơ đã liên kết;
  - 4 chip Chưa trả lời · Tôi đang giữ · Đã trả lời · Tất cả, mỗi chip có số đếm;
  - danh sách khách: tab Chưa trả lời xếp người chờ lâu nhất lên đầu, viền vàng / đỏ theo thời gian chờ.
- **Cột giữa:**
  - đầu: tên, SĐT, "Khách nhắn lúc …", trạng thái, và vùng giữ hội thoại;
  - tin nhắn, gồm cả ZNS đã gửi tới hồ sơ;
  - "Tải tin cũ hơn";
  - hàng mẫu ZNS;
  - ô trả lời.
- **Cột phải:**
  - khách: `[mã] tên`, SĐT, tag, liên kết / đổi hồ sơ;
  - Lịch hẹn (Sắp tới, Lần khám cuối);
  - Dịch vụ đang điều trị + Bác sĩ;
  - Công nợ (Tổng tiền, Đã thu, Còn nợ), chỉ hiện khi có "Chi phí › Xem";
  - Ghi chú nội bộ.

**Giữ hội thoại:**

- "Nhận xử lý" giữ hội thoại cho một người trong 15 phút. Hạn được tính lại sau mỗi lần trả lời.
- Hết hạn thì hội thoại tự coi là trống, không cần job dọn.
- Người đang giữ thấy "Bạn đang xử lý", "Chuyển cho…", "Nhả hội thoại". Người khác thấy "{tên} đang giữ".
- Server từ chối người thứ hai bằng `ZaloInbox:0001`. Trả lời, gửi ZNS, chuyển hoặc nhả khi không giữ: `0002`.
- "Chuyển cho…" chỉ liệt kê nhân viên của chi nhánh, đang hoạt động, có "Hộp thư Zalo › Xử lý hội thoại".

**Trạng thái:**

- Chưa trả lời: tin cuối của khách chưa có câu trả lời nào sau nó.
- Đã chăm sóc: OA đã trả lời sau tin cuối của khách.
- Một hội thoại do OA mở trước (ví dụ ZNS) thì là Đã chăm sóc.
- Tính là trả lời: tin nhân viên gửi (từ Hộp thư hoặc từ Zalo OA Manager, về qua echo / Đồng bộ) và ZNS gửi từ Hộp thư (lưu ở `bd_message_logs`, không phải tin chat).
- **Không** tính là trả lời (R-1028, R-1029): thẻ xin SĐT, và tin OA tự gửi mà Zalo trả dạng template / list… (ví dụ thẻ chào mừng khi khách quan tâm OA, hiện "[Tin tự động của OA]"). Hai loại này vẫn hiện là tin cuối của hội thoại.

**Trả lời** (tin tư vấn, `POST /v3.0/oa/message/cs`):

- Tối đa 2.000 ký tự, Ctrl+Enter để gửi.
- Chỉ gửi được trong 48 giờ kể từ tin cuối của khách (`0003`). Ô trả lời ghi "Còn N giờ…", quá hạn thì ghi "chỉ gửi được ZNS".
- Server hỏi Zalo trước và chỉ lưu khi Zalo nhận. Echo `oa_send_text` cùng msg_id sẽ bị bỏ, hoặc được gán người gửi nếu echo về trước.

**Đồng bộ:**

- Mở tab thì đọc `listrecentchat` (50 hội thoại gần nhất).
- Mở hội thoại thì đọc `conversation` 10 tin mới nhất; "Tải tin cũ hơn" đọc tiếp 10 tin.
- Tin trùng `msg_id` không lưu lại.
- Webhook `user_send_*` / `oa_send_*` đưa tin vào ngay lúc có.
- Màn hình tự lấy lại dữ liệu theo chu kỳ: danh sách 10 giây, khung chat 5 giây.

**Liên kết hồ sơ:**

- **Tự nối theo SĐT khách chia sẻ** (R-1026). Hội thoại chưa có hồ sơ, có SĐT khớp đúng 1 hồ sơ **trong chi nhánh của hội thoại** (dạng `0…` / `84…` / `+84…`), thì tự nối. SĐT có từ ba nguồn:
  - hội thoại mới mở thì đọc `user/detail` → `shared_info.phone`;
  - webhook `user_submit_info` ("Người dùng gửi thông tin"): `info.phone` thành SĐT của hội thoại (chưa có hội thoại thì mở mới);
  - Đồng bộ: hội thoại chưa nối và chưa có SĐT thì hỏi lại `user/detail`, mỗi user một lần trong một lượt, không giới hạn (chủ dự án chọn).
- Mỗi lần hội thoại chưa nối đi qua (tin webhook, Đồng bộ), hệ thống thử khớp lại, nên hồ sơ tạo **sau** khi khách chia sẻ SĐT được nối khi khách nhắn lại.
- Khớp 0 hồ sơ hoặc ≥ 2 hồ sơ thì không nối và không gợi ý. Danh sách gợi ý và khớp theo SĐT người giám hộ thuộc task khác. Nút Tạo hồ sơ / Tạo lịch hẹn: R-1030, ngay dưới.
- Khi Zalo báo ZNS đã tới (`user_received_message`), user Zalo trong báo đó được liên kết với hồ sơ đã nhận ZNS.
- Còn lại thì nhân viên chọn tay.
- Liên kết đã có (chọn tay, từ ZNS, hoặc tự nối trước đó) **không bao giờ bị đè**. Gỡ liên kết bằng API (`PUT …/patient` với `null`; FE không có nút) thì tin nhắn sau của khách sẽ nối lại nếu SĐT vẫn khớp đúng 1 hồ sơ.

**[Tạo hồ sơ] [Tạo lịch hẹn]** (R-1030, chủ dự án chốt 2026-10-25), hai nút cạnh nhau dưới ô "Liên kết hồ sơ":

- **Tạo hồ sơ** mở đúng popup tạo hồ sơ của phòng khám (`PatientEditorDialog`):
  - điền sẵn tên Zalo và SĐT khách đã chia sẻ (`84…` đổi về `0…`; SĐT bị che thì bỏ);
  - tên tạm "Zalo …1234" thì để trống ô Họ và tên;
  - lưu xong hội thoại tự nối hồ sơ mới (`PUT …/patient`): khung phải hiện `[mã] tên`, SĐT, Lịch hẹn / Dịch vụ / Công nợ, dòng bên trái đổi tên ngay.
- **Tạo lịch hẹn** mở đúng popup tạo lịch hẹn (`AppointmentEditorModal`):
  - hội thoại **chưa nối**: chọn bệnh nhân có sẵn, hoặc "+" tạo hồ sơ mới (cũng điền sẵn tên và SĐT Zalo). Lưu xong hội thoại nối với bệnh nhân của lịch hẹn;
  - hội thoại **đã nối**: bệnh nhân khoá là hồ sơ đã nối, lưu xong mục "Sắp tới" đổi ngay, không nối lại.
- Hiện nút:
  - Tạo hồ sơ: chỉ khi chưa nối, hoặc đang "Đổi hồ sơ"; cần `cskhInbox.update` + `patient.create`.
  - Tạo lịch hẹn: cần `appointment.create`; hội thoại chưa nối thì cần thêm `cskhInbox.update` (vì sẽ nối).
- Không đổi BE: chỉ thêm 2 khoá i18n `CSKH:Inbox:Panel:CreatePatient` / `CreateAppointment`.

**Xin SĐT** (R-1028, thẻ Zalo `request_user_info`):

- Khách chưa có hồ sơ và chưa có SĐT ("Chưa có SĐT") nhận **tự động đúng 1 thẻ**, ngay khi:
  - quan tâm OA (`follow`);
  - bấm "Nhắn tin" trên trang OA (`user_click_chatnow`);
  - hoặc nhắn tin đầu tiên.
- Khách bấm thẻ, gửi SĐT (`user_submit_info`) → hội thoại tự nối theo R-1026.
- Thẻ là tin tư vấn nên Zalo chỉ nhận trong 48 giờ. Zalo từ chối thì lượt gửi được trả lại, sự kiện sau thử lại.
- Thẻ hiện thành bong bóng có nhãn "Thẻ xin số điện thoại". Thẻ **không** tính là trả lời: hội thoại vẫn "Chưa trả lời".
- Nhãn "Chưa có SĐT" ở dòng hội thoại và cạnh tên đầu khung chat. Dòng phụ ghi "Đã gửi thẻ xin SĐT lúc …".
- Nút "Xin SĐT": chỉ người đang giữ thấy, gửi lại thẻ bao nhiêu lần cũng được, khoá khi quá 48 giờ (`0003`), cần `cskhInbox.update`.
- Khách đã có SĐT hoặc hồ sơ thì nhãn và nút biến mất, không gửi thẻ.
- Tiêu đề và mô tả thẻ lấy từ `vi.json` (`ZaloInbox:InfoRequest:*`), luôn tiếng Việt. Ảnh thẻ: `Zalo:InfoRequestImageUrl` → ảnh đại diện OA → `logo.png`.
- Đồng bộ đọc lại `user/detail` cho hội thoại còn thiếu SĐT **hoặc** còn tên tạm "Zalo …xxxx", rồi thay tên tạm và điền ảnh đại diện còn thiếu. Tên thật đã có thì giữ.

**Tag:**

- Nhập tự do, có gợi ý các tag chi nhánh đã dùng.
- Mỗi hội thoại tối đa 10 tag, mỗi tag 30 ký tự (`0007`, `0008`). Trùng chữ hoa / thường thì giữ một.

**Mẫu ZNS:**

- Hàng chip hiện 3 mẫu Zalo "Sẵn sàng" mới nhất của chi nhánh. "Xem thêm" mở dialog tìm và chọn mẫu.
- Chọn mẫu thì hiện thẻ xem trước dưới khung chat: từng tham số ZNS với giá trị của khách. SĐT và tiền bị che theo quyền người xem.
- Chọn mẫu khác thì thẻ cũ được **thay**.
- "Gửi ZNS" tới SĐT của hồ sơ liên kết (`0012` nếu chưa có). Mỗi lần gửi được ghi vào `MessageLog` (đếm trong Thống kê CSKH), và bong bóng ZNS hiện trong chat.

### Ghi chú (dùng chung chat ↔ hồ sơ)

- `CareNote` gắn với hội thoại, hồ sơ, hoặc cả hai:
  - ghi trong chat của hội thoại đã liên kết thì ghi chú mang cả hồ sơ;
  - ghi ở hồ sơ thì gắn thêm vào hội thoại mới nhất của hồ sơ.
- **Tạo:** ghi người viết và giờ. **Sửa:** ghi người sửa, giờ, và nội dung trước khi sửa. **Xoá:** gạch ngang, vẫn hiện, kèm "Đã xoá bởi …".
- "Lịch sử ghi chú" hiện mọi bước.
- Ai có quyền xử lý cũng sửa / xoá được ghi chú của người khác. Đã xoá thì không sửa được nữa (`0011`).
- Quyền sửa / xoá: `cskhInbox.update` **hoặc** `treatmentCskh.update`.

### Tab Chăm sóc KH của hồ sơ (`/patient/:id?tab=care`)

- **Toolbar:**
  - **Mở chat Zalo** (cần `cskhInbox.read`): mở thẳng hội thoại của khách. Khoá kèm tooltip nếu khách chưa nhắn OA.
  - **Gửi tin** (cần `cskhSend.read`): mở Gửi tin nhắn với `channel=sms&patientId=`. Khách bị khoá, kênh vẫn đổi được.
  - Hai nút này đứng trước "CSKH đặc biệt".
- **Dưới bảng CSKH**, khối "Lịch sử chăm sóc khách hàng". Tab bỏ `pd-pane--fill` nên cuộn như một trang.
  - **Bộ chọn khoảng ngày:** mặc định "Tất cả thời gian", áp cho dòng thời gian.
  - **Ghi nhận chăm sóc** (cần `treatmentCskh.create`):
    - ô nhập;
    - "Kết quả cuộc gọi: Đã liên hệ / Không nghe máy", là tag cố định;
    - "Lưu ghi chú". Chỉ chọn tag mà không nhập chữ thì ghi chú lấy chữ của tag.
  - **Dòng thời gian, mới nhất trên cùng.** Chip Tất cả / Chat Zalo / ZNS / SMS / Gọi điện / Ghi chú. Gồm:
    - chat Zalo;
    - ZNS / SMS / email (Thành công / Đã nhận / Thất bại);
    - cuộc gọi khớp SĐT hồ sơ (Nghe máy / Gọi nhỡ / Máy bận);
    - ghi chú, sửa / xoá được ngay trên dòng;
    - thay đổi trạng thái việc CSKH (`CareContactLog`).
  - **Trạng thái chăm sóc:**
    - Đã liên hệ nếu trong 90 ngày có tin CSKH gửi thành công (ZNS / SMS / email hoặc trả lời chat), ngược lại Chưa liên hệ;
    - Ngày chăm sóc gần nhất;
    - Hội thoại Zalo (Chưa trả lời / Đã chăm sóc).
  - **Tóm tắt chi phí năm {năm}:** Tin ZNS thành công / lỗi, Tin SMS đã gửi, Tin nhắn chat Zalo, Cuộc gọi, Chi phí tin.

### BE

- **Domain:**
  - `ZaloConversation` (`bd_zalo_conversations`, unique `(ClinicBranchId, ZaloUserId)`);
  - `ZaloChatMessage` (`bd_zalo_chat_messages`, unique `(ClinicBranchId, ZaloMessageId)`);
  - `CareNote` + `CareNoteRevision` (`bd_care_notes`, `bd_care_note_revisions`).
- **Zalo:** `IZaloApiClient` có thêm `SendTextMessageAsync`, `GetConversationAsync`, `GetRecentChatsAsync`, `GetUserDetailAsync`.
- **Webhook:** `ZaloWebhookHandler` chuyển sự kiện chat cho `ZaloChatWebhookProcessor`. Mỗi sự kiện chạy trong một UoW riêng; lỗi chỉ ghi log, không trả lỗi cho Zalo. Log ứng dụng chỉ có tên sự kiện, không có nội dung tin.
- **Ứng dụng:**
  - `ZaloInboxIngestor`: một đường ghi duy nhất cho webhook, sync và trả lời;
  - `ZaloInboxSync`, `ZaloInboxReader`, `ZaloInboxAssignees`;
  - `ZaloInboxAppService`, `ZaloInboxZnsAppService`, `CareNoteAppService` (+ `CareNoteReader`), `PatientCareHistoryAppService`.
- **API:**

| Prefix | Endpoint | Quyền |
|---|---|---|
| `api/v1/app/zalo-inbox` | `conversations`, `counts`, `conversations/{id}`, `/messages`, `sync`, `conversations/{id}/sync`, `assignees`, `tags`, `patients`, `zns-templates`, `conversations/{id}/zns/preview` | `cskhInbox.read` |
| | `claim`, `release`, `transfer`, `POST messages`, `PUT tags`, `PUT patient`, `POST zns` | `cskhInbox.update` |
| `api/v1/app` | `zalo-inbox/conversations/{id}/notes` | read / update |
| | `patients/{id}/care-notes` | `treatmentCskh.read` / `create` |
| | `care-notes/{id}` (PUT / DELETE) | `cskhInbox.update` hoặc `treatmentCskh.update` |
| | `patients/{id}/care-history`, `/overview` | `treatmentCskh.read` |

- **Phạm vi chi nhánh:**
  - mọi endpoint lấy chi nhánh từ `X-Clinic-Branch-Id` và kiểm qua `BranchAccessChecker`;
  - id của chi nhánh khác trả **404**, không phải 403.
- **Quyền:**
  - subject `cskhInbox` (Xem / Xử lý hội thoại), nằm trong cây Phân quyền dưới CSKH;
  - seeder cấp cho role tĩnh, role tuỳ chỉnh phải cấp tay.
- **Mã lỗi:** `BlueDental:ZaloInbox:0001..0013`.
- **Migration:**
  - `20261023023050_ZaloInbox` chỉ tạo 4 bảng. Staging cần chạy DbMigrator, sau đó xoá cache quyền Redis.
  - `20261024112502_ZaloInfoRequest` (R-1028) thêm cột nullable `InfoRequestedAt` vào `bd_zalo_conversations`.
  - `20261025090000_ZaloAutomaticMessageNoAnswer` (R-1029, chỉ dữ liệu): tính lại `LastReplyAt` + trạng thái của mọi hội thoại từ tin chat, bỏ thẻ (Kind 8) và tin OA tự gửi (Kind 9).
  - `20261025100000_ZaloInboxZnsStillAnswers` (R-1029, chỉ dữ liệu): bản trên quên ZNS gửi từ Hộp thư (nằm ở `bd_message_logs`). Bản này trả lại câu trả lời đó; nó chỉ dời `LastReplyAt` về sau, không đưa hội thoại nào về "Chưa trả lời".

### FE

- **api:** `api/inboxApi.ts`, `api/careNoteApi.ts`, `api/careHistoryApi.ts`.
- **component:**
  - `components/inbox/*` (CSS `cskh-inbox.css`, tiền tố `ibx-`);
  - `components/notes/*` (`cskh-notes.css`, `cn-`), dùng chung chat và hồ sơ;
  - `components/history/*` (`cskh-history.css`, `ch-`).
- **hook:** `useHoldActions`, `useHistorySync`.
- **logic thuần:** `inboxLook.ts`.

### Nghe chuông tin nhắn Zalo (R-1194, 2026-11-10)

- **Quyền:** `BlueDental.cskhInbox.notify` — "Nghe chuông tin nhắn Zalo", một lá trong nhóm Hộp thư Zalo. Không role nào có sẵn; chủ dự án tick cho "Phòng tiếp nhận". Admin vẫn có quyền nên vẫn kêu.
- **BE:** `GET /api/v1/app/zalo-inbox/pulse` (`ZaloInboxPulseAppService`).
  - Cần `cskhInbox.notify` và kiểm chi nhánh.
  - Trả `{ lastCustomerMessageAt }`: giờ tin khách mới nhất của chi nhánh. Không có nội dung tin, tên hay SĐT.
  - Tin OA / nhân viên gửi không đổi giá trị này.
- **FE:** `hooks/useZaloMessageChime.ts` + `components/ZaloMessageChime.tsx`, gắn trong `AppLayout` nên kêu ở mọi màn hình.
  - Hỏi mỗi 10 giây, kể cả khi tab ở nền.
  - Lần đầu sau khi tải trang hoặc đổi chi nhánh chỉ ghi mốc.
  - Giờ mới hơn thì phát `public/sounds/tinnhan.mp3` 1 lần, dù trong lượt hỏi đó có nhiều tin.
  - Chọn "Tất cả chi nhánh" thì không hỏi.
  - Nhiều tab cùng trình duyệt chỉ kêu 1 lần (`navigator.locks` + localStorage `bd:zalo-message-chime:<branchId>`).
  - Âm thanh qua `lib/chime.ts` `playMessageChime`, dùng chung trạng thái mở khoá với chuông "Bác sĩ mời lên".
- **Hạn chế:** trình duyệt chặn autoplay khi trang chưa được bấm lần nào. Lần kêu bị chặn thì mất. Chỉ tài khoản có Tiếp nhận "Sửa" thấy chuông tắt nhấp nháy ở dock (R-1145).

## Kiểm thử

| Mức | Kết quả |
|---|---|
| Domain.Tests | **1085/1085** (gồm `ZaloConversationTests` 14, `CareNoteTests` 7, `ZaloChatKindsTests` 20) |
| Application.Tests | **816/816** (gồm `ZaloInboxAppServiceContractTests`) |
| HttpApi.Host.Tests | **24/24** |
| E2E `zalo-inbox` | **5/5** |
| Hồi quy mức 3 | xem R-1021 trong `03-regression-log.md` |
| R-1026 (2026-10-24) | Domain **1107/1107** (`ZaloConversationTests` 18); E2E `zalo-inbox` **10/10**; mức 3 37/41, 4 đỏ y hệt trên HEAD. Xem R-1026. |
| R-1028 (2026-10-24) | Domain **1107/1107**; Application (`Zalo`) **45/45**; E2E `zalo-inbox` **12/12**, 3 ca R-1028 đỏ trên HEAD `3667a12b`; mức 3 28/31, 3 đỏ có sẵn. Xem R-1028. |
| R-1029 (2026-10-25) | Domain **1107/1107**; Application (`Zalo`) **45/45**; E2E `zalo-inbox` **13/13**, ca mới đỏ trên `3c0637b1`; 2 migration chạy thử trên DB thật (có rollback). Xem R-1029. |
| R-1030 (2026-10-25) | E2E `zalo-inbox` **15/15** (ca 11, 12 mới + kiểm tra quyền trong ca 5); mức 3, 17 spec lịch hẹn: **61/62**, 1 đỏ có sẵn `labo-orders-actions:88`; `tsc -b`, `oxlint` sạch. Xem R-1030. |

**Đường chạy E2E:**

- build production `vite preview` 127.0.0.1:8131;
- host :5000;
- PostgreSQL `BlueDental`;
- không chặn request nào.

Zalo là stub local `e2e/fixtures/zalo-stub.mjs` (:5199). **Không bao giờ gọi Zalo thật.** Host chạy với các biến:

```
Zalo__AppId=e2e-app  Zalo__AppSecret=e2e-app-secret  Zalo__OaId=stub-oa
Zalo__WebhookSecret=e2e-webhook-secret
Zalo__OAuthBaseUrl / OpenApiBaseUrl / BusinessApiBaseUrl = http://127.0.0.1:5199
```

Spec ký webhook giống Zalo: `mac = sha256(appId + body + timestamp + secret)`. Stub phục vụ `message/cs`, `conversation`, `listrecentchat`, `user/detail` từ dữ liệu spec nạp vào `/__users` và `/__history`.

```
E2E_BASE_URL=http://127.0.0.1:8131 E2E_ZALO_STUB=1 \
  npx playwright test e2e/zalo-inbox.spec.ts --workers=1
```

**Các ca E2E:**

1. **Webhook đến tới tải lại:**
   - webhook có chữ ký → Chưa trả lời;
   - Nhận xử lý → "Còn 48 giờ";
   - trả lời → stub nhận đúng `user_id` và text → Đã chăm sóc;
   - tag tự do;
   - ghi chú tạo → sửa (lịch sử có "Trước: …") → xoá (gạch ngang, "Đã xoá bởi");
   - tải lại vẫn còn;
   - Nhả hội thoại;
   - khách nhắn lại → Chưa trả lời.
2. **Đồng bộ và ZNS:**
   - đồng bộ 12 tin lịch sử: mở thấy 10 tin, "Tải tin cũ hơn" thấy đủ 12;
   - SĐT khách chia sẻ liên kết đúng hồ sơ;
   - chip mẫu → thẻ xem trước có tên khách;
   - "Xem thêm" chọn mẫu khác → thẻ cũ bị thay (chỉ còn 1 thẻ);
   - Gửi ZNS → stub nhận `template_id` + `template_data` → bong bóng ZNS.
3. **Giữ và chuyển:**
   - đồng nghiệp thấy "đang giữ", không có nút Nhận xử lý, API trả 403 `ZaloInbox:0001`;
   - Chuyển cho → đồng nghiệp trả lời được ("Gửi bởi {tên}");
   - khách nhắn 3 ngày trước → ô trả lời khoá, API trả `0003`.
3b. **Tải lại giữ chip và dòng đang mở (R-1025):**
   - chọn chip Đã trả lời, mở hội thoại → URL có `box=cared`;
   - tải lại → chip Đã trả lời vẫn được chọn, dòng có `aria-current`, chat vẫn mở;
   - link chỉ có `conversation` → chip Tất cả, dòng được chọn và nằm trong vùng nhìn thấy.
4. **Tab Chăm sóc KH:**
   - lịch sử có tin chat và ghi chú viết từ chat; Chưa liên hệ;
   - Ghi nhận chăm sóc chỉ chọn "Không nghe máy" → ghi chú có tag, và hiện trong chat;
   - chip lọc Chat Zalo / Ghi chú;
   - Mở chat Zalo mở đúng hội thoại;
   - trả lời → Đã liên hệ + Đã chăm sóc, có "Trả lời Zalo", có tóm tắt năm;
   - Gửi tin → màn Gửi tin nhắn, SMS, khách bị khoá.
5. **Quyền và chi nhánh:**
   - chỉ `cskhInbox.read`: không có Nhận xử lý / mẫu ZNS / Thêm ghi chú; API claim và ghi chú trả 403;
   - "Ẩn số điện thoại": ZNS có `{so_dien_thoai}` hiện số đã che trong `/messages` và `/care-history` (admin vẫn thấy đủ số);
   - chi nhánh khác: `GET` trả 404, danh sách không có hội thoại.
6. **Khách gửi thông tin (`user_submit_info`, R-1026):**
   - khách nhắn trước, chưa nối; gửi thông tin không có SĐT thì vẫn chưa nối;
   - gửi SĐT dạng `84…` → nối đúng hồ sơ, cột phải có `[mã] tên`, tải lại vẫn còn;
   - gửi SĐT chưa có hồ sơ → chưa nối; tạo hồ sơ với số đó, khách nhắn lại → nối;
   - 2 hồ sơ cùng số (`09…` và `84…`) → không nối;
   - hồ sơ chọn tay, khách gửi SĐT của hồ sơ khác rồi nhắn tiếp → vẫn hồ sơ chọn tay.
7. **Đồng bộ hỏi lại SĐT (R-1026):**
   - hội thoại chưa nối, Zalo chưa có SĐT; sau đó stub trả `shared_info.phone`;
   - Đồng bộ → đúng 1 lần gọi `user/detail` cho user đó → dòng mang tên hồ sơ, cột phải có `[mã] tên`;
   - Đồng bộ lần nữa → 0 lần gọi `user/detail` (đã nối thì không hỏi); tải lại vẫn nối.
8. **Khách lạ đến nhận thẻ xin SĐT (R-1028):**
   - user stub không biết nhắn tin → đúng 1 thẻ (`request_user_info`, đúng tiêu đề / mô tả); nhắn tiếp → không thêm thẻ;
   - echo `oa_send_template` của thẻ (msg_id lạ) → lưu là thẻ, hội thoại vẫn "Chưa trả lời", `infoRequestedAt` có giá trị;
   - UI: dòng có "Chưa trả lời" + "Chưa có SĐT"; đầu khung chat có nhãn và "Đã gửi thẻ xin SĐT lúc"; bong bóng thẻ có nhãn "Thẻ xin số điện thoại";
   - Đồng bộ sau khi stub biết tên → dòng mang tên thật, không còn dòng tên tạm;
   - `follow` → 1 thẻ, nhắn sau đó → không thêm; `user_click_chatnow` → 1 thẻ;
   - khách stub đã có SĐT → 0 thẻ, không có nhãn;
   - user `999…` (Zalo từ chối) → 1 lần gọi, `infoRequestedAt` vẫn rỗng; tin sau → gọi lần 2.
9. **Nút Xin SĐT (R-1028):**
   - chưa Nhận xử lý thì không có nút;
   - giữ rồi bấm → toast "Đã gửi thẻ xin số điện thoại", stub nhận đúng 1 thẻ, thêm bong bóng, trạng thái vẫn "Chưa trả lời", tải lại vẫn vậy;
   - khách chia sẻ SĐT (`user_submit_info`) → tải lại: mất nhãn ở dòng và đầu khung chat, mất nút;
   - khách nhắn cách đây 72 giờ → nút khoá, API trả `BlueDental:ZaloInbox:0003`;
   - chỉ `cskhInbox.read` → API `request-info` trả 403 (ca "Quyền và chi nhánh").
10. **Tin OA tự gửi không tính là trả lời (R-1029):**
    - khách nhắn "Hi", 1 giây sau webhook `oa_send_template` (thẻ chào mừng), rồi thẻ xin SĐT → hội thoại vẫn "Chưa trả lời";
    - Đồng bộ mang về thẻ chào mừng không chữ và một tin template có chữ → vẫn "Chưa trả lời", nằm ở chip Chưa trả lời;
    - nhân viên Nhận xử lý rồi trả lời → tải lại: rời chip Chưa trả lời, sang Đã trả lời với "Đã chăm sóc".
11. **Tạo hồ sơ (R-1030):**
    - khách có SĐT `84…`, chưa có hồ sơ → bấm Tạo hồ sơ: ô Họ và tên = tên Zalo, Điện thoại = `0…`;
    - đổi tên rồi Lưu → `PUT …/patient` 200, hồ sơ lưu đúng tên + SĐT; khung phải có `[mã] tên`, SĐT, mục Lịch hẹn; dòng bên trái mang tên hồ sơ;
    - đã nối: mất nút Tạo hồ sơ, còn Tạo lịch hẹn; tải lại vẫn nối;
    - Đổi hồ sơ → Tạo hồ sơ hiện lại; Huỷ → ẩn.
12. **Tạo lịch hẹn (R-1030):**
    - DB E2E không có bác sĩ demo: spec tự tạo một nha sĩ cho lượt chạy (`createRunStaff`) và xoá cả nha sĩ lẫn lịch hẹn của nó ở `finally`;
    - chưa nối → chọn bệnh nhân có sẵn theo mã, chọn giờ, chọn nha sĩ → Lưu: `POST` lịch hẹn + `PUT …/patient` 200; khung phải có `[mã] tên` và "Sắp tới" đúng giờ đã đặt;
    - đã nối → ô bệnh nhân khoá; đặt lịch sớm hơn → "Sắp tới" đổi ngay, không có `PUT …/patient`;
    - tải lại vẫn còn.
13. **Quyền** (thêm vào ca 5): user chỉ `cskhInbox.read`, không `patient.create` / `appointment.create` → không thấy nút nào.

### Lưu ý khi viết spec

- `toContainText` trên `.ibx-chat` khớp cả chữ còn trong ô trả lời. Phải chờ **bong bóng** (`.ibx-bubble-text`), nếu không test sẽ đi tiếp khi tin chưa lưu.
- Stub giữ `/__calls`, `/__users`, `/__history` suốt đời tiến trình. Spec phải dùng user id mới mỗi lần chạy và đếm phần chênh.
- `zalo-oa` cần BD-001 **không** có kết nối. Spec này tự nối rồi tự gỡ nếu đầu test chưa có.
- Hai hồ sơ cùng số (R-1026): khi tạo hồ sơ, kiểm tra trùng SĐT chỉ so đúng chuỗi, và `+84` được đổi về `0` còn `84…` thì giữ nguyên. Vì vậy hồ sơ thứ hai được lưu số dạng `84…`. Đếm `user/detail` theo user id, chỉ tính phần chênh từ mốc trước khi Đồng bộ.

- Nghe chuông (R-1194): `e2e/zalo-message-chime.spec.ts` **2/2** (cần `E2E_ZALO_STUB=1`). Spec đếm số lần kêu bằng init script bọc `HTMLMediaElement.play`: lần phát volume 0 là phép thử autoplay, không tính. `page.goto` chạy lại init script nên số đếm về 0. Webhook ký + nối/gỡ stub OA nằm ở `e2e/fixtures/zaloWebhook.ts`.

## Còn treo

- Các điểm tự chọn hoặc khác mock: xem `docs/clone/unknowns.md` (F-80).
- Nghe chuông (R-1194): lần kêu bị trình duyệt chặn (chưa bấm vào trang) không được phát bù.
- Tin OA tự gửi (R-1029): chỉ nhận ra được khi Zalo trả dạng template / list… Tin tự động là **chữ thường** (ví dụ tin trả lời tự động cài trong OA Manager) thì không phân biệt được với nhân viên trả lời trên OA Manager, nên vẫn tính là trả lời.
- Hội thoại khách chỉ quan tâm OA / bấm Nhắn tin mà chưa nhắn chữ nào hiện "Đã chăm sóc" (chưa có tin khách nào để chờ trả lời). Chưa hỏi chủ dự án có muốn để "Chưa trả lời" không.
- Chưa kiểm được với OA thật:
  - `recipient.id` trong webhook ZNS đã nhận có phải user_id không;
  - echo `oa_send_text` có cùng `message_id` với kết quả gửi tin tư vấn không;
  - trong API hội thoại, `src` = 0 có phải tin do OA gửi không;
  - API hội thoại có trả chữ (`message`) cho tin OA loại template / list… không. Thực tế (2026-10-23): thẻ chào mừng của OA về không có `message` / `url` / `thumb`, nên hiện "[Tin tự động của OA]" (R-1023). Host ghi log tên trường (không ghi giá trị) để lần sau dựng được thẻ.
- Tự nối theo SĐT (R-1026), chưa kiểm được với OA thật:
  - payload `user_submit_info` đọc theo dạng `sender.id` / `recipient.id` / `info.phone`; sai dạng thì host log tên field (`Zalo user_submit_info came without a user, an OA or a phone; fields: …`);
  - phải bật sự kiện "Người dùng gửi thông tin" trong cấu hình Webhook của app Zalo thì nhánh webhook mới chạy;
  - OA Đức Hạnh có được đọc `shared_info.phone` qua `user/detail` không. Nếu không được thì chỉ còn nhánh webhook.
- Thẻ xin SĐT (R-1028), chưa kiểm được với OA thật:
  - Zalo có nhận thẻ ngay sau `follow` / `user_click_chatnow` khi khách chưa nhắn chữ nào không (thẻ là tin tư vấn, cần khách "tương tác" trong 48 giờ). Nếu Zalo từ chối, lượt được trả lại và thẻ đi khi khách nhắn tin đầu;
  - payload `follow` (`follower.id`, `oa_id`) và `user_click_chatnow` (`user_id`, `oa_id`) đọc theo tài liệu Zalo; sai dạng thì host log tên field;
  - echo `oa_send_template` mang template ở `message.payload` hay `attachments[].payload` (đọc cả hai);
  - API lịch sử chat trả thẻ với `message_id` / `type` nào. Nếu gửi xong mà lưu lỗi, Đồng bộ sẽ đọc thẻ thành một câu trả lời thường (hiếm);
  - phải tích `follow` và `user_click_chatnow` trong cấu hình Webhook của app Zalo.
- Khớp ≥ 2 hồ sơ: chưa gợi ý, chờ task sau (chủ dự án).
- Chưa có SignalR cho hộp thư, đang tự lấy lại theo chu kỳ 5 / 10 giây.
- Không làm phần Chiến dịch CSKH của P2210.

## Retest khi sửa

Xem `02-impact-map.md`: `ZaloInbox*`, `CareNote*`, `PatientCareHistoryAppService`, `ZaloWebhookHandler`, `IZaloApiClient` / `HttpZaloApiClient`, `features/cskh/components/{inbox,notes,history}/*`, `PatientCareTab`.
