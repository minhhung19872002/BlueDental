using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Threading.Tasks;
using BlueDental.EInvoicing;
using BlueDental.TreatmentManagement;
using Volo.Abp.Application.Services;

namespace BlueDental.Billing;

// ── The cashier's PC: the receipt page (P2610) ──────────────────────────────

/// <summary>Where a receipt stands with the branch's iPad.</summary>
public class ReceiptSigningStateDto
{
    /// <summary>The branch has at least one paired iPad ("Kết nối iPad").</summary>
    public bool HasDevice { get; set; }

    /// <summary>
    /// THANHTOAN-… of another receipt the iPad is showing now: "iPad đang chờ
    /// khách ký phiếu …". Null when the iPad is free or shows this receipt.
    /// </summary>
    public string? BusyWithCode { get; set; }

    /// <summary>This receipt's latest session — the open one when there is one.</summary>
    public ReceiptSigningSessionDto? Session { get; set; }
}

public class ReceiptSigningSessionDto
{
    public Guid Id { get; set; }
    public bool IsOpen { get; set; }

    /// <summary>Gửi tới iPad.</summary>
    public DateTimeOffset SentAt { get; set; }

    /// <summary>Khách kiểm tra.</summary>
    public DateTimeOffset? CheckedAt { get; set; }

    /// <summary>Khách đồng ý &amp; ký.</summary>
    public DateTimeOffset? SignedAt { get; set; }

    public DateTimeOffset? ClosedAt { get; set; }
    public SigningCloseReason? CloseReason { get; set; }

    /// <summary>The drawing as <c>data:image/png;base64,…</c>, decrypted for the screen only.</summary>
    public string? SignatureDataUrl { get; set; }
}

/// <summary>
/// One line of a receipt's log (P2910_02): what happened, who did it and
/// when; an export also says how it was signed and by whom.
/// </summary>
public class PaymentReceiptLogDto
{
    public ReceiptLogAction Action { get; set; }
    public DateTimeOffset At { get; set; }
    public string? UserName { get; set; }
    public ReceiptSignMode? SignMode { get; set; }
    public string? AccountantSignerName { get; set; }
    public DateTimeOffset? AccountantSignatureSavedAt { get; set; }
    public DateTimeOffset? CustomerSignedAt { get; set; }
    public bool? CustomerSignedOnPaper { get; set; }
    public string? FileSha256 { get; set; }
    public PaymentCancelReason? CancelReasonCode { get; set; }
}

/// <summary>Gửi tới iPad / Gửi lại.</summary>
public class SendReceiptToDeviceDto
{
    /// <summary>The iPad shows another receipt: end that session and show this one.</summary>
    public bool Replace { get; set; }
}

public interface IReceiptSigningAppService : IApplicationService
{
    Task<ReceiptSigningStateDto> GetAsync(Guid patientPaymentId);

    Task<ReceiptSigningStateDto> SendAsync(Guid patientPaymentId, SendReceiptToDeviceDto input);

    /// <summary>Hủy phiên &amp; sửa phiếu.</summary>
    Task<ReceiptSigningStateDto> CancelAsync(Guid patientPaymentId);

    /// <summary>Yêu cầu khách ký lại.</summary>
    Task<ReceiptSigningStateDto> RequestResignAsync(Guid patientPaymentId);

    /// <summary>
    /// "In phiếu thu" → Xác nhận in (P2910_02): the customer signs the printed
    /// draft at the counter; an open iPad session ends as Printed.
    /// </summary>
    Task<ReceiptSigningStateDto> PrintForPaperAsync(Guid patientPaymentId);

    /// <summary>The receipt's log, oldest first — a cancelled receipt's too.</summary>
    Task<List<PaymentReceiptLogDto>> GetLogAsync(Guid patientPaymentId);
}

// ── Clinic settings: Kết nối iPad ──────────────────────────────────────────

public class SigningDeviceDto
{
    public Guid Id { get; set; }
    public Guid ClinicBranchId { get; set; }
    public string Name { get; set; } = string.Empty;
    public DateTimeOffset CreationTime { get; set; }
    public DateTimeOffset? LastSeenAt { get; set; }
    public DateTimeOffset? RevokedAt { get; set; }
    public bool IsActive { get; set; }
}

/// <summary>A device just paired: the token comes back this once, to build its link.</summary>
public class PairedSigningDeviceDto : SigningDeviceDto
{
    public string Token { get; set; } = string.Empty;
}

public class CreateSigningDeviceDto
{
    public Guid ClinicBranchId { get; set; }

    [Required]
    [StringLength(SigningDeviceConsts.MaxNameLength)]
    public string Name { get; set; } = string.Empty;
}

public static class SigningDeviceConsts
{
    public const int MaxNameLength = 100;

    /// <summary>The header the iPad sends its token in — never the URL, which logs keep.</summary>
    public const string TokenHeader = "X-Signing-Device-Token";
}

public interface ISigningDeviceAppService : IApplicationService
{
    Task<List<SigningDeviceDto>> GetListAsync(Guid clinicBranchId);

    Task<PairedSigningDeviceDto> CreateAsync(CreateSigningDeviceDto input);

    Task RevokeAsync(Guid id);
}

// ── The iPad page ───────────────────────────────────────────────────────────

