# F-77 — CSKH › Gửi tin nhắn (BA P2110, đợt 2)

Nguồn:

- `P2110.drawio` của BA (luồng gửi, các nút trên dòng CSKH);
- mock HTML `3 · Gửi tin nhắn` (`Send.dc.html`). Chủ dự án yêu cầu ưu tiên đúng bố cục này.

Đợt 1 là F-76 (`cskh-message-template.md`); 12 quyết định của chủ dự án ghi ở đó.
BlueDental riêng, bản gốc không có màn này. Regression id R-1009.

Status: xem `01-feature-verification-registry.md` dòng F-77.

## Quyết định áp dụng ở đợt này

| # | Quyết định | Cách làm |
|---|---|---|
| 1 | Chỉ Zalo gửi thật | SMS / Email chọn được, nhưng thẻ kiểm tra báo "Kênh … chưa kết nối gửi" và nút gửi bị khoá. Server từ chối bằng `Tools:0018` |
| 3 | Thiếu biến thì bỏ qua khách | Khách đó đứng trong bảng với nhãn "Thiếu …" và được kể tên ở "Kiểm tra trước khi gửi" |
| 4 | Xóa chỉ bỏ khách khỏi lần gửi này | Không xoá dòng CSKH; có "Hoàn tác" |
| 5 | Màn Gửi thay dialog Lưu tin nhắn / Gửi ZBS | Xoá `SaveMessageDialog`, `SendZaloDialog`, `messageApi.ts` |
| 7 | Không có Tệp tải lên | Chỉ có Danh sách CSKH và Khách lẻ |
| 8 | Không có thẻ Đã xem / phản hồi | Thống kê chỉ có chưa nhận / đã nhận / không có SĐT |
| 10 | Hẹn giờ gửi + Gửi thử tới tôi | Gửi thử đi tới `IdentityUser.PhoneNumber` của người bấm |

## Đã dựng

### Luồng

1. **Kênh**: SMS / Zalo / Email. Mỗi lần gửi chỉ một kênh.
2. **Mẫu**: lọc theo kênh, mẫu Sẵn sàng lên đầu. Chưa có mẫu thì có link "Tạo mẫu mới" và "Danh sách mẫu".
3. **Gửi tới**:
   - **Danh sách CSKH**: 1 trong 10 tab CSKH (chip có số đếm), đọc theo khoảng ngày (Ngày / Tuần / Tháng + chọn ngày).
   - **Khách lẻ**: chọn từng khách qua ô tìm; tick để gửi.
   - Bảng khách: tìm theo tên / mã / SĐT (không dấu), nhãn trạng thái từng dòng, nút Xóa.
   - Thống kê: "N chưa nhận", "N đã nhận", "N không có SĐT" (Email: "không có email").
   - Ô "Bỏ qua khách đã nhận mẫu này trong 30 ngày", **mặc định bật**. Tắt thì khách đã nhận vẫn được gửi lại, và có dòng nhắc "Đang tắt…".
4. **Cột phải**:
   - Kiểm tra trước khi gửi;
   - Xem trước với khách đầu tiên sẽ nhận;
   - Tóm tắt: kênh · mẫu, danh sách · khoảng ngày, số tin, chi phí (giá ZNS × số tin; Zalo không báo giá thì "Chưa rõ");
   - Hẹn giờ gửi;
   - nút "Gửi N tin Zalo" / "Hẹn gửi N tin Zalo" và "Gửi thử tới tôi";
   - danh sách lượt hẹn giờ đang chờ, có "Huỷ hẹn".
5. Bấm gửi thì hỏi "Xác nhận gửi tin" → "Có".

Khi còn thiếu điều kiện, nút gửi đọc điều đang thiếu thay cho "Gửi N tin": chưa chọn mẫu → kênh chưa kết nối → chưa tick khách → không có khách để gửi → giờ hẹn đã qua.

### Lối vào

