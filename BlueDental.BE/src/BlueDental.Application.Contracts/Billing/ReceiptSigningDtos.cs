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
    Issued = 5
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

/// <summary>Tells the iPad and the cashier's screen that a session moved; ids only.</summary>
public interface IReceiptSigningNotifier
{
    Task NotifyChangedAsync(Guid clinicBranchId, Guid patientPaymentId);
}
