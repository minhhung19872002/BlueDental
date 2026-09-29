<#
.SYNOPSIS
  Gọi thử API EasyInvoice (SoftDreams) trên sandbox với header xác thực 5 phần.
  Mật khẩu KHÔNG truyền qua tham số dòng lệnh; đọc từ biến môi trường EASYINVOICE_PASSWORD.

.EXAMPLE
  $env:EASYINVOICE_PASSWORD = '<mật khẩu>'
  .\easyinvoice-probe.ps1                                  # importInvoice với body rỗng -> xem lỗi đổi thế nào
  .\easyinvoice-probe.ps1 -Action api/publish/importInvoice -BodyFile .\sample-body.json
#>
param(
  [string]$BaseUrl = 'http://api.softdreams.vn',
  [string]$Action = 'api/publish/importInvoice',
  [string]$Username = 'API',
  [string]$TaxCode = '0318531468',   # MST của tenant EasyInvoice — BẮT BUỘC, phần thứ 6 của header
  [string]$BodyFile = ''
)

$password = $env:EASYINVOICE_PASSWORD
if ([string]::IsNullOrWhiteSpace($password)) { Write-Error 'Thiếu $env:EASYINVOICE_PASSWORD'; exit 1 }

# Thuật toán lấy từ thư viện chính thức EInvoice.IntegratedLib (SoftDreams, 2018), xác nhận sandbox nhận 2026-09-28:
#   Authentication = base64(MD5("POST" + unixSeconds + nonce)) : nonce : unixSeconds : username : password : taxCode
# (thư viện 2018 chỉ có 5 phần; sandbox đa tenant 2026 cần thêm MST, thiếu MST -> lỗi 176)
$ts    = [string][UInt64]([DateTime]::UtcNow - [DateTime]::new(1970,1,1,0,0,0,[DateTimeKind]::Utc)).TotalSeconds
$nonce = [Guid]::NewGuid().ToString('N').ToLower()
$md5   = [System.Security.Cryptography.MD5]::Create()
$sig   = [Convert]::ToBase64String($md5.ComputeHash([Text.Encoding]::UTF8.GetBytes("POST$ts$nonce")))
$auth  = "$sig`:$nonce`:$ts`:$Username`:$password`:$TaxCode"

$body = '{}'
if ($BodyFile) { $body = Get-Content -Raw -Encoding UTF8 $BodyFile }

$headers = @{ 'Authentication' = $auth; 'Admin-Agent' = 'easyinvoice.vn' }
try {
  $resp = Invoke-WebRequest -Uri "$BaseUrl/$Action" -Method Post -Headers $headers -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($body)) -UseBasicParsing
  "HTTP $($resp.StatusCode)"; $resp.Content
} catch {
  $r = $_.Exception.Response
  if ($r) {
    "HTTP $([int]$r.StatusCode)"
    $sr = New-Object IO.StreamReader($r.GetResponseStream(), [Text.Encoding]::UTF8); $sr.ReadToEnd()
  } else { $_ }
}
