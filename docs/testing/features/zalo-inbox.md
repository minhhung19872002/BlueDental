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

- Chưa trả lời: tin cuối của khách chưa có tin OA nào sau nó.
- Đã chăm sóc: OA đã trả lời sau tin cuối của khách.
- Một hội thoại do OA mở trước (ví dụ ZNS) thì là Đã chăm sóc.

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
- Khớp 0 hồ sơ hoặc ≥ 2 hồ sơ thì không nối và không gợi ý. Danh sách gợi ý, nút Tạo hồ sơ / Đặt lịch hẹn và khớp theo SĐT người giám hộ thuộc task khác.
- Khi Zalo báo ZNS đã tới (`user_received_message`), user Zalo trong báo đó được liên kết với hồ sơ đã nhận ZNS.
- Còn lại thì nhân viên chọn tay.
- Liên kết đã có (chọn tay, từ ZNS, hoặc tự nối trước đó) **không bao giờ bị đè**. Gỡ liên kết bằng API (`PUT …/patient` với `null`; FE không có nút) thì tin nhắn sau của khách sẽ nối lại nếu SĐT vẫn khớp đúng 1 hồ sơ.

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
- **Migration:** `20261023023050_ZaloInbox` chỉ tạo 4 bảng. Staging cần chạy DbMigrator, sau đó xoá cache quyền Redis.

### FE

- **api:** `api/inboxApi.ts`, `api/careNoteApi.ts`, `api/careHistoryApi.ts`.
- **component:**
  - `components/inbox/*` (CSS `cskh-inbox.css`, tiền tố `ibx-`);
  - `components/notes/*` (`cskh-notes.css`, `cn-`), dùng chung chat và hồ sơ;
  - `components/history/*` (`cskh-history.css`, `ch-`).
- **hook:** `useHoldActions`, `useHistorySync`.
- **logic thuần:** `inboxLook.ts`.

## Kiểm thử

| Mức | Kết quả |
|---|---|
| Domain.Tests | **1085/1085** (gồm `ZaloConversationTests` 14, `CareNoteTests` 7, `ZaloChatKindsTests` 20) |
| Application.Tests | **816/816** (gồm `ZaloInboxAppServiceContractTests`) |
| HttpApi.Host.Tests | **24/24** |
| E2E `zalo-inbox` | **5/5** |
| Hồi quy mức 3 | xem R-1021 trong `03-regression-log.md` |
| R-1026 (2026-10-24) | Domain **1107/1107** (`ZaloConversationTests` 18); E2E `zalo-inbox` **10/10**; mức 3 37/41, 4 đỏ y hệt trên HEAD. Xem R-1026. |

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

### Lưu ý khi viết spec

- `toContainText` trên `.ibx-chat` khớp cả chữ còn trong ô trả lời. Phải chờ **bong bóng** (`.ibx-bubble-text`), nếu không test sẽ đi tiếp khi tin chưa lưu.
- Stub giữ `/__calls`, `/__users`, `/__history` suốt đời tiến trình. Spec phải dùng user id mới mỗi lần chạy và đếm phần chênh.
- `zalo-oa` cần BD-001 **không** có kết nối. Spec này tự nối rồi tự gỡ nếu đầu test chưa có.
- Hai hồ sơ cùng số (R-1026): khi tạo hồ sơ, kiểm tra trùng SĐT chỉ so đúng chuỗi, và `+84` được đổi về `0` còn `84…` thì giữ nguyên. Vì vậy hồ sơ thứ hai được lưu số dạng `84…`. Đếm `user/detail` theo user id, chỉ tính phần chênh từ mốc trước khi Đồng bộ.

## Còn treo

- Các điểm tự chọn hoặc khác mock: xem `docs/clone/unknowns.md` (F-80).
- Chưa kiểm được với OA thật:
  - `recipient.id` trong webhook ZNS đã nhận có phải user_id không;
  - echo `oa_send_text` có cùng `message_id` với kết quả gửi tin tư vấn không;
  - trong API hội thoại, `src` = 0 có phải tin do OA gửi không;
  - API hội thoại có trả chữ (`message`) cho tin OA loại template / list… không. Thực tế (2026-10-23): thẻ chào mừng của OA về không có `message` / `url` / `thumb`, nên hiện "[Tin tự động của OA]" (R-1023). Host ghi log tên trường (không ghi giá trị) để lần sau dựng được thẻ.
- Tự nối theo SĐT (R-1026), chưa kiểm được với OA thật:
  - payload `user_submit_info` đọc theo dạng `sender.id` / `recipient.id` / `info.phone`; sai dạng thì host log tên field (`Zalo user_submit_info came without a user, an OA or a phone; fields: …`);
  - phải bật sự kiện "Người dùng gửi thông tin" trong cấu hình Webhook của app Zalo thì nhánh webhook mới chạy;
  - OA Đức Hạnh có được đọc `shared_info.phone` qua `user/detail` không. Nếu không được thì chỉ còn nhánh webhook.
- Khớp ≥ 2 hồ sơ: chưa gợi ý, chờ task sau (chủ dự án).
- Chưa có SignalR cho hộp thư, đang tự lấy lại theo chu kỳ 5 / 10 giây.
- Không làm phần Chiến dịch CSKH của P2210.

## Retest khi sửa

Xem `02-impact-map.md`: `ZaloInbox*`, `CareNote*`, `PatientCareHistoryAppService`, `ZaloWebhookHandler`, `IZaloApiClient` / `HttpZaloApiClient`, `features/cskh/components/{inbox,notes,history}/*`, `PatientCareTab`.
