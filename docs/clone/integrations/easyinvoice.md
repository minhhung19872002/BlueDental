# EasyInvoice (SoftDreams) — tích hợp hóa đơn điện tử

Cập nhật 2026-09-28. Mọi mục FACT dưới đây đã được thử trực tiếp trên sandbox
bằng `easyinvoice-probe.ps1` / curl. Mật khẩu API không nằm trong repo.

## Môi trường test (do BA cấp)

| | |
|---|---|
| API | `http://api.softdreams.vn` (HTTP thuần, IIS 8.5, ASP.NET Web API) |
| Portal | `http://app.softdreams.vn` (cùng ứng dụng, `/Account/LogOn`) |
| Tra cứu | `tracuu.softdreams.vn` |
| Tenant | MST `0318531468` (Công ty CP Dịch vụ Nha khoa Đức Hạnh, test) |
| User API | `API` — mật khẩu: biến môi trường `EASYINVOICE_PASSWORD`, KHÔNG commit |
| Mẫu số / ký hiệu | Pattern `1C26TYY`, Serial `""` (rỗng) — 1000 HĐ thường, 0 HĐ MTT |
| Chữ ký số | CTS seri `5401016F6DB…` hết hạn 22/02/2028, "CQT chưa chấp nhận sử dụng" |
| HSM | **Sandbox KHÔNG cấu hình HSM** → `importAndPublishInv` bị chặn (mã 196) |

## FACT — xác thực (dịch ngược thư viện chính thức + thử trên sandbox)

Nguồn: NuGet `EInvoice.IntegratedLib` 1.0.1 (Softdreams JSC, 2018), `APIHelper.GenAuthentication`.
Bản dịch ngược ở `reference-private/easyinvoice-lib/` (git-ignore). Thư viện 2018 dùng 5 phần
(on-premise, một tenant); sandbox 2026 đa tenant **bắt buộc thêm MST làm phần thứ 6**.

```
POST {base}/api/...
Content-Type: application/json; charset=utf-8
Admin-Agent: easyinvoice.vn
Authentication: {sig}:{nonce}:{ts}:{username}:{password}:{taxCode}

ts    = Unix seconds UTC (lệch 1 ngày → bị từ chối; đồng hồ server phải đúng)
nonce = Guid.NewGuid().ToString("N").ToLower()
sig   = Base64( MD5( "POST" + ts + nonce ) )
```

Ma trận lỗi xác thực (HTTP 401, `Status 5`):

| Trường hợp | ErrorCode | Message |
|---|---|---|
| Không header / `Basic` / sai chữ ký / ts cũ / sai user | 175 | Chuỗi xác thực không hợp lệ |
| Đúng định dạng nhưng thiếu MST hoặc MST sai | 176 | Hệ thống chưa được khởi tạo |
| Đủ 6 phần, MST đúng, sai mật khẩu | 177 | Tài khoản không hợp lệ hoặc chưa được kích hoạt |

Mật khẩu gửi **plain text** trong header (không MD5). Chỉ HTTP nên đi qua Internet không mã hóa
→ khi lên production phải hỏi SoftDreams URL HTTPS.

## FACT — khung response

```json
{ "Status": 2, "Message": "Ok", "Data": { ... }, "ErrorCode": 0 }
```

`Status 2` = thành công (hằng `API_SUCCESS_STATUS`). Lỗi: `Status 4` (dữ liệu, HTTP 400/404/409)
hoặc `Status 5` (hệ thống/xác thực, HTTP 401/500). `ErrorCode` là số hoặc chuỗi tùy endpoint —
parse lỏng. Lỗi theo từng hóa đơn nằm trong `Data.KeyInvoiceMsg { ikey: message }`.

Mã lỗi đã gặp:

