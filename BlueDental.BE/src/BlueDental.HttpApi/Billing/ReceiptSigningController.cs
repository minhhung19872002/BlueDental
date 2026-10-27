using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using BlueDental.Controllers;
using BlueDental.EInvoicing;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Volo.Abp;
using Volo.Abp.Auditing;

namespace BlueDental.Billing;

/// <summary>The receipt page's iPad buttons (P2610).</summary>
[RemoteService]
[Authorize]
[Route("api/v1/app/receipt-signing")]
public sealed class ReceiptSigningController(IReceiptSigningAppService service) : BlueDentalController
{
    [HttpGet("{patientPaymentId:guid}")]
    public Task<ReceiptSigningStateDto> GetAsync(Guid patientPaymentId) => service.GetAsync(patientPaymentId);

    [HttpPost("{patientPaymentId:guid}/send")]
    public Task<ReceiptSigningStateDto> SendAsync(Guid patientPaymentId, [FromBody] SendReceiptToDeviceDto input) =>
        service.SendAsync(patientPaymentId, input);

    [HttpPost("{patientPaymentId:guid}/cancel")]
    public Task<ReceiptSigningStateDto> CancelAsync(Guid patientPaymentId) => service.CancelAsync(patientPaymentId);

    [HttpPost("{patientPaymentId:guid}/resign")]
    public Task<ReceiptSigningStateDto> RequestResignAsync(Guid patientPaymentId) =>
        service.RequestResignAsync(patientPaymentId);
}

/// <summary>Cài đặt → Kết nối iPad.</summary>
[RemoteService]
[Authorize]
[Route("api/v1/app/signing-devices")]
public sealed class SigningDeviceController(ISigningDeviceAppService service) : BlueDentalController
{
    [HttpGet]
    public Task<List<SigningDeviceDto>> GetListAsync([FromQuery] Guid clinicBranchId) =>
        service.GetListAsync(clinicBranchId);

    [HttpPost]
    public Task<PairedSigningDeviceDto> CreateAsync([FromBody] CreateSigningDeviceDto input) =>
        service.CreateAsync(input);

    [HttpPost("{id:guid}/revoke")]
    public Task RevokeAsync(Guid id) => service.RevokeAsync(id);
}

/// <summary>The branch's iPad page; no sign-in, the device token (in a header) is the key.</summary>
// Not audited: the call carries the device token and the drawing, which
// the audit log would keep in clear.
[RemoteService]
[AllowAnonymous]
[DisableAuditing]
[Route("api/v1/public/signing-station")]
public sealed class SigningStationController(ISigningStationAppService service) : BlueDentalController
{
    [HttpGet]
    public Task<SigningStationDto> GetCurrentAsync(
        [FromHeader(Name = SigningDeviceConsts.TokenHeader)] string? token) =>
        service.GetCurrentAsync(token ?? string.Empty);

    [HttpPost("sessions/{sessionId:guid}/check")]
    public Task<SigningStationDto> CheckAsync(
        [FromHeader(Name = SigningDeviceConsts.TokenHeader)] string? token, Guid sessionId) =>
        service.CheckAsync(token ?? string.Empty, sessionId);

    [HttpPost("sessions/{sessionId:guid}/sign")]
    public Task<SigningStationDto> SignAsync(
        [FromHeader(Name = SigningDeviceConsts.TokenHeader)] string? token, Guid sessionId,
        [FromBody] SignReceiptDto input) =>
        service.SignAsync(token ?? string.Empty, sessionId, input);

    [HttpPost("sessions/{sessionId:guid}/invoice-request")]
    public Task<SigningStationDto> RequestInvoiceAsync(
        [FromHeader(Name = SigningDeviceConsts.TokenHeader)] string? token, Guid sessionId,
        [FromBody] SubmitPublicInvoiceRequestDto input) =>
        service.RequestInvoiceAsync(token ?? string.Empty, sessionId, input);
}
