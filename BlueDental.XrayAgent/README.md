# BlueDental X-ray Agent (F-95)

A small Windows tray app for the PC that runs Vatech EzDent-i. It does two jobs:

1. **Pushes pictures**: it watches the folder where EzDent-i saves or exports
   pictures and sends every new JPEG or PNG to BlueDental. If the file name
   carries a customer code (Mã KH / Biểu đồ số) of a patient in the same
   branch, the picture lands in that patient's **Hình ảnh → Trước điều trị**
   column with an "X-quang" chip. Any other picture waits under
   **Ảnh chưa gán hồ sơ** until staff assign it. Pictures are never assigned
   by name.
2. **Opens EzDent-i on the patient**: the "Mở EzDent-i" button on a patient's
   Hình ảnh tab opens `bluedental-xray://open?code=<Mã KH>`. The agent asks
   BlueDental for that patient, writes `linkage.xml` and starts the EzDent-i
   loader. The link carries only the code. Names and the birthday travel over
   HTTPS with the device token.

The agent only makes outbound HTTPS calls. The clinic needs no open port and no
static IP. See `docs/integrations/xray-ezdent.md` for the architecture and the
points that are still **UNVERIFIED**.

## Layout

```
BlueDental.XrayAgent.slnx
src/BlueDental.XrayAgent.Core/   net9.0: settings, parser, ledger, station client, pipeline, watcher, bridge
src/BlueDental.XrayAgent/        net9.0-windows WinForms tray app, DPAPI, registry, single instance
test/BlueDental.XrayAgent.Tests/ xUnit tests for Core
```

## Build, test and publish

```
dotnet build BlueDental.XrayAgent.slnx
dotnet test  BlueDental.XrayAgent.slnx
dotnet publish src/BlueDental.XrayAgent -c Release -r win-x64 --self-contained -p:PublishSingleFile=true -o publish
```

The result is a single `BlueDental.XrayAgent.exe` (about 100 MB). It needs no
.NET installed on the clinic PC. To shrink it to about half, add
`-p:EnableCompressionInSingleFile=true`.

## Install at the clinic (no admin rights needed)

1. **In BlueDental:** an admin opens Cài đặt → **Máy X-quang**, adds the PC
   and copies the token. The token is shown only once.
2. **On the X-ray PC:** copy the exe to a fixed place, for example
   `%LOCALAPPDATA%\BlueDental\XrayAgent\bin\`, then run:

   ```
   BlueDental.XrayAgent.exe --install
   ```

   This registers the `bluedental-xray://` link and the start-at-logon entry
   under HKCU, for the current Windows user only.
3. **Start the agent** (or log off and on again). A blue "X" appears in the
   tray. Right-click it, choose **Cài đặt…** and fill in:
   - **Địa chỉ BlueDental:** for example `https://duchanhpremium.vn`. Plain
     `http` is accepted only for localhost.
   - **Mã thiết bị:** paste the token, then press **Kiểm tra kết nối**.
   - **Thư mục ảnh:** the folder EzDent-i saves or exports into. Leave
     **Gửi cả ảnh cũ đã có sẵn trong thư mục** unticked so the old archive is not pushed.
   - **Mẫu tên tệp (regex):** a regex with the optional groups `code`, `name` and
     `year`. The default is `^(?<code>DH\d{6,}|\d{3,7})`. Tick "Không có mã
     trong tên tệp thì lấy tên thư mục chứa ảnh" when EzDent-i files pictures in a folder per patient.
   - **EzDent-i:** the Bin folder (default
     `C:\Program Files (x86)\VATECH\EzDent-i\Bin`), the loader
     (`VTE2Loader32.exe` or `VTEzBridge.exe`) and its arguments. `{linkage}`
     stands for the linkage file's full path.
4. To remove the agent, run `BlueDental.XrayAgent.exe --uninstall`, then
   delete the exe and `%LOCALAPPDATA%\BlueDental\XrayAgent`.

## The linkage file

The default template:

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

| Placeholder | Value |
|---|---|
| `{ChartNumber}` | Mã KH |
| `{LastName}` | Họ |
| `{FirstName}` | Tên |
| `{FullName}` | Họ + Tên |
| `{Birthday}` | Ngày sinh as `yyyyMMdd` |
| `{BirthdayIso}` | Ngày sinh as `yyyy-MM-dd` |
| `{Gender}` | `M`, `F` or empty |

- **Vietnamese marks:** names are written without marks unless "Ghi tên không
  dấu" is unticked.
- **Escaping:** values are XML-escaped.
- **Unknown placeholders:** left as they are.
- **Encoding:** the file is written as UTF-8 without a BOM.
- **Format still UNVERIFIED:** if EzDent-i expects something else, point
  **Mẫu tệp liên kết** at your own template file. The agent needs no rebuild.

## Where things are kept

`%LOCALAPPDATA%\BlueDental\XrayAgent\`:

| File | Content |
|---|---|
| `settings.json` | the settings. The token is stored only DPAPI-protected (CurrentUser). |
| `state.json` | which files were sent or refused. Keys are hashes, not paths. Entries older than a year are pruned. |
| `logs\agent-*.log` | log, one file per day. |
| `linkage.xml` | written here unless another folder is set. |

**No patient data in the logs:** they never hold a patient name, a birthday or
a file path. They hold only the customer code and the first 12 hex characters
of the file's SHA-256.

## Behaviour notes

- **Which files are taken:** only `.jpg`, `.jpeg` and `.png`. A file is sent
  only after its size has stayed the same for 2 s and it can be opened
  exclusively.
- **Missed folder events:** the folder is rescanned every 60 s, because
  folder events can be missed on network drives.
- **Duplicates:** the same file is sent once. The server also drops duplicates
  per device by SHA-256.
- **When the server is down:** the agent retries after 5 s, 15 s, 1 min, 5 min,
  then every 15 min.
- **When a file is refused:** a refused file (not a real picture, too big,
  over 20 MB) is not retried.
- **When the token is revoked:** the agent pauses all uploads and shows a tray
  message until a new token is saved.
- **A second copy of the agent:** it hands the link to the running copy over a
  per-user named pipe, then exits.
