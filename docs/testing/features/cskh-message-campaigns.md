# F-79 — CSKH › Chiến dịch đã gửi + Kết quả lần gửi (BA P2210, phần B)

Nguồn:

- `P2210.drawio` của BA, phần B: ảnh danh sách "Chiến dịch đã gửi" (tab mới cạnh
  "Phân nhóm CSKH", nút "+ Tạo chiến dịch", 2 trạng thái Đang gửi / Đã gửi, nút "Tạm dừng"
  và "Lịch sử") và ảnh "Kết quả lần gửi" (chips, 7 thẻ số, thanh kết quả, lý do, bảng từng khách).
- Ghi chú BA trên ảnh: "Thêm tab mới giúp anh", "On-click: mở màn hình gửi tin nhắn",
  "Có 2 trạng thái … Button Tạm dừng … Option 2: dừng gửi, tin đã gửi thì thôi, khách chưa gửi
  thì dừng luôn không gửi nữa", "On-click [Lịch sử]: mở trang lịch sử thống kê chiến dịch này".
- Trả lời của BA qua chủ dự án (2026-10-23): bỏ hẳn 2 cột "Chiến dịch" và "Tên chiến dịch";
  bỏ "Gọi điện"; cột Template đứng đầu.

Phần A, phần C và "Hộp thư Zalo" của P2210 không thuộc đợt này.
F-76 / F-77 / F-78 là các đợt trước của CSKH nhắn tin (`cskh-message-template.md`,
`cskh-message-send.md`, `cskh-message-stats.md`). BlueDental riêng, bản gốc không có màn này.
Regression id R-1020.

Status: xem `01-feature-verification-registry.md` dòng F-79.

## Quyết định của chủ dự án

| # | Câu hỏi | Quyết định |
|---|---|---|
| 1 | Một "chiến dịch" là gì | Mỗi lần bấm Gửi (gửi ngay hoặc hẹn giờ) là một dòng. Không có chiến dịch tự động lặp lại |
| 2 | Cột Chiến dịch / Tên chiến dịch | Bỏ cả hai (BA). Template là cột đầu (BA, sau cùng) |
| 3 | Trạng thái | Đang gửi = chờ (cả hẹn giờ) hoặc đang gửi; Đã gửi = xong; Đã dừng = tạm dừng hoặc huỷ hẹn |
| 4 | Tạm dừng | Option 2 của BA: tin đã đi giữ nguyên, phần còn lại không bao giờ đi, không có "gửi tiếp". Có hộp xác nhận. Lần hẹn giờ chưa chạy thì bị huỷ |
| 5 | Ai được Tạm dừng | Ai có `cskhSend.Create` (cũng là quyền Tạo chiến dịch) |
| 6 | Trang kết quả | Trang riêng `/cskh-grouping/campaigns/:id`, mở từ nút "Lịch sử" |
| 7 | Đã xem / Gọi điện | Không có "Đã xem" (Zalo không báo về), bỏ cột "Xử lý tiếp" / "Gọi điện" (BA) |
| 8 | R12 Sai định dạng số | Lý do bị loại riêng, không gộp vào "Không có số điện thoại" |
| 9 | R05 Gộp trùng số | Làm: nhiều hồ sơ chung một số chỉ nhận một tin |
| 10 | R13 Đã ghi nhớ không có Zalo | **Chưa quyết** — chưa dựng gì, chờ chủ dự án nói "làm" hoặc "bỏ" |

## Đã dựng

### Tab "Chiến dịch đã gửi" (`/cskh-grouping?tab=campaign`)

- Thứ tự tab: Chăm sóc khách hàng · Phân nhóm CSKH · **Chiến dịch đã gửi** · Template tin nhắn.
  Không có tiêu đề hiện ra (R-993).
- "+ Tạo chiến dịch" mở màn Gửi tin nhắn. Gửi xong (ngay hoặc hẹn giờ) màn quay về tab này,
  lần gửi mới nằm trên cùng.
- Cột (theo thứ tự):
  1. **Template**: chip "ZNS" (Zalo) hoặc tên kênh + tên mẫu.
  2. **Khách hàng / Tệp khách hàng**: tên khách nếu gửi một người, không thì tên tab CSKH của danh sách.
  3. **Lần chạy gần nhất**: ngày giờ dạng "22/10 09:00" như ảnh BA (năm chỉ hiện khi khác năm nay:
     "22/10/2025 09:00"); lấy lúc bắt đầu, không thì giờ hẹn, không thì lúc tạo. Dòng phụ:
     "Hẹn gửi 24/10 08:00" khi chưa chạy, "3/3 thành công" khi không có lỗi, "4/5 thành công · 1 lỗi",
     hoặc "3/5 đã gửi · 2 dừng".
  4. **Trạng thái**: Đang gửi (xanh dương), Đã gửi (xanh lá), Đã dừng (xám, chữ đậm đủ tương phản).
  5. **Thao tác** (canh phải, nút thường không icon như ảnh BA): "Tạm dừng" (chỉ khi Đang gửi và có quyền)
     và "Lịch sử".