/// <summary>Which screen the iPad shows.</summary>
public enum SigningStationStage
{
    /// <summary>Xin chào quý khách.</summary>
    Idle = 1,

    /// <summary>The PHIẾU THU with the two boxes (steps 1–2).</summary>
    Review = 2,

    /// <summary>Ký tên.</summary>
    Signing = 3,

    /// <summary>Cảm ơn quý khách đã ký — waiting for the accountant.</summary>
    Signed = 4,

    /// <summary>Phiếu thu đã được xuất.</summary>
    Issued = 5,

    /// <summary>Phiếu thu đã được in — the customer signs on paper at the counter (P2910_02).</summary>
    Printed = 6
}

public class SigningStationDto
{
    /// <summary>The header: the branch name.</summary>
    public string ClinicName { get; set; } = string.Empty;

    public string DeviceName { get; set; } = string.Empty;
    public SigningStationStage Stage { get; set; }
    public Guid? SessionId { get; set; }
    public string? PaymentCode { get; set; }
    public PaymentReceiptContentDto? Receipt { get; set; }

    /// <summary>The customer's own drawing, on the thank-you screen.</summary>
    public string? SignatureDataUrl { get; set; }

    /// <summary>A "Yêu cầu xuất hóa đơn" is already live for this receipt.</summary>
    public bool InvoiceRequested { get; set; }

    /// <summary>Thời điểm on "Phiếu thu đã được xuất".</summary>
    public DateTimeOffset? IssuedAt { get; set; }

    /// <summary>When "In phiếu thu" was confirmed, on "Phiếu thu đã được in".</summary>
    public DateTimeOffset? PaperSignedAt { get; set; }
}

public class SignReceiptDto
{
    /// <summary><c>data:image/png;base64,…</c> of the drawing.</summary>
    [Required]
    [StringLength(SignatureImageConsts.MaxDataUrlLength)]
    public string SignatureDataUrl { get; set; } = string.Empty;
}

public static class SignatureImageConsts
{
    /// <summary>~700 KB of base64; a finger signature on an iPad canvas is far below.</summary>
    public const int MaxDataUrlLength = 1_000_000;
}

/// <summary>
/// The iPad page. Anonymous at the HTTP level; every call names the device by
/// its token, and only the branch's open session is reachable.
/// </summary>
public interface ISigningStationAppService : IApplicationService
{
    Task<SigningStationDto> GetCurrentAsync(string deviceToken);

    /// <summary>Both boxes ticked and "Xác nhận thông tin" pressed.</summary>
    Task<SigningStationDto> CheckAsync(string deviceToken, Guid sessionId);

    /// <summary>"Hoàn tất ký".</summary>
    Task<SigningStationDto> SignAsync(string deviceToken, Guid sessionId, SignReceiptDto input);

    /// <summary>"Yêu cầu xuất hóa đơn" on the review screen.</summary>
    Task<SigningStationDto> RequestInvoiceAsync(string deviceToken, Guid sessionId, SubmitPublicInvoiceRequestDto input);
}

// ── The accountant's Ký điện tử signature (P2910_02) ───────────────────────

/// <summary>The signed-in user's saved signature, decrypted for their own screen.</summary>
public class AccountantSignatureDto
{
    /// <summary><c>data:image/png;base64,…</c>.</summary>
    public string SignatureDataUrl { get; set; } = string.Empty;

    public AccountantSignatureSource Source { get; set; }

    /// <summary>"lưu dd/MM/yyyy" — also what an export keeps as the signer's timestamp.</summary>
    public DateTimeOffset SavedAt { get; set; }

    /// <summary>"Chữ ký của …".</summary>
    public string UserName { get; set; } = string.Empty;
}

/// <summary>Lưu chữ ký (drawn) or Dùng chữ ký này (uploaded).</summary>
public class SaveAccountantSignatureDto
{
    /// <summary>A PNG the browser has already shrunk to at most 600×200.</summary>
    [Required]
    [StringLength(AccountantSignatureConsts.MaxDataUrlLength)]
    public string SignatureDataUrl { get; set; } = string.Empty;

    [EnumDataType(typeof(AccountantSignatureSource))]
    public AccountantSignatureSource Source { get; set; }
}

public static class AccountantSignatureConsts
{
    /// <summary>Raw PNG bytes the server keeps; the browser shrinks a ≤2 MB upload below this.</summary>
    public const int MaxBytes = 200 * 1024;

    /// <summary>
    /// As loose as the iPad's, so an image just over <see cref="MaxBytes"/>
    /// gets the "quá lớn" message rather than a bare validation error.
    /// </summary>
    public const int MaxDataUrlLength = SignatureImageConsts.MaxDataUrlLength;
}

public interface IAccountantSignatureAppService : IApplicationService
{
    /// <summary>Null when the user has none yet: the pad opens straight away.</summary>
    Task<AccountantSignatureDto?> GetMineAsync();

    Task<AccountantSignatureDto> SaveMineAsync(SaveAccountantSignatureDto input);
}

/// <summary>Tells the iPad and the cashier's screen that a session moved; ids only.</summary>
public interface IReceiptSigningNotifier
{
    Task NotifyChangedAsync(Guid clinicBranchId, Guid patientPaymentId);
}
