# F-84 — In phiếu thu để ký tay & chữ ký kế toán (P2910_02, R-1081, R-1082)

Source: BA `P2910_02.drawio` plus the owner's four answers (29/10):
print the draft at once, drop the description the BA struck out, the
accountant's signature goes in the "Người lập phiếu" box above the name, and
an upload of up to 2 MB is shrunk automatically. BlueDental only; the
reference app has nothing like it. Builds on P2610 (`receipt-export.md`,
`receipt-ipad-signing.md`, `receipt-cancel.md`) and P2910 (`payment-rounds.md`).

## Behaviour

### A. Totals block on the PHIẾU THU sheet

Each label is as wide as its words and stays on one line; the amounts are
right-aligned. This applies to the receipt page, the iPad and the exported
PDF (`ReceiptPaper`, `ReceiptExporter`).

### B. Dịch vụ on the invoice-request form

`InvoiceRequestSources.ServiceNamesAsync` reads the receipt line's
"Tên trên phiếu" (`ReceiptName`). When that is blank it falls back to the
catalog name, then the service code, then the receipt's note. The public QR form
`/invoice-request/:token`, the staff draft and the iPad's invoice step all go
through it.

### C. In phiếu thu (customer signs on paper)

- "In phiếu thu" on a receipt that is still "Chưa thanh toán" first asks for
  confirmation (`ReceiptPaperConfirm`).
- `POST /api/v1/app/receipt-signing/{id}/print-for-paper` (Payment.Update,
  branch-scoped) does the following:
  - sets `PaperSignedAt` and the cashier on the receipt (`PatientPayment.SignOnPaper`);
  - closes the open iPad session as `Printed` (6);
  - writes one `PrintedForPaper` log line.
- Printing again keeps the first time and cashier and writes no second line.
- An exported or paid receipt cannot go to paper (`Billing:0096`). Once a
  receipt is on paper it cannot be sent to the iPad (`Billing:0119`).
- The FE prints the draft PDF straight after the call.
- Steps 2–4 then read "Ký tay trên giấy · HH:mm:ss" and step 5 "Kế toán kiểm
  tra" is current. The panel heading reads "Khách đã ký" with a
  "Lúc HH:mm:ss" chip (the print time).
- The iPad shows the Printed screen for 30 s
  (`ReceiptSigningSession.IssuedShownFor`) and then goes back to waiting.
- While the receipt is on paper, "Hủy phiên & sửa phiếu" is the only way back.
  That action, and any edit (PUT) of the receipt, take the receipt back from
  paper (`PaperSignedAt` cleared) and log `PaperTakenBack`.

### D. Accountant panel (step 5)

- Hình thức ký số is a radio with three choices:

  | Value | Label | Notes |
  |---|---|---|
  | 3 | Ký điện tử | Default |
  | 2 | Token điện tử | Disabled; the server refuses it with `0113` until phase 7 |
  | 1 | Ký tay trực tiếp | The accountant signs the printed sheet by hand |

- **Ký điện tử** uses the signed-in user's own saved signature
  (`AccountantSignatureField`):
  - draw it on the pad, or upload an image;
  - the picker takes up to 2 MB and the browser shrinks the image to fit
    600 × 200 PNG (`utils/signatureImage.ts`);
  - "Dùng chữ ký này" saves it through `PUT /api/v1/app/accountant-signature/mine`
    (`Payment.Update`);
  - the server caps the image at 200 KB (`Billing:0118`);
  - a new save replaces the old signature in place; each change is recorded in
    `bd_accountant_signature_changes`.
- `GET /api/v1/app/accountant-signature/mine` (any signed-in user) reads it back.
  Neither endpoint is audited, because the request body is the drawing.
- An Electronic export with no saved signature is refused with `Billing:0117`.
- On the exported sheet and PDF, the signature sits above "Người lập phiếu" and
  the name stays. The receipt records `AccountantSignerId` and
  `AccountantSignatureSavedAt`.
- A Ký tay trực tiếp export keeps no signer.
- The exported panel lists:

  | dt | dd |
  |---|---|
  | Xuất phiếu | `dd/MM/yyyy HH:mm · name` |
  | Hình thức ký số | "{mode} – name xác nhận" |
  | Chữ ký kế toán | "name · chữ ký lưu {time}" (Ký điện tử), or "Ký tay trực tiếp trên phiếu in" |
  | Khách ký | "Trên iPad lúc …", or "Tay trên phiếu in lúc …" |
  | Ký số đơn vị | "Chưa ký số" |
  | Lưu trữ | "PDF/A · tối thiểu 10 năm" |
  | Xác nhận thanh toán | only when the receipt is paid |