| Từ | Mở Gửi tin nhắn với |
|---|---|
| Nút "Gửi tin nhắn chăm sóc" trên thanh công cụ của 10 tab CSKH | Zalo, Danh sách CSKH = tab đang xem, cùng khoảng ngày |
| Nút Gửi SMS / Gửi Zalo trên một dòng CSKH | Kênh đó, Khách lẻ **khoá** vào khách này ("Gửi riêng cho khách đã chọn từ danh sách chăm sóc") |
| Nút Gửi SMS trên dòng Phân nhóm CSKH | SMS, Khách lẻ khoá vào khách này |
| "Dùng mẫu này để gửi" ở thẻ xem trước của tab Template tin nhắn | Kênh và mẫu đó |

Dòng khách "Lịch tạm" (chưa có hồ sơ) không có nút Gửi SMS / Gửi Zalo.

URL: `/cskh-grouping/send?channel=&templateId=&page=&care_dateMode=&care_date=&patientId=` (`sendPath`).

### BE

- **`MessageSendBatch`** (bảng `bd_message_send_batches`): một lần bấm Gửi.
  - Gồm: kênh, mẫu (giữ tên lúc gửi), nguồn (CareList / Individual), tab CSKH + khoảng ngày, ô 30 ngày, giờ hẹn, số khách sẽ nhận, số khách bị bỏ qua.
  - Trạng thái: Chờ 0 · Đang gửi 1 · Xong 2 · Đã huỷ 3. Chỉ huỷ được lượt còn Chờ (`Tools:0023`).
- **`MessageLog`** thêm `SendBatchId` và `CareRecordId`. Mỗi khách là một log ở trạng thái Pending, ghi ngay khi tạo lượt.
- **`MessageRecipientBuilder`**: đọc lại khách ở server, không lấy theo bảng trên màn hình. Lý do bỏ qua:
  - không có liên hệ (SĐT Zalo không đổi được sang 84…);
  - đã nhận mẫu này trong 30 ngày, hoặc đang chờ trong một lô hẹn giờ (khi ô 30 ngày bật, R-1013);
  - thiếu biến hoặc tham số ZNS bắt buộc.

  Tối đa 5000 khách một lượt (`Tools:0025`).
- **`MessageSendJob`** (ABP background job `cskh.message-send`). Chỉ host chạy job; DbMigrator tắt job và worker (R-1012):
  - Hẹn giờ thì job được xếp với `delay`. Job chạy sớm thì tự xếp lại.
  - Mỗi tin được điền lại theo dữ liệu **lúc gửi**, kể cả SĐT (R-1019; hết số hợp lệ thì Thất bại `NoPhone`), gửi qua `ZaloOaGateway`, lưu riêng từng tin. Host dừng giữa chừng thì chạy lại sẽ chỉ gửi nốt phần chưa gửi.
  - Gửi được thì đánh dấu dòng CSKH đã gửi Zalo (`CareRecord.MarkZaloSent`).
  - Log ứng dụng chỉ có id, không có dữ liệu khách (PHI).
- **Gửi thử**: điền theo khách đang xem trước, gửi tới SĐT của tài khoản (`Tools:0022` nếu chưa có). Không tạo `MessageLog`, nên "Đã gửi" của mẫu không đổi; chỉ nhật ký gọi tích hợp ghi lại lần gọi.
- **Xem trước**: che SĐT khi người xem bị "Ẩn số điện thoại" và che `{so_tien_con_lai}` khi không có "Chi phí › Xem" (`MessageValueMasker`). Tin gửi đi không bị che.
- **Mã lỗi** `Tools:0018..0025`: kênh chưa kết nối, mẫu chưa sẵn sàng, không có khách, giờ hẹn đã qua, chưa có SĐT gửi thử, không huỷ được, chưa chọn danh sách, quá 5000 khách.

### API — `api/v1/app/message-sends`

| Method | Path | Quyền |
|---|---|---|
| GET | `/templates` (mẫu theo kênh + kênh nào đã kết nối) | cskhSend.read |
| GET | `/lists` (10 tab CSKH, đếm theo khoảng ngày) | read |
| POST | `/recipients` (POST vì danh sách khách lẻ có thể dài) | read |
| POST | `/preview` | read |
| GET | `/customers` (tìm khách lẻ) | read |
| POST | `/` (gửi ngay hoặc hẹn giờ) | create |
| GET | `/{id}`, `/` | read |
| POST | `/{id}/cancel` | create |
| POST | `/test` | create |

