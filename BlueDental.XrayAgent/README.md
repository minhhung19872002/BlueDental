# BlueDental X-ray Agent (F-95)

Ứng dụng nhỏ chạy dưới khay hệ thống (tray) của Windows, cài trên máy tính chạy
Vatech EzDent-i. Agent làm hai việc:

1. **Đẩy ảnh lên BlueDental.** Agent theo dõi thư mục EzDent-i lưu hoặc xuất
   ảnh và gửi mọi ảnh JPEG / PNG mới lên BlueDental.
   - Tên tệp có **Mã KH (Biểu đồ số)** của một hồ sơ **cùng chi nhánh**: ảnh vào
     cột **Hình ảnh → Trước điều trị** của hồ sơ đó, kèm chip "X-quang".
   - Mọi ảnh khác chờ ở trang **Ảnh chưa gán hồ sơ** cho tới khi nhân viên gán.
   - Không bao giờ tự gán ảnh theo tên.
2. **Mở EzDent-i đúng bệnh nhân.** Nút "Mở EzDent-i" ở tab Hình ảnh của hồ sơ
   mở link `bluedental-xray://open?code=<Mã KH>`.
   - Agent hỏi BlueDental thông tin hồ sơ đó, ghi `linkage.xml`, rồi chạy
     loader của EzDent-i.
   - Link chỉ mang mã. Họ tên và ngày sinh đi qua HTTPS kèm device token.

Agent chỉ gọi HTTPS ra ngoài. Phòng khám không phải mở cổng và không cần IP
tĩnh. Kiến trúc và các điểm còn **UNVERIFIED** (chưa thử với EzDent-i thật) xem
ở `docs/integrations/xray-ezdent.md`.

## Cấu trúc thư mục

```
BlueDental.XrayAgent.slnx
src/BlueDental.XrayAgent.Core/   net9.0: cấu hình, parser, ledger, station client, pipeline, watcher, bridge
src/BlueDental.XrayAgent/        net9.0-windows: app WinForms dưới khay, DPAPI, registry, chạy một bản duy nhất
test/BlueDental.XrayAgent.Tests/ test xUnit cho Core
```

## Build, test và publish

```
dotnet build BlueDental.XrayAgent.slnx
dotnet test  BlueDental.XrayAgent.slnx
dotnet publish src/BlueDental.XrayAgent -c Release -r win-x64 --self-contained -p:PublishSingleFile=true -o publish
```

- **Kết quả:** một tệp `BlueDental.XrayAgent.exe`, khoảng 100 MB.
- **Không cần cài .NET** trên máy phòng khám.
- **Muốn nhỏ còn khoảng một nửa:** thêm `-p:EnableCompressionInSingleFile=true`.

## Cài đặt tại phòng khám (không cần quyền admin)

1. **Trên BlueDental:** admin vào Cài đặt → **Máy X-quang**, bấm Thêm máy và
   copy token. Token **chỉ hiện một lần**.
2. **Trên máy X-quang:** chép tệp exe vào một chỗ cố định, ví dụ
   `%LOCALAPPDATA%\BlueDental\XrayAgent\bin\`, rồi chạy:

   ```
   BlueDental.XrayAgent.exe --install
   ```

   Lệnh này đăng ký link `bluedental-xray://` và mục tự chạy khi đăng nhập
   Windows. Cả hai ghi trong HKCU, nên chỉ áp dụng cho tài khoản Windows đang
   dùng.
3. **Mở agent**, hoặc đăng xuất rồi đăng nhập lại Windows. Một chữ "X" màu xanh
   hiện dưới khay. Bấm chuột phải, chọn **Cài đặt…** rồi điền:
   - **Địa chỉ BlueDental:** ví dụ `https://duchanhpremium.vn`. Chỉ nhận `http`
     khi là localhost.
   - **Mã thiết bị:** dán token, rồi bấm **Kiểm tra kết nối**.
   - **Thư mục ảnh:** thư mục EzDent-i lưu hoặc xuất ảnh vào.
     - Dùng một thư mục riêng **ngoài OneDrive**, ví dụ `C:\XrayExport`. Desktop
       và Documents thường đồng bộ lên cloud.
     - **Để trống ô "Gửi cả ảnh cũ đã có sẵn trong thư mục"**, nếu không thì cả
       kho ảnh cũ sẽ bị đẩy lên.
   - **Đọc Chart No từ tệp thông tin ảnh EzDent-i** (mặc định bật):
     - Khi xuất ảnh, chọn JPG hoặc PNG và tick **"Thêm Tệp Thông tin Hình ảnh"**.
       EzDent-i ghi thêm một tệp cùng tên với ảnh, trong đó có `Chart No`.
     - Agent lấy mã, năm sinh và giờ chụp từ tệp đó; tệp này thắng tên tệp.
     - Ảnh mới chưa có tệp thông tin thì agent đợi tối đa 20 giây rồi gửi
       không mã, và ảnh vào hàng "Ảnh chưa gán hồ sơ".
   - **Mẫu tên tệp (regex):** regex với các nhóm tuỳ chọn `code`, `name`, `year`.
     - Mặc định là `^(?<code>DH\d{6,}|\d{3,7})`.
     - Nếu EzDent-i xếp ảnh theo thư mục riêng của từng bệnh nhân, tick ô
       "Không có mã trong tên tệp thì lấy tên thư mục chứa ảnh".
   - **EzDent-i:**
     - **Thư mục Bin:** mặc định `C:\Program Files (x86)\VATECH\EzDent-i\Bin`.
     - **Loader:** `VTE2Loader32.exe` (mặc định, đúng như shortcut EzDent-i trên máy phòng khám) hoặc `VTEzBridge32.exe`.
     - **Tham số của loader:** `{linkage}` là đường dẫn đầy đủ của tệp liên kết.