- Mới nhất ở trên, phân trang chung (`useTablePagination`). Khi còn dòng Đang gửi, bảng tự tải lại 5 giây một lần.

### Tạm dừng

- Hộp xác nhận: "Tạm dừng lần gửi này?".
  - Đang gửi: "Các tin mẫu "…" đã gửi đi vẫn giữ nguyên; các tin chưa gửi sẽ dừng hẳn, không thể gửi tiếp."
  - Hẹn giờ chưa chạy: "Lần gửi mẫu "…" hẹn lúc … sẽ bị hủy, không tin nào được gửi đi."
- Sau khi dừng: toast "Đã tạm dừng lần gửi", dòng thành Đã dừng.
- Lần gửi chưa chạy (Queued) thành Cancelled, lần đang chạy thành Stopped. Mọi tin còn Chờ thành **Đã dừng**
  ("Dừng trước khi gửi"). Job gửi đọc lại từng tin trước khi gửi nên tin đã dừng không đi.
- Dừng lần thứ hai (hoặc dừng lần đã xong) bị từ chối `BlueDental:Tools:0023`.
- "Huỷ hẹn" cũ của màn Gửi tin nhắn cũng đổi: tin chờ thành Đã dừng thay vì bị xoá.

### Trang "Kết quả lần gửi" (`/cskh-grouping/campaigns/:id`)

1. **Đầu trang**: đường dẫn "Chiến dịch đã gửi / Kết quả lần gửi", tiêu đề "Kết quả lần gửi · {mẫu}",
   nút "Xuất Excel danh sách lỗi" (viền xanh như các nút Excel khác của CSKH) và "Về danh sách CSKH"
   (nút chính, về tab Chăm sóc khách hàng).
2. **Chips** (`ul[aria-label="Kết quả lần gửi"]`): kênh · Template ID · Gửi tay / Hẹn giờ {giờ} ·
   người gửi · lúc gửi · tệp khách · số khách.
3. **Thẻ số**: Khách đã chọn · Bị loại trước khi gửi (+ % số đã chọn) · Đã gửi đi (+ "N tin chờ gửi" khi đang gửi) ·
   Thành công (+ % số đã gửi) · Thất bại (+ % số đã gửi) · Đã nhận · Chi phí ("N tin × 300 đ" khi mọi tin cùng giá,
   không thì "N tin tính phí") · Đã dừng (chỉ khi > 0).
4. **Thanh kết quả**: tiêu đề "Từ {số đã chọn} khách đến {số thành công} tin thành công"; một thanh chồng chia
   theo khách đã chọn (Thành công xanh lá / Lỗi đỏ / Bị loại xám nhạt / Chờ gửi xanh dương / Đã dừng xám đậm),
   chú thích luôn có Thành công, Lỗi, Bị loại; phần khác chỉ khi > 0. Dưới là **Lý do** từng loại bị loại kèm số.
5. **Bảng từng khách**: lọc "Tất cả · 4" / "Thành công · 1" / "Thất bại · 1" / "Bị loại · 2". Cột Khách (link hồ sơ) ·
   Số điện thoại · Kết quả · Chi tiết · Thời điểm · Chi phí.
   - Thứ tự: đã gửi trước, bị loại sau.
   - Chi tiết: "Đã gửi, chờ Zalo báo nhận" / "Khách đã nhận", lý do thất bại bằng tiếng Việt, lý do bị loại,
     "Gộp vào tin của {tên}", "… · gửi chung cho N hồ sơ" trên dòng mang tin (R05).
   - Thời điểm: giờ:phút:giây nếu cùng ngày với lần gửi, khác ngày thì có cả ngày. Tin thất bại không có lúc gửi
     thì lấy lúc lần gửi bắt đầu.
   - Chi phí: Thành công = giá Zalo tính; Thất bại = 0 đ; bị loại / chờ / dừng = "—" (theo ảnh BA).
   - Khách lẻ không có hồ sơ (lịch tạm) không có link.
6. Lần gửi cũ (trước F-79) không lưu người bị loại: hiện ghi chú "N khách bị loại của lần gửi cũ chỉ được đếm, không lưu tên."

