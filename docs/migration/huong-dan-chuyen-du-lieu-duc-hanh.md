# Hướng dẫn chuyển dữ liệu hệ thống cũ — Nha Khoa Đức Hạnh

Người đọc: BA chép dữ liệu từ file khách gửi ("Lịch sử điều trị chi nhánh NHA KHOA ĐỨC HẠNH 2.xlsx")
sang file mẫu `BlueDental_Migration.xlsx`, rồi chuyển cho bên kỹ thuật chạy import.

> File khách gửi chứa dữ liệu y tế thật. Không gửi qua kênh công khai, không đưa vào git.
> Tài liệu này chỉ có số liệu tổng và tên danh mục, không có dữ liệu bệnh nhân.

## 1. Quy trình

1. Phòng khám tạo sẵn trên BlueDental, chi nhánh cần nhập:
   - **dịch vụ** ở `/taxonomy/service` (mục 5.1);
   - **tài khoản nhân sự** cho bác sĩ và phụ tá (mục 5.2);
   - **tài khoản nhận tiền** ở `/taxonomy/payment-method`, nếu có thu chuyển khoản hoặc ví;
   - một **dịch vụ giữ chỗ** "Khám (hệ thống cũ)" và một **bác sĩ giữ chỗ** "BS hệ thống cũ" (tên tuỳ ý) cho các phiếu chỉ có ghi chú (mục 3.3).
2. Tải file mẫu mới nhất từ hệ thống (`GET /api/v1/app/data-migration/template`) hoặc lấy `docs/migration/BlueDental_Migration.xlsx`.
   Mẫu đúng có 4 sheet dữ liệu: Khách hàng, Điều trị, Thanh toán, Lịch hẹn, cộng sheet Hướng dẫn. Mẫu cũ thiếu cột tiền, sheet Thanh toán hoặc sheet Lịch hẹn thì không dùng.
3. Chép dữ liệu vào 4 sheet theo mục 2 và 3. Mỗi file khoảng **5.000 khách**, kèm đủ dòng Điều trị, Thanh toán và Lịch hẹn của đúng các khách đó (mục 6).
4. Bên kỹ thuật chạy thử (`dryRun=true`). Nếu có lỗi, họ gửi lại **file lỗi**: chính file của bạn, thêm cột "Lỗi" ở cuối mỗi sheet. Sửa đúng các dòng đó rồi gửi lại.
5. Khi chạy thử báo 0 lỗi, bên kỹ thuật chạy thật. Chỉ cần còn một lỗi là **cả file không được nhập**.
6. Chạy lại cùng một file là an toàn: Mã KH đã có ở chi nhánh sẽ được bỏ qua, cùng mọi dòng Điều trị, Thanh toán và Lịch hẹn của mã đó.
   Vì vậy không thể nhập bổ sung lịch sử cho một khách đã nhập rồi: lịch sử của một khách phải đủ ngay trong lần đầu.

## 2. Ánh xạ cột

### Sheet "Khách hàng" — mỗi khách một dòng

| File khách (sheet "Lịch sử khám") | Mẫu | Ghi chú |
|---|---|---|
| Mã KH | Mã KH \* | Không được trùng (mục 4.1) |
| Khách hàng | Họ và tên \* | Chỉ chữ, số, khoảng trắng và `- . '` (mục 4.3) |
| Điện thoại | Số điện thoại | 8–15 chữ số. Ô ghi 2 số: số đầu ở đây, số sau ở "SĐT liên hệ khẩn cấp" (mục 4.2) |
| — | Email | Phải có Số điện thoại **hoặc** Email |
| Các cột còn lại của mẫu | | File khách không có, để trống |

"Lịch sử khám" có mỗi phiếu khám một dòng, nên một khách lặp lại nhiều dòng. Ở sheet Khách hàng chỉ lấy **một dòng cho mỗi khách**.

### Sheet "Điều trị" — mỗi dòng dịch vụ một dòng