| Code | HTTP | Ý nghĩa |
|---|---|---|
| 100 / 107 | 400 | Request rỗng / json sai (107 ở nhóm business) |
| 102 | 400 | Thiếu field bắt buộc (`Ikey`, `Ikeys`…) |
| 117 | 400 | Pattern/Serial không hợp lệ hoặc không khả dụng |
| 127 | 400 | `[XmlFormat] - <VALIDATIONERROR>`: thiếu/hỏng `XmlData` |
| 128 | 404 | Ikeys không tồn tại |
| 129 | 409 | Dữ liệu hóa đơn không hợp lệ, chi tiết trong `KeyInvoiceMsg` |
| 164 | 409 | Thao tác hủy không hợp lệ (HĐ mới tạo lập không được hủy) |
| 165 | 404 | Hóa đơn không tồn tại |
| 196 | 400 | Máy chủ không cấu hình ký HSM |
| 199 | 500 | Có lỗi xảy ra (vd `<Invoices></Invoices>` rỗng) |

## FACT — endpoint và body đã xác minh

Tất cả POST, JSON. GET trả 405.

### `api/publish/importInvoice` — tạo hóa đơn nháp (chưa ký, chưa cấp số)

```json
{ "XmlData": "<Invoices><Inv><key>{ikey}</key><Invoice>…</Invoice></Inv></Invoices>",
  "Pattern": "1C26TYY", "Serial": "" }
```

Response `Data`: `{ Pattern, Serial, Ikeys[], Invoices[ InvoiceSummary ] }`.

`InvoiceSummary` (cũng là phần tử của `getInvoicesByIkeys`):

```
InvoiceStatus:int (0 = mới tạo lập)   Type:int   Pattern   Serial   No ("0" = chưa cấp số)
Ikey   ArisingDate "dd/MM/yyyy"   IssueDate   Buyer   CustomerName   CustomerAddress
CustomerCode   CustomerTaxCode   Total (trước thuế)   TaxAmount   Amount (tổng)
LookupCode (mã tra cứu, VD "7527DRPPQ")   LinkView ("tracuu.softdreams.vn" khi đọc lại)
ModifiedDate "dd/MM/yyyy HH:mm:ss"   PublishedBy   IsSentTCTSummary   TCTCheckStatus ("Chưa gửi thuế")
TCTErrorMessage   TaxAuthorityCode (mã CQT sau khi cấp)   CusIdentification   BudgetaryRelationshipCode   PassportNo
```

Hành vi đã thử:

- **Cùng Ikey gửi lại khi HĐ còn nháp → ghi đè** (LookupCode mới, dữ liệu mới). Ikey là khóa upsert
  cho nháp, không phải khóa idempotent chặn trùng.
- `Pattern` phải đúng `1C26TYY`, `Serial` rỗng. Tách `"1"` + `"C26TYY"` → lỗi 117.
- `VATRate` nhận `10` và `-1` (KCT). `0`, `8`, `-2` chưa thử.
- Bắt buộc: `CusName` **hoặc** `Buyer`; `PaymentMethod` (không được rỗng). Thiếu → 129 + KeyInvoiceMsg.
- Bản in PDF (mẫu của tenant, có logo Đức Hạnh) hiển thị: Buyer, CusName, CusTaxCode, CusAddress,
  CusBankNo, PaymentMethod, CurrencyUnit, ExchangeRate, bảng Products 9 cột, Total/VAT/Amount,
  AmountInWords, mã tra cứu; số HĐ = `<Chưa cấp số>` khi còn nháp.

### `api/publish/importAndPublishInv` — tạo + ký + cấp số (HSM)

Sandbox trả `196 Máy chủ hiện không cấu hình ký HSM`. Body dự kiến giống `importInvoice`.
→ Hỏi SoftDreams bật HSM cho tenant test, hoặc chấp nhận luồng: BlueDental tạo nháp,
kế toán ký/phát hành trên portal, BlueDental `getInvoicesByIkeys` để đồng bộ số/mã CQT.

### `api/publish/getInvoicesByIkeys` — tra cứu

```json
{ "Ikeys": ["ikey1", "ikey2"] }
```

`Pattern` tùy chọn; `Ikeys` phải là mảng. Response `Data.Invoices[ InvoiceSummary ]`. Ikey không có → 404/128.

### `api/publish/getInvoicePdf` — tải PDF

```json
{ "Ikey": "…" }
```

`Pattern` tùy chọn. Trả `application/pdf` thẳng (không bọc JSON). ~460 KB cho HĐ 1 dòng.

### `api/business/cancelInvoice` — hủy

