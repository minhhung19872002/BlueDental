# P3110 — Labo (đặt hàng / nhận & kiểm tra / bảo hành) + Bảo hành dịch vụ — Plan chi tiết

> Trạng thái: **PLAN — đã được owner duyệt 2026-10-31 ("ok theo đề xuất"), chưa code.**
> File này là checklist để reviewer (người hoặc AI) đối chiếu code với yêu cầu BA.
> Mỗi yêu cầu có mã `REQ-xx`; commit, test và tài liệu sẽ ghi lại mã này.

## 0. Nguồn, phạm vi, quy ước

| Mục | Giá trị |
|---|---|
| Nguồn BA | `C:\Users\ADMIN\Downloads\P3110.drawio` (204 mxCell, 49 ảnh mock, các note nối với ô bằng mũi tên) |
| Ảnh mock đã tách | `docs/wip/p3110-mocks/` — tên file `m{id}.png` / `f{id}.png` theo id mxCell trong drawio (không commit nếu owner không yêu cầu) |
| Feature | **F-86** (nối tiếp F-85 Labo workflow P2910_03) |
| R-id | dự kiến R-1084 → R-1089, mỗi giai đoạn một số (xem §6). **Kiểm tra lại** implementation-progress, regression log, origin/main và origin/develop trước khi lấy số |
| Nhánh | `develop`. Nền: `a378021e` (F-85, chưa push) |
| Thứ tự làm | A → C → D → E → B → F |
| Quy tắc | UI giống mock 1:1 · không `any` · mọi text qua i18n (vi + en) · CSS riêng của feature, token `--bd-*`, không Tailwind · test acceptance full-stack thật (không `page.route` / MSW) · không log PHI |

### Mock ↔ màn hình

| Màn hình | Mock |
|---|---|
| Bảng dịch vụ trang kế hoạch (Chi tiết điều trị) | `f1`, `f8`, `f9`, `m385` (ô Phiếu Labo), `m390` (cột Bảo hành) |
| Ô Hành động ở LỊCH SỬ ĐIỀU TRỊ | `m6`, `m7` (Tạo Labo / BN có n phiếu), `m24` (bug khoá QC), `m38` (UI khoá), `m230` (Bảo hành dịch vụ / bỏ Kích hoạt bảo hành) |
| Popup Labo — 1 · Đặt hàng | `m28` (bản cũ + note), `m105`, `m106`, `m134`, `m139`, `m142`, `m143`, `m144`, `m149`, `m154`, `m158` |
| Popup Labo — 2 · Nhận hàng & kiểm tra | `m175`, `m176`, `m177`, `m184`, `m189`, `m238`, `m278`, `m279`, `m281`, `m282`, `m284`, `m286`, `m294`, `m306`, `m307`, `m342` |
| Popup Labo — 3 · Bảo hành | `m374` |
| Tab "Bảo hành" trang kế hoạch | `m348`, `m360`, `m361`, `m366`, `m371` |
| Công đoạn bảo hành | `m390`, `m394`, `m395`, `m400`, `m401`, `m412`, `m415` |

---

## 1. Quyết định của owner (chốt 2026-10-31)

| # | Câu hỏi | Quyết định |
|---|---|---|
| D1 | Nút "Bảo hành dịch vụ" → "màn hình bảo trì" | **Chuyển sang tab "Bảo hành"** của trang kế hoạch điều trị (BA: "tới trang đó thôi", "đơn giản behaviour lại") |
| D2 | "Ảnh đính kèm chung" có bắt buộc không | **Không bắt buộc** (theo note "Bỏ bắt buộc đi giúp anh"; dấu `*` trên mock 139 bỏ đi) |
| D3 | Khớp cắn | **Giữ**, làm một **cột trong bảng Thông số từng răng, đặt ngay sau cột Kiểu nhịp** |
| D4 | Mã phiếu bảo hành nha khoa | Công thức BA: `BH-{Mã phiếu điều trị}{Mã phiếu dịch vụ}-ddmmyyyy-xx`. Mã dòng dịch vụ đã chứa mã phiếu (`DT01-03`), nên dùng **`BH-{mã dòng dịch vụ}-{ddMMyyyy ngày bắt đầu BH}-{xx}`**, ví dụ `BH-DT01-03-30102026-01`. **`xx` = số thứ tự 2 chữ số, chạy từ 01 theo (dòng dịch vụ + ngày bắt đầu BH); thẻ Dịch vụ và thẻ Labo dùng chung bộ đếm** (sửa 01/11, R-1090 — trước đây `xx` = số răng và thẻ Labo có dạng riêng `BH-{yyMM}-{4 số cuối LABO}-{răng}`). Phiếu Labo không gắn dòng dịch vụ → không kích hoạt được (`Labo:0037`), chờ owner |
| D5 | Cột "Lượt" / số lượt bảo hành | **Bỏ hẳn**: không có cột Lượt, không có khái niệm số lượt |
| D6 | Cột "Bảo hành" trong bảng dịch vụ (mock 390) | **Có thêm cột**, chỉ hiện **chip trạng thái** (Nha khoa / Labo). **Không** hiện các dòng phụ ("2 thẻ", "1 yêu cầu đang xử lý", "R36 đã hết lượt") và **không** có mã YCBH |
| D7 | Ảnh theo từng răng trong bảng Thông số | **Làm thật**: upload MinIO, chạy được hoàn chỉnh |
| D8 | Phạm vi | **Làm hết** A–F trong đợt này |
| D9 | Popup "Bảo hành dịch vụ" (Nha khoa, không có mock) | Dựng theo khung **bước 3 Bảo hành của Labo**, chi tiết ở REQ-B5 |

---

## 2. Yêu cầu và tiêu chí nghiệm thu (truy vết theo note BA)

Cột "Note BA" chép nguyên văn từ drawio. Reviewer kiểm từng dòng ở cột "Tiêu chí nghiệm thu".

### A. Bảng dịch vụ + LỊCH SỬ ĐIỀU TRỊ

| ID | Note BA | Mock | Tiêu chí nghiệm thu |
|---|---|---|---|
| REQ-A1 | "Bỏ cái này giúp anh" (ô cạnh chip Trạng thái) | f1 | Cột Trạng thái của bảng dịch vụ **không còn** chữ "N lần" cạnh chip |
| REQ-A2 | "Update UI cho cột phiếu Labo giống như vầy … id phiếu labo hiển thị là phiếu mới nhất – on-click thì mở popup phiếu labo" | m385 | Cột Phiếu Labo, từ trên xuống: (1) chip trạng thái của **phiếu mới nhất** (không tính phiếu đã huỷ), màu theo `laboStatusPill`; (2) mã `LABO-…` chữ indigo đậm, bấm **mở popup Labo** của phiếu đó; (3) `Đã nhận: dd/mm/yyyy HH:mm` khi phiếu đã nhận hàng, nếu chưa nhận thì `Dự kiến giao: dd/mm/yyyy`; (4) `+N phiếu trước · Xem tất cả ›` khi dòng có từ 2 phiếu trở lên. Không có phiếu → "Không áp dụng" như hiện tại |
| REQ-A3 | "Phần "+1 phiếu" xem tất cả → on-click: mở sang tab Labo giúp anh (Tab mới tại view này)" | m385 | Bấm "Xem tất cả ›" mở **tab Labo của hồ sơ bệnh nhân** (`/patient/:id?tab=labo`) trong **tab trình duyệt mới**. *(Giả định G1)* |
| REQ-A4 | "lỗi status labo không đồng bộ – ấn vào phiếu labo và hoàn thành rồi nhưng ở đây vẫn hiển thị chờ Labo" | f8, f9 | Chip ở REQ-A2 luôn theo trạng thái thật (Nháp / Đã gửi Labo / Chờ kiểm tra / Trả hàng / Hoàn thành / Bảo hành / Hết hạn). Thao tác trong popup Labo (gửi, kiểm tra, trả, bảo hành, huỷ) → bảng dịch vụ **cập nhật ngay, không cần tải lại trang** (invalidate query của kế hoạch). Nguyên nhân hiện tại: `PlanLaboCell.chipOf` chỉ có 2 nhánh Bảo hành / "Chờ Labo" |
| REQ-A5 | "Dịch vụ này chưa tạo Labo nào" / "Nếu có tạo 1 hoặc nhiều hơn thì hiển thị như vầy → BN có {số phiếu} phiếu, không cho chỉnh sửa" | m6, m7 | Ô Hành động: dòng chưa có phiếu Labo → chỉ có nút "Tạo Labo". Có từ 1 phiếu (không tính phiếu huỷ) → thêm chip chỉ đọc `BN có {n} phiếu` (bấm không làm gì, không sửa được) |
| REQ-A6 | "Thay UI này giúp anh nhé – Button Tải ảnh thì vẫn cho tải lên nhé em." | m38 | Công đoạn bị khoá: checkbox/nút Hoàn thành mờ; dòng đỏ `🔒 Khoá: LABO-xxx chưa kiểm tra` + link `Xem phiếu Labo ›` (mở popup Labo, bước 2); ô có nền đỏ nhạt; **Tải ảnh vẫn bấm được** |
| REQ-A7 | Bug: "Khi kiểm tra hàng xong rồi nhưng Labo vẫn hiển thị khóa QC. Expected: khi Labo đạt cho tất cả các răng trong phiếu thì enable lại Hoàn thành. Nút Hoàn thành chỉ cho check tại ngày mà Labo đó hoàn thành; những ngày trong quá khứ không cho check nếu phiếu labo chưa hoàn thành. Ví dụ ngày 10 pass 1 răng → ngày 10 vẫn khoá; ngày 11 pass hết → ngày 11 mới cho Hoàn thành" | m24 | Luật mới trong `LaboStagePolicy.LocksCompletion` cho công đoạn `S` của dòng dịch vụ: với mỗi phiếu (không huỷ) mà `S` làm **từ** công đoạn tạo phiếu trở đi → `S` **bị khoá** nếu (a) phiếu chưa đạt QC hết răng, **hoặc** (b) `S.TreatmentDate` **trước** ngày phiếu đạt QC hết (`QualityPassedOn` = ngày của lần kiểm tra mà răng cuối cùng Đạt). Công đoạn làm trước công đoạn tạo phiếu vẫn không bị khoá (giữ như cũ). Test bằng đúng ví dụ ngày 10 / ngày 11. Trên FE: sau khi kiểm tra đạt trong popup → lịch sử điều trị mở khoá **ngay** (invalidate stage query) |
| REQ-A8 | "Bỏ nút này đi" (Kích hoạt bảo hành) | m230 | Nút "Kích hoạt bảo hành" (`StageLaboWarrantyButton`) **không còn** trong ô Hành động |
| REQ-A9 | "Đổi button text → "Bảo hành dịch vụ" – On-click tới màn hình bảo trì" + D1 | m230 | Nút xanh đổi nhãn thành **"Bảo hành dịch vụ"**. Bấm → mở trang kế hoạch của dòng đó, **tab Bảo hành** (`?tab=warranty`), cuộn tới / làm nổi dòng dịch vụ đó trong card "Tình trạng bảo hành theo dịch vụ". Nút **không** còn mở `StageFollowUpDialog` ở chế độ bảo hành (tái khám giữ nguyên). Trạng thái mờ "Không bảo hành" giữ như cũ |
| REQ-A10 | D6 | m390 | Bảng dịch vụ có thêm cột **"Bảo hành"**, đặt sau cột Phiếu Labo. Mỗi dòng tối đa 2 chip: `Nha khoa · {Chờ kích hoạt / Đã kích hoạt / Chưa đủ điều kiện}` và `Labo · {…}` (chỉ khi dòng có phiếu Labo), màu giống tab Bảo hành (cam / xanh lá / xám). Không áp dụng → `–`. Không có dòng phụ, không có YCBH |