| File khách (sheet "Chi tiết điều trị") | Mẫu | Ghi chú |
|---|---|---|
| Mã KH | Mã KH \* | |
| Ngày điều trị | Ngày điều trị \* | `dd/MM/yyyy`, không sau hôm nay |
| Mã phiếu | Mã phiếu | |
| Dịch vụ | Dịch vụ \* | Đúng tên dịch vụ trên BlueDental (mục 5.1) |
| Vị trí răng | Răng | File khách luôn trống, để trống |
| "Yêu cầu điều trị", "Triệu chứng", "Chuẩn đoán" của phiếu (sheet Lịch sử khám) + Ghi chú của dòng | Nội dung điều trị | Phần của phiếu chỉ cần đặt ở dòng đầu của phiếu. Triệu chứng và Chẩn đoán ghi kèm nhãn, nối bằng "; ", ví dụ `Đau răng 36; Triệu chứng: sưng nướu; Chẩn đoán: viêm tuỷ`. File khách chỉ có 57 phiếu có Triệu chứng và 3 phiếu có Chẩn đoán; BlueDental không có ô riêng cho hai thông tin này ở lịch sử nhập cũ |
| Bác sĩ | Bác sĩ điều trị \* | Tên đăng nhập hoặc họ tên nhân sự trên BlueDental (mục 5.2) |
| Phụ tá | Phụ tá | Không bắt buộc. Nếu điền thì phải là nhân sự có trên BlueDental |
| — | Kế hoạch | Khoá gom kế hoạch (mục 3.1) |
| Số lượng | Số lượng | |
| Đơn giá gốc | Đơn giá gốc | |
| Đơn giá | Đơn giá | |
| Thành tiền | Thành tiền | |
| Đã hủy | — | File khách luôn là "Không". Dòng nào là "Có" thì không chép |

Các cột Công đoạn, Bác sĩ hỗ trợ, Trạng thái để trống. Trạng thái trống được tính là Hoàn thành.

### Sheet "Thanh toán" — mỗi lần thu tiền một dòng

| File khách (sheet "Thanh toán") | Mẫu | Ghi chú |
|---|---|---|
| Mã KH | Mã KH \* | |
| Mã phiếu | Mã phiếu | Cần Mã phiếu **hoặc** Kế hoạch |
| — | Kế hoạch | Dùng khi muốn tiền chia cho cả kế hoạch (mục 4.5) |
| Ngày thu | Ngày thu \* | |
| Số tiền | Số tiền \* | Số tiền 0 thì dòng tự bị bỏ qua, không cần xoá |
| — | Hình thức | File khách không có. Để trống = Tiền mặt |
| Người thu | Người thu | Nhân sự trên BlueDental. Để trống = người chạy import |
| Mã thanh toán | Ghi chú | Ví dụ "Mã thanh toán 12345", để đối chiếu về sau |

### Sheet "Lịch hẹn" — mỗi lịch hẹn một dòng

| File khách (sheet "Lịch hẹn") | Mẫu | Ghi chú |
|---|---|---|
| Mã KH | Mã KH \* | |
| Ngày hẹn | Ngày giờ hẹn \* | `dd/MM/yyyy HH:mm`. Chỉ có ngày, hoặc giờ 00:00 (456 dòng), thì hệ thống lấy 09:00 |
| — | Thời lượng (phút) | File khách không có. Để trống = 30 phút |
| Bác sĩ | Bác sĩ \* | Như cột Bác sĩ điều trị (mục 5.2). **159.861 dòng** để trống: ghi "BS hệ thống cũ" |
| Đã khám | Trạng thái | **Để trống** (mục 3.5). Không chép "Có" thành "Đã đến" |
| Lời dặn | Nội dung | Chỉ 894 dòng có chữ |
| — | Lý do hủy | File khách không có lịch hủy, để trống |
| Id KH, Mã phiếu, Lần hẹn, Ngày tạo, Lí do hẹn | — | Không chép. Lí do hẹn luôn trống |