Body `{ "Ikey", "Pattern"?, "Serial"?, "Reason"? }` — server nhận Ikey, nhưng HĐ nháp
(`InvoiceStatus 0`) → 164 "mới tạo lập không được phép huỷ". Chỉ hủy được HĐ đã phát hành;
chưa thử được vì sandbox không ký được. Không thấy cách xóa nháp qua API (xóa trên portal).

### `api/business/replaceInvoice`, `api/business/adjustInvoice`

Body rỗng → 102 "Ikey hoặc thông tin hóa đơn liên quan của hóa đơn gốc không được đồng thời bỏ trống".
Cần HĐ đã phát hành, chưa thử tiếp.

### Không tồn tại trên sandbox (404)

`externalGetDigest`, `externalWrapAndLaunch` (ký USB token phía client trong thư viện 2018) và
mọi endpoint đoán khác. Luồng ký phía client không dùng được với môi trường này.

## FACT — XmlData (README thư viện 2018, sandbox chấp nhận nguyên xi)

```xml
<Invoices>
  <Inv>
    <key>Ikey do BlueDental sinh (unique)</key>
    <Invoice>
      <CusCode>Mã KH</CusCode>
      <Buyer>Họ tên người mua</Buyer>
      <CusName>Tên đơn vị (bắt buộc nếu Buyer rỗng)</CusName>
      <CusAddress/><CusBankName/><CusBankNo/><CusPhone/>
      <CusTaxCode>MST (bắt buộc với KH doanh nghiệp)</CusTaxCode>
      <PaymentMethod>Bắt buộc: "Tiền mặt" | "Chuyển khoản" | "TM/CK"</PaymentMethod>
      <ArisingDate>dd/MM/yyyy (mặc định hôm nay)</ArisingDate>
      <CurrencyUnit>VND</CurrencyUnit><ExchangeRate>1.0000</ExchangeRate>
      <PaymentStatus>1</PaymentStatus>
      <Extra>json bổ sung</Extra>
      <Products>
        <Product>
          <Code/><ProdName>bắt buộc</ProdName><ProdUnit/>
          <ProdQuantity/><ProdPrice/>
          <Total>trước thuế</Total><VATRate>10|8|5|0|-1(KCT)</VATRate><VATAmount/>
          <Amount>tổng dòng</Amount>
        </Product>
      </Products>
      <Total/><VATRate/><VATAmount/><Amount/>
      <AmountInWords>bắt buộc</AmountInWords>
    </Invoice>
  </Inv>
</Invoices>
```

Chiết khấu = `<Product>` với `Total`/`Amount` âm, `ProdQuantity`/`ProdPrice` rỗng.
Nhiều `<Inv>` trong một request được (thư viện gửi theo lô).

## Dữ liệu test đã tạo trên sandbox (nháp, chưa cấp số, xóa trên portal khi cần)

| Ikey | Ghi chú |
|---|---|
| `bluedental-test-20260928082454` | HĐ test đầu tiên, sau đó bị ghi đè bởi test trùng Ikey ("Dup test", 1 đồng) |
| `bd-vatkct` | test VATRate -1 |

## Cách chạy probe (mật khẩu qua biến môi trường)

```powershell
$env:EASYINVOICE_PASSWORD = '<mật khẩu>'
powershell -File docs/clone/integrations/easyinvoice-probe.ps1
# importInvoice với {} → lỗi 127 nghĩa là xác thực đã qua
powershell -File docs/clone/integrations/easyinvoice-probe.ps1 -Action api/publish/getInvoicesByIkeys -BodyFile q.json
```

## Tài liệu DLL (nguồn thứ cấp — CHƯA kiểm chứng trên REST)

Nguồn: "EasyInvoice — Tài liệu tích hợp DLL" (bản chụp từ Scribd, chủ sở hữu tự tìm, 2026-10-01). Tài liệu
không chính thức, mô tả thư viện DLL cho .NET 3.5 chứ không phải REST API, danh sách VAT thiếu 8%. Chỉ ghi
**cấu trúc**; mọi mục dưới đây chưa được thử trên sandbox REST trừ khi ghi rõ.

**Trạng thái HĐ (`InvoiceStatus`)** — BlueDental đã dùng bảng này để ánh xạ (`ProviderInvoiceSummary.Status`):