### E. Receipt log (BA note on logging)

`bd_payment_receipt_logs` is append-only (`PaymentReceiptLog`, written by
`ReceiptLogBook` inside the caller's unit of work, so a failed step leaves no
line). It stores ids and times only, no PHI. Names are resolved when the log is
read.

`GET /api/v1/app/receipt-signing/{id}/log` (Payment.Read, branch-scoped) returns
`{ items, intact, unsealedCount }`, the lines oldest first (by `sequence`). It
still reads a cancelled (soft-deleted) receipt. There is no screen for it yet
(owner: not needed now).

| BA asks for | Where it is |
|---|---|
| Thời gian xuất phiếu | `At` of the `Exported` line (3) |
| Người ký | the `Exported` line's fields (below) |
| Thời gian hủy phiếu (nếu có) | `At` of the `Cancelled` line (4), with `CancelReasonCode` |
| User timestamp | `UserName` + `At` on every line |

The `Exported` line's signer fields:

- `SignMode`;
- `AccountantSignerName` and `AccountantSignatureSavedAt`;
- `CustomerSignedAt`, and `CustomerSignedOnPaper` when the customer signed on paper.

The log also carries `PrintedForPaper` (1) and `PaperTakenBack` (2), and
`FileSha256` on the export line.

#### Tamper evidence (R-1082)

- **Seal chain.** Each line has a `Sequence` (1, 2, 3… per receipt) and a
  `Seal`. The seal is an HMAC-SHA256 over the line's fields and the seal of
  the line before it, stored as `v1:` + 64 hex characters.
  - The HMAC key is derived from `RECEIPT_VAULT_KEY` with HKDF-SHA256 (info
    `bluedental/receipt-log/v1`), so the same key never both encrypts and
    authenticates.
  - Code: `PaymentReceiptLog.SealAfter` / `IsSealedAfter` and `ReceiptLogChain.Check`.
  - Sealed fields: version, `Id`, `PatientPaymentId`, `ClinicBranchId`,
    `Sequence`, `Action`, `At`, `UserId`, `SignMode`, `AccountantSignerId`,
    `AccountantSignatureSavedAt`, `CustomerSignedAt`, `CustomerSignedOnPaper`,
    `FileSha256`, `CancelReasonCode` and the previous seal.
  - Times are kept in UTC to the microsecond, as PostgreSQL stores them, so a
    line read back seals to the same text.
- **Writing.** `ReceiptLogBook` seals the new line after the receipt's last
  line and inserts it **without saving**. The line is saved together with the
  rest of the caller's unit of work.
  - A line written earlier in the same unit of work is remembered through
    `IUnitOfWorkManager.Current.GetOrAddItem`, so two lines in one request
    still chain. Otherwise the last saved line is read.
  - Why no early save: `autoSave` flushes the whole DbContext, including the
    caller's half-done change. Hủy phiếu then read its own cancel in
    `GuardRefundsStillCoveredAsync` and refused itself with `Billing:0101`
    (caught by the R-915 e2e).
  - A unique index on (`PatientPaymentId`, `Sequence`) refuses two writers
    that race for the same number when they save.
- **Reading.** Each item carries `sequence` and `verified`. `intact` is false
  when a line was changed, removed from the middle or the start, written
  without the key, or numbered out of order.
- **Database.** Triggers `bd_payment_receipt_logs_no_change` (BEFORE UPDATE OR
  DELETE, per row) and `bd_payment_receipt_logs_no_truncate` (BEFORE TRUNCATE)
  refuse any change with `insufficient_privilege`.
- **Limits.**
  - Removing the newest lines cannot be told from the chain alone. The
    trigger is what stops that.
  - The table owner can `DISABLE TRIGGER`. A line changed that way still fails
    verification.
  - Lines written before R-1082 exist only on develop, staging and local
    databases (main has no log table yet). The migration numbers them by time
    and leaves them unsealed. They count in `unsealedCount` and are accepted
    only ahead of the first sealed line.
  - Without `RECEIPT_VAULT_KEY`, every log write fails with `Billing:0107`:
    - In phiếu thu;
    - taking a receipt back from paper (Hủy phiên & sửa phiếu, or an edit);
    - Xuất phiếu thu (it already needed the key);
    - Hủy phiếu thu.