File khách có **478.821 dòng** hẹn, từ năm 2016 đến nay. Bỏ các dòng sau, đừng chép:

- **5.472 dòng không có Ngày hẹn**, trong đó 4.695 dòng "Đã khám = Không". Không có ngày thì không dựng được lịch.
- **6 dòng ghi năm 1980** (mục 4.4).

### Không nhập

| File khách | Lý do |
|---|---|
| Tổng tiền, Đã trả, Còn lại, Nợ trước | Hệ thống tự tính từ Thành tiền và các lần thu |

## 3. Cách hệ thống dựng dữ liệu

### 3.1 Gom kế hoạch điều trị

- Các dòng cùng Mã KH và cùng **Kế hoạch** gộp thành một kế hoạch, tên kế hoạch là chính chữ trong cột đó.
- Kế hoạch để trống thì gom theo **Mã phiếu**: mỗi phiếu cũ thành một kế hoạch.
- Mã phiếu cũng trống thì gom theo ngày.
- Mã DT01, DT02… đánh theo ngày đầu tiên của mỗi kế hoạch.

**Nên ghi Kế hoạch = "Chỉnh nha"** cho mọi dòng nhóm "chỉnh hình hô & móm" của một khách. Nhóm này có 178.610 dòng, mỗi khách chỉnh nha có 50–165 phiếu.
Nếu để mỗi phiếu thành một kế hoạch, hồ sơ chỉ hiện được 100 kế hoạch đầu, phần còn lại bị khuất.

### 3.2 Tiền

- Dòng có **Đơn giá** mở một dịch vụ mới trong kế hoạch với giá đó.
  - Thành tiền trống thì bằng Số lượng × Đơn giá.
  - Thành tiền nhỏ hơn Số lượng × Đơn giá thì phần chênh là giảm giá.
  - Thành tiền lớn hơn Số lượng × Đơn giá là **lỗi**.
  - Đơn giá gốc trống, hoặc nhỏ hơn Đơn giá, thì lấy bằng Đơn giá. File khách có 453 dòng như vậy, không cần sửa.
- Dòng **không có Đơn giá** là một lần điều trị tiếp theo (một công đoạn) của dịch vụ cùng tên gần nhất trong kế hoạch, không tính thêm tiền.
- Để trống mọi cột tiền thì dịch vụ có giá 0 và không phát sinh công nợ.

### 3.3 Phiếu chỉ có ghi chú

File khách có **258.413 phiếu khám** (trên tổng 478.819) không có dòng dịch vụ nào, đa số từ năm 2025 trở đi. Mỗi phiếu như vậy ghi thành một dòng Điều trị:

- Dịch vụ: "Khám (hệ thống cũ)";
- Bác sĩ điều trị: "BS hệ thống cũ";
- Nội dung điều trị: "Yêu cầu điều trị" của phiếu;
- Kế hoạch: "Lịch sử cũ".

Như vậy mỗi khách chỉ có một kế hoạch "Lịch sử cũ" chứa các lần khám này.

### 3.4 Thanh toán

- Tiền được chia vào các dịch vụ của Mã phiếu ghi trên dòng trước, rồi đến các dịch vụ khác cùng kế hoạch. Mỗi dịch vụ nhận tối đa phần còn phải trả của nó.
- Tiền còn dư sau khi chia là **lỗi** (mục 4.5).
- Phiếu thu có trạng thái Đã thu, ghi ngày thu cũ lúc 17:00. Mã phiếu thu dạng `THANHTOAN-{số}/{mã kế hoạch}/{năm}`.
  Một dòng mà tiền chia vào hai kế hoạch thì sinh hai phiếu thu, mỗi kế hoạch một phiếu.
- Phiếu thu nhập từ hệ thống cũ **không** hiện trong "Yêu cầu xuất hóa đơn".
- Phiếu thu cũ có trong báo cáo doanh thu và sổ quỹ, tính theo ngày thu.

### 3.5 Lịch hẹn

