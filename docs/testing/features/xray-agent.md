# F-95 — Liên kết máy X-quang (Vatech EzDent-i)

Status: `VERIFIED` (phía BlueDental) · Verified commit: chưa commit, xem
`01-feature-verification-registry.md`.

Kiến trúc, API và các điểm UNVERIFIED nằm ở `docs/integrations/xray-ezdent.md`.
Agent có README riêng: `BlueDental.XrayAgent/README.md`.

## Stack đã chạy

Dùng một stack riêng để không đụng :5000 / :8080 của các session khác:

- **DB:** `BlueDental_f95`, bản sao của DB local, đã chạy migration `XrayAgentF95`.
- **API host:** :5195, Development.
- **Frontend:** bản build production chạy `vite preview` ở :8195, proxy `/api` sang :5195.
- **Hạ tầng:** MinIO + ClamAV thật trong Docker.
- Đăng nhập qua màn hình login thật. Không có `page.route`, MSW hay token tiêm vào.

## Rules under test

| Quy tắc | Bằng chứng |
|---|---|
| Cài đặt → Máy X-quang: Thêm máy cho ra token 43 ký tự **chỉ một lần**. Tải lại trang thì token biến mất, dòng máy hiện "Đang hoạt động" | e2e #1 |
| Ảnh có Mã KH cùng chi nhánh → cột **Trước điều trị** + chip "X-quang", nút "Mở EzDent-i" hiện; tải lại vẫn còn | e2e #2, smoke agent |
| Gửi lại cùng một tệp → `duplicate: true`, cùng `inboxItemId`, không tạo ảnh thứ hai | e2e #2, Domain + EF (unique index) |
| Không có mã, hoặc chỉ có tên + năm sinh → **Pending** trong `/xray-inbox`, **không tự gán** | e2e #4 |
| Gợi ý "Trùng tên và năm sinh" → Gán → toast "Đã gán ảnh vào hồ sơ"; Bỏ qua → "Đã bỏ qua ảnh"; tải lại thì cả hai rời inbox, số đếm giảm 2, hồ sơ có 2 ảnh X-quang | e2e #4 |
| Tài khoản chi nhánh 2 không thấy inbox của chi nhánh 1; gợi ý và gán đều bị từ chối; trang `/xray-inbox` trống | e2e #5 |
| Thu hồi máy → dòng hiện "Đã thu hồi"; Ping và gửi ảnh bị từ chối với `Imaging:0002`; ảnh đã gán giữ nguyên | e2e #6 |
| Mã của một hồ sơ **chi nhánh khác** → ảnh Pending trong inbox của chi nhánh máy, hồ sơ kia không có ảnh nào; `by-code` trả `Imaging:0009`, nên cầu nối cũng không mở được hồ sơ chi nhánh khác | e2e #3 |
| Khớp qua `LegacyId` (mã hệ thống cũ) khi không trùng `PatientCode` → AutoAssigned; `by-code` cũng nhận | smoke tay trên DB riêng (`LegacyId` chỉ ghi được qua nhập dữ liệu F-61, app không có API đặt) |
| Nhận dạng tệp theo byte, không theo tên; guard Pending của Assign / Discard; ảnh tự gán không có StaffId; token chỉ giữ hash | Domain.Tests `XrayTests` (10) |
| Mỗi method có permission riêng; station không bị audit, nên token không vào audit log | Application.Tests `XrayAppServiceContractTests` (4) |
| Unique `(XrayDeviceId, Sha256)` và unique token hash; StaffId cho phép null | EF.Tests `XrayMappingTests` (3) |
| Controller mới theo đúng quy ước route / verb | HttpApi.Host.Tests `ControllerConventionTests` |

Spec `e2e/xray-agent.spec.ts` có 6 test chạy nối tiếp (#1 … #6, theo thứ tự trong spec).
Kết quả: **6/6 xanh**.

## Agent

- **Unit test:** xUnit 109/109 (`BlueDental.XrayAgent.Tests`), gồm parser tên tệp / URL, ledger, pipeline (backoff, token bị thu hồi), station client, bridge.
  - Phần tệp thông tin ảnh EzDent-i (2026-11-11) có `EzdentInfoFileTests` và các test pipeline / watcher:
    - Chart No thắng tên tệp.
    - Ảnh chờ tệp thông tin 20 giây rồi gửi không mã.
    - Tắt cài đặt thì bỏ qua tệp thông tin.
    - Log không lộ tên, năm sinh hay tên tệp.
  - Dữ liệu test đều là dữ liệu tổng hợp.
- **Smoke thật** (2026-11-11): harness console tham chiếu `BlueDental.XrayAgent.Core` và gọi `AgentRuntime.Start` với các thư mục tạm, chạy với API :5195.
  - **Ghép máy + Ping:** ghép máy qua API của app, sau đó Ping ok.
  - **Tải ảnh:** thả `<Mã KH>_pano.jpg` (JPEG thật) vào thư mục theo dõi. Log ghi `sent code=… status=2`. Trình duyệt thật mở tab Hình ảnh và thấy 1 thẻ trong Trước điều trị, có chip X-quang, ảnh thu nhỏ tải được (200), nút "Mở EzDent-i" hiện.
  - **Mở EzDent-i:** `Bridge.OpenAsync(code)` trả `Opened`. Kết quả:
    - `linkage.xml` mã hoá UTF-8 không BOM, tên hồ sơ có dấu được ghi không dấu, `ChartNumber` = Mã KH, `Birthday` dạng `yyyyMMdd`, `Gender` `F`.
    - Loader giả (`VTE2Loader32.exe`) chạy với thư mục làm việc là Bin và nhận đúng đường dẫn của `linkage.xml`.
  - **Log không có PHI:** chỉ có 3 dòng, không có tên, năm sinh hay đường dẫn tệp.
- **Chưa kiểm được trên dev:** `--install` (ghi HKCU) và named pipe giữa hai bản agent. Hai phần này nằm trong app WinForms, không có trong Core.

## Hồi quy

- **Kết quả:** `patient-image*.spec.ts` 14/14 xanh (patient-image 6, batch + capture 8).
- **Sửa spec (lỗi có sẵn, không do F-95):** test "a branch-scoped account cannot read another branch's pictures" trong `patient-image.spec.ts` đỏ từ trước F-95.
  - **Nguyên nhân:** `beforeEach` đã đăng nhập admin, và `/login` của một trình duyệt đã đăng nhập bị `PublicOnlyRoute` đẩy về app.
  - **Cách sửa:** test chạy trong context trình duyệt riêng.

## Retest level

Mức 3: `PatientImage` dùng chung (StaffId cho phép null, thêm XrayDeviceId, lõi ghi ảnh tách ra `PatientImageWriter`), menu / router / `useNavBadges`, DbContext.

**Phụ thuộc:** F-24 Hình ảnh, picker "Chọn ảnh hiển thị" ở Chẩn đoán & Tư vấn, Cài đặt phòng khám.