### C. Popup Labo — 1 · Đặt hàng

| ID | Note BA | Mock | Tiêu chí nghiệm thu |
|---|---|---|---|
| REQ-C1 | "E update lại UI cho khớp với như này nhé" | m105, m106, m142, m143 | Header popup: tiêu đề "Đặt hàng" + chip trạng thái (vd "Nháp"). Thanh bước `1 · Đặt hàng / 2 · Nhận hàng & kiểm tra / 3 · Bảo hành` (bước chưa mở có ổ khoá). Lưới trường theo mock: Tên KH*, Kế hoạch* · Dịch vụ điều trị*, Bác sĩ chỉ định* (có tìm kiếm) · Số phiếu*, Ngày gửi* · Nhà cung cấp* (có tìm kiếm), Ngày nhận dự kiến* |
| REQ-C2 | "Cái này bỏ luôn giúp anh không cần giờ đâu – Dưới log db lưu lại timestamp lúc tạo phiếu là được" | m28 | **Không còn** ô Giờ gửi và Giờ nhận. Ngày gửi / Ngày nhận dự kiến chỉ còn ngày. Giờ tạo phiếu lấy từ `CreationTime` (đã có). Sau khi gửi, Ngày gửi / Ngày nhận dự kiến chỉ đọc (m144). Mọi chỗ khác in "Dự kiến giao" bỏ giờ |
| REQ-C3 | "Bỏ bắt buộc đi giúp anh" (Ảnh đính kèm) + D2 | m28, m139 | "Ảnh đính kèm chung" **không có `*`**; gửi Labo khi chưa có ảnh nào **thành công**. BE: `EnsureImageCount(submitting: true)` không còn đòi tối thiểu 1 ảnh; vẫn tối đa 5 |
| REQ-C4 | "Chỗ này căn hiển thị tầm 2–3 dịch vụ đầu tiên → nhiều hơn → hiển thị xem thêm – On-click: mở popup mới cho phép người dùng chọn dịch vụ" | m134 | Dòng "Dịch vụ Labo*": 3 chip đầu, chip được chọn màu tím có "✓"; khi có hơn 3 dịch vụ → nút viền "Xem thêm dịch vụ ›". Dòng "Vật liệu*" làm giống hệt: "Xem thêm vật liệu ›". Dịch vụ đã chọn nằm ngoài 3 chip đầu → vẫn hiện thành chip được chọn |
| REQ-C5 | "On click: xem thêm dịch vụ / xem thêm vật liệu – Em sử dụng model này – Chỉ cho phép chọn 1 dịch vụ. Khi chọn xong dịch vụ thì danh sách và popup danh sách Vật liệu cũng phải tự động filter theo dịch vụ đã chọn" | m158 | Modal "Chọn dịch vụ Labo · {n} dịch vụ": ô tìm "Tìm theo tên dịch vụ, mã hoặc vật liệu…" (không phân biệt dấu); chip nhóm kèm số lượng (Tất cả n / theo nhóm); "Dùng gần đây"; danh sách **radio** gom theo nhóm (tên, dòng phụ, "N vật liệu"); footer "Đã chọn: X", Huỷ / Chọn dịch vụ. **Chọn một.** Modal vật liệu dùng chung khung, chỉ liệt kê vật liệu của dịch vụ đã chọn; đổi dịch vụ thì xoá vật liệu không còn hợp lệ |
| REQ-C6 | "Current: Sơ đồ răng không cho phép chọn răng. Expected: cho phép bác sĩ chọn răng để tạo Labo; đếm số lượng bác sĩ đã chọn" + "Cái button Răng là mở sơ đồ răng lên chọn số răng; R12… là hiển thị text cho coi thôi" | m134 | Dòng "Răng*": nút tím có icon răng mở sơ đồ răng **chọn được** (thêm/bỏ răng); chip `R11 R12 R13` chỉ để xem; `Số lượng: {n}` (+ "· cầu n đơn vị" khi Kiểu nhịp là cầu). Bảng thông số thêm/bớt dòng theo răng đã chọn |
| REQ-C7 | "Chỗ này cho phép người dùng nhập cấu hình cho từng răng" + D3 | m139, m149 | Bảng "Thông số từng răng", hint "Nhiều màu ghi cách nhau «/», VD: A1/A2/A3". Cột: Răng · Màu răng* · Đường hoàn tất* (select) · Kiểu nhịp (select) · **Khớp cắn (select, sau Kiểu nhịp)** · Ảnh (thumbnail + "+") · Ghi chú cho Labo ("Không bắt buộc"). Dòng thiếu trường bắt buộc tô đỏ nhạt; footer báo `R13 chưa chọn đường hoàn tất.`; đủ thì `Đủ thông tin cho n răng.` BE kiểm tra lại cùng luật khi Gửi Labo |
| REQ-C8 | "Nếu dùng chung thông số cho tất cả thì hiển thị như bên dưới. Validate: khi dùng chung 1 thông số nhưng khi qua nhận hàng và kiểm tra thì vẫn phải tách riêng ra mỗi răng là 1 thông tin" | m154 | Checkbox "Dùng chung 1 thông số cho tất cả răng": bảng còn 1 dòng `R11, R12, R13`, caption "Thông số trên áp dụng cho cả 3 răng. Bỏ chọn «Dùng chung» để chỉnh riêng từng răng – giá trị chung được điền sẵn vào mỗi dòng." Bỏ tick → mỗi dòng nhận sẵn giá trị chung. **DB luôn lưu từng răng một dòng** (`bd_labo_order_teeth`); bước 2 hiện từng răng riêng |
| REQ-C9 | D7 | m139 | Cột Ảnh của mỗi răng: upload thật lên MinIO, xem/xoá được, gắn với răng (lưu được, tải lại trang vẫn còn). Chế độ dùng chung: ảnh của dòng chung gắn cho mọi răng *(Giả định G2)* |
| REQ-C10 | footer | m139, m143 | Footer: Huỷ · Lưu nháp · **"Gửi Labo & in phiếu"** (gửi xong mở bản in phiếu Labo như nút cũ) |

### D. Popup Labo — 2 · Nhận hàng & kiểm tra