- Trạng thái để trống thì hệ thống tự suy theo ngày chạy import: lịch **đã qua** là **Đã đến** (khách đã đến và khám xong), lịch **chưa tới** là **Đã hẹn**.
  File khách có 24 dòng hẹn sau ngày 13/10/2026 nhưng vẫn ghi "Đã khám = Có". Để trống thì các dòng đó thành Đã hẹn, nếu đến ngày nhập chúng đã qua thì thành Đã đến; ghi cứng "Đã đến" cho lịch chưa tới là lỗi.
- Có thể ghi tay: Đã hẹn, Đã đến, Trễ hẹn, Hủy hẹn. Lịch đã qua không được ghi Đã hẹn. Lịch chưa tới không được ghi Đã đến hay Trễ hẹn.
- Lịch cũ được ghi như thể tạo đúng vào giờ hẹn. Hồ sơ khách bắt đầu từ ngày khám sớm nhất, gồm cả ngày đến khám trong Lịch hẹn.
- Hồ sơ bệnh nhân, tab Lịch hẹn, hiện lịch **mới nhất trước**. Bộ đếm từng trạng thái đếm đủ mọi lịch, không giới hạn số dòng.
- Lịch cũ **không** sinh việc Chăm sóc khách hàng (nhắc lịch, gọi lại sau khám, khách lâu không quay lại) và không ghi vào lịch sử thay đổi lịch hẹn.
- Lịch cũ có trong báo cáo lượt khám theo ngày hẹn.

## 4. Lỗi dữ liệu trong file khách — BA phải sửa

Số liệu đếm trên toàn file khách (36.634 khách).

### 4.1 Mã KH trùng

**648 mã** đang dùng chung cho **1.315 khách khác nhau**: cùng mã nhưng khác "Id KH".
Mỗi khách phải có một Mã KH riêng, ví dụ thêm hậu tố `-2`, `-3` cho khách thứ hai, thứ ba.
Nhớ đổi mã ở **cả bốn sheet** của khách đó.

### 4.2 Số điện thoại

- **857 khách** ghi từ 2 số trở lên trong một ô. Số đầu đưa vào "Số điện thoại", số thứ hai vào "SĐT liên hệ khẩn cấp".
- **482 khách** không có số điện thoại hợp lệ. Hệ thống bắt buộc có SĐT hoặc Email (chủ dự án giữ luật này), nên BA phải bổ sung, hoặc hỏi phòng khám.

### 4.3 Họ tên có ký tự lạ

**462 khách** có ký tự ngoài chữ, số, khoảng trắng và `- . '`.
Phần lớn là ngoặc tròn, ví dụ ghi chú tên người nhà kiểu "Tên (mẹ bé X)"; ngoài ra có 2 tên có dấu phẩy và 1 tên có `< >`.
Bỏ phần trong ngoặc khỏi Họ và tên và chuyển nó sang cột "Ghi chú" của sheet Khách hàng.

Một số tên lưu dấu tiếng Việt kiểu tách rời (dấu đứng riêng sau chữ). Trường hợp này hệ thống tự chuẩn hoá, không cần sửa.

### 4.4 Ngày sai

Có **33 phiếu khám** và **7 dòng chi tiết** có ngày trước năm 2000 hoặc sau hôm nay (ví dụ năm 1980, năm 4741). Sheet Lịch hẹn có thêm **6 dòng** năm 1980.
Hỏi phòng khám ngày đúng, hoặc bỏ các dòng đó.

### 4.5 Thu tiền nhiều hơn tiền phiếu

**58 Mã phiếu** có tổng tiền thu lớn hơn tổng Thành tiền của phiếu; tổng phần dư là **92.867.000 đ**.
Trong đó 49 phiếu có Thành tiền bằng 0, ví dụ phiếu cạo vôi ghi giá 0 nhưng có thu 200.000 đ.
Import sẽ báo lỗi "Số tiền … vượt quá phần còn phải trả". Với mỗi phiếu, chọn một cách:

