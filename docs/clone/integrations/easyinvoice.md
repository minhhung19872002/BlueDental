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

## Còn mở (UNKNOWN_REFERENCE_BEHAVIOR)

- Body/response của `importAndPublishInv` khi có HSM; response sau khi cấp số (`No`, `TaxAuthorityCode`).
- Body của cancel/replace/adjust với HĐ đã phát hành (Reason, ngày, HĐ thay thế…).
- Có endpoint xóa nháp / gửi email / lấy XML đã ký không.
- URL HTTPS + tài khoản production.
- Thuế suất áp dụng cho dịch vụ nha khoa (kế toán khách quyết).
- Bản gốc app.nfcdental.com lập HĐ từ phiếu thu hay từ kế hoạch điều trị (register có cột
  "Tên đơn vị", "Hình thức thanh toán" → nghiêng về phiếu thu; không có dữ liệu thật để xem).

## Thiết kế tích hợp vào BlueDental (đề xuất, 2026-09-28)

Khảo sát code hiện có (Explore 2026-09-28):

| Đã có | Ở đâu | Dùng lại |
|---|---|---|
| Aggregate `Invoice` header-only, `Draft→Issued→PartiallyPaid→Paid/Voided` | `BlueDental.Domain/Billing/Invoice.cs` | Không phải nguồn tiền thật của phòng khám |
| `PatientPayment` (phiếu thu `THANHTOAN-NN/plan/yyyy`) + `PatientPaymentLine` theo dịch vụ | `BlueDental.Domain/Billing/PatientPayment.cs` | **Nguồn dữ liệu để lập HĐĐT** (bản gốc lập HĐ theo phiếu thu) |
| HttpClient mẫu: `IHttpClientFactory` named client, không throw, trả `Outcome` | `BlueDental.Application/ClinicIntegration/HttpClinicPartnerClient.cs` | Copy cấu trúc |
| `IntegrationCallLog` (Operation, Path, StatusCode, DurationMs, Error) | `BlueDental.Domain/ClinicIntegration/IntegrationCallLog.cs` | Thêm bảng riêng cho HĐĐT, giữ thêm body đã che mật khẩu |
| Báo cáo `/operations?financeSubTab=invoice` gọi API thật, đã có cột Nhà cung cấp / Trạng thái phát hành | `BlueDental.FE/src/features/operations/reports/InvoiceReport.tsx` | Nơi hiển thị kết quả |
| Dialog cấu hình HĐĐT chỉ có UI (MISA, taxCode, appId, user, pass) — chưa có BE | `BlueDental.FE/src/features/tools/components/InvoiceConfigView.tsx` | Nối BE `EInvoiceProviderConfig` |
| Permission `operationsFinanceInvoice` read/export; `payment` CRUD | `BlueDental.Domain.Shared/Permissions/BlueDentalAbilityPermissions.cs` | Thêm subject `eInvoice` |
| Options pattern: chưa có `IOptions<T>`; đọc `configuration["X:Y"]`; secrets ở `appsettings.Development.json` (Zalo) | `BlueDental.HttpApi.Host/appsettings*.json` | HĐĐT sẽ là options class typed đầu tiên |

### Lớp Domain (`Billing/ElectronicInvoices/`)

- `EInvoiceProviderConfig : FullAuditedAggregateRoot<Guid>` — `ClinicBranchId`, `Provider` (enum `EasyInvoice=1, Misa=2`),
  `BaseUrl`, `Username`, `PasswordEncrypted` (ABP `IStringEncryptionService`), `Pattern`, `Serial?`, `TaxCode`,
  `IsActive`, `DefaultVatRate`. Một chi nhánh một cấu hình đang hoạt động.
- `ElectronicInvoice : FullAuditedAggregateRoot<Guid>` — `ClinicBranchId`, `PatientPaymentId` (nguồn), `PatientId`,
  `Ikey` (= Id, idempotent), `Status` (`Pending=1, Issued=2, Failed=3, Cancelled=4, Replaced=5, Adjusted=6`),
  `Pattern`, `Serial`, `InvoiceNo?`, `LookupCode?`, `IssuedAt?`, `SubTotal`, `VatAmount`, `Total`, `VatRate`,
  `BuyerName`, `BuyerTaxCode?`, `BuyerAddress?`, `PaymentMethodLabel`, `ProviderMessage?`, `PdfBlobName?`.
  Guard: chỉ `Pending/Failed` mới `MarkIssued`; `Cancel(reason)` chỉ khi `Issued`.