| ID | Note BA | Mock | Tiêu chí nghiệm thu |
|---|---|---|---|
| REQ-D1 | "UI của nhận hàng và kiểm tra: update lại theo giao diện này" | m175, m281, m282, m284, m286 | Card tóm tắt: Phiếu Labo (đậm) · Tên khách hàng · Dịch vụ · Răng `11, 12, 13` · Nhà cung cấp (pill tối) · Bác sĩ chỉ định · Ngày gửi · Ngày giao dự kiến · Thông tin phiếu `Xem chi tiết ›` (mở lại bước 1, chỉ đọc). Header có chip trạng thái |
| REQ-D2 | "Bỏ số lượng và màu giúp anh" | m177 | Ô "Răng · SL · Màu" chỉ còn **"Răng"** |
| REQ-D3 | "Bỏ luôn button này đi e" (Lưu nhận hàng) | m176 | Mục A "Nhận hàng · lần N" giữ Ngày nhận thực tế*, Số lượng nhận*, Số lượng đặt, Người nhận · kiểm tra; **không còn** nút "Lưu nhận hàng" |
| REQ-D4 | "Sau khi người dùng tạo phiếu Labo thì ở đây sẽ hiển thị button này – On-click: cập nhật trạng thái = Chờ kiểm tra; chuyển sang hiển thị danh sách răng cần kiểm tra labo" | m279 | Phiếu Đã gửi Labo / Trả hàng: mục B là card khoá "Chưa bắt đầu kiểm tra · n răng chờ kiểm tra" + đoạn giải thích + nút tím **"▶ Kiểm tra Labo"**; góc phải "Chờ bắt đầu kiểm tra". Bấm → gọi `receive` với giá trị mục A (validate Ngày nhận, Số lượng nhận như cũ) → trạng thái **Chờ kiểm tra** → hiện danh sách răng |
| REQ-D5 | "Chỗ này fix cứng text "Đã trả". Số lần count dựa theo kết quả Lỗi – mỗi lần Lỗi và nhấn Trả hàng lỗi / Trả toàn bộ → +1. Nếu trả hàng lại 2 lần thì hiện text đỏ + nền đỏ nhạt" | m238, m342 | Mỗi dòng răng: `Răng 11` · màu · nút ✓Đạt / ✕Lỗi · **`Đã trả: n lần`** · `BH Labo: chưa kích hoạt / đã kích hoạt · {mã}`. `n` = số lần trả mà răng đó có kết quả **Lỗi** (tính theo từng răng; "Trả toàn bộ" chỉ cộng cho răng Lỗi). n ≥ 2 → chữ đỏ, nền đỏ nhạt. n ≥ 3 → `Đã trả: n lần ≥ 3 lần – báo quản lý` + dòng `Lần 1: {lỗi} · Lần 2: {lỗi}…` (m342). Header phải: `Đạt tất cả n/n`, `Đạt x · Lỗi y`, hoặc `Không đạt n/n → trả toàn bộ` |
| REQ-D6 | "Nếu răng bị lỗi thì hiển thị 1 group như vầy, lưu riêng cho từng răng. Sau khi bấm Trả lại hàng lỗi / Trả toàn bộ thì lưu lại lịch sử. Lần kiểm tra tiếp theo hiển thị lại lịch sử gần nhất để người dùng coi lại; người dùng có thể chỉnh sửa và lưu lại nếu hàng vẫn lỗi, ghi nhận lần trả tiếp theo" | m278 | Răng Lỗi mở group "Kết luận R11: KHÔNG ĐẠT → trả Labo lần k": Hình ảnh lỗi (upload) + "Mô tả gửi Labo · R11 *" + "▴ Thu gọn". Răng Đạt thu gọn. Mô tả và ảnh lưu **theo răng**. Lần kiểm tra sau, răng từng lỗi được điền sẵn mô tả lần trả gần nhất; sửa được; trả tiếp tạo bản ghi lịch sử mới (không ghi đè lần trước) |
| REQ-D7 | "Nếu đạt rồi thì disabled không cần kiểm tra nữa" | m342 | Răng đã Đạt ở lần trước: dòng mờ, không bấm Đạt/Lỗi được, ghi `Đạt lần k · đã lắp dd/mm` / `không có trong lần giao này` |
| REQ-D8 | "Nếu bật bảo hành rồi thì hiển thị như vầy" | m342 | Răng đã kích hoạt BH: `BH Labo: đã kích hoạt · BH-2611-0312-13` |
| REQ-D9 | "Kiểm tra lại UI – Bỏ text chi phí phát sinh" | m294 | Form trả hàng: Ngày trả hàng* · Hẹn Labo giao lại*; **không có** "Chi phí phát sinh" |
| REQ-D10 | "2 button này hiển thị thêm số răng trả hàng trong đợt kiểm tra – Trả hàng lỗi: chỉ đếm răng không đạt; Trả toàn bộ: lấy tất cả trong phiếu" | m306, m307 | Footer: Huỷ · Huỷ phiếu (viền đỏ) · `Trả toàn bộ (n răng)` (viền đỏ, n = **mọi răng của phiếu**) · `Trả hàng bị lỗi (n răng)` (n = răng **Lỗi** trong lần kiểm tra này) · `✓ Xác nhận Labo đạt (n răng)` khi tất cả Đạt |
| REQ-D11 | "Cái này cho nó thành cái màu tím button giúp a" | m184 | Nút "Trả hàng bị lỗi" là **nút tím đặc** (primary `--bd-*`), không phải đỏ. *(m306/m307 vẽ màu đỏ; note mới hơn thắng → tím)* |
| REQ-D12 | lịch sử | m189 | Bảng "Lịch sử nhận hàng & trả hàng · theo răng": Lần·ngày · Răng · Kết quả · Lỗi · Xử lý · Hẹn giao lại; góc phải `n lần nhận · m lần trả`; dòng chú thích footer `Phiếu → QC đạt · mở khoá «Lắp»` / `Phiếu → Trả hàng · chờ Labo giao lại` |

### E. Popup Labo — 3 · Bảo hành

| ID | Note BA | Mock | Tiêu chí nghiệm thu |
|---|---|---|---|
| REQ-E1 | "Mỗi section như vầy – thêm phần upload ảnh thẻ bảo hành – không bắt buộc – chỉ cần upload ảnh – Mặt trước / Mặt sau (giống chụp lại CCCD)" | m374 | Mỗi răng (Ngày bắt đầu BH*, Số serial, Ngày hết hạn, chip Thời hạn, Điều kiện) có thêm 2 ô ảnh **Mặt trước** / **Mặt sau**: không bắt buộc, upload MinIO, xem lại được sau khi kích hoạt (cả trên tab Bảo hành) |
| REQ-E2 | "Phần lịch sử ở đây bỏ – chuyển logic này về chỗ trang danh sách cho gọn" | m374 | Popup bước 3 **không còn** phần "Thông tin thẻ / Lịch sử" theo răng (`LaboWarrantyHistory`); lịch sử này hiện trong card "Lịch sử bảo hành" của tab Bảo hành (REQ-B7) |

### B. Tab "Bảo hành" trên trang kế hoạch điều trị

| ID | Note BA | Mock | Tiêu chí nghiệm thu |
|---|---|---|---|
| REQ-B1 | "Thêm tab mới này. Đếm các dịch vụ đã được checked = Hoàn thành. Đếm phiếu Labo đã được kiểm tra đạt (phiếu labo không có răng nào có kết quả trả lại)" | m348 | Tab thứ 5 `Bảo hành {n}` sau Dư nợ, URL `?tab=warranty`. `n` = số dòng dịch vụ trạng thái **Hoàn thành** + số phiếu Labo **đạt QC và chưa từng trả răng nào** (`ReturnCount == 0`). Badge cam `{k} chờ` = số mục đang **Chờ kích hoạt** (Nha khoa + Labo); k = 0 thì ẩn badge |
| REQ-B2 | "Danh sách dịch vụ sẵn sàng để kích hoạt bảo hành" | m348, m366 | Card "TÌNH TRẠNG BẢO HÀNH THEO DỊCH VỤ", góc phải `Hôm nay: dd/mm/yyyy`. Chip lọc `Tất cả n · ● Sẵn sàng kích hoạt n · Đã kích hoạt n · Chưa đủ điều kiện n`. Cột: Dịch vụ · răng (+ BS điều trị + mã LABO) · Hoàn thành (ngày / "Đang điều trị · công đoạn …") · 🛡 Bảo hành nha khoa · ⚗ Bảo hành Labo · Thao tác. Liệt kê mọi dòng không huỷ của kế hoạch. Một dòng thuộc **Sẵn sàng** nếu có cột Chờ kích hoạt; nếu không, thuộc **Đã kích hoạt** nếu có cột đã kích hoạt; còn lại là **Chưa đủ điều kiện** |
| REQ-B3 | — | m348 | Ô **Nha khoa**: `Chờ kích hoạt` (dòng Hoàn thành, `WarrantyDays > 0` trong danh mục, còn răng chưa có thẻ) · `Đã kích hoạt · n thẻ` · `Chưa đủ điều kiện` (chưa Hoàn thành) · `–` (`WarrantyDays = 0`). Ô **Labo**: `Chờ kích hoạt` (có phiếu đạt QC còn răng Đạt chưa có thẻ) · `Đã kích hoạt · n thẻ` · `Chưa đủ điều kiện` (có phiếu chưa đạt QC) · `–` (không có phiếu) |
| REQ-B4 | "On-click button Bảo hành → mở popup bảo hành. Nếu là Bảo hành Labo thì mở phiếu Labo → tự động điều hướng tới tab số 3 bảo hành; Loại bảo hành = Bảo hành Labo" | m348 | Thao tác: nút xanh `🛡 Bảo hành dịch vụ` khi Nha khoa = Chờ kích hoạt; nút hồng `⚗ Bảo hành Labo` khi Labo = Chờ kích hoạt; `Xem thẻ ›` khi đã có thẻ (cuộn tới card phiếu đã kích hoạt, lọc theo dòng). Bảo hành Labo mở popup Labo (`laboModal=order&laboRowId=…&laboStep=warranty`) đúng phiếu đang chờ |
| REQ-B5 | "Nếu là bảo hành nha khoa thì làm 1 popup riêng hiển thị thông tin bảo hành; Loại bảo hành = Bảo hành dịch vụ" + D9 | — | Popup mới "Bảo hành dịch vụ", khung giống bước 3 Labo: header dịch vụ · BS · ngày hoàn thành; tab theo răng (dòng không có răng → một mục); mỗi răng: Ngày bắt đầu bảo hành* (mặc định hôm nay, không trước ngày Hoàn thành) · Thời hạn (chip mặc định `Theo danh mục · {WarrantyDays} ngày` + các chip tháng như Labo + Khác) · Ngày hết hạn (tự tính, chỉ đọc) · Điều kiện bảo hành · ảnh thẻ Mặt trước/Mặt sau (không bắt buộc). Không có Số serial. Nút `Kích hoạt bảo hành (n răng)`. Mã thẻ theo D4 |
| REQ-B6 | "Click nút này thì scroll xuống dưới, tự động filter lịch sử bảo hành của mã phiếu đã chọn – default lịch sử hiển thị tất cả theo timeline giảm dần" | m360, m361 | Card "PHIẾU BẢO HÀNH ĐÃ KÍCH HOẠT": chip `Tất cả n · Nha khoa n · Labo n`, select sắp xếp `Hết hạn sớm nhất` (mặc định) / `Mới kích hoạt nhất`. Cột: Mã phiếu (thẻ Labo có thêm dòng mã LABO) · Loại (chip Nha khoa xanh / Labo hồng) · Dịch vụ · răng (`R36 · BS. …` hoặc `R11 · {nhà cung cấp}`) · Hiệu lực (`từ → **đến**` + thời hạn "12 tháng" / "5 năm") · Thời gian còn lại (`Còn n ngày` + thanh tiến độ) · Trạng thái (`Còn hạn` / `Hết hạn`) · `Lịch sử ↓`. **Không có cột Lượt** (D5). Bấm `Lịch sử ↓` → cuộn tới card lịch sử, lọc theo mã thẻ đó, có nút bỏ lọc |
| REQ-B7 | "Áp dụng logic ghi nhận lịch sử ở tab số 3 bảo hành của phiếu Labo nhưng bổ sung thêm: 1. Lịch sử tạo bảo hành của dịch vụ; 2. Lịch sử bảo hành dịch vụ tạo bước bảo hành ở phiếu điều trị – chỗ này tham khảo thôi, đừng hiển thị thông tin giống như vầy" | m371 | Card "LỊCH SỬ BẢO HÀNH": chip `Tất cả · Kích hoạt / gửi thẻ · Yêu cầu bảo hành n · Labo`. Dòng thời gian gom theo ngày, **mới nhất trên cùng**, mỗi sự kiện có chip loại Labo / Nha khoa / Điều trị. Nguồn: (1) sự kiện bảo hành Labo, cùng logic `LaboWarrantyHistory` cũ; (2) kích hoạt thẻ nha khoa; (3) công đoạn bảo hành (`IsGuarantee`) tạo / hoàn thành = "Yêu cầu bảo hành". Panel phải "Yêu cầu bảo hành": Đang xử lý n · Đã hoàn tất n *(bỏ "Lượt đã dùng" theo D5)*. Nội dung sự kiện lấy từ dữ liệu thật, không chép chữ trong mock |
| REQ-B8 | "Sau khi kích hoạt bảo hành thì dịch vụ này sẽ hiển thị trong tab Tiếp tục bảo hành ở kế hoạch điều trị" | m348, m390 | Dòng có ít nhất một thẻ (Nha khoa hoặc Labo) **còn hạn** → hiện trong tab **TIẾP TỤC BẢO HÀNH** (cột Chi tiết) để bắt đầu công đoạn bảo hành, kể cả khi chưa có công đoạn bảo hành nào đang mở. Dòng có công đoạn bảo hành đang mở vẫn hiện như hiện tại |

