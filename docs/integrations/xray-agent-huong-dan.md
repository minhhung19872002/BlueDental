# Hướng dẫn cài và dùng BlueDental X-quang Agent

Tài liệu này hướng dẫn nối máy chụp X-quang Vatech (phần mềm **EzDent-i**) với
BlueDental. Sau khi cài, phim chụp xong được xuất ra thư mục, rồi **tự vào đúng
hồ sơ bệnh nhân** trên BlueDental. Nhân viên không phải tải ảnh lên tay nữa.

---

## Mục lục

1. [Tóm tắt cách hoạt động](#1-tóm-tắt-cách-hoạt-động)
2. [Chuẩn bị](#2-chuẩn-bị)
3. [Bước 1: Tạo mã kết nối trên BlueDental](#3-bước-1-tạo-mã-kết-nối-trên-bluedental)
4. [Bước 2: Tạo thư mục nhận ảnh trên máy X-quang](#4-bước-2-tạo-thư-mục-nhận-ảnh-trên-máy-x-quang)
5. [Bước 3: Chép chương trình vào máy X-quang](#5-bước-3-chép-chương-trình-vào-máy-x-quang)
6. [Bước 4: Cài đặt (đăng ký) chương trình](#6-bước-4-cài-đặt-đăng-ký-chương-trình)
7. [Bước 5: Mở chương trình và điền Cài đặt](#7-bước-5-mở-chương-trình-và-điền-cài-đặt)
8. [Bước 6: Kiểm tra lần đầu](#8-bước-6-kiểm-tra-lần-đầu)
9. [Hằng ngày: xuất phim từ EzDent-i](#9-hằng-ngày-xuất-phim-từ-ezdent-i)
10. [Hằng ngày: gán ảnh ở "Ảnh chưa gán hồ sơ"](#10-hằng-ngày-gán-ảnh-ở-ảnh-chưa-gán-hồ-sơ)
11. [Nút "Mở EzDent-i" trong hồ sơ](#11-nút-mở-ezdent-i-trong-hồ-sơ)
12. [Xử lý sự cố](#12-xử-lý-sự-cố)
13. [Đổi máy, thu hồi mã, gỡ cài đặt](#13-đổi-máy-thu-hồi-mã-gỡ-cài-đặt)
14. [Lưu ý bảo mật](#14-lưu-ý-bảo-mật)

---

## 1. Tóm tắt cách hoạt động

```
EzDent-i  ──Xuất ảnh (PNG + tệp thông tin)──►  C:\XrayExport
                                                   │
                                     BlueDental X-quang Agent (dưới khay)
                                                   │  gửi qua HTTPS
                                                   ▼
                                              BlueDental
                       ├─ Chart No trùng Mã KH / ID hệ thống của hồ sơ cùng chi nhánh
                       │     → ảnh vào hồ sơ: tab Hình ảnh → cột "Trước điều trị", có nhãn "X-quang"
                       └─ không trùng
                             → ảnh chờ ở trang "Ảnh chưa gán hồ sơ" để nhân viên gán
```

- **Mã bệnh nhân lấy từ đâu.** Khi xuất ảnh có tick **"Thêm Tệp Thông tin Hình
  ảnh"**, EzDent-i ghi thêm một tệp nhỏ cạnh ảnh, trong đó có **Chart No**
  (Biểu đồ số). Agent đọc số này để biết ảnh của ai.
- **Không bao giờ tự gán theo tên.** Nếu không có số hoặc số không trùng, ảnh
  luôn chờ nhân viên gán tay.
- **Không cần mở cổng mạng hay IP tĩnh.** Agent chỉ gửi ra ngoài qua HTTPS, như
  trình duyệt.

> **Quy tắc quan trọng:** khi tạo bệnh nhân mới bên EzDent-i, gõ **Biểu đồ số
> (Chart No) đúng bằng Mã KH** của bệnh nhân đó trên BlueDental. Gõ sai hoặc bỏ
> trống thì ảnh không tự vào hồ sơ.

---

## 2. Chuẩn bị

| Cần có | Ghi chú |
|---|---|
| Tài khoản BlueDental có quyền **sửa thông tin phòng khám** | Để tạo mã kết nối ở Bước 1 |
| Máy tính đang chạy EzDent-i (máy X-quang) | Windows 10/11, có Internet |
| Tệp `BlueDental.XrayAgent.zip` | Do bên BlueDental gửi |
| Khoảng 15 phút | Lần cài đầu tiên |

- **Không cần quyền quản trị (admin)** của Windows.
- **Không cần cài thêm .NET** hay phần mềm nào khác.
- Chương trình chỉ chạy cho **tài khoản Windows đang đăng nhập**. Nếu máy X-quang
  có nhiều tài khoản Windows, cài trên tài khoản mà nhân viên hay dùng để chụp.

---

## 3. Bước 1: Tạo mã kết nối trên BlueDental

Làm trên **bất kỳ máy nào** đăng nhập được BlueDental, bằng tài khoản quản lý.

1. Đăng nhập BlueDental.
2. Chọn **đúng chi nhánh** có máy X-quang. Ảnh gửi về sẽ chỉ vào hồ sơ của chi
   nhánh này.
3. Bấm vào **tên tài khoản ở góc trên bên phải**, chọn **Cài đặt**.
4. Chọn tab **Máy X-quang**.
5. Ô **Tên máy**: đặt tên dễ nhận ra, ví dụ `Máy X-quang phòng 2`.
6. Bấm **Thêm máy**.
7. Một khung **Thông tin kết nối** hiện ra, gồm hai dòng:
   - **Địa chỉ máy chủ**: ví dụ `https://duchanhpremium.vn`.
   - **Mã kết nối**: một chuỗi dài khoảng 43 ký tự.
8. Bấm **Sao chép** từng dòng rồi dán vào nơi an toàn để dùng ở Bước 5. Ví dụ
   dán vào Notepad trên chính máy X-quang, **xoá ngay sau khi dùng xong**.

> **Mã kết nối chỉ hiện một lần.** Nếu lỡ đóng khung trước khi sao chép, bấm
> **Thu hồi** máy vừa tạo rồi làm lại từ bước 5.
>
> Ai có mã này đều gửi được ảnh vào chi nhánh. Không gửi mã qua Zalo nhóm,
> email hay chụp màn hình cho người ngoài.

---

## 4. Bước 2: Tạo thư mục nhận ảnh trên máy X-quang

Từ bước này trở đi, làm **trên máy X-quang**.

1. Mở **File Explorer** (phím `Windows` + `E`).
2. Bấm **This PC / Máy tính này** → mở ổ **`C:`**.
3. Chuột phải vào chỗ trống → **New / Mới** → **Folder / Thư mục**.
4. Đặt tên **`XrayExport`**. Kết quả là thư mục `C:\XrayExport`.

> **Không dùng thư mục trên Desktop, Documents hay Pictures.** Trên máy này các
> thư mục đó đang đồng bộ **OneDrive**, nên phim có thông tin bệnh nhân sẽ bị
> đẩy lên cloud của Microsoft. Tệp trên OneDrive cũng có thể chỉ là bản giữ chỗ,
> khiến agent không đọc được.

---

## 5. Bước 3: Chép chương trình vào máy X-quang

1. Chép tệp `BlueDental.XrayAgent.zip` vào máy X-quang, ví dụ ra Desktop.
2. Chuột phải tệp zip → **Extract All… / Giải nén tất cả…** → bấm **Extract**.
3. Mở thư mục vừa giải nén. Trong đó có tệp **`BlueDental.XrayAgent.exe`**
   (khoảng 45 MB).
4. Tạo thư mục cố định cho chương trình:
   1. Bấm `Windows` + `R`.
   2. Gõ `%LOCALAPPDATA%` rồi Enter. Thư mục `C:\Users\<tên>\AppData\Local` mở ra.
   3. Tạo thư mục **`BlueDental`**, trong đó tạo **`XrayAgent`**, trong đó tạo
      **`bin`**.
5. Chép `BlueDental.XrayAgent.exe` vào thư mục `bin` vừa tạo. Đường dẫn cuối
   cùng là:

   ```
   %LOCALAPPDATA%\BlueDental\XrayAgent\bin\BlueDental.XrayAgent.exe
   ```

6. Có thể xoá tệp zip và thư mục giải nén trên Desktop.

> Phải để tệp exe ở **chỗ cố định** như trên. Nếu sau này di chuyển tệp, chương
> trình sẽ không tự chạy được nữa và phải làm lại Bước 4.

---

## 6. Bước 4: Cài đặt (đăng ký) chương trình

Bước này giúp chương trình **tự chạy mỗi khi đăng nhập Windows** và cho phép
nút "Mở EzDent-i" trên BlueDental gọi được nó.

1. Bấm `Windows` + `R`.
2. Dán đúng dòng sau (có cả dấu ngoặc kép) rồi bấm **OK**:

   ```
   "%LOCALAPPDATA%\BlueDental\XrayAgent\bin\BlueDental.XrayAgent.exe" --install
   ```

3. Một hộp thoại báo: **"Đã cài đặt: trình duyệt mở được EzDent-i từ BlueDental
   và chương trình tự chạy khi đăng nhập Windows."** Bấm **OK**.

> Nếu Windows hiện cảnh báo **"Windows protected your PC"** (SmartScreen): bấm
> **More info / Thông tin thêm** → **Run anyway / Vẫn chạy**.

---

## 7. Bước 5: Mở chương trình và điền Cài đặt

### 7.1. Mở chương trình

1. Mở thư mục `%LOCALAPPDATA%\BlueDental\XrayAgent\bin` (như Bước 3) và **nháy
   đúp** `BlueDental.XrayAgent.exe`. Lần sau không cần làm bước này vì chương
   trình tự chạy khi đăng nhập.
2. Nhìn xuống **khay hệ thống** (góc dưới bên phải, cạnh đồng hồ) sẽ thấy biểu
   tượng **chữ "X" màu xanh**. Nếu không thấy, bấm mũi tên **`^`** để hiện các
   biểu tượng ẩn.
3. **Nháy đúp** biểu tượng chữ "X", hoặc chuột phải → **Cài đặt…**. Cửa sổ
   **Cài đặt BlueDental X-quang** mở ra.

### 7.2. Khung "Kết nối BlueDental"

| Ô | Điền gì |
|---|---|
| **Địa chỉ BlueDental** | **Địa chỉ máy chủ** đã sao chép ở Bước 1, ví dụ `https://duchanhpremium.vn` |
| **Mã thiết bị** | **Mã kết nối** đã sao chép ở Bước 1 |

Bấm **Kiểm tra kết nối**:

- **Kết nối được: <tên máy> — <tên chi nhánh>**: đúng. Kiểm tra tên chi nhánh
  có đúng chi nhánh của máy này không.
- **Mã thiết bị không đúng hoặc đã bị thu hồi.**: dán lại mã. Nếu vẫn lỗi, tạo
  mã mới ở Bước 1.
- **Không kết nối được (…)**: kiểm tra Internet và địa chỉ (phải bắt đầu bằng
  `https://`).

### 7.3. Khung "Gửi ảnh X-quang"

| Ô | Chọn |
|---|---|
| **Thư mục ảnh** | Bấm **…** → chọn `C:\XrayExport` (đã tạo ở Bước 2) |
| **Quét cả thư mục con** | Để **tick** |
| **Đọc Chart No từ tệp thông tin ảnh EzDent-i** | **Tick** (mặc định đã tick) |
| **Mẫu tên tệp (regex)** | **Giữ nguyên**, không sửa |
| **Không có mã trong tên tệp thì lấy tên thư mục chứa ảnh** | **Bỏ tick** |
| **Gửi cả ảnh cũ đã có sẵn trong thư mục** | **Bỏ tick**. Nếu tick, mọi ảnh cũ đang có trong thư mục sẽ bị gửi lên hết |

### 7.4. Khung "Mở EzDent-i từ BlueDental"

Giữ nguyên mặc định:

| Ô | Giá trị mặc định |
|---|---|
| **Thư mục Bin của EzDent-i** | `C:\Program Files (x86)\VATECH\EzDent-i\Bin` |
| **Chương trình nạp** | `VTE2Loader32.exe` |
| **Tham số** | `"{linkage}"` |
| **Thư mục ghi tệp liên kết** | để trống |
| **Mẫu tệp liên kết** | để trống |
| **Ghi tên không dấu** | tick |

### 7.5. Lưu

Bấm **Lưu**. Sau khi lưu, **xoá mã kết nối** đã dán tạm trong Notepad (nếu có).
Mã đã được chương trình cất giữ dạng mã hoá.

---

## 8. Bước 6: Kiểm tra lần đầu

1. Chuột phải biểu tượng chữ "X" dưới khay. Dòng trên cùng của menu là trạng
   thái, phải thấy:
   - **Đã kết nối: <tên máy> — <tên chi nhánh>**
   - **Đang theo dõi thư mục ảnh**
   - **Đã gửi 0 · chờ gửi lại 0 · bị từ chối 0**
2. Chọn một bệnh nhân **đã có hồ sơ trên BlueDental** và **đã có Biểu đồ số
   bên EzDent-i bằng Mã KH**.
3. Xuất một phim của bệnh nhân đó theo [mục 9](#9-hằng-ngày-xuất-phim-từ-ezdent-i).
4. Đợi khoảng 10 giây. Dòng đếm dưới khay chuyển thành **Đã gửi 1**.
5. Trên BlueDental, mở hồ sơ bệnh nhân đó → tab **Hình ảnh** → cột **Trước điều
   trị**. Phim mới hiện ở đó, có nhãn **X-quang**.
6. Nếu phim **không** vào hồ sơ mà nằm ở trang **Ảnh chưa gán hồ sơ**: Chart No
   bên EzDent-i không trùng Mã KH / ID hệ thống bên BlueDental. Báo lại cho bên
   BlueDental, kèm **Chart No** và **Mã KH** của bệnh nhân thử (gửi riêng, không
   gửi vào nhóm chung).

---

## 9. Hằng ngày: xuất phim từ EzDent-i

Làm sau mỗi lần chụp, khi muốn đưa phim sang BlueDental.

1. Trong EzDent-i, mở bệnh nhân và mở phim ở **Trình hiển thị**.
2. Chọn lệnh **Xuất** (menu chính, hoặc chuột phải vào ảnh → **Export / Xuất**).
3. Trong hộp thoại Xuất:
   1. **Định dạng**: chọn **PNG** (hoặc JPG). **Không chọn** Gốc (DICOM), BMP
      hay TIF vì BlueDental không nhận các dạng này.
   2. **Tick "Thêm Tệp Thông tin Hình ảnh"**. Thiếu tick này thì ảnh không có
      mã và sẽ phải gán tay.
   3. **Thư mục lưu**: chọn `C:\XrayExport` (Đĩa Cục bộ C: → XrayExport →
      **Select Folder**).
4. Bấm **OK / Xuất**.
5. Trong `C:\XrayExport` sẽ có **2 tệp cùng tên** dạng `PX<ngày>_<giờ>_…`: một
   tệp ảnh và một tệp thông tin. **Không đổi tên, không xoá** hai tệp này cho tới
   khi ảnh đã lên BlueDental.
6. Khoảng vài giây đến 20 giây sau, ảnh lên BlueDental.

**Mẹo:**

- EzDent-i thường nhớ định dạng, ô tick và thư mục của lần xuất trước. Chỉ cần
  chỉnh một lần, các lần sau kiểm tra lại cho chắc.
- Xuất nhiều phim cùng lúc vẫn được. Mỗi phim là một cặp tệp.
- Xuất lại đúng một phim đã gửi thì BlueDental tự bỏ qua, không bị trùng ảnh.
- Thỉnh thoảng có thể dọn bớt tệp cũ trong `C:\XrayExport`, sau khi đã thấy ảnh
  trên BlueDental.

---

## 10. Hằng ngày: gán ảnh ở "Ảnh chưa gán hồ sơ"

Ảnh vào trang này khi không tìm được hồ sơ, ví dụ quên tick tệp thông tin, Biểu
đồ số gõ sai, hoặc bệnh nhân chưa có hồ sơ trên BlueDental.

1. Trên BlueDental, bấm menu **Ảnh chưa gán hồ sơ**. Con số trên menu là số ảnh
   đang chờ.
2. Mỗi ô là một ảnh, có hình nhỏ, tên tệp, giờ nhận và gợi ý.
3. Bấm **Gán hồ sơ** trên ảnh cần gán. Hộp thoại **Gán ảnh vào hồ sơ** mở ra:
   - **Hồ sơ gợi ý**: các hồ sơ trùng mã, trùng tên và năm sinh, hoặc trùng tên.
     **Đối chiếu kỹ** trước khi chọn vì có thể có người trùng tên.
   - **Hoặc tìm hồ sơ**: gõ mã, tên hoặc số điện thoại.
4. Chọn đúng hồ sơ → bấm **Gán**. Ảnh vào cột **Trước điều trị** của hồ sơ đó.
5. Ảnh chụp hỏng hoặc gửi nhầm: bấm **Bỏ qua** → xác nhận. Ảnh bị xoá khỏi danh
   sách và không vào hồ sơ nào.

> Nếu ảnh vào đây thường xuyên, kiểm tra lại hai điều: đã tick **"Thêm Tệp Thông
> tin Hình ảnh"** khi xuất chưa, và Biểu đồ số bên EzDent-i có đúng bằng Mã KH
> không.

---

## 11. Nút "Mở EzDent-i" trong hồ sơ

> **Đang thử nghiệm.** Cách EzDent-i nhận lệnh mở bệnh nhân chưa được Vatech
> xác nhận. Nếu nút không hoạt động, báo lại kèm tệp nhật ký (xem mục 12).

1. Chỉ dùng được **trên chính máy X-quang** (máy đã cài agent).
2. Mở BlueDental bằng trình duyệt trên máy X-quang → mở hồ sơ bệnh nhân → tab
   **Hình ảnh** → bấm **Mở EzDent-i**. Nút chỉ hiện khi chi nhánh đã có máy
   X-quang đang hoạt động.
3. Lần đầu, trình duyệt hỏi có cho mở **BlueDental X-quang** không: tick **Luôn
   cho phép** rồi bấm **Mở**.
4. EzDent-i mở lên đúng bệnh nhân. Nếu bệnh nhân chưa có bên EzDent-i, ô Biểu
   đồ số được điền sẵn bằng Mã KH.

---

## 12. Xử lý sự cố

### Xem trạng thái

Chuột phải biểu tượng chữ "X" dưới khay, đọc dòng trên cùng.

| Trạng thái | Nguyên nhân | Cách xử lý |
|---|---|---|
| Chưa cài đặt — mở Cài đặt… | Chưa điền Bước 5 | Làm lại Bước 5 |
| Không kết nối được BlueDental (…) | Mất Internet hoặc BlueDental đang bảo trì | Kiểm tra mạng. Agent tự thử lại, ảnh không bị mất |
| Mã thiết bị bị từ chối — nhập mã mới… | Mã đã bị thu hồi | Tạo mã mới (Bước 1) và dán vào Cài đặt |
| Không thấy thư mục ảnh — chưa gửi ảnh | Thư mục `C:\XrayExport` bị xoá hoặc đổi tên | Tạo lại thư mục, hoặc chọn lại trong Cài đặt |
| Chưa chọn thư mục ảnh — chưa gửi ảnh | Ô Thư mục ảnh trống | Chọn `C:\XrayExport` trong Cài đặt |
| … chờ gửi lại N | Gửi chưa được, đang chờ thử lại | Tự thử lại sau 5 giây, 15 giây, 1 phút, 5 phút, rồi 15 phút một lần |
| … bị từ chối N | Tệp không phải ảnh thật, quá 20 MB, hoặc không an toàn | Xuất lại phim dạng PNG |

### Không thấy biểu tượng chữ "X" dưới khay

- Bấm mũi tên **`^`** cạnh đồng hồ để xem biểu tượng ẩn.
- Nếu vẫn không có: mở lại `%LOCALAPPDATA%\BlueDental\XrayAgent\bin\BlueDental.XrayAgent.exe`.
- Nếu sau khi khởi động lại máy mà không tự chạy: làm lại Bước 4.

### Ảnh không lên BlueDental

1. Kiểm tra ảnh có nằm trong `C:\XrayExport` không, và có đuôi `.png` / `.jpg`
   không. EzDent-i có thể đã lưu sang thư mục khác.
2. Kiểm tra trạng thái dưới khay (bảng trên).
3. Xem trang **Ảnh chưa gán hồ sơ**. Có thể ảnh đã lên nhưng chưa khớp hồ sơ.

### Gửi nhật ký cho bên BlueDental

1. Chuột phải biểu tượng chữ "X" → **Mở thư mục nhật ký**.
2. Gửi tệp `agent-<ngày>.log` của ngày có sự cố.

Nhật ký **không chứa** tên, ngày sinh hay tên tệp ảnh của bệnh nhân, chỉ có mã
và giờ, nên gửi được.

---

## 13. Đổi máy, thu hồi mã, gỡ cài đặt

### Thu hồi mã (máy hỏng, mất máy, nghi lộ mã)

1. BlueDental → **Cài đặt** → tab **Máy X-quang**.
2. Bấm **Thu hồi** ở dòng máy đó → xác nhận.
3. Từ lúc này máy đó không gửi được ảnh nữa. Muốn dùng lại thì tạo mã mới
   (Bước 1) và dán vào Cài đặt của agent.

### Chuyển sang máy X-quang khác

1. Thu hồi mã của máy cũ (như trên) và gỡ agent trên máy cũ (như dưới).
2. Làm lại từ Bước 1 trên máy mới.

### Cập nhật phiên bản mới

1. Chuột phải biểu tượng chữ "X" → **Thoát**.
2. Chép đè `BlueDental.XrayAgent.exe` mới vào `%LOCALAPPDATA%\BlueDental\XrayAgent\bin`.
3. Nháy đúp tệp exe để mở lại. Cài đặt cũ được giữ nguyên, không cần điền lại.

### Gỡ cài đặt

1. Chuột phải biểu tượng chữ "X" → **Thoát**.
2. Bấm `Windows` + `R`, dán dòng sau rồi bấm **OK**:

   ```
   "%LOCALAPPDATA%\BlueDental\XrayAgent\bin\BlueDental.XrayAgent.exe" --uninstall
   ```

3. Xoá thư mục `%LOCALAPPDATA%\BlueDental\XrayAgent`.
4. Thu hồi mã của máy trên BlueDental.

---

## 14. Lưu ý bảo mật

- **Mã kết nối** giống như mật khẩu của máy X-quang. Không chia sẻ, không chụp
  màn hình gửi đi. Nghi bị lộ thì thu hồi ngay.
- **Thư mục ảnh** phải nằm ngoài OneDrive / Google Drive / Dropbox.
- **Phim và tệp thông tin** có tên, ngày sinh bệnh nhân. Không chép thư mục
  `C:\XrayExport` ra USB hay gửi qua Zalo.
- Agent chỉ gửi ảnh tới đúng địa chỉ BlueDental đã điền, qua HTTPS.