| Mã nhà cung cấp | Nghĩa | BlueDental `ElectronicInvoiceStatus` |
|---|---|---|
| 0 | Chưa ký | `Draft` (0) — **đã thấy trên sandbox** |
| 1 | Đã ký | `Published` (1) |
| 2 | Đã khai báo thuế | `Published` (1) |
| 3 | Bị thay thế | `Replaced` (3) |
| 4 | Bị điều chỉnh | `Adjusted` (4) |
| 5 | Bị hủy | `Cancelled` (2) |
| 6 | Đã duyệt | `Published` (1) |

HĐ chưa có số (`No` rỗng / `"0"`) luôn là `Draft`, trừ mã 5. Mã gốc vẫn lưu ở `ProviderStatus`.

**Hủy / thay thế / điều chỉnh** (chưa làm — cần HĐ đã ký, sandbox không có HSM):

- Hủy: định danh bằng `Ikey` + `Pattern` + `Serial`.
- Thay thế / điều chỉnh: XmlData bọc `<ReplaceInv>` / `<AdjustInv>` thay cho `<Invoice>`, có `<Ikey>` của HĐ mới và
  tham chiếu HĐ gốc; điều chỉnh có `<Type>`: 2 = tăng, 3 = giảm, 4 = điều chỉnh thông tin.
- Mỗi HĐ chỉ được thay thế **hoặc** điều chỉnh **một** lần.

**Trường XmlData bổ sung**:

- `<Email>` / `<EmailCC>` người mua — chỉ có hiệu lực khi có `CusCode`. BlueDental chưa gửi.
- `ProdName` tối đa **300 ký tự** → BlueDental từ chối dòng dài hơn (`EInvoicing:0005`, `MaxLineNameLength`).
- Dòng chiết khấu: `Total`/`VATAmount`/`Amount` âm (khớp README 2018). Dòng ghi chú: `<Pos></Pos>` rỗng, không tiền.
- `PaymentMethod` là chuỗi tự do; ví dụ trong tài liệu: `T/M`, `C/K`, `TM/CK`, `TT/D`, `Bù trừ`.
  BlueDental vẫn gửi `TM` / `CK` / `TM/CK` (sandbox chấp nhận).
- Trong tài liệu DLL, `<Ikey>` nằm **trong** `<Invoice>`; REST (đã kiểm chứng) dùng `<Inv><key>…</key><Invoice>`. Giữ dạng REST.

**Khác**: tải PDF có tham số `Option` 0/1/2 (chưa rõ nghĩa từng giá trị trên REST); có hàm
`createReservedInvoices` (cấp trước dải HĐ) — BlueDental không dùng.

## Còn mở (UNKNOWN_REFERENCE_BEHAVIOR)

- Body/response của `importAndPublishInv` khi có HSM; response sau khi cấp số (`No`, `TaxAuthorityCode`).
- Body REST thật của cancel/replace/adjust với HĐ đã phát hành — tài liệu DLL cho khung (xem mục trên), chưa thử.
- Mã trạng thái 2–6 trả về qua `getInvoicesByIkeys` có khớp bảng của tài liệu DLL không.
- Có endpoint xóa nháp / gửi email / lấy XML đã ký không.
- URL HTTPS + tài khoản production.
- Thuế suất áp dụng cho dịch vụ nha khoa (kế toán khách quyết).
- Bản gốc app.nfcdental.com lập HĐ từ phiếu thu hay từ kế hoạch điều trị (register có cột
  "Tên đơn vị", "Hình thức thanh toán" → nghiêng về phiếu thu; không có dữ liệu thật để xem).

## BlueDental API — đã dựng (2026-09-30, thay cho bản đề xuất 2026-09-28)

Luồng: Chi tiết kế hoạch điều trị → tab **Thanh toán** → nút "Xuất hóa đơn điện tử" (icon FileText) trên phiếu thu
→ `POST issue-from-payment` → EasyInvoice `api/publish/importInvoice` → HĐ **nháp, chưa cấp số** hiện trên portal
SoftDreams. Đã xác minh end-to-end với sandbox (một phiếu thu thật trên local → nháp "Chưa cấp số" trên portal).