### F. Công đoạn bảo hành (tab TIẾP TỤC BẢO HÀNH)

| ID | Note BA | Mock | Tiêu chí nghiệm thu |
|---|---|---|---|
| REQ-F1 | "Cái khung này giữ nguyên giống mấy cái kia (Tiếp tục công đoạn / Thêm công đoạn)" | m390 | Dùng **đúng khung 5 cột** Chi tiết · Ngày – Nhân sự · Dịch vụ đã chọn · Nội dung điều trị · Ghi chú lịch hẹn của `StageForm`. Không dựng layout riêng theo mock 390. Cột Chi tiết không hiện tag YCBH (D6) |
| REQ-F2 | "Bác sĩ hỗ trợ" | m400 | Cột Ngày – Nhân sự của công đoạn bảo hành có thêm select **"Bác sĩ hỗ trợ"** (không bắt buộc) dưới Phụ tá; lưu được và hiện lại khi mở công đoạn. *(Giả định G3: chỉ công đoạn bảo hành)* |
| REQ-F3 | — | m394, m395 | Cột Dịch vụ đã chọn: `{dịch vụ} · R{răng}`, `Hoàn thành dd/mm/yyyy · BS…`, **"Thẻ bảo hành áp dụng *"** gồm 2 thẻ chọn một: `🛡 Nha khoa · Hạn dd/mm/yyyy` (viền xanh khi chọn) và `⚗ Labo · {n} Labo · chọn ở Nội dung điều trị` (viền hồng khi chọn). Thẻ nào không có thẻ BH còn hạn thì mờ. Bên dưới giữ Răng (chip + nút sơ đồ), Hình ảnh, Tải ảnh như khung cũ |
| REQ-F4 | "Nếu chọn bảo hành Labo – Nội dung điều trị hiển thị dropdown ở cột nội dung điều trị – Dropdown list hiển thị danh sách phiếu Labo liên quan tới phiếu điều trị đó đã được tạo bảo hành" | m394, m395 | Chọn Labo → cột Nội dung điều trị có dropdown **"Dịch vụ bảo hành · Labo *"** liệt kê phiếu Labo **của dòng dịch vụ trong phiếu điều trị này** có thẻ BH còn hạn: `{nhà cung cấp} / {dịch vụ Labo} R11, R21 · Hạn dd/mm/yyyy` (không có "lượt", D5). Bên dưới: "Nội dung điều trị *" và "Danh sách công đoạn" như cũ |
| REQ-F5 | "Nếu chọn bảo hành dịch vụ thì cột nội dung điều trị chỉ cần hiển thị nội dung điều trị" | m412, m415 | Chọn Nha khoa → chỉ có "Nội dung điều trị *" (+ Danh sách công đoạn), không có dropdown |
| REQ-F6 | — | m401 | Cột Ghi chú lịch hẹn giữ nguyên (R-1056: textarea + chip Chọn nhanh) |
| REQ-F7 | — | — | BE: tạo công đoạn bảo hành **bắt buộc** có loại thẻ (Nha khoa / Labo) và thẻ còn hạn của đúng dòng đó; loại Labo bắt buộc `LaboOrderId` thuộc dòng và có thẻ còn hạn. Sai → lỗi nghiệp vụ có mã. Sự kiện được ghi vào lịch sử bảo hành (REQ-B7) |

---

## 3. Thiết kế kỹ thuật

### 3.1 Backend (.NET 9 / ABP)

**Domain**

- `LaboStagePolicy.LocksCompletion` sửa theo REQ-A7. `LaboOrder` thêm `QualityPassedOn` (tính từ `PassedAt` lớn nhất của các răng khi đã đạt QC hết). Bỏ `OrderAwaitingWarranty` khỏi DTO công đoạn (REQ-A8).
- `LaboOrder` / `LaboOrderTooth`:
  - mỗi răng có `ToothShade`, `FinishLineId`, `RhythmId`, `BiteId`, `LabNote` và ảnh;
  - phiếu có `SharedSpec` (bool);
  - các cột thông số cấp phiếu cũ vẫn giữ cho các nơi đọc cũ (danh sách, in, export), lấy theo răng đầu tiên;
  - `Submit` kiểm tra Màu* + Đường hoàn tất* cho **từng răng**, không còn bắt buộc ảnh (REQ-C3, C7, C8).
- `SentAt` / `DueAt` nhận ngày (lưu nửa đêm giờ phòng khám); giờ tạo lấy từ `CreationTime` (REQ-C2).
- Số lần trả theo răng: `LaboOrderTooth.ReturnCount` + danh sách lỗi theo lần, lấy từ `LaboOrderRound.ToothResults` (REQ-D5). Mô tả lỗi và ảnh lỗi theo răng (REQ-D6). Bỏ chi phí phát sinh khỏi request trả hàng (REQ-D9).
- Ảnh thẻ BH Mặt trước/Mặt sau cho răng Labo (REQ-E1).
- Aggregate mới `ServiceWarrantyCard` (tên `ServiceWarranty` đã thuộc Catalogs), module TreatmentManagement, bảng `bd_service_warranty_cards`:
  - cột: `Id`, `BranchId`, `PatientId`, `TreatmentPlanId`, `TreatmentServiceId`, `ToothNumber?`, `Code`, `StartDate`, `EndDate`, `DurationDays`, `Conditions?`, ảnh trước/sau, `ActivatedAt`, `ActivatedById`, audit;
  - unique `(TreatmentServiceId, ToothNumber)` có lọc soft-delete;
  - factory `Activate(...)` kiểm tra: dòng đã Hoàn thành, `WarrantyDays > 0`, ngày bắt đầu ≥ ngày hoàn thành, răng thuộc dòng và chưa có thẻ.
- `TreatmentStage` thêm `SupportDoctorId?`, `WarrantyKind?` (Service / Labo), `WarrantyLaboOrderId?`. Domain kiểm tra REQ-F7.
- Error codes mới nối tiếp: `Labo:0034+`, `TreatmentManagement:` (xem số cuối trước khi thêm); có bản dịch vi/en.

**Migrations** (một migration mỗi giai đoạn có đổi schema; chạy bằng DbMigrator):

| Giai đoạn | Migration |
|---|---|
| C | Cột thông số trên `bd_labo_order_teeth`; `SharedSpec`; gắn ảnh theo răng (`bd_patient_images.LaboToothNumber` hoặc tương đương) |
| D | Mô tả / ảnh lỗi theo răng theo lần trả; bỏ chi phí phát sinh (giữ cột cũ để đọc, không ghi nữa) |
| E | Ảnh thẻ trước/sau trên răng Labo |
| B | Bảng `bd_service_warranty_cards` |
| F | 3 cột mới trên `bd_treatment_stages` |