### Lý do bị loại (lưu từng người lúc tạo lần gửi)

| Mã | Lý do | Ghi chú |
|---|---|---|
| 1 | Không có số điện thoại | như F-77 |
| 2 | Đã nhận mẫu này trong 30 ngày | như F-77 |
| 3 | Thiếu dữ liệu biến | như F-77 |
| 4 | Sai định dạng số (R12) | số không đổi được sang dạng Zalo (vd. số nước ngoài `+1…`) |
| 5 | Gộp trùng số (R05) | các hồ sơ chung một số: xếp theo tên (vi-VN, không phân biệt hoa thường), hồ sơ đầu mang tin, các hồ sơ sau "Gộp vào tin của {tên}" |

Màn Gửi tin nhắn cũng hiện 2 lý do mới: ô thống kê "sai định dạng số" / "gộp trùng số", dòng khách
"Sai định dạng số" / "Gộp vào tin của …", và 2 dòng kiểm tra trước khi gửi.

### Xuất Excel danh sách lỗi

- Một sheet "Danh sách lỗi": các khách Thất bại rồi Bị loại (tối đa 50.000 mỗi loại), có tiêu đề
  "Kết quả lần gửi · {mẫu}" và "Gửi lúc … · Danh sách lỗi".
- Tên file `ket-qua-lan-gui-yyyyMMdd-HHmm.xlsx`. SĐT che theo "Ẩn số điện thoại".

### BE

- Bảng `AppMessageLogs` thêm `SkipReason`, `MergedIntoMessageId`; trạng thái tin thêm `Skipped`, `Stopped`;
  trạng thái lần gửi thêm `Stopped`. Migration `20261023015207_MessageCampaignResults`.
- Lúc tạo lần gửi (`MessageSendAppService`): mọi khách bị loại được lưu thành tin `Skipped` kèm lý do;
  tin của người được gửi lưu `Pending` như cũ.
- `MessageRecipientBuilder`: R12 (`ZaloPhoneNumber` không đổi được) và R05 (gộp theo số đã chuẩn hoá).
- `MessageCampaignAppService` (`[Authorize(CskhSend.Read)]`; Tạm dừng cần `CskhSend.Create`):
  - chi nhánh lấy từ `X-Clinic-Branch-Id`; lần gửi của chi nhánh khác trả 404;
  - Chi phí = tổng `Cost` của tin đã gửi được; giá một tin chỉ trả khi mọi tin cùng giá;
  - đếm theo `MessageBatchCounter` (thêm số Đã dừng).
- `MessageCampaignExcel`: sheet "Danh sách lỗi" qua `ExcelSheet`.
- `IMessageSendStopper` / `EfCoreMessageSendStopper`: một câu `UPDATE` đổi mọi tin Pending của lần gửi thành Stopped.
- `MessageSenderNames`: tên người gửi (cả nhân viên đã xoá), dùng chung với Thống kê CSKH.
- Tin `Skipped` / `Stopped` **không phải tin đã gửi**: Thống kê CSKH, Lịch sử tin nhắn (`ToolsAppService`) và
  danh sách tin Zalo OA đều lọc theo `MessageSendStatuses.Messages`.

### API — `api/v1/app/message-campaigns`

| Method | Path | Quyền |
|---|---|---|
| GET | `/` (danh sách, mới nhất trước, phân trang) | cskhSend.read |
| GET | `/{id}` (đầu trang, chips, thẻ số, thanh, lý do, số theo tab) | read |
| GET | `/{id}/recipients?outcome=` (bảng từng khách) | read |
| POST | `/{id}/stop` | cskhSend.create |
| GET | `/{id}/failures-excel` | read |

### Quyền

- Không có quyền mới. `cskhSend.read` thấy tab và trang kết quả; `cskhSend.create` thấy "Tạo chiến dịch" và "Tạm dừng".
- Route `cskh` (`/cskh-grouping`) mở thêm cho người chỉ có `cskhSend`. Trang `/cskh-grouping/campaigns/:id` cần `cskhSend` đọc.
- Không có `cskhSend`: không có tab, API 403.

### FE

- `pages/MessageCampaignResultPage.tsx`; component trong `components/campaigns/` (`CampaignListTab`, `CampaignTable`,
  `CampaignResultHead`, `CampaignKpis`, `CampaignOutcomeBar`, `CampaignRecipientsCard`, `CampaignExportButton`,
  `campaignLook.ts`), CSS `cskh-campaign.css`.
- API `api/campaignApi.ts`. Đường dẫn trong `templatePaths.ts` (`CAMPAIGN_LIST_PATH`, `campaignResultPath`, `CARE_LIST_PATH`).
- Trang kết quả tự tải lại 5 giây một lần khi lần gửi còn Đang gửi.