Chi nhánh lấy từ `X-Clinic-Branch-Id`. Mẫu của chi nhánh khác không được liệt kê và không dùng để gửi được.

### Quyền

- Subject `cskhSend` (Xem / Gửi), nằm dưới CSKH trong cây Phân quyền, sau "Template tin nhắn". Seeder cấp cho role tĩnh; role tuỳ chỉnh phải cấp tay.
- Route `/cskh-grouping/send` cần `read`.
  - Chỉ có Xem: thấy kiểm tra, xem trước, tóm tắt; **không** có nút gửi, Gửi thử, Hẹn giờ, Huỷ hẹn. Server trả 403 cho POST `/` và `/test`.
  - Không có Xem: dòng CSKH không có Gửi SMS / Gửi Zalo, thanh công cụ không có "Gửi tin nhắn chăm sóc", vào link trực tiếp thì gặp "Không có quyền truy cập".

### Migration

`20261022042924_MessageSendBatches`:

- tạo bảng `bd_message_send_batches` + index `(ClinicBranchId, Status, ScheduledAt)`;
- thêm cột `SendBatchId` và `CareRecordId` vào `bd_message_logs`;
- thêm index `(SendBatchId)` và `(ClinicBranchId, TemplateId, PatientId, SentAt)` (dùng cho kiểm tra 30 ngày).

Staging cần DbMigrator (migration + quyền mới), sau đó xoá cache quyền Redis.

### FE

- Trang `pages/MessageSendPage.tsx` → `components/send/SendScreen.tsx` (19 component trong `send/`), CSS `cskh-send.css` (tiền tố `.snd-`).
- Hooks:
  - `useSendParams`: URL ↔ kênh / mẫu / nguồn / tab / khoảng ngày;
  - `useSendTemplateChoice`;
  - `useSendRecipients`;
  - `useIndividualPicks`;
  - `useRecipientRemoval`: Xóa / Hoàn tác, xoá sạch khi đổi nguồn / tab / ngày;
  - `useSendSchedule`;
  - `useSendActions` + `useSendSubmit`;
  - `useDismissable`.
- Logic thuần: `sendRecipients.ts` (phân loại dòng, thống kê, tìm), `sendSummary.ts` (tóm tắt, lý do khoá nút).
- API: `api/sendApi.ts`.
- Bảng CSKH: `CareRowActions` đổi `onMessage` / `onSend` thành `onSms` / `onZalo`. `CareToolbar` có thêm vùng `actions` cho nút "Gửi tin nhắn chăm sóc".

## Kiểm thử

| Mức | Kết quả |
|---|---|
| Domain.Tests | **1028/1028** (gồm `MessageSendBatchTests` 10) |
| Application.Tests | **772/772** (gồm `MessageSendAppServiceContractTests` 6) |
| HttpApi.Host.Tests | **24/24** |
| E2E `cskh-message-send` | **6/6**; sau đợt sửa review R-1012..R-1019: **13/13** (toàn bộ `cskh*` 43/43) |
| Hồi quy mức 3 | **59/61**, 2 ca đỏ `role-permissions` có từ trước (R-936, R-994); chi tiết R-1009 trong `03-regression-log.md` |

Đường chạy E2E:

- build production `vite preview` 127.0.0.1:8130;
- host develop 127.0.0.1:5100;
- PostgreSQL `BlueDental_develop`;
- job gửi thật;
- không chặn request nào.

Zalo là stub local `e2e/fixtures/zalo-stub.mjs` (:5199). **Không bao giờ gọi Zalo thật.** Cả spec chỉ chạy khi có `E2E_ZALO_STUB=1`.

Các ca E2E:

1. **Khách lẻ**:
   - 2 khách, 1 khách thiếu Ngày hẹn / Giờ hẹn bị bỏ qua và được kể tên;
   - gửi 1 tin; lượt gửi về Xong với 1 tin đã gửi;
   - stub nhận đúng `template_id` và tham số;
   - tải lại: khách hiện "Đã nhận dd/mm/yyyy", nút đọc "Không có khách để gửi";
   - tắt ô 30 ngày: "Đang tắt…" và nút "Gửi 1 tin Zalo".