Controller: `BlueDental.HttpApi/EInvoicing/ElectronicInvoiceController.cs`, base `api/v1/app/e-invoices`
(FE gọi `/v1/app/e-invoices…` vì axios `baseURL` đã là `/api`).

| Method | Path | Quyền | Mô tả |
|---|---|---|---|
| GET | `/api/v1/app/e-invoices?patientPaymentId&treatmentPlanId&patientId&clinicBranchId` | `payment.read` | Danh sách HĐĐT, mới nhất trước, lọc theo chi nhánh user được xem. Trả `ListResultDto<ElectronicInvoiceDto>` |
| POST | `/api/v1/app/e-invoices/issue-from-payment/{patientPaymentId}` | `payment.finalize` | Tạo nháp tại EasyInvoice từ một phiếu thu. Gọi lại khi còn nháp → **ghi đè cùng nháp** (Ikey cố định) |
| POST | `/api/v1/app/e-invoices/{id}/sync` | `payment.read` | `getInvoicesByIkeys` — cập nhật trạng thái/số HĐ sau khi kế toán ký trên portal |
| GET | `/api/v1/app/e-invoices/{id}/pdf` | `payment.read` | `getInvoicePdf` — trả `application/pdf`, tên `hoa-don-dien-tu-{id}` |

Không có body request; mọi tham số ở path/query.

### `ElectronicInvoiceDto`

```jsonc
{
  "id": "<guid>", "clinicBranchId": "<guid>", "patientId": "<guid>",
  "patientPaymentId": "<guid>", "treatmentPlanId": "<guid|null>",
  "provider": "EasyInvoice",
  "ikey": "bd-<patientPaymentId không gạch>",
  "pattern": "<mẫu số>", "serial": "<string|null>",
  "status": 0,                 // 0 Draft, 1 Published, 2 Cancelled, 3 Replaced, 4 Adjusted
  "no": "<string|null>",       // số HĐ, chỉ có sau khi ký
  "lookupCode": "<string|null>", "linkView": "<string|null>",
  "total": 0, "taxAmount": 0, "amount": 0,
  "customerName": "<string>",
  "lastSyncedAt": "<datetimeoffset|null>", "lastError": "<string|null>",
  "creationTime": "<datetime>"
}
```

### Quy tắc nghiệp vụ

- Một phiếu thu ↔ một HĐĐT. `Ikey = bd-{patientPaymentId:N}` → retry không tạo HĐ thứ hai.
- Chỉ phiếu `Kind = Payment` lập được HĐ (hoàn tiền / tạm ứng → `EInvoicing:0002`).
- HĐ đã `Published`/`Cancelled` không ghi đè được (`EInvoicing:0004`).
- Dòng HĐ mặc định (người dùng vẫn sửa được trong hộp thoại):
  - **Cả phiếu điều trị** → một dòng như bản gốc: "Kế hoạch điều trị {mã DT}", ĐVT "Răng", SL 1, đơn giá = Thành tiền
    của phiếu (đo trên bản gốc 2026-09-21).
  - **Phiếu thu** → mỗi `PatientPaymentLine` = một dòng, tên/mã/đơn vị lấy từ Danh mục dịch vụ (CatalogEntry); không
    chia dòng hoặc cộng không khớp → một dòng cho cả số tiền phiếu thu.
- Người mua = bệnh nhân (mã BN, họ tên, địa chỉ, SĐT). Hình thức TT: tiền mặt / chuyển khoản theo phiếu.
- VAT mặc định `-1` (KCT — dịch vụ y tế không chịu thuế), đổi qua `EasyInvoice:VatRate`.
- Mọi lần gọi nhà cung cấp ghi vào `IntegrationCallLog` (operation `einvoice-import` / `einvoice-lookup` /
  `einvoice-pdf`) trong UoW riêng nên vẫn còn khi request lỗi. **Chỉ ghi shape** (path, status, thời gian, số dòng,
  lỗi) — không ghi body (có tên BN = PHI) và không ghi header (có mật khẩu).
- Kiểm tra chi nhánh qua `BranchAccessChecker` ở cả 4 endpoint.

### Mã lỗi