**API** (ABP AppService, lọc chi nhánh ở AppService, quyền kiểm tra ở server):

| Endpoint | Mục đích |
|---|---|
| `GET treatment-plans/{id}/warranty-overview` | 3 card của tab Bảo hành + số trên tab + số "chờ" + đếm từng chip lọc |
| `POST treatment-services/{lineId}/warranty` | Kích hoạt bảo hành nha khoa (REQ-B5) |
| `POST labo-orders/{id}/warranty` multipart (`cards[i].*` + `cardPhotos` / `cardPhotoTeeth` / `cardPhotoSides`, Mặt trước 1 / Mặt sau 2) — ảnh thẻ Labo gửi cùng lúc kích hoạt; bản JSON cũ vẫn chạy. Ảnh sai răng / trùng mặt / lệch số lượng → 403 `Labo:0036`; mặt không tồn tại → 400 (model binding) | REQ-E1 (đã làm) |
| `POST/DELETE` ảnh thẻ (MinIO) cho thẻ nha khoa | REQ-B5 |
| Sửa `labo-orders` POST/PUT/submit/receive/check/warranty | Hợp đồng DTO mới (răng, ngày, trả hàng) |
| Sửa API tạo/sửa công đoạn | `supportDoctorId`, `warrantyKind`, `warrantyLaboOrderId` |
| Plan detail DTO | Thêm trạng thái chip Labo đầy đủ, `laboOrderCount`, `latestLabo{code,status,receivedAt,dueAt}`, `warrantyChips` (REQ-A2, A10) |

**Quyền**:
- Đọc tab Bảo hành theo quyền xem kế hoạch điều trị.
- Kích hoạt BH nha khoa dùng quyền **cập nhật công đoạn điều trị** đang có *(Giả định G4: không tạo permission mới — tránh lỗi cache Redis của permission mới)*.
- Thao tác Labo giữ `treatmentLabo`.

### 3.2 Frontend (React 19 / AntD 6 / TanStack Query)

| Khu vực | File chính (dự kiến) |
|---|---|
| A | `treatment-management/components/plan-detail/PlanLaboCell.tsx` (dựng lại), `serviceColumns.tsx` (bỏ "N lần", thêm cột Bảo hành), `PlanWarrantyChips.tsx` (mới); `patient-management/.../stage/StageHistory.tsx`, `StageLaboParts.tsx` (bỏ `StageLaboWarrantyButton`, UI khoá mới, chip "BN có n phiếu"), `StageWarrantyButton.tsx` (nhãn + điều hướng); invalidate query trong `labo/api/laboMutations.ts` |
| C | `labo/components/workflow/LaboOrderStep.tsx`, `order-dialogs/*` (bỏ giờ), `LaboServicePickerModal.tsx` + `LaboMaterialPickerModal.tsx` (mới), `LaboToothSpecTable.tsx` (mới, có chế độ dùng chung), `LaboToothSpecRow.tsx`, `useLaboOrderForm.ts`, `labo-order-dialog.css` |
| D | `labo/components/check/*`: `LaboReceiveSection` (bỏ nút lưu), `LaboCheckStartCard.tsx` (mới), `LaboToothCheckList` / `LaboToothCheckRow` (Đã trả, BH Labo, disabled), `LaboToothDefectGroup.tsx` (mới), `LaboCheckFooter` (số răng trên nút, nút tím), `LaboRoundHistoryTable`, `LaboReturnFields` (bỏ chi phí), `labo-check.css` |
| E | `labo/components/warranty/LaboWarrantyToothForm.tsx` (+ ảnh thẻ), bỏ `LaboWarrantyHistory` khỏi popup; `components/WarrantyCardPhotos.tsx` (shared, dùng cả cho B5) |
| B | `treatment-management/components/plan-warranty/`: `PlanWarrantyTab.tsx` (container), `WarrantyStatusCard.tsx`, `ActivatedWarrantyCard.tsx`, `WarrantyHistoryCard.tsx`, `ServiceWarrantyDialog.tsx`, `useWarrantyHistoryFilter.ts`, `plan-warranty.css`; `api/warrantyApi.ts`, `warrantyQueries.ts`, `warrantyMutations.ts`, `warrantyAdapters.ts`; `planDetailTypes.ts` thêm `PLAN_TAB.warranty` |
| F | `stage/stageModel.ts` (`continueWarranty` gồm dòng có thẻ còn hạn), `StageForm.tsx` / `useStageComposer.ts` (Bác sĩ hỗ trợ, thẻ áp dụng, dropdown Labo), `StageWarrantyCardPick.tsx` (mới), `StageLaboWarrantySelect.tsx` (mới) |

Quy tắc: component ≤ 150 dòng, Container/Presenter, không `any`, không inline style (chỉ CSS custom property cho phần trăm thanh tiến độ), i18n vi/en cho mọi chuỗi, phân trang chung `useTablePagination.buildConfig`, bảng có kẻ dọc (R-997), header bảng indigo (R-1075).

---

## 4. Giả định (reviewer cần xác nhận nếu thấy sai)

| ID | Giả định | Lý do |
|---|---|---|
| G1 | "Xem tất cả ›" mở tab Labo của hồ sơ bệnh nhân trong **tab trình duyệt mới** | Note: "mở sang tab Labo (Tab mới tại view này)"; trang kế hoạch không có tab Labo, hồ sơ bệnh nhân thì có |
| G2 | Chế độ "Dùng chung": ảnh của dòng chung gắn cho mọi răng | Note C8 chỉ nói tách thông số theo răng |
| G3 | "Bác sĩ hỗ trợ" chỉ có ở công đoạn bảo hành | Ô note 399 nằm trong phần "Công đoạn bảo hành" |
| G4 | Không tạo permission mới cho kích hoạt BH nha khoa; dùng quyền cập nhật công đoạn | Trước đây BH là một thao tác của công đoạn |
| G5 | ~~`xx` trong mã BH nha khoa = số răng 2 chữ số; dòng không có răng → `00`~~ **Bỏ (01/11, R-1090)**: `xx` là số thứ tự từ 01 theo dòng + ngày bắt đầu, Dịch vụ + Labo đếm chung (xem D4). Thẻ cũ đuôi số răng giữ nguyên, chờ owner | Mock: BHPK-…-36 / -37 / -11 (đã bị BA sửa) |
| G6 | Thẻ BH nha khoa không cần "huỷ / sửa" trong đợt này | BA không mô tả |
| G7 | Nút "Trả hàng bị lỗi" màu tím (note 187) dù m306/m307 vẽ đỏ | Note là chỉ thị trực tiếp của BA |
| G8 | Phiếu Labo cũ (trước P3110, thông số cấp phiếu) hiển thị thông số đó cho mọi răng; không cần migrate dữ liệu cũ thành từng răng ngoài việc chép giá trị phiếu vào răng | Giữ tương thích dữ liệu đã có trên staging |
| G9 | Group Lỗi "▴ Thu gọn" chỉ ẩn phần nhập; khi bấm trả hàng mà mô tả còn trống thì mọi group mở lại và báo lỗi | Thu gọn là thao tác xem, không được bỏ qua validate |
| G10 | Góc phải "Không đạt n/n → trả toàn bộ" chỉ khi **mọi răng của phiếu** đều Lỗi; còn răng đã Đạt lần trước thì ghi `Đạt x · Lỗi y` và footer vẫn có cả hai nút | Tránh mâu thuẫn chữ "trả toàn bộ" với nút "Trả hàng bị lỗi" đang bật |
| G11 | Răng đã Đạt lần trước hiện dòng khoá `Đạt lần k · chờ lắp` (chưa lắp) hoặc `Đạt lần k · đã lắp dd/mm` | m342 chỉ vẽ "đã lắp"; chưa lắp cần chữ riêng |
| G12 | "Trả toàn bộ" mở lại mọi răng: lần giao sau kiểm tra lại cả răng từng Đạt | Labo nhận lại cả phiếu |
| G13 | `Đã trả: n lần` trong lúc đang kiểm tra đã tính luôn lần trả sắp bấm (răng Lỗi hiện n+1) | Khớp tiêu đề "trả Labo lần k" cùng dòng |
| G14 | Ô màu cạnh "Răng N" là một chip màu ngà cố định, không đổi theo mã màu | Mock vẽ một màu cho mọi răng |
| G15 | Lần kiểm tra sau, mô tả răng điền sẵn mô tả **lần trả gần nhất** của răng đó; ảnh không điền sẵn (phải tải ảnh mới cho lần trả mới) | Note "hiển thị lại lịch sử gần nhất… có thể chỉnh sửa"; ảnh lần trước vẫn xem trong lịch sử |
| G16 | Ngày hoàn thành của dòng dịch vụ = ngày điều trị muộn nhất của các công đoạn đã hoàn thành (không tính công đoạn bảo hành / bị thay thế); dòng đánh Hoàn thành tay không có công đoạn → ngày sửa cuối của dòng theo giờ phòng khám | BA không định nghĩa "ngày hoàn thành"; ngày bắt đầu BH không được trước ngày này |
| G17 | API tab Bảo hành đặt dưới `api/v1/app/patient-treatments/{planId}/…` thay vì `treatment-plans/…` / `treatment-services/…` như §3.1 | Theo controller kế hoạch điều trị đang có; cùng kiểm tra chi nhánh + phạm vi điều trị |
| G18 | Bảng "Tình trạng bảo hành" và "Phiếu bảo hành đã kích hoạt" **không phân trang** (`pagination={false}`) | Một phiếu điều trị chỉ có vài chục dòng/thẻ; mock không vẽ thanh phân trang, và lọc "Xem thẻ ›" cần thấy mọi thẻ của dòng |
| G19 | Thời hạn thẻ hiện theo chữ của chip chọn ("1 năm", "6 tháng"), thẻ "Theo danh mục" hiện "{n} ngày" — m360 vẽ "12 tháng" | Cùng một cách gọi với chip trong popup, tránh hai chữ cho cùng một thời hạn |
| G20 | Dòng phụ dưới sự kiện kích hoạt (m371) = `BS. {bác sĩ của thẻ} · {thời hạn}` | Mock ghi tên bác sĩ; dữ liệu thật có bác sĩ điều trị của dòng |
| G21 | ~~Ô chọn thẻ bên trái ghi "Nha khoa"~~ → **bỏ 01/11**: owner chỉ mock m415, ô ghi **"Dịch vụ"** như mock (chip / cột ở tab Bảo hành vẫn "Nha khoa" theo m348) | Cùng tên với cột "Nha khoa" của tab Bảo hành; "Dịch vụ" trùng nghĩa với cột "Dịch vụ đã chọn" |
| G22 | "Bác sĩ hỗ trợ" (REQ-F2) = trường `secondStaffId` đã có trên mọi form công đoạn — không thêm trường mới | Trường đã tồn tại, cùng nhãn; G3 thu hẹp lại thành "đã có sẵn" |
| G23 | Được mở công đoạn bảo hành khi dòng còn **ít nhất một thẻ còn hạn** (Nha khoa `EndDate ≥ hôm nay`, hoặc răng Labo đã kích hoạt còn hạn) — thay cho đếm ngày theo danh mục từ ngày hoàn thành như trước | Thẻ là nguồn thật của thời hạn sau P3110 (thời hạn chọn được 6 tháng…5 năm); **cần owner xác nhận** |
| G24 | Icon bảo hành ở bảng điều trị của hồ sơ và "Bảo hành" ở dòng lịch sử điều hướng sang tab Bảo hành của phiếu (`planDetailPath(..., PLAN_TAB.warranty, lineId)`) như nút của bảng dịch vụ; nhánh "Tạo bảo hành" cũ trong popup tái khám bị gỡ | Owner chốt câu 1: "navigate qua tab Bảo hành" |
| G25 | Dropdown "Dịch vụ bảo hành · Labo" dòng 1 = nhà cung cấp, dòng 2 = `{vật liệu của phiếu} {răng} · Hạn {ngày}` (vật liệu = `LaboMaterial.Name`, phiếu cũ không có vật liệu → bỏ phần vật liệu) | m394 vẽ "Zirconia Cercon HT R11, R21 · Hạn 06/11/2031" |