## Kiểm thử

| Mức | Kết quả |
|---|---|
| Domain.Tests | **1035/1035** (gồm `MessageSendBatchTests` Stop, `MessageLogSkipTests`) |
| Application.Tests | **801/801** (gồm `MessageCampaignAppServiceContractTests` 11/11, chạy lại sau khi đổi chữ cột) |
| E2E `cskh-message-campaigns` | **5/5** (chạy 2 lượt sau khi sửa giao diện theo ảnh BA: 44,0 s và 37,5 s) |
| Hồi quy mức 3 | xem R-1020 trong `03-regression-log.md` |

Đường chạy E2E: build production `vite preview` 127.0.0.1:8130 → host develop 127.0.0.1:5100 →
PostgreSQL `BlueDental_develop`, job gửi thật, không chặn request nào. Zalo là stub local
`e2e/fixtures/zalo-stub.mjs` (:5199); spec chỉ chạy khi có `E2E_ZALO_STUB=1`.

Các ca E2E:

1. **Tạo chiến dịch → gửi → Kết quả lần gửi**: 4 khách (1 nhận được, 1 bị stub từ chối `0399…`, 1 thiếu biến,
   1 số nước ngoài `+1415…`). Danh sách: cột, trạng thái Đã gửi, "1/2 thành công · 1 lỗi". Trang kết quả: chips,
   7 thẻ số (Chi phí 300 đ), thanh và lý do, 4 tab "Tất cả · 4" … , tiêu đề cột "Khách" / "Số điện thoại", từng dòng
   (link hồ sơ, Thời điểm giờ:phút:giây, Chi phí 300 đ / 0 đ / —), lọc Thất bại / Bị loại, file Excel một sheet đủ
   3 khách lỗi, stub chỉ nhận đúng 2 tin; 2 nút quay về.
2. **R05 gộp trùng số**: hồ sơ và khách lịch tạm chung một số → màn gửi báo gộp, gửi 1 tin, trang kết quả "gửi chung
   cho 2 hồ sơ" và "Gộp vào tin của …", lý do "Gộp trùng số", tiêu đề thanh "Từ 2 khách đến 1 tin thành công".
   Quay về danh sách bằng đường dẫn: dòng có "1/1 thành công" (không có "lỗi") và ngày giờ dạng `dd/MM HH:mm`.
3. **Tạm dừng lần hẹn giờ**: hộp xác nhận, dòng thành Đã dừng "0/1 đã gửi · 1 dừng", lần gửi Cancelled, dừng lần hai bị từ chối,
   trang kết quả có thẻ Đã dừng 1 và dòng "Dừng trước khi gửi", stub không nhận tin nào.
4. **Quyền**: chỉ đọc thì có tab nhưng không có Tạo chiến dịch / Tạm dừng, POST stop 403; không có `cskhSend` thì không có tab, API 403.
5. **Chi nhánh**: chi nhánh khác không thấy lần gửi trong danh sách, `{id}`, `recipients`, `stop` đều 404.

Lệnh chạy:

```
E2E_BASE_URL=http://127.0.0.1:8130 E2E_ZALO_STUB=1 \
  npx playwright test e2e/cskh-message-campaigns.spec.ts --workers=1
```

### Lưu ý khi viết spec

- Stub tính 300 đ cho mỗi tin gửi được; tin thất bại 0 đ.
- Số `0399…` luôn bị stub từ chối (-108), số `+1…` bị loại "Sai định dạng số" trước khi gửi.
- Tên khách R05 nằm trong "Gộp vào tin của {tên}" của dòng kia: tìm dòng mang tin bằng link tên chính xác, không bằng chữ.
- Tên file Excel có ngày giờ: so bằng regex.
- Dọn lần gửi hẹn giờ còn chờ bằng POST `/stop` trong `finally`.

## Còn treo

- **R13** (đã ghi nhớ không có Zalo, "Gọi điện"): chờ chủ dự án.
- Đã xem: Zalo không báo về nên không có.
- Staging cần DbMigrator (migration mới). Không có quyền mới nên không phải xoá cache quyền Redis.
- Các điểm khác so với ảnh BA: xem `docs/clone/pages/cskh-messaging.md` và `unknowns.md` (F-79).

## Retest khi sửa

Xem `02-impact-map.md`: `MessageCampaign*`, `IMessageSendStopper`, `MessageRecipientBuilder` (R05 / R12),
`features/cskh/components/campaigns/*`, `campaignApi.ts`, `MessageSendStatuses`.
