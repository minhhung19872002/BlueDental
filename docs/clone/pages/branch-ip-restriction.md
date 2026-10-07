# Xác thực IP theo chi nhánh — Cài đặt → Danh sách chi nhánh, Nhân sự

**BlueDental-local.** The reference (app.nfcdental.com) has no such setting, so
nothing here is cloned. The source is the function list
`Danh-muc-chuc-nang-nha-khoa-v2`, cluster 11 item 11: *"Quản lý việc đăng nhập
theo địa chỉ IP. Cho phép hay không cho phép nhân viên đăng nhập khi ở ngoài
công ty."* The choices below were made on 2026-10-07 in place of an answer from
the owner, and are the ones to revisit if the owner decides otherwise.

## Decisions (assumed, not observed)

| Question | Chosen |
|----------|--------|
| Where the networks live | On the branch: "IP được phép đăng nhập" in the branch dialog (Cài đặt → Danh sách chi nhánh). One entry per line; a single address (`113.161.10.20`) or a CIDR block (`113.161.10.0/24`), IPv4 or IPv6. Commas, semicolons and spaces also separate entries. Stored normalized (host bits cleared, duplicates dropped); a bad entry is refused by name (`BlueDental:Organizations:0007`) |
| Turning it on | A branch restricts nothing until its list has an entry. Deploying the feature changes nothing for anyone |
| "Cho phép / không cho phép" per staff | Checkbox "Cho phép đăng nhập ngoài công ty" on the staff dialog, **off** by default: once a branch has a list, its staff are held to it unless ticked |
| Who is never restricted | The `admin` role (so the people who set the list cannot lock themselves out) and staff ticked as above |
| Which branches count | The account's own: its branch assignments; else its home-branch property; else — a clinic-wide account — **every** branch. An account may sign in from the network of any of its branches that has a list; branches without a list are ignored. So a clinic-wide non-admin account (e.g. `manager`) is held to the union of all lists once any branch has one |
| When it is checked | At sign-in, **after** the password is accepted (a wrong password says nothing about IP rules) → 403 `BlueDental:Auth:LoginIpNotAllowed`, shown on the login form. And on every authenticated request: a session that signed in at the clinic and carries on from elsewhere is signed out (401, same code) and the login screen says why (`/login?reason=ip`) |
| How fast a change applies | The per-request answer is cached for one minute per account and address, so a new list or tick takes effect within a minute; sign-in always reads the current settings |
| Helping the admin | The dialog shows "IP hiện tại của bạn: …" (what the server sees) with "Thêm vào danh sách" |
| Who sees the list | Branch administration (`GET /clinic-branches`, `/{id}`). The header's `/accessible` list, which every signed-in user reads, returns it as `null` |
| Cài đặt → Thông tin phòng khám | Saves the branch without the field; `null` keeps the list, `""` clears it |

## API

```
GET  /api/v1/app/account/client-ip          → { ipAddress }   any signed-in user
POST /api/v1/app/clinic-branches            { …, allowedIpRanges? }
PUT  /api/v1/app/clinic-branches/{id}       { …, allowedIpRanges? }   null = keep, "" = clear
GET  /api/v1/app/clinic-branches[/{id}]     → { …, allowedIpRanges: "a\nb" | null }
POST/PUT /api/v1/app/staff[/{id}]           { …, allowLoginOutsideOffice }
POST /api/account/login (ABP)               403 { error: { code: "BlueDental:Auth:LoginIpNotAllowed" } }
any authenticated request                   401 { error: { code: "BlueDental:Auth:LoginIpNotAllowed" } } + sign-out
```

## Implementation

- `IpAddressRange` (value object) and `ClinicBranch.AllowedIpRanges` /
  `SetAllowedIpRanges` / `AllowsLoginFrom`; the rule itself is
  `LoginIpPolicy.IsAllowed` (pure, Domain).
- `SignInRestrictionGuard` (Application) loads the account's flags, roles and
  branches (shared with item 13, `usage-hours.md`).
- `BlueDentalSignInManager.SignInOrTwoFactorAsync` (host) refuses sign-in;
  `SignInRestrictionMiddleware` (after `UseDynamicClaims`) ends sessions.
- Client address behind the proxies: production enables
  `ASPNETCORE_FORWARDEDHEADERS_ENABLED`; `ConfigureForwardedHeaders` trusts only
  loopback and private networks with no hop limit, so the address is the first
  non-proxy one in `X-Forwarded-For` (Caddy → nginx → API). The old default
  (trust all, one hop) would have reported the proxy's address for everyone.

## Open (UNKNOWN_REFERENCE_BEHAVIOR does not apply — owner decisions)

- Whether clinic-wide non-admin accounts should be held to the union of all
  lists (current) or never restricted.
- Whether "Cho phép đăng nhập ngoài công ty" should default to on for existing
  staff (current: off for everyone).
- Not checked yet on production: the address the API sees through Caddy → nginx
  (`GET /api/v1/app/account/client-ip` from a clinic network should return the
  clinic's public IP). Test before typing a list on production.