- `EInvoiceApiCallLog : CreationAuditedEntity<Guid>` — như `IntegrationCallLog` + `RequestBody`, `ResponseBody`
  (che mật khẩu trong header, không lưu header), `ElectronicInvoiceId?`. Đáp ứng CLAUDE.md §9.

### Lớp Application

- `IEInvoiceProviderClient` (Strategy theo `Provider`, mục 15.6) với `EasyInvoiceClient : ITransientDependency`:
  `IssueAsync(config, ElectronicInvoice, lines)`, `GetPdfAsync`, `LookupAsync(ikeys)`, `CancelAsync`.
  Header sinh bằng `EasyInvoiceAuthHeader.Build(method, user, password)` (thuật toán mục FACT ở trên) — có unit test
  cho chuỗi cố định (ts, nonce cho trước → sig biết trước).
- `ElectronicInvoiceAppService : BlueDentalAppService` (bắt buộc kế thừa base để `L[]` hoạt động):
  - `POST api/v1/app/e-invoices/issue-from-payment/{patientPaymentId}` — build `ElectronicInvoice` từ phiếu thu +
    `PatientPaymentLine` (mỗi line = một `Product`, tên dịch vụ từ CatalogEntry), gọi client, lưu kết quả + log.
  - `GET api/v1/app/e-invoices?branchId&from&to&status` — nguồn cho báo cáo `financeSubTab=invoice`.
  - `GET api/v1/app/e-invoices/{id}/pdf`, `POST …/{id}/cancel`, `POST …/{id}/sync` (getInvoicesByIkeys).
  - `EInvoiceProviderConfigAppService` CRUD nối vào dialog Tools đã có.
- Controller conventional cho từng contract (R-401: mọi contract phải có controller, không bật lại `[Authorize]` app-service).
- Sau `importInvoice` lưu `LookupCode`, `InvoiceStatus`; `POST …/{id}/sync` gọi `getInvoicesByIkeys` để lấy `No`, `TaxAuthorityCode`, `TCTCheckStatus` khi kế toán đã ký trên portal.
- Không background job ở phase 1: phát hành do người dùng bấm. Phase 2 có thể thêm `AsyncPeriodicBackgroundWorkerBase`
  retry `Failed` và sync trạng thái CQT.

### Cấu hình & bí mật

```jsonc
// appsettings.json (commit) — chỉ khung
"EInvoice": { "EasyInvoice": { "BaseUrl": "http://api.softdreams.vn", "TimeoutSeconds": 30 } }
// appsettings.Development.json / docker env (KHÔNG commit giá trị)
"EInvoice": { "EasyInvoice": { "Username": "API", "Password": "...", "Pattern": "1C26TYY" } }
```

Ưu tiên lưu credential theo chi nhánh trong `EInvoiceProviderConfig` (mã hóa) vì tenant EasyInvoice = 1 MST = 1 pháp nhân;
appsettings chỉ giữ giá trị mặc định cho sandbox/dev. Nếu chỉ một pháp nhân toàn hệ thống thì appsettings + `IOptions<EInvoiceOptions>` là đủ.

### Frontend

- `features/billing/e-invoice/` : `api/` (TanStack hooks), `components/IssueEInvoiceDialog.tsx`
  (xem trước: người mua, MST, dòng dịch vụ, VAT), `EInvoiceStatusTag` (Strategy map).
- Nút "Phát hành HĐĐT" trong `PlanPaymentsTab.tsx` cạnh "In hóa đơn tổng"; cột Thao tác báo cáo `InvoiceReport.tsx`: Xem PDF / Hủy.
- Gating `useAbility("eInvoice", "create")`; menu/route theo `routePermissions.ts`.

### Thứ tự làm (feature loop CLAUDE.md §10)

1. Probe xong 2026-09-28: auth 6 phần, body `XmlData` XML. Chốt với BA: luồng phát hành khi sandbox không có HSM.
2. API contract DTO + enum → Domain entities + tests → migration `AddElectronicInvoices`.
3. `EasyInvoiceClient` + `EasyInvoiceAuthHeader` (unit test header) + call log.
4. AppService + controller + integration test HTTP thật (mock **duy nhất** được phép: fake `IEInvoiceProviderClient` — hệ ngoài).
5. FE dialog + nút + cột báo cáo; Playwright thật với sandbox SoftDreams (sandbox không phải production của ai → được ghi).
6. `/simplify`, `/security-review` (credential, log che mật khẩu, PHI không log tên bệnh nhân trong body log? → **che `CusName/CusPhone` trong log**).