2. **Danh sách CSKH** từ tab Nhắc lịch hẹn:
   - URL mang tab và ngày, chip "Nhắc lịch hẹn" đã chọn;
   - Xóa (dialog BA) rồi Hoàn tác;
   - Hẹn giờ ngày mai → "Hẹn gửi N tin Zalo", lượt hẹn hiện trong danh sách chờ;
   - Huỷ hẹn → trạng thái Đã huỷ; stub không nhận tin nào.
3. **Gửi thử tới tôi**: tài khoản có SĐT → "Đã gửi thử tới …" và stub nhận 1 tin; tài khoản chưa có SĐT → toast lỗi.
4. **SMS + Dùng mẫu này để gửi**: SMS báo chưa kết nối; nút ở tab Template tin nhắn mở Gửi với kênh Zalo và đúng mẫu.
5. **Quyền**:
   - chỉ `cskhCare.read`: không có nút gửi trên bảng, link trực tiếp bị chặn, API 403;
   - chỉ `cskhSend.read`: không có nút gửi / gửi thử; POST `/` và `/test` trả 403.
6. **Chi nhánh**: mẫu được liệt kê theo chi nhánh; gửi mẫu của BD-001 từ chi nhánh khác không thành công.

Đợt sửa sau review (R-1013..R-1019, chi tiết trong `03-regression-log.md`):

7. **R-1013**: khách đã nằm trong một lô hẹn giờ ghi "Chờ gửi dd/mm/yyyy", không gửi lại được (cả qua API).
8. **R-1014**: nút "Gửi Zalo" trên dòng CSKH mang `careRecordId`; gửi xong dòng đó có `zaloSentAt`.
9. **R-1015**: "Lịch gửi đã hẹn" chỉ có lô hẹn giờ, và tự bỏ lô đã tới giờ mà không cần tải lại.
10. **R-1016**: Zalo từ chối làm mới token → lô hẹn giờ Xong với 1 thất bại "Zalo OA chưa kết nối", màn Gửi vẫn mở được.
11. **R-1017**: đổi danh sách CSKH thì nút Gửi khoá tới khi đọc xong danh sách mới.
12. **R-1018**: xem trước bị lỗi (thu quyền khi trang đang mở) thì báo "Không xem trước được: …".
13. **R-1019**: khách đổi số sau khi hẹn giờ → tin đi số mới; khách mất số → Thất bại "Khách không còn số điện thoại hợp lệ" (cả Thống kê và Excel).

R-1012 (DbMigrator không chạy job) được kiểm bằng tay vì e2e không dừng được host; xem log.

Lệnh chạy:

```
E2E_BASE_URL=http://127.0.0.1:8130 E2E_ZALO_STUB=1 \
  npx playwright test e2e/cskh-message-send.spec.ts --workers=1
```

### Lưu ý khi viết spec

- Stub có `POST /__config`: `{tokenLife}` đổi thời hạn token phát ra, `{refreshFails: true}` cho làm mới token trả -14014, `{reset: true}` trả về mặc định. Spec đổi cấu hình phải `reset` trong `finally`.
- Stub giữ mọi lần gọi (`/__calls`) suốt đời tiến trình, không reset giữa các spec. Spec phải so **phần chênh** (đếm trước / sau) hoặc lọc theo SĐT. `cskh-message-template` đã đổi sang đếm chênh trong R-1009.
- Nút AntD có icon mang tên icon ở đầu accessible name ("delete Xóa", "check-circle Có"): dùng regex `/Xóa$/`, `/Có$/`.
- Ô `type="search"` có role `searchbox`.

## Còn treo

- ~~Đợt 3 (F-78): Thống kê CSKH + PeriodRangePicker~~: xong (R-1011), xem `cskh-message-stats.md`.
- SMS / Email chưa có nhà cung cấp gửi; khi có thì thêm vào job gửi.
- Các điểm khác so với `Send.dc.html`: xem `docs/clone/unknowns.md` (F-77).

## Retest khi sửa

Xem `02-impact-map.md`: `MessageSend*`, `MessageRecipientBuilder`, `MessageSendJob`, `features/cskh/components/send/*`, `CareRowActions` / `careColumns`.
