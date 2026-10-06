# Combo dịch vụ — review P0510 (BlueDental riêng, 2026-10-06)

Không phải hành vi bản gốc. Nguồn: `save/P0510.drawio`, từ ô "Update thêm màn hình
cho combo nhé" trở xuống, cộng phần "Thêm dịch vụ → Loại: Combo" phía trên mà các
màn đó cần để có dữ liệu thật.

## Dữ liệu

- Combo là một **mục của danh mục dịch vụ** (`CatalogEntry`, `Group = care_service`)
  có `IsCombo = true` và bảng con `bd_catalog_combo_items`
  (`ComponentEntryId`, `Quantity`, `UnitPrice`, `SortOrder`). Migration `CatalogCombos`.
- Loại cố định từ lúc tạo — dialog chỉ cho đổi "Dịch vụ lẻ / Combo" khi thêm mới.
- **Giá combo = Σ Thành tiền × Số lượng** của các dòng (`CatalogEntry.ReplaceComboItems`);
  không ai gõ được giá combo, kể cả import Excel (`ChangePrice` bỏ qua trên combo).
- "Thành tiền" của dòng là giá **trong combo**; giá danh mục của dịch vụ không đổi
  ("Sửa tiền không được ảnh hưởng tới master data").
- Thành phần phải là **dịch vụ lẻ còn sống của cùng chi nhánh** — không lồng combo,
  không lấy dịch vụ chi nhánh khác (lỗi `Catalogs:0028`); ít nhất 1 dòng (`0027`);
  mỗi dịch vụ một dòng, số lượng ≥ 1, giá ≥ 0 (`0026`). Dịch vụ đã trong combo rồi
  mới bị xoá thì vẫn được giữ khi lưu lại combo.
- `RetailPrice` ("Tổng giá lẻ") tính ở server lúc đọc, theo giá danh mục **hiện tại**
  của từng thành phần.
- `GET catalog-entries?isCombo=true|false` lọc theo loại; `GET catalog-entries/kind-counts`
  đếm "Tất cả / Dịch vụ lẻ / Combo" với cùng bộ lọc của danh sách.

## Danh mục › Dịch vụ

- Nút "Thêm dịch vụ / combo"; ô tìm "Tìm theo tên dịch vụ hoặc combo..."; công tắc
  "Tất cả (n) · Dịch vụ lẻ (n) · ◇ Combo (n)" bên phải ô tìm.
- Dòng combo: ô vuông tím có biểu tượng lớp, tag COMBO (thêm "Ngưng hoạt động" khi đã
  xoá mềm), dòng phụ "mã · N thành phần · M đơn vị", giá combo kèm Tổng giá lẻ gạch
  ngang và "-x%". Mũi tên mở bảng SL / Thành phần / Loại / Giá lẻ / **Giá combo**
  (review đổi tiêu đề "DT phân bổ" thành "Giá combo") và chân "Tổng giá lẻ · Giá combo ·
  Khách tiết kiệm". Nút **Sao chép** chỉ có trên combo — mở dialog thêm mới đã điền sẵn.
- Dialog combo: panel "Danh mục" bên trái (tìm ở server, lọc nhóm, "+N trong combo"),
  bảng "Thành phần combo" (−/+ số lượng, Đơn giá danh mục, Thành tiền sửa được, xoá),
  "Cấu hình giá & thuế" (Trước/Sau thuế, Tổng giá lẻ — disabled, Giá combo, Đơn vị —
  free text, % thuế — dropdown như dịch vụ, Tiền thuế, Thực thu), dải xanh
  "Khách tiết kiệm …", bốn tab Cài đặt / Công đoạn / Bảo hành / Labo **dùng chung**
  với dịch vụ (`ServiceSettingsTabs`). Nút "Huỷ" + "Lưu combo".
- Tiền thuế / Thực thu theo đúng công thức review:
  Trước thuế → thuế = giá combo × %, thực thu = giá combo + thuế;
  Sau thuế → thuế = giá combo × % ÷ (1 + %), thực thu = giá combo − thuế;
  KCT / KKKNT / 0% → 0 đ (`comboPricing.ts`).

## Chọn Dịch Vụ

- "Lựa chọn dịch vụ" có công tắc "Dịch vụ lẻ (n) | Combo (n)"; ô tìm đổi thành
  "Tìm combo" ở tab Combo. Danh sách Dịch vụ lẻ gửi `isCombo=false` — combo không
  bao giờ hiện như một dịch vụ lẻ.
- Tick một dịch vụ có trong combo → thông báo cam "Gợi ý tư vấn: Thêm … để áp dụng
  {combo}. Tiết kiệm …" (đủ hết thành phần thì "Các dịch vụ đã chọn nằm trong …").
  Nhiều combo khớp: chọn combo chứa nhiều dịch vụ đã tick nhất, hoà thì combo tiết
  kiệm nhiều hơn. Nút **"Áp dụng Combo"** chỉ mở tab Combo (review: "On-click: mở tab
  Combo") — chữ trên nút không kèm tên combo (review che phần tên).
- Thẻ combo: tên, mô tả, "-x%", thành phần ✓ kèm giá lẻ, Tổng giá lẻ gạch ngang, giá
  combo, "Tiết kiệm …", nút "Chọn combo". Chọn được nhiều combo.
- Bấm "Chọn combo": **xoá mọi dịch vụ lẻ đã tick**; nút đổi thành "Hủy dịch vụ" — bấm
  thì bỏ combo, dịch vụ lẻ đã xoá **không** quay lại ("kệ, bắt chọn lại").
- Thẻ tóm tắt: danh sách LẺ / COMBO có ✕, "Tổng cộng (giá gốc)" (combo tính theo Tổng
  giá lẻ), "Giảm giá" (gõ trên dòng lẻ), "Giảm giá combo", "Thành tiền".
- Lưu: mỗi combo thành **một** dòng tư vấn `serviceId = combo`, số lượng 1, giá =
  "Giá sau giảm" của combo — như dịch vụ lẻ. Combo mang công đoạn / bảo hành / labo
  của chính nó nên các bước sau (kế hoạch, công đoạn, thanh toán) chạy như một dịch vụ.

## Kiểm chứng

`e2e/catalog-combo.spec.ts` (thật toàn bộ: preview :8080 → API :5000 → PostgreSQL),
`BlueDental.Domain.Tests/Catalogs/CatalogComboTests.cs`,
`BlueDental.EntityFrameworkCore.Tests/Catalogs/CatalogComboMappingTests.cs`.
