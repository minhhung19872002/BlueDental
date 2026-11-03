# F-81 phase 4 — Ký phiếu thu trên iPad (P2610)

Status: `IN_PROGRESS` (phase 4/7 đã xanh trên stack thật; F-81 còn phase 5–7)
— see `01-feature-verification-registry.md`, regression log R-1048.

BlueDental-only (BA `P2610.drawio`, 2026-10-27); the reference has no iPad flow.

## Owner decisions (2026-10-27)

- The iPad is its own web page `/sign`, no staff login, no fallback on the PC.
- Pairing is per branch: Cài đặt → **Kết nối iPad** (`/settings?tab=ipad`) prints a
  link + QR once. A branch may pair several iPads; each has its own revocable token.
- One open session per branch: every iPad of the branch shows the same receipt.
- A new receipt goes **straight to the iPad** when the branch has one and it is free.
  Busy → the PC shows "iPad đang chờ khách ký phiếu …" and the cashier waits, or
  "Hủy phiên đang chờ & gửi phiếu này".
- iPad header: logo + branch name only. No Quầy, no "Báo sai thông tin".
- The accountant panel is **not** in phase 4: exporting still uses the interim ✓ /
  `POST patient-payments/{id}/issue`.

## Flow

| Who | Screen / action | Result |
|-----|-----------------|--------|
| Admin | Kết nối iPad → name → "Tạo đường dẫn kết nối" | `POST signing-devices`; link `/sign/pair#<token>` + QR shown once. Only the SHA-256 of the token is stored. |
| iPad | opens the link | token saved in the iPad browser, URL becomes `/sign` (the token leaves the address bar and history; after `#` it never reaches the server log) |
| Cashier | writes a receipt | session opened if the iPad is free (`ReceiptSigningDesk.SendIfFreeAsync`) |
| iPad | PHIẾU THU + 2 boxes → "Xác nhận thông tin" | `POST signing-station/sessions/{id}/check` |
| iPad | draws on the pad → "Hoàn tất ký" | `POST …/sign`, PNG data URL, stored **AES-256-GCM** (`ReceiptCipher`, key `ReceiptVault:Key`) |
| iPad | "Yêu cầu xuất hóa đơn" (Doanh nghiệp / Cá nhân) | `POST …/invoice-request` → invoice request with source 3 "Khách gửi trên iPad" |
| Cashier | Gửi lại · Hủy phiên & sửa phiếu · Yêu cầu khách ký lại | `receipt-signing/{paymentId}/send {replace} · /cancel · /resign` |
| Export / revise / cancel the receipt | | session closed (Issued / Revised / ReceiptCancelled); iPad shows "Đã xuất phiếu thu" then idles |

Live updates: event `ReceiptSigningChanged` — the iPad on hub `/signalr/receipt-signing`
(group per branch, joined with the device token), the PC on `/signalr/notifications`
(ids only; each screen re-reads what it may see).
The iPad never gets a 401 (that would open the staff login): a missing, forged or
revoked token is 403 `Billing:0111`.

## Tests

`BlueDental.FE/e2e/receipt-ipad.spec.ts` (serial, real stack, no interception; the
iPad is a second browser context 1024×1366 with touch, paired through the link the
settings screen printed):

1. Kết nối iPad prints link + QR once; the list shows "Đang kết nối"; the iPad
   reloads on `/sign` without a login.
2. Auto-send → iPad review → both boxes → sign → PC live: status, panel, steps 4/6,
   signature + "Ký lúc" on the sheet; a separate GET returns `data:image/png`;
   reload keeps it. Ký lại → pad again. Issue → iPad "Đã xuất phiếu thu" → idle;
   PC 6/6 steps, signature kept.
3. Busy: 2nd receipt shows "iPad đang chờ khách ký phiếu <1st>", no Gửi button;
   take over → 1st session closed (separate read). Hủy phiên → iPad idle; manual
   "Gửi tới iPad" works.
4. Invoice request Cá nhân: required fields checked on the iPad; separate list
   request shows source 3, buyer name, isCompany false. (Not exported to EasyInvoice.)
5. Station API: no token / forged token → 403 `0111` (never 401); sign before the
   check → `0104`; a non-PNG data URL → `0105`; a session the cashier ended → `0103`.
6. Branch 2 cannot list branch 1's iPads (4xx). Thu hồi → "Đã thu hồi", no button;
   the iPad's reload shows "iPad chưa được kết nối", still on `/sign`.

Clean-up: `afterEach` cancels the sessions of receipts the test wrote; `afterAll`
revokes every "iPad e2e …" device still active, so other specs' receipts are not
sent to an iPad.

`BlueDental.Domain.Tests/Billing/ReceiptSigningTests.cs`: session state machine,
signature image validation, cipher round-trip / tamper.

## Assumptions (not in the BA mock)

See `docs/clone/unknowns.md` → P2610 phase 4.