## 5. Ngoài phạm vi

- Cột "Lượt", số lượt bảo hành, "R36 đã hết lượt" (D5).
- Mã YCBH và tag YCBH ở cột Chi tiết (D6).
- Dòng phụ trong cột Bảo hành của bảng dịch vụ (D6).
- Ký số, in thẻ bảo hành.
- Đồng bộ lên main (chỉ develop; lên main khi owner yêu cầu).

---

## 6. Kế hoạch theo giai đoạn

| Giai đoạn | R-id (dự kiến) | Nội dung | Migration |
|---|---|---|---|
| A | R-1084 | REQ-A1…A10 (A10 cần dữ liệu của B → làm phần chip sau khi xong B) | không |
| C | R-1085 | REQ-C1…C10 | có |
| D | R-1086 | REQ-D1…D12 | có |
| E | R-1087 | REQ-E1, E2 | có |
| B | R-1088 | REQ-B1…B8 | có |
| F | R-1089 | REQ-F1…F7 | có |

Mỗi giai đoạn: BE domain → BE API tests (xanh) → FE → e2e thật → `/simplify` → chạy thật trên trình duyệt → cập nhật tài liệu.

---

## 7. Kiểm thử

### 7.1 BE — API integration (PostgreSQL thật, `BlueDental.HttpApi.Host.Tests`)

| Test | Kiểm tra |
|---|---|
| Labo submit | Thiếu Màu / Đường hoàn tất ở 1 răng → lỗi; đủ → Sent; 0 ảnh → vẫn gửi được; dùng chung → mỗi răng một dòng trong DB |
| Labo ngày | Request không có giờ; `SentAt` / `DueAt` là ngày; `CreationTime` có |
| Kiểm tra / trả | `receive` từ Sent → AwaitingCheck; trả hàng lỗi 2 lần → `ReturnCount` răng = 2; trả toàn bộ chỉ cộng cho răng Lỗi; mô tả lỗi theo răng còn ở lần sau; không còn chi phí phát sinh |
| Khoá công đoạn (REQ-A7) | Kịch bản ngày 10 / ngày 11: ngày 10 khoá, ngày 11 mở, công đoạn trước công đoạn tạo phiếu không khoá |
| BH Labo | Ảnh trước/sau lưu và đọc lại được |
| BH nha khoa | Kích hoạt: mã đúng `BH-{line}-{ddMMyyyy}-{xx}` (xx từ 01 theo dòng + ngày, Labo đếm chung, kích hoạt đồng thời không trùng — R-1090); dòng chưa Hoàn thành → lỗi; `WarrantyDays = 0` → lỗi; trùng răng → lỗi; chi nhánh khác → 403/404; không quyền → 403 |
| Overview | Số trên tab, số "chờ", phân loại 3 nhóm, danh sách thẻ, lịch sử gộp 3 nguồn, sắp xếp mới nhất trước |
| Công đoạn bảo hành | Thiếu loại thẻ → lỗi; Labo không thuộc dòng / thẻ hết hạn → lỗi; `SupportDoctorId` lưu và đọc lại |

### 7.2 FE — Playwright full-stack (đăng nhập thật, không chặn API, chạy trên `vite preview`)

| Spec | Nội dung |
|---|---|
| `labo-workflow.spec.ts` (sửa) | Đặt hàng mới (modal dịch vụ, chọn răng trên sơ đồ, bảng thông số, dùng chung, ảnh theo răng, không giờ, không ảnh vẫn gửi) → Kiểm tra Labo → Lỗi 1 răng → trả (số răng trên nút) → nhận lại → Đạt → Bảo hành (ảnh thẻ) → tải lại trang, kiểm tra dữ liệu còn |
| `plan-detail-labo.spec.ts` (mới) | Cột Phiếu Labo đổi trạng thái ngay sau thao tác trong popup (REQ-A4); "+N phiếu trước" mở tab mới; không còn "N lần"; cột Bảo hành |
| `stage-labo-lock.spec.ts` (mới) | Khoá / mở khoá theo REQ-A7, Tải ảnh vẫn dùng được khi khoá, chip "BN có n phiếu", không còn "Kích hoạt bảo hành", "Bảo hành dịch vụ" chuyển sang tab Bảo hành |
| `plan-warranty-tab.spec.ts` (mới) | Đếm tab, chip lọc, kích hoạt BH nha khoa qua popup, BH Labo mở bước 3, "Lịch sử ↓" lọc, không có cột Lượt |
| `warranty-stage.spec.ts` (mới) | Dòng có thẻ xuất hiện ở TIẾP TỤC BẢO HÀNH; chọn Nha khoa / Labo đổi cột Nội dung; Bác sĩ hỗ trợ lưu được; sự kiện hiện trong lịch sử bảo hành |
| Hồi quy | `labo*.spec.ts`, `patient.spec` (Labo), `treatment-stage*`, `plan-detail*`, `branch-*` |

### 7.3 So sánh hình ảnh

Chụp từng màn trong §0 ở local, đặt cạnh mock tương ứng; ghi khác biệt còn lại vào doc feature.

---

## 8. Tài liệu cập nhật khi xong

- `docs/testing/features/labo-workflow.md` (C/D/E)
- `docs/testing/features/plan-warranty.md` (mới, B/F)
- `docs/testing/01-feature-verification-registry.md` (F-86)
- `docs/testing/02-impact-map.md`
- `docs/testing/03-regression-log.md` (R-1084…)
- `docs/clone/unknowns.md` (các giả định G1–G8 nếu owner chưa xác nhận)

---

## 9. Checklist cho reviewer

- [ ] Mọi `REQ-xx` ở §2 có code tương ứng và ít nhất một test (BE hoặc e2e) chứng minh
- [ ] Không còn: "N lần", "Kích hoạt bảo hành" ở lịch sử, Giờ gửi / Giờ nhận, `*` ở ảnh đính kèm, "Lưu nhận hàng", "Chi phí phát sinh", "SL · Màu" ở tóm tắt, phần lịch sử trong popup bước 3, cột Lượt
- [ ] Khớp cắn là cột sau Kiểu nhịp
- [ ] Mã BH nha khoa đúng D4; mã thẻ Labo không đổi
- [ ] Luật khoá công đoạn đúng ví dụ ngày 10 / ngày 11
- [ ] Số trên nút Trả hàng bị lỗi / Trả toàn bộ đúng luật REQ-D10; nút Trả hàng bị lỗi màu tím
- [ ] Dùng chung thông số → DB lưu từng răng; bước 2 hiện từng răng
- [ ] Tab Bảo hành: số đếm, badge chờ, 3 card, lọc theo thẻ, lịch sử mới nhất trước
- [ ] Công đoạn bảo hành giữ khung `StageForm`; thẻ áp dụng bắt buộc; dropdown Labo chỉ phiếu của dòng đó còn hạn
- [ ] Lọc chi nhánh và kiểm tra quyền ở server cho mọi endpoint mới
- [ ] Không `any`, không hard-code text, không inline style, CSS trong folder feature, i18n vi/en đủ
- [ ] e2e chạy full-stack thật, không `page.route` / MSW

---

