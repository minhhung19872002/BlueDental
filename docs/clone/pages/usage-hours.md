# Quản lý thời gian sử dụng — Cài đặt → Danh sách chi nhánh, Nhân sự

**BlueDental-local.** The reference (app.nfcdental.com) has no such setting, so
nothing here is cloned. The source is the function list
`Danh-muc-chuc-nang-nha-khoa-v2`, cluster 11 item 13: *"Cấu hình thời gian mà
user có thể sử dụng phần mềm. Ví dụ chỉ được đăng nhập vào hệ thống từ 6g sáng
đến 8g tối."* The choices below were made on 2026-10-07 in place of an answer
from the owner, and follow the shape of item 11 (`branch-ip-restriction.md`) so
the two rules behave alike.

## Decisions (assumed, not observed)

| Question | Chosen |
|----------|--------|
| Where the window lives | On the branch: "Giờ được phép sử dụng" (Từ – Đến) in the branch dialog. Clinic time (Vietnam, `ClinicCalendar`), every day of the week. Start inclusive, end exclusive; an end before the start runs overnight (22:00 → 06:00). Both or neither; two equal times are refused (`BlueDental:Organizations:0008`) |
| Not the opening hours | `ClinicBranch.OpeningTime/ClosingTime` already exist but nothing reads or fills them; they were left alone so turning this on is a deliberate act, and staff can be allowed in before opening |
| Turning it on | A branch restricts nothing until both times are set. Deploying changes nothing for anyone |
| Per staff | Checkbox "Cho phép dùng ngoài giờ" on the staff dialog, **off** by default, separate from item 11's "Cho phép đăng nhập ngoài công ty" |
| Who is never restricted | The `admin` role |
| Which branches count | Same as item 11: the account's assignments, else its home branch, else (clinic-wide account) every branch. Allowed when the clinic time falls in the window of any of its branches that has one |
| When it is checked | At sign-in after the password is accepted → 403 `BlueDental:Auth:LoginOutsideHours`, message names the window ("Tài khoản này chỉ được dùng phần mềm trong khung giờ 06:00–20:00…"). On every authenticated request: a session still open when the window ends is signed out (401, same code) and the login screen says why (`/login?reason=hours`) |
| How late the cut-off is | The per-request answer is cached a minute per account and address, so a session ends at most a minute after the window closes (or after the window / tick changes) |
| Both rules | IP is checked first, then hours; the refusal names the first that fails |
| Cài đặt → Thông tin phòng khám | Saves the branch without the times; both `null` keep the window, both `""` clear it |

## API

```
POST /api/v1/app/clinic-branches            { …, usageStartTime?: "HH:mm", usageEndTime?: "HH:mm" }
PUT  /api/v1/app/clinic-branches/{id}       same; both null = keep, both "" = clear
GET  /api/v1/app/clinic-branches[/{id}]     → { …, usageStartTime: "06:00" | null, usageEndTime: "20:00" | null }
POST/PUT /api/v1/app/staff[/{id}]           { …, allowLoginOutsideHours }
POST /api/account/login (ABP)               403 { error: { code: "BlueDental:Auth:LoginOutsideHours", message } }
any authenticated request                   401 same code + sign-out
```

## Implementation

- `ClinicBranch.UsageStartTime/UsageEndTime`, `SetUsageHours`, `AllowsUsageAt`;
  the rule is `UsageHoursPolicy` (pure, Domain).
- Item 11's guard and middleware were generalized: `SignInRestrictionGuard`
  returns a `SignInRefusal` (code + window text); `BlueDentalSignInManager` and
  `SignInRestrictionMiddleware` answer with it.

## Open — owner decisions

- Days of the week (e.g. closed on Sunday) are not modelled; the window applies every day.
- No warning before the window closes; the session simply ends on the next request after it.
