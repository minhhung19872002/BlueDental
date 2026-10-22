# F-76 — CSKH › "Template tin nhắn" + trang Tạo/Sửa mẫu (BA P2110, đợt 1)

Nguồn: `P2110.drawio` của BA (img_08). Mock HTML `3 · Gửi tin nhắn` dùng cho
đợt 2. Chủ dự án duyệt kế hoạch 2026-10-22, chốt 12 quyết định.

BlueDental riêng, bản gốc không có màn này. Regression id R-1008.

Status: xem `01-feature-verification-registry.md` dòng F-76.

## Phạm vi theo đợt

| Đợt | Feature | Nội dung | Trạng thái |
|---|---|---|---|
| 1 | F-76 | Tab Template tin nhắn, trang tạo/sửa mẫu, bỏ Công cụ › Tin nhắn › Mẫu tin nhắn | `VERIFIED` (develop `9e2d457b`) |
| 2 | F-77 | Gửi tin nhắn (`Send.dc.html`), icon trên dòng mở Gửi đã khoá khách, nút "Gửi tin nhắn chăm sóc" trên 10 tab, thay dialog Lưu tin nhắn / Gửi ZBS, Hẹn giờ gửi + Gửi thử | `VERIFIED` (develop `8925f078`) |
| 3 | F-78 | Menu con header Tổng quan + Thống kê CSKH, PeriodRangePicker chỉ ở Thống kê (`cskh-message-stats.md`) | `VERIFIED` (develop, chưa commit) |

## Quyết định của chủ dự án (2026-10-22)

1. Chỉ Zalo gửi thật. SMS / Email lưu mẫu được nhưng hiện "Chưa kết nối gửi".
2. Mẫu Zalo = một mẫu ZNS đã được Zalo duyệt, cộng tên và mục đích riêng.
   Tham số tự gán biến.
3. Bộ biến cố định, giá trị mặc định cố định. Thiếu biến bắt buộc thì bỏ qua khách (đợt 2).
4. Xoá trên màn Gửi chỉ bỏ khách khỏi lần gửi đó (đợt 2).
5. Màn Gửi thay dialog Lưu tin nhắn / Gửi ZBS cũ (đợt 2).
6. Ẩn Công cụ › Tin nhắn › Mẫu tin nhắn. **Đã làm.**
7. Không có Tệp tải lên.
8. Không có thẻ Đã xem / phản hồi.
9. Giữ thiết kế v2.
10. Làm Hẹn giờ gửi + Gửi thử (đợt 2).
11. PeriodRangePicker chỉ ở Thống kê (đợt 3).
12. Làm trên nhánh develop.

## Đã dựng (đợt 1)

### Domain — `MessageTemplate`

| Trường | Ý nghĩa |
|---|---|
| `Purpose` | `CareType`, phải là 1 trong 10 tab CSKH (`CareBoard.Types`) |
| `Status` | Nháp 0 · Sẵn sàng 1 · Chờ duyệt 2 · Zalo từ chối 3 · Ngừng dùng 4 |
| `Subject` | Tiêu đề, chỉ cho Email |
| `ExternalTemplateId`, `ParamMapJson` | Mẫu ZNS và bảng gán tham số → biến, chỉ cho Zalo |
| `RemoveDiacritics` | Bỏ dấu khi gửi, chỉ cho SMS |

- **Lưu nháp** (`SaveDraft`): chỉ cần tên (`Tools:0010`).
- **Lưu mẫu** (`Publish`):
  - mọi kênh: bắt buộc mục đích (`0011`);
  - SMS / Email: bắt buộc nội dung (`0012`), Email cần thêm tiêu đề (`0013`). Biến không có trong bộ biến bị từ chối (`0014`). Lưu xong là Sẵn sàng;
  - Zalo: bắt buộc chọn mẫu ZNS (`0015`). Mọi tham số Zalo đánh dấu bắt buộc phải có giá trị (`0016`). Trạng thái theo Zalo: ENABLE → Sẵn sàng, REJECT → Zalo từ chối, DISABLE / DELETE → Ngừng dùng, còn lại (PENDING_REVIEW…) → Chờ duyệt.