## 10. Nhật ký tiến độ (cập nhật liên tục — đọc mục này trước khi làm tiếp)

| Giai đoạn | Trạng thái | Ghi chú |
|---|---|---|
| A | XONG, đã kiểm (chưa commit) | — |
| C | XONG (chưa commit) | e2e labo-workflow 4/4, patient Đặt hàng 2/2, labo-api 11/11, các spec Labo khác 25/25; BE Labo: Domain 65, EF 8, App 42 xanh. Ảnh so khớp m134/m139/m158 |
| D | XONG (chưa commit) | BE: mô tả + ảnh lỗi theo răng, `returnCount`/`returnHistory` theo răng, bỏ chi phí phát sinh. FE: `LaboCheckStartCard`, `LaboToothDefectGroup`, tóm tắt 3×3, footer đếm răng + nút tím, lịch sử theo răng. e2e: labo* 41/41, patient Labo 2/2 (lần chạy đầu sau loạt dài có 1 lần timeout 30s ở "Tạo Labo opens Đặt hàng", chạy lại xanh — flaky do khởi động nguội). Ảnh so khớp m279/m278/m294/m342/m189: đã chỉnh cho khớp mock — ô răng Lỗi nền hồng nhạt + viền hồng, nút Lỗi đã chọn dạng nhạt (không đặc), vạch đứt hồng, "Hình ảnh lỗi:" chữ thường xám, ô tải ảnh viền tím, "Thu gọn" tím đậm, ô màu răng không co, dòng "đang nhập" trong lịch sử nền vàng nhạt, "Chờ lắp" chữ đen. Giả định G9–G15 |
| E | XONG (chưa commit) | BE: `PatientImage.WarrantyCardSide` (migration `20261031135031_WarrantyCardPhotoP3110`), kích hoạt BH multipart kèm ảnh thẻ, lỗi `Labo:0036`, `images[].warrantyCardSide`. FE: module dùng chung `src/components/WarrantyCardPhotos/` (ô Mặt trước / Mặt sau tỉ lệ CCCD 85.6×54, xem lightbox, xoá; `useWarrantyCardDrafts` giữ file nháp theo răng — dùng lại cho B5), hàng "Ảnh thẻ bảo hành" trong form từng răng, cột "Ảnh thẻ" trong bảng thẻ; REQ-E2 bỏ `LaboWarrantyToothTabs` + `LaboWarrantyCardInfo` (card hết bấm chọn), `LaboWarrantyHistory` giữ lại cho B7. Ảnh thẻ bị lọc khỏi ảnh phiếu (dải ảnh Đặt hàng, popup chi tiết, cột hồ sơ). e2e: labo-api REQ-E1 (sai răng / trùng mặt / lệch số → 0036, mặt 3 → 400, hợp lệ đọc lại), labo-workflow tải Mặt trước qua UI → reload → cột Ảnh thẻ có ảnh, không còn tab Thông tin thẻ / Lịch sử; labo* 42/42 (1 lần timeout đăng nhập, chạy lại xanh), patient Labo 2/2; Domain Labo+PatientImage 80/80. Ảnh so khớp m374. Chưa hỗ trợ thêm/thay ảnh sau khi kích hoạt (unknowns) |
| B | XONG REQ-B1…B7 (chưa commit); REQ-B8 chuyển sang F | **FE xong:** thư mục `plan-warranty/` (tab container, 3 card, popup `ServiceWarrantyDialog` + ảnh thẻ dùng lại `WarrantyCardPhotos`, lọc "Xem thẻ ›" / "Lịch sử ↓" có tag bỏ lọc, badge "k chờ" + "Hôm nay" trên dải tab). `LaboWarrantyHistory` đã gỡ — logic chuyển vào `PlanWarrantyHistory` (BE). **Sửa sau khi chạy lặp:** `cardCodes` của sự kiện kích hoạt sắp theo mã (ordinal) cho ổn định — trước đây theo thứ tự DB, test API lặp đôi khi đỏ. **Test:** API `plan-warranty-api.spec.ts` 7/7 + UI `plan-warranty-tab.spec.ts` 3/3 (đếm tab / chip / kích hoạt 2 đợt + reload / lọc thẻ + lịch sử), chạy `--repeat-each=2` 20/20 xanh. Hồi quy Labo + plan-detail: 36/39 lúc đầu — `treatment-plan-detail` đỏ do có thêm tab "Bảo hành0" (đã sửa spec); 2 lỗi 500 `IX_bd_labo_orders_OrderCode` là **race có sẵn** ở `NextOrderCodeAsync` (F-85, đọc-rồi-chèn) lộ ra khi một phiên khác chạy cùng bộ spec vào chung host — không thuộc P3110. Ảnh so khớp m348/m366/m360/m361/m371. Lệch có chủ đích: G18, G19, G20. **Trước đó:** domain `ServiceWarrantyCard` + `PatientImage.ServiceWarrantyCardId`, migration `20261031142735_ServiceWarrantyCardP3110` (đã áp DB thử), lỗi `Treatment:0053..0057` + bản dịch, Domain tests 11 ca xanh. Xong thêm: `PlanWarrantyAppService` (+ `PlanWarrantyOverviewBuilder`, `PlanWarrantyHistory`), `PlanWarrantyController`, build xanh. API tests `e2e/plan-warranty-api.spec.ts` 7/7 xanh (request thật, mỗi ca một phiếu điều trị riêng qua fixture `freshSlip` — phiếu dùng chung DT10 vướng lỗi có sẵn `TreatmentPlan.DiscountShareParts` âm, ghi regression log, không sửa trong P3110). Lưu ý: đóng công đoạn cuối tự chuyển dòng sang Hoàn thành. Đang: FE Thiết kế chốt ở mục "Thiết kế đã chốt cho B" bên dưới |
| F | XONG (chưa commit) | REQ-F1…F7 + REQ-B8 + chip REQ-A10. BE: `TreatmentStage.WarrantyKind` + `WarrantyLaboOrderId` (migration `20261031160612_StageWarrantyCardP3110`), lỗi `Treatment:0058..0061`, G23 (bảo hành theo thẻ). FE: card "Thẻ bảo hành áp dụng", select phiếu Labo (G25), răng theo thẻ, chuỗi mở khoá thẻ; bỏ popup "Tạo bảo hành" (G24); `PlanWarrantyChips`. e2e: `warranty-stage-api` 2/2, `warranty-stage` 2/2, `treatment-plan-detail` 13/13; hồi quy mức 3 xanh (labo* + branch-* + stage-treatment-date 53/53, patient Labo/BH 2/2, labo-workflow 4/4) trừ `stage-staff-pickers:163` (đỏ sẵn R-956) và `medical-record-sheet-facts:169` (dữ liệu, ngắt dòng) — R-1089. 01/11 sửa lỗi UI bảng Thông số từng răng ("+" lệch, hồng đậm), ảnh so khớp m139 |
| Sửa sau review (01/11) | XONG | **R-1090** mã thẻ `BH-{mã dòng}-{ddMMyyyy}-{xx}` đếm chung Dịch vụ + Labo (bảng `bd_warranty_card_sequences`, upsert khoá dòng, migration `20261031182508_WarrantyCardNumberR1090`, unique `(TreatmentServiceId, Code)`, Labo không dòng → `Labo:0037`); **R-1091** `.pd-labo-check-grid--three` (so m374); **R-1092** REQ-C2 bỏ giờ ở card tóm tắt / lịch sử / cột "Đã nhận" / Ngày trả + Hẹn giao lại; **R-1093** REQ-D6 mỗi răng Lỗi ≥1 ảnh (BE `Labo:0025` kèm răng, FE nhóm răng viền đỏ + alert). Chờ owner: thẻ cũ đuôi số răng, phiếu Labo không dòng. Test: Domain/EF xanh, e2e xanh trừ `stage-staff-pickers:163` đỏ sẵn (chi tiết cuối R-1093, regression log) |

### Thiết kế đã chốt cho B (để làm tiếp không phải đọc lại)