- **Scripts.**
  - `deploy/db/clear-all-except-catalog.sql` disables the TRUNCATE trigger
    around its TRUNCATE and turns it back on afterwards.
  - The patient hard-delete script does not touch the log table, which has no
    foreign key to the receipt.
- Disk and backup encryption belong to the infrastructure and come later.
  Columns are not encrypted, because the log holds ids and times only.

### Encryption ("mã hóa hết")

Every exported PDF/A is sealed with AES-256-GCM (`ReceiptVault:Key`, from
`RECEIPT_VAULT_KEY`, version byte 0x01). It is stored in MinIO at
`receipts/{branch}/{id}.pdf.enc` with its SHA-256, and the SHA-256 is checked
again on every read.

Signatures are encrypted at rest too:

- the customer's iPad signature;
- the accountant's saved signature (`SignatureCipher`, stored as `v1:…`).

A draft print is not stored and is not logged as a file.

## Data

- Migration `20261029141918_PaperSignAndAccountantSignature`:
  - `bd_payment_receipt_logs`;
  - `bd_accountant_signatures`, one row per user;
  - `bd_accountant_signature_changes`, indexed on (UserId, ChangedAt);
  - new columns on `bd_patient_payments`: `PaperSignedAt`, `PaperSignedById`,
    `AccountantSignerId`, `AccountantSignatureSavedAt`.
- Migration `20261029154727_SealedReceiptLog` (R-1082):
  - `Sequence` (lines already there are numbered by time) and `Seal`
    (varchar 80) on `bd_payment_receipt_logs`;
  - a unique index on (PatientPaymentId, Sequence), replacing (PatientPaymentId, At);
  - function `bd_payment_receipt_logs_append_only()` and its two triggers.
- Error codes: `Billing:0117` (no saved signature), `0118` (over 200 KB) and
  `0119` (already on paper, cannot go to the iPad).

## Tests

`e2e/receipt-paper-sign.spec.ts` (real stack, serial, 5 tests):

1. In phiếu thu:
   - the session closes as Printed;
   - a second print keeps the first time;
   - export needs no iPad drawing;
   - the log reads Printed → Exported with user, time, signer and hash.
2. Hủy phiên & sửa phiếu and an edit both take the receipt back from paper and
   log `PaperTakenBack`.
3. Ký điện tử:
   - refused with no saved signature (`0117`) and over 200 KB (`0118`);
   - the saved signature is on the export and in the log.
4. Branch 2:
   - can neither print nor read the log;
   - does not see this user's signature.
5. On screen:
   - the confirm popup comes first;
   - the steps read "Ký tay trên giấy";
   - Ký điện tử signs and exports.

Every log read in the spec also checks the seal chain (R-1082): `intact`,
`unsealedCount` 0, sequence 1..n and every line `verified`.

`Domain.Tests/Billing/ReceiptLogChainTests` (9 cases, R-1082):

- a log read back as written is intact;
- a changed field or time no longer verifies;
- a line removed from the middle or the start breaks the chain;
- a line sealed with another key does not verify;
- unsealed lines are counted, and allowed only ahead of the sealed ones;
- times are kept in UTC to the microsecond;
- a line is sealed once, and only after a line of its own receipt;
- the MAC depends on both the text and the key.

Checked by hand with psql on the isolated database (R-1082):

- UPDATE, DELETE and TRUNCATE are refused;
- a line changed with the trigger disabled reads back `verified: false` and
  `intact: false`.

`e2e/invoice-request-api.spec.ts` "R-1081: the QR form names the service as the
receipt does" covers both cases:

- round 1, which has no name of its own, falls back to the catalog name;
- round 2, with its own wording, shows it on the staff draft and on the
  anonymous public form.

`Domain.Tests/Billing/ReceiptPaperSignTests` (13 cases):

- printing:
  - keeps the first time and cashier;
  - is refused once the receipt is exported;
  - an edit takes the receipt back;
- export:
  - Electronic needs a saved signature, and records the signer and when it was saved;
  - a hand-signed export keeps no signer;
- log:
  - the print, export and cancel lines carry what they should;
  - an export line before the export is refused;
- the iPad Printed screen;
- a saved signature is replaced in place;
- the cap error.

Updated for the new labels: `receipt-exported`, `receipt-page`,
`receipt-cancel`, `receipt-ipad`, `fixtures/ledgerReceipt.ts` (`SIGN_MODE`,
`issueReceipt` exports Ký tay trực tiếp).

## Assumptions (not in the BA mock)

See `docs/clone/unknowns.md` → P2910_02.