- ghi lại Đơn giá và Thành tiền đúng cho dòng dịch vụ của phiếu; hoặc
- ở dòng Thanh toán, ghi **Kế hoạch** thay cho Mã phiếu, để tiền chia sang các phiếu khác cùng kế hoạch (thường dùng cho chỉnh nha trả góp); hoặc
- bỏ dòng thu tiền đó, nếu phòng khám đồng ý.

## 5. Danh mục cần có trên BlueDental

Tên trong file mẫu phải trùng tên trên BlueDental. Hệ thống không phân biệt hoa thường và bỏ qua khoảng trắng thừa.
Dịch vụ đã xoá, đã ngừng hoặc là combo thì không khớp.

### 5.1 Dịch vụ trong file khách (47)

Mỗi dòng ghi: nhóm cũ — tên dịch vụ (số dòng chi tiết).

- Chụp Phim — Chụp Pano (1.684), Chụp Phim (935)
- Cạo vôi & đánh bóng răng — Cao Vôi Đánh Bóng (6.464)
- Cắt chóp + lấy nang — Cắt Nướu (474)
- Implant — Implant (1.802)
- Phục hình răng sứ cố định — Gắn Cố Định (3.276), Gắn Tạm (3.096), Lấy Dấu Răng Tạm (1.465), Mài Cùi (2.909), So Màu (28), Thử Sườn (267), Thử Sứ - Mài Chỉnh (632)
- Phục hình răng tháo lắp — Giao Hàm (234), Hàm Khung (34), Lưới chống gãy hàm (2), Lấy Dấu (2.430), Mài Chỉnh Khớp Cắm (152), Thử Răng (186), Thử Sáp (69)
- TRÁM RĂNG — TRÁM RĂNG (775)
- Tư Vấn — Tư Vấn Răng Sứ (763)
- Tẩy trắng răng — Thuốc tẩy trắng (227), Tẩy Trắng Tại Chỗ (1.547), Tẩy Trắng Tại Nhà (214)
- chỉnh hình hô & móm — Chỉnh Nha (173.897), Khác (4.713)
- gắn cùi giả — gắn cùi giả (37)
- khác — Cắt Chóp (501), Cắt Chỉ (1.662), Gắn Hột (41), Gắn Răng Xúc (88), Hàm Tẩy Trắng (Chỉnh Nha) (74)
- nhổ răng — Tiểu Phẩu (2.116), nhổ răng (4.427)
- nội nha — Bơm Rửa (389), Chữa tủy (778), Mở Tủy (558), Quay Ca(OH)2 (1.823), SSOT,Băng Thuốc (1.078), TBOT (1.631), Trám KT (260), a (25), Đặt AS (429)
- trám răng — GIC (508), Trám Composite (6.573), Trám Fuji (261), Đặt EU (568)

Cần hỏi phòng khám:

- "Khác" (nhóm chỉnh nha) và "a" (nội nha) không rõ là dịch vụ gì. Nên đặt tên rõ hơn, ví dụ "Chỉnh nha - khác".
- "TRÁM RĂNG" và nhóm "trám răng" là hai nhóm khác nhau trong file cũ; có thể gộp về cùng một dịch vụ trên BlueDental.

BA có thể đổi tên dịch vụ cho khớp danh mục đã có trên BlueDental. Không bắt buộc tạo đúng tên cũ.

### 5.2 Nhãn bác sĩ trong file khách (23)

Mỗi dòng ghi: nhãn — số dòng.

| Nhãn | Dòng | | Nhãn | Dòng |
|---|---|---|---|---|
| Bác sĩ Dũng | 50.237 | | Bác sĩ Thủy | 4.966 |
| q1 | 46.190 | | thường | 3.492 |
| Q1 | 28.212 | | Bác sĩ | 3.425 |
| Hương | 27.342 | | BS Hoàng q8 | 3.292 |
| 15 | 23.618 | | Bác sĩ Tới | 2.656 |
| BS Ngân 8 | 10.434 | | Ha Q1 | 2.628 |
| Bác sĩ Nam | 8.389 | | Bác Sĩ Đoài | 2.037 |
| Q 1 | 6.341 | | Linh | 1.944 |
| Phương | 5.989 | | ut | 795 |
| Bác sĩ Nguyên | 103 | | Bs Thủy | 6 |
| BS Dũng | 4 | | Bs Tới | 1 |
| BS Hương | 1 | | | |