4. **Gỡ agent:** chạy `BlueDental.XrayAgent.exe --uninstall`, rồi xoá tệp exe và
   thư mục `%LOCALAPPDATA%\BlueDental\XrayAgent`.

## Tệp liên kết

Mẫu mặc định:

```xml
<?xml version="1.0" encoding="utf-8"?>
<LinkageParameter>
  <Patient>
    <ChartNumber>{ChartNumber}</ChartNumber>
    <LastName>{LastName}</LastName>
    <FirstName>{FirstName}</FirstName>
    <Birthday>{Birthday}</Birthday>
    <Gender>{Gender}</Gender>
  </Patient>
</LinkageParameter>
```

| Chỗ thay thế | Giá trị |
|---|---|
| `{ChartNumber}` | Mã KH |
| `{LastName}` | Họ |
| `{FirstName}` | Tên |
| `{FullName}` | Họ + Tên |
| `{Birthday}` | Ngày sinh dạng `yyyyMMdd` |
| `{BirthdayIso}` | Ngày sinh dạng `yyyy-MM-dd` |
| `{Gender}` | `M`, `F` hoặc để trống |

- **Dấu tiếng Việt:** tên được ghi không dấu, trừ khi bỏ tick ô "Ghi tên không
  dấu".
- **Ký tự đặc biệt:** giá trị được escape theo XML.
- **Chỗ thay thế lạ:** để nguyên.
- **Mã hoá:** UTF-8, không BOM.
- **Định dạng còn UNVERIFIED:** nếu EzDent-i cần định dạng khác, trỏ ô
  **Mẫu tệp liên kết** sang tệp mẫu của mình. Không cần build lại agent.

## Dữ liệu lưu ở đâu

Thư mục `%LOCALAPPDATA%\BlueDental\XrayAgent\`:

| Tệp | Nội dung |
|---|---|
| `settings.json` | Cấu hình. Token chỉ được lưu sau khi mã hoá DPAPI (CurrentUser). |
| `state.json` | Tệp nào đã gửi hoặc bị từ chối. Khoá là hash, không phải đường dẫn. Mục cũ hơn một năm tự xoá. |
| `logs\agent-*.log` | Log, mỗi ngày một tệp. |
| `linkage.xml` | Ghi ở đây, trừ khi chọn thư mục khác. |

**Log không chứa dữ liệu bệnh nhân.** Log không bao giờ có tên, ngày sinh hay
đường dẫn tệp. Log chỉ có Mã KH và 12 ký tự hex đầu của SHA-256 của tệp.

## Cách agent hoạt động

- **Tệp nào được gửi:** chỉ `.jpg`, `.jpeg`, `.png`. Một tệp chỉ được gửi khi
  kích thước đã đứng yên 2 giây và mở độc quyền được.
- **Sót sự kiện thư mục:** cứ 60 giây agent quét lại thư mục một lần, vì trên ổ
  mạng sự kiện thư mục có thể bị sót.
- **Trùng tệp:** một tệp chỉ gửi một lần. Server cũng bỏ tệp trùng theo SHA-256
  trên từng máy.
- **Khi server không phản hồi:** agent thử lại sau 5 giây, 15 giây, 1 phút,
  5 phút, rồi cứ 15 phút một lần.
- **Khi tệp bị từ chối** (không phải ảnh thật, quá 20 MB): không gửi lại.
- **Khi token bị thu hồi:** agent dừng mọi lượt gửi và báo dưới khay cho tới khi
  lưu token mới.
- **Mở agent lần hai:** bản thứ hai chuyển link sang bản đang chạy qua named
  pipe riêng của tài khoản Windows, rồi thoát.