- **Domain:** aggregate `TreatmentManagement/ServiceWarrantyCard.cs` (`FullAuditedAggregateRoot<Guid>`), bảng `bd_service_warranty_cards`: BranchId, PatientId, TreatmentPlanId, TreatmentServiceId, `ToothNumber?` (null = dòng không có răng), Code, StartDate/EndDate (DateOnly), `DurationMonths?` (null = "Theo danh mục" → `DurationDays` = WarrantyDays), `DurationDays?`, Conditions?, ActivatedAt, ActivatedById. Unique `(TreatmentServiceId, ToothNumber)` lọc soft-delete (NULLS NOT DISTINCT); Code chỉ index (mã phiếu điều trị có thể trùng giữa bệnh nhân).
- **Mã thẻ (D4, R-1090):** `BH-{mã dòng dịch vụ}-{ddMMyyyy ngày bắt đầu}-{xx}`, xx từ 01 theo dòng + ngày, đếm chung với thẻ Labo; mã dòng (vd `DT01-03`) đã chứa mã phiếu điều trị + số thứ tự dịch vụ.
- **Kiểm tra khi kích hoạt:** dòng `Done`; `WarrantyDays > 0` trong danh mục; ngày bắt đầu ≥ ngày hoàn thành; răng thuộc dòng (dòng không răng → chỉ một thẻ null); răng chưa có thẻ; tháng 1..600. Lỗi `Treatment:0053` dòng chưa Hoàn thành, `0034` dịch vụ không có thời hạn BH, `0054` răng sai / trùng / đã có thẻ, `0055` bắt đầu trước ngày hoàn thành, `0056` tháng ngoài 1..600, `0057` ảnh thẻ sai.
- **Ngày hoàn thành của dòng (G16):** max `TreatmentDate` các công đoạn không bảo hành, không bị thay thế, đã hoàn thành; dòng hoàn thành tay không có công đoạn → ngày `LastModificationTime ?? CreationTime` của dòng theo giờ phòng khám.
- **Ảnh thẻ:** `PatientImage.ServiceWarrantyCardId?` + `WarrantyCardSide` (migration), gửi multipart cùng lúc kích hoạt như Labo (`cardPhotos` / `cardPhotoTeeth` / `cardPhotoSides`).
- **API (G17 — lệch §3.1, theo controller sẵn có):** `GET api/v1/app/patient-treatments/{planId}/warranty-overview` (quyền xem kế hoạch + phạm vi điều trị); `POST api/v1/app/patient-treatments/{planId}/services/{lineId}/warranty` JSON + multipart (quyền `TreatmentStage.Update`, G4).
- **Overview:** `tabCount` (dòng Done + phiếu Labo Completed/Warranty có ReturnCount 0 của các dòng), `pendingCount`, `rows[]` (mọi dòng trừ Huỷ/Thay thế: mã, dịch vụ, răng, BS, mã LABO, trạng thái, ngày hoàn thành, công đoạn hiện tại, cờ đã lắp Labo, ô Nha khoa + ô Labo = Pending/Activated(n)/NotEligible/None, id phiếu Labo đang chờ, nhóm Ready/Activated/NotEligible), `cards[]` (thẻ Nha khoa + răng Labo đã kích hoạt), `history[]` (Labo QC đạt / trả / kích hoạt; kích hoạt Nha khoa; công đoạn bảo hành tạo / hoàn thành; mỗi sự kiện có `cardCodes[]` cho lọc "Lịch sử ↓"), `requests{open, done}`.
- **FE:** tab `warranty` trong `PLAN_TAB_KEYS` cho mọi người xem phiếu, badge "k chờ"; ẩn thống kê tiền trên tab này. Thư mục `treatment-management/components/plan-warranty/`. Xoá `LaboWarrantyHistory` sau khi card lịch sử xong.

### Thiết kế đã chốt cho D (để làm tiếp không phải đọc lại)

- **BE hiện tại:** `LaboOrder.Receive` mở round mới (Sent/Returned → AwaitingCheck) hoặc sửa round đang mở; `ConfirmPassed` / `ReturnToLab(results, LaboReturnRequest{ReturnAll, Description, ReturnedAt, RedeliveryDueAt, CheckImageCount})`; `ReturnCount` = số round `IsReturn`. Kết quả răng mỗi round ở `LaboOrderRound._toothResults` (jsonb, `LaboRoundToothResult{ToothNumber, Result, Note}`).
- **REQ-D4:** nút "▶ Kiểm tra Labo" = gọi `receive` sẵn có (không thêm endpoint). Bỏ nút "Lưu nhận hàng"; khi đã Chờ kiểm tra, giá trị mục A vẫn gửi `receive` (sửa round đang mở) trước khi kết luận, như `conclude` đang làm.
- **REQ-D5:** số lần trả theo răng = số round `IsReturn` có kết quả răng đó là Failed — tính từ rounds (không thêm cột). Đưa ra DTO răng: `returnCount` + danh sách lỗi theo lần (`returnHistory: [{roundNo, note}]`).
- **REQ-D6:** mỗi răng Lỗi có mô tả riêng → `LaboRoundToothResult` thêm `Description` (jsonb, không cần migration cột); request trả hàng nhận mô tả theo răng; `Description` cấp phiếu = ghép mô tả các răng (giữ cột cũ). Ảnh lỗi theo răng: `PatientImage` đã có roundNo + `LaboToothNumber` → kiểm tra mỗi răng Lỗi có ≥1 ảnh (thay `CheckImageCount` tổng). Lần sau điền sẵn mô tả lần trả gần nhất của răng.
- **REQ-D9:** bỏ "Chi phí phát sinh" khỏi UI; cột cũ giữ, không ghi.
- **REQ-D12:** bảng lịch sử theo răng dựng từ rounds × toothResults ở FE.
- FE file mới: `check/LaboCheckStartCard.tsx`, `check/LaboToothDefectGroup.tsx`; sửa `LaboOrderSummaryCard` (3×3), `LaboReceiveSection`, `LaboToothCheckList`, `LaboConclusionBox`, `LaboCheckFooter` (số răng, nút tím), `LaboRoundHistoryTable`.

### Thiết kế đã chốt cho F (để làm tiếp không phải đọc lại)

- **BE (xong, e2e `warranty-stage-api.spec.ts` 2/2):** `CreateTreatmentStageDto.WarrantyKind?` (1 Nha khoa / 2 Labo) + `WarrantyLaboOrderId?`; `TreatmentStage.WarrantyKind` / `WarrantyLaboOrderId` (Tiếp tục chép sang — `ContinueAs`). `WarrantyCover.cs`: Nha khoa từ chối laboOrderId (0060), cần ≥1 thẻ còn hạn (0059), răng = null nếu có thẻ không răng, ngược lại tập răng của thẻ; Labo: phiếu thuộc dòng, chưa huỷ, có răng đã kích hoạt còn hạn (0060); răng ngoài phạm vi → 0061; thiếu loại → 0058. `warrantySourceStageId` được null (REQ-B8, dòng hoàn thành tay). Overview thẻ Labo có thêm `materialName` (G25).
- **FE thuần (`stage/stageWarranty.ts`):** `lineCovers(cards, today)` → `Map<lineId, {dental: {teeth: number[] | null, until} | null, labo: LaboWarrantyOption[]}>` (thẻ còn hạn khi `endDate >= today`, so chuỗi YYYY-MM-DD); `LaboWarrantyOption {orderId, orderCode, supplierName, materialName, teeth, until}`; hàm răng được phủ theo lựa chọn.
- **REQ-B8:** `buildStageItems(services, stages, covers?)` — tab `continueWarranty` liệt kê thêm dòng chưa có chuỗi bảo hành mở nhưng có thẻ còn hạn: `stages: []`, `teeth` = răng của dòng được thẻ nào đó phủ (thẻ không răng phủ cả dòng), `shownTeeth` = răng của dòng.
- **Chuỗi bảo hành đang mở:** giữ đường Tiếp tục; ô chọn thẻ hiện `warrantyKind` / `warrantyLaboOrderId` của chuỗi, khoá; chuỗi cũ (null) không bắt chọn.
- **Bảo hành mới:** draft thêm `warrantyKind` + `warrantyLaboOrderId`; đổi lựa chọn → răng nháp = mọi răng lựa chọn phủ, răng ngoài phạm vi mờ. Kiểm tra: bắt chọn loại; Labo bắt chọn phiếu; răng phải nằm trong phạm vi. Payload: `isGuarantee: true`, `warrantySourceStageId` = công đoạn thường (không BH, không bị thay) hoàn thành gần nhất của dòng hoặc null, `warrantyKind`, `warrantyLaboOrderId`.
- **`warrantyState`:** đổi từ đếm ngày danh mục sang "dòng còn thẻ hợp lệ" (G23).
- **UI (m390/m394/m395/m412/m415):** cột Dịch vụ đã chọn = tên đậm `{dịch vụ} · R11`, dòng xám `Hoàn thành dd/mm/yyyy · BS. …`, nhãn `Thẻ bảo hành áp dụng *`, hai ô cạnh nhau — Nha khoa (khiên xanh, `Hạn dd/mm/yyyy`, chọn = viền xanh lá + nền xanh nhạt) / Labo (bình thí nghiệm tím, `n Labo · chọn ở Nội dung điều trị`, chọn = viền tím-hồng + nền hồng nhạt); răng + nút hàm, Hình ảnh, Tải ảnh như cũ. Cột Nội dung điều trị: khi Labo → `Dịch vụ bảo hành · Labo *` (select 2 dòng: NCC đậm / `{vật liệu} R.. · Hạn ..`) trên ô `Nội dung điều trị *` placeholder `Nhập nội dung điều trị bảo hành...`; khi Nha khoa → chỉ ô nội dung + Danh sách công đoạn. Không có "lượt" (D5), không có mã YCBH (D6).
- **File FE:** `stageWarranty.ts`, hook `useWarrantyPick.ts` (tách khỏi `useStageComposer`, không làm composer dài thêm), `StageWarrantyCardPick.tsx`, `StageLaboWarrantySelect.tsx`, `stage-warranty.css`; `StageForm` tách biến thể bảo hành để ≤150 dòng.
- **G24:** icon bảo hành ở `PatientProfileTab` + "Bảo hành" ở dòng lịch sử → `planDetailPath(patient.id, stage.treatmentId, branchId, PLAN_TAB.warranty, stage.treatmentServiceId)`; gỡ nhánh guarantee trong `StageFollowUpDialog` / `useFollowUpForm` nếu sạch (Tái khám giữ).
- **A10:** cột chip `PlanWarrantyChips` trong `serviceColumns.tsx`.

### Môi trường chạy thử (tạm, xoá khi xong)

- DB `BlueDental_p291003`; BE host :5150 (bản build ở scratchpad `art`, `App__SelfUrl=http://127.0.0.1:5150`).
- FE: `npx vite build --config vite.p3110.tmp.config.ts` → `dist-p3110/`; `npx vite preview --config vite.p3110.tmp.config.ts --host 127.0.0.1` → :8180.
- e2e: `E2E_BASE_URL=http://127.0.0.1:8180 npx playwright test <spec> --workers=1 --reporter=line`.
- Khi xong tất cả: xoá `vite.p3110.tmp.config.ts`, `dist-p3110/`; cập nhật docs §8; KHÔNG commit khi owner chưa bảo.