| Code | Khi nào |
|---|---|
| `BlueDental:EInvoicing:0001` NotConfigured | Thiếu một trong BaseUrl / Username / Password / TaxCode / Pattern |
| `BlueDental:EInvoicing:0002` ReceiptNotInvoiceable | Phiếu không phải phiếu thu |
| `BlueDental:EInvoicing:0003` ProviderRefused | EasyInvoice từ chối / không phản hồi (`data.Message` = lỗi nhà cung cấp) |
| `BlueDental:EInvoicing:0004` AlreadyPublished | HĐ đã ký/hủy, không phát hành lại |
| `BlueDental:EInvoicing:0005` InvalidDraft | Thiếu tên người mua, không có dòng, tổng ≤ 0, tên dòng > 300 ký tự, hoặc phản hồi sai Ikey |

### Cấu hình & bí mật

Section `EasyInvoice` (`EasyInvoiceOptions`) — **chỉ còn là mặc định dự phòng** khi chi nhánh chưa có cấu hình riêng (xem "Cấu hình theo chi nhánh" bên dưới):

| Key | Ở đâu |
|---|---|
| `BaseUrl`, `Username`, `TaxCode`, `Pattern`, `Serial`, `VatRate`, `TimeoutSeconds` | `appsettings.json` (commit được, giá trị sandbox) |
| `Password` | **Không bao giờ commit.** Local: `appsettings.Development.json` (gitignored) hoặc user-secrets. Docker/server: biến `EASYINVOICE_PASSWORD` trong `.env` → compose map thành `EasyInvoice__Password` |

- Local `dotnet run` cần `ASPNETCORE_ENVIRONMENT=Development` để đọc `appsettings.Development.json`
  (`Properties/launchSettings.json`, gitignored).
- Server: thêm `EASYINVOICE_PASSWORD=…` vào `/home/hung/BlueDental/.env` rồi `docker compose up -d --force-recreate api`;
  kiểm tra bằng `docker compose exec api env | grep Invoice` (tên biến viết hoa thường lẫn lộn).
- Quyền `payment.finalize` do DbMigrator seed cho admin — chạy lại migrator sau khi deploy.

### Cập nhật 2026-10-01 — hóa đơn theo phiếu điều trị, phát hành, cấu hình theo chi nhánh

Endpoint thêm (base `api/v1/app/e-invoices`):

| Method | Path | Quyền | Mô tả |
|---|---|---|---|
| GET | `draft?patientPaymentId=…` **hoặc** `draft?treatmentPlanId=…` | `payment.read` | Bản nháp để FE điền InvoiceModal (người mua, dòng, trần tiền, `isConfigured`). Thiếu/thừa nguồn → `0011` |
| POST | `issue` body `IssueElectronicInvoiceDto` | `payment.finalize` | `{patientPaymentId \| treatmentPlanId, publish, buyerName, companyName, address, taxCode, phone, …}`. `publish=false` → `importInvoice` (Lưu Nháp); `publish=true` → `importAndPublishInv` (Phát Hành, ký HSM) |

- Ikey theo nguồn: phiếu thu `bd-{paymentId:N}`, phiếu điều trị `bd-plan-{planId:N}`. Một phiếu điều trị chỉ xuất theo **một** cách (cả phiếu hoặc theo phiếu thu) → `0012`; HĐ đã **Hủy** không còn chặn cách kia (`ElectronicInvoice.BillsSlipOtherWay`). FE ẩn nút "Xuất HĐ" ở phiếu thu khi server chắc chắn sẽ từ chối (HĐ của phiếu thu đã ký, hoặc phiếu điều trị đã xuất cả phiếu và HĐ đó chưa hủy) — `isReceiptInvoiceable`.
- Tổng HĐ không vượt số tiền nguồn (`0010`, kiểm ở server). Gửi trùng song song → `0006`. Phiếu thu đã có HĐ số → không xoá được (`0009`).
- HĐ giữ tài khoản (cấu hình) lúc lập; đổi cấu hình chi nhánh không chuyển HĐ cũ.
- Sandbox không có HSM: **Phát Hành trả lỗi 196** từ SoftDreams tới khi được cấp HSM. Lưu Nháp chạy bình thường.