Cần làm rõ với phòng khám:

- **"q1", "Q1", "Q 1", "15", "thường", "Bác sĩ", "ut"** không phải tên người. Chúng chiếm khoảng **112.000 dòng**, gần một nửa file.
  Hỏi phòng khám đó là ai; nếu không xác định được thì ghi bác sĩ giữ chỗ "BS hệ thống cũ".
- Một người có thể có nhiều nhãn, ví dụ "Bác sĩ Dũng" và "BS Dũng", "Bác sĩ Thủy" và "Bs Thủy". Ghi cùng một tên nhân sự BlueDental cho tất cả.
- Bác sĩ đã nghỉ vẫn nhập được nếu tài khoản bị **khoá**. Tài khoản đã **xoá** thì không nhập được.

Phụ tá (cột Phụ tá, không bắt buộc) có 14 nhãn: PT Dương, PT Thủy, PT Linh, PT Hằng, PT Trâm, PT Út, PT, PT Thảo, PT Hoa, PT Huê, Phụ Tá 3, Phụ Tá Dương, Phụ Tá Liên, Phụ Tá 7.
224.755 dòng để trống. Chỉ điền khi phụ tá đã có tài khoản; nếu không thì để trống.

## 6. Chia file

- Mỗi file khoảng **5.000 khách**, gồm đủ dòng Điều trị, Thanh toán và Lịch hẹn của đúng 5.000 khách đó.
  Thanh toán hay Lịch hẹn của một khách mà nằm ở file khác thì sẽ bị bỏ qua, vì khách đó đã được nhập ở file trước.
- File tối đa 60 MB. Đo thật trên máy dev: 5.000 khách / 70.000 dòng điều trị / 3.000 lần thu, nhập trong khoảng 26 giây.
- Toàn bộ 36.634 khách tương đương khoảng 8 file.

## 7. Công nợ — chủ dự án cần chốt trước khi nhập

Nếu điền đủ tiền dịch vụ và tiền thu như file cũ, hệ thống sẽ tính công nợ khoảng **36,8 tỷ đồng cho 4.736 khách**, vì hệ thống cũ không ghi thu tiền từ năm 2025.

- Muốn giữ đúng công nợ thì điền đủ, phòng khám sẽ thấy nợ trên hồ sơ.
- Không muốn hiện nợ cũ thì để trống cột tiền ở các dòng không tính. Dịch vụ giá 0 không sinh nợ.

## 8. Chạy thử với dữ liệu thật (13/10/2026, DB local)

Lấy ngẫu nhiên 200 khách sạch: Mã KH không trùng, có SĐT, ngày hợp lệ; 150 khách có thanh toán. Chép theo đúng hướng dẫn này: 4.387 dòng điều trị, 270 lần thu.

- Chạy thử lần đầu báo **3 lỗi**: 2 tên có ngoặc (mục 4.3) và 1 phiếu thu 200.000 đ trên phiếu giá 0 (mục 4.5). Cả hai đều là lỗi của dữ liệu cũ.
- Sau khi sửa 3 dòng đó, nhập thật trong **1,4 giây**: 200 khách, 698 kế hoạch, 4.387 công đoạn, 272 phiếu thu.
  3 lần thu có Mã phiếu nằm ở 2 kế hoạch nên mỗi lần tách thành 2 phiếu.
- Tổng tiền phiếu thu khớp đúng tổng tiền thu trong file: 473.544.000 đ.
- Hồ sơ bệnh nhân hiển thị đúng: các kế hoạch có Tổng phiếu và Đã trả khớp, trạng thái Hoàn thành.