- Độ dài tối đa (`0017`): SMS 1000, Zalo 2000. Tên và tiêu đề theo `MessageTemplateConsts`.
- Mỗi kênh chỉ giữ trường của mình. Server trim nội dung.
- **Nhân bản**: tạo bản nháp "- bản sao", cùng chi nhánh và cùng kênh.
- **Đồng bộ Zalo** (`SyncZaloStatus`): bản nháp giữ nguyên là nháp.

### Biến (`MessageVariables`, 16 biến)

| Nhóm | Biến |
|---|---|
| Khách hàng | `ten_khach_hang`, `xung_ho`, `ma_khach_hang`, `so_dien_thoai`, `email`, `ngay_sinh` |
| Lịch hẹn | `ngay_hen`, `gio_hen`, `thu_hen`, `noi_dung_dich_vu`, `bac_si` |
| Điều trị | `ngay_dieu_tri`, `dich_vu_da_lam`, `so_tien_con_lai` |
| Hệ thống | `ten_phong_kham`, `hotline` |

Mỗi biến có một trong ba cách xử lý khi trống: dùng giá trị thay (vd "Quý
khách"), bỏ qua khách, hoặc luôn có.

### API — `api/v1/app/message-templates`

| Method | Path | Quyền |
|---|---|---|
| GET | `/` (lọc `channel`, `purpose`, `filter` không dấu; đếm theo kênh) | cskhTemplate.read |
| GET | `/{id}` | read |
| POST | `/` | create |
| PUT | `/{id}` | update |
| POST | `/{id}/duplicate` | create |
| GET | `/variables` | read |
| GET | `/sample-customer?exceptPatientId=` (ưu tiên khách có lịch hẹn sắp tới) | read |
| POST | `/preview` | read |
| GET | `/zns-templates`, `/zns-templates/{templateId}` | read |
| POST | `/sync-zalo-status` (Zalo lỗi → giữ trạng thái cũ, trả `error`) | read |

- Mọi endpoint lấy chi nhánh từ `X-Clinic-Branch-Id`. Đọc mẫu của BD-001 bằng
  tài khoản chi nhánh khác:
  - gửi header chi nhánh của mình → 404;
  - gửi header BD-001 (không được phân công) → 403.
- Cột "Đã gửi" đếm các dòng nhật ký gửi đã tới khách.
- Phần gọi Zalo nằm trong `ZaloOaGateway`, dùng chung với `ZaloOaAppService`.

### Quyền

- Subject `cskhTemplate` (Xem / Thêm / Sửa), đặt dưới CSKH trong cây
  Phân quyền.
- Seeder cấp cho các role tĩnh. Role tuỳ chỉnh phải cấp tay.
- Route FE:
  - tab cần `read`;
  - `/cskh-grouping/templates/new` cần `create`;
  - `/cskh-grouping/templates/:id` cần `update`.

### Migration

`20261022021207_MessageTemplateEditor`:

- thêm 6 cột;
- thêm index `(ClinicBranchId, Channel, Status)`;
- đặt mọi mẫu cũ thành Sẵn sàng.

Staging cần DbMigrator, sau đó xoá cache quyền Redis.

### FE

- **Tab "Template tin nhắn"** (`components/templates/`):
  - chip kênh có số đếm;
  - lọc Mục đích;
  - tìm theo tên hoặc nội dung;
  - bảng: Tên mẫu, Kênh, Mục đích, Số biến, Đã gửi, Trạng thái;
  - thẻ xem trước bên phải;
  - Sửa / Nhân bản theo quyền.
- **Trang tạo/sửa** (`components/template-editor/`, hooks `useTemplateEditor`,
  `useCaretField`, `useVariableInsert`, `useVariableAutocomplete`,
  `useEditorPreview`):
  - Thông tin mẫu: tên, mục đích, kênh;
  - Soạn nội dung, có 2 bước;
  - chip biến hay dùng;
  - gõ `{` thì hiện gợi ý (listbox "Thư viện biến"; mũi tên / Enter / Esc);
  - Thư viện biến: tìm kiếm, nhóm dạng PillTabs xuống dòng, nút + chèn tại con trỏ, dấu ✓ cho biến đã dùng;
  - Biến trong mẫu: cho gỡ biến;
  - xem trước với khách mẫu, nút "Đổi khách";
  - Zalo: chọn mẫu ZNS, bảng tham số điền sẵn biến (`znsParamDefaults`), báo khi chi nhánh chưa nối OA.
  - Lưu nháp / Lưu mẫu;
  - rời trang khi chưa lưu thì hỏi Ở lại / Bỏ thay đổi.
- **Công cụ › Tin nhắn**: bỏ sub-tab Mẫu tin nhắn. Xoá `MessageTemplateView`
  và các hàm template trong `toolsApi`.
- **Đổi tên** "Complain" → "Khiếu nại" (BA P2110).

## Kiểm thử

| Mức | Kết quả |
|---|---|
| Domain.Tests | **1017/1017** (gồm `MessageTemplateTests` 16, `MessageTemplateRendererTests` 8) |
| Application.Tests | **758/758** (gồm `MessageTemplateAppServiceContractTests` 5) |
| HttpApi.Host.Tests | **24/24** (controller mới có route) |
| E2E `cskh-message-template` | **7/7** |
| Hồi quy mức 3 | `cskh-generated-tabs`, `report-customer`, `zalo-oa`, `routes` **45/45**; `cskh*` 5 spec **14/14** |

Đường chạy E2E:

- build production `vite preview`, cổng 8130;
- host develop :5100;
- PostgreSQL `BlueDental_develop`;
- không chặn request nào.

Zalo là stub local `e2e/fixtures/zalo-stub.mjs` (:5199). Host được trỏ tới stub
qua `Zalo__OAuthBaseUrl` / `OpenApiBaseUrl` / `BusinessApiBaseUrl` và
`Zalo__OaId` = OA của stub. **Không bao giờ gọi Zalo thật.**

Các ca E2E:

1. Soạn SMS:
   - gõ `{ng`: có `{ngay_hen}`, **không** có `{ten_khach_hang}`;
   - dùng chip biến hay dùng và Thư viện biến;
   - Lưu nháp rồi Lưu mẫu;
   - tải lại vẫn còn.
2. Rời trang khi chưa lưu: Ở lại giữ nội dung; Bỏ thay đổi không tạo mẫu.
3. Nhân bản tạo bản nháp "- bản sao", còn sau khi tải lại.
4. Chi nhánh khác không thấy và không đọc được mẫu của BD-001.
5. Chi nhánh chưa nối Zalo: báo cần kết nối, khoá chọn mẫu ZNS.
6. Quyền:
   - chỉ Xem: không có nút tạo / sửa / nhân bản, link trực tiếp bị chặn;
   - có Thêm: Lưu nháp rồi quay về danh sách.
7. Zalo (`E2E_ZALO_STUB=1`):
   - chọn mẫu ZNS thì tham số được điền sẵn;
   - thiếu tham số bắt buộc thì không lưu;
   - mẫu Zalo chưa duyệt thì thành Chờ duyệt.

   BD-001 chưa nối OA thì spec tự nối qua `connect-url` + `oauth/callback` (state
   ký thật), rồi gỡ trong `afterEach`. Nhờ vậy `zalo-oa` vẫn thấy "chưa kết nối".

Lệnh chạy:

```
E2E_BASE_URL=http://127.0.0.1:8130 E2E_ZALO_STUB=1 \
  npx playwright test e2e/cskh-message-template.spec.ts --workers=1
```

## Còn treo

- ~~Đợt 3 (F-78)~~: xong (R-1011), xem `cskh-message-stats.md`.
- ~~Nút "Dùng mẫu này để gửi" ở thẻ xem trước chưa hiện~~: đã nối ở đợt 2
  (F-77, R-1009), mở Gửi tin nhắn với đúng kênh và mẫu.
- Các điểm khác img_08 còn lại: xem `docs/clone/unknowns.md` (F-76).

## Retest khi sửa

Xem `02-impact-map.md`:

- `MessageTemplate*`, `ZaloOaGateway`, `CareBoard.Types`;
- `matchesVariable` (`messageVariables.ts`): dùng chung cho gợi ý `{`, Thư viện
  biến và ô tham số ZNS.