### Cấu hình theo chi nhánh — `api/v1/app/e-invoice-configs`

UI: Công cụ → Hóa đơn → Cấu hình (`/tools/invoice`). Bảng `EInvoiceBranchConfigs`.

| Method | Path | Quyền | Ghi chú |
|---|---|---|---|
| GET | `?clinicBranchId=` | `Tools.View` | `ListResultDto<EInvoiceConfigDto>`, chỉ chi nhánh user được xem |
| GET | `{id}` | `Tools.View` | |
| POST | | `Tools.Manage` | `CreateUpdateEInvoiceConfigDto`; mật khẩu bắt buộc |
| PUT | `{id}` | `Tools.Manage` | mật khẩu rỗng = giữ mật khẩu cũ; chi nhánh không đổi được |
| DELETE | `{id}` | `Tools.Manage` | |

```jsonc
// EInvoiceConfigDto — KHÔNG bao giờ trả mật khẩu (form gốc: Tên, Chi nhánh, App ID, MST, Tên đăng nhập,
// Mật khẩu, Tính thuế theo dịch vụ, Tính thuế theo kỳ, Trạng thái)
{ "id": "<guid>", "clinicBranchId": "<guid>", "name": "<string>", "provider": "EasyInvoice",
  "appId": "<string|null>", "username": "<string>", "hasPassword": true, "taxCode": "<string>",
  "taxByService": false, "taxByPeriod": false, "isActive": true,
  "lastPattern": "<string|null>", "lastSerial": "<string|null>", "creationTime": "<datetime>" }
```

- Form không có rule ở FE (như bản gốc); server từ chối tên / MST / tên đăng nhập trống, và mật khẩu trống khi tạo (`0013`).
- `appId`, `taxByService`, `taxByPeriod` được **lưu nhưng chưa dùng** (UNKNOWN_REFERENCE_BEHAVIOR, xem unknowns.md).
- URL API và VAT mặc định lấy từ appsettings `EasyInvoice`. Mẫu số / Ký hiệu nhập ở hộp thoại Hóa đơn
  (`IssueElectronicInvoiceDto.pattern/serial`); server nhớ cặp dùng gần nhất vào `lastPattern/lastSerial` để điền sẵn lần sau
  (`draft.numberings`). Không có mẫu nào → `0014`.
- Hộp thoại cho sửa Tiền tệ / Tỷ giá, nhưng chỉ phát hành VND tỷ giá 1 (`0015`).

- Mỗi chi nhánh tối đa **một** cấu hình đang hoạt động (`0008`). Cấu hình sai (URL, VAT ngoài -1/0/5/8/10…) → `0007`.
- Mật khẩu lưu mã hoá (write-only), không ghi log.
- Thứ tự chọn tài khoản khi lập HĐ: cấu hình active của chi nhánh → section `EasyInvoice` trong appsettings → `0001`.

### Mã lỗi bổ sung

| Code | Khi nào |
|---|---|
| `0006` IssueInProgress | Đang gửi cùng nguồn |
| `0007` InvalidConfig | Cấu hình không hợp lệ |
| `0008` DuplicateActiveConfig | Chi nhánh đã có cấu hình active |
| `0009` ReceiptInvoiced | Xoá phiếu thu đã có HĐ |
| `0010` AmountExceedsSource | Vượt trần tiền nguồn |
| `0011` SourceRequired | Không có / có cả hai nguồn |
| `0012` SourceAlreadyInvoiced | Phiếu điều trị đã xuất theo cách khác |

### Kiểm chứng

`e2e/einvoice-api.spec.ts` (full stack thật, không chặn request): CRUD cấu hình + không lộ mật khẩu + giữ mật khẩu khi PUT rỗng,
một cấu hình active/chi nhánh, `draft` cần nguồn, UI tạo cấu hình → reload còn → xoá. Không spec nào gọi tới SoftDreams.

### Còn lại

- Hủy / thay thế / điều chỉnh HĐ đã phát hành: chưa làm (cần body thật khi có HSM).
- Phát hành có ký số: chờ SoftDreams cấp HSM + URL HTTPS production.
- Xem thêm `docs/clone/unknowns.md` mục EasyInvoice.
