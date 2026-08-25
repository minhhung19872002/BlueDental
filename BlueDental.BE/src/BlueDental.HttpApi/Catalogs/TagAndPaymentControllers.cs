using System;
using System.Threading.Tasks;
using BlueDental.Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Volo.Abp;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Content;

namespace BlueDental.Catalogs;

/// <summary>Thẻ hồ sơ — Danh mục / Thẻ hồ sơ.</summary>
[RemoteService]
[Authorize]
[Route("api/v1/app/patient-tags")]
public sealed class PatientTagController(IPatientTagAppService service) : BlueDentalController
{
    [HttpGet]
    public Task<PagedResultDto<PatientTagDto>> GetListAsync([FromQuery] GetPatientTagListInput input) =>
        service.GetListAsync(input);

    [HttpGet("{id:guid}")]
    public Task<PatientTagDto> GetAsync(Guid id) => service.GetAsync(id);

    [HttpPost]
    public Task<PatientTagDto> CreateAsync([FromBody] CreatePatientTagDto input) =>
        service.CreateAsync(input);

    [HttpPut("{id:guid}")]
    public Task<PatientTagDto> UpdateAsync(Guid id, [FromBody] UpdatePatientTagDto input) =>
        service.UpdateAsync(id, input);

    [HttpDelete("{id:guid}")]
    public Task DeleteAsync(Guid id) => service.DeleteAsync(id);
}

/// <summary>Phương thức thanh toán — Danh mục / Phương thức thanh toán.</summary>
[RemoteService]
[Authorize]
[Route("api/v1/app/payment-accounts")]
public sealed class PaymentAccountController(IPaymentAccountAppService service) : BlueDentalController
{
    [HttpGet]
    public Task<PagedResultDto<PaymentAccountDto>> GetListAsync(
        [FromQuery] GetPaymentAccountListInput input) => service.GetListAsync(input);

    [HttpGet("{id:guid}")]
    public Task<PaymentAccountDto> GetAsync(Guid id) => service.GetAsync(id);

    [HttpPost]
    public Task<PaymentAccountDto> CreateAsync([FromBody] CreatePaymentAccountDto input) =>
        service.CreateAsync(input);

    [HttpPut("{id:guid}")]
    public Task<PaymentAccountDto> UpdateAsync(Guid id, [FromBody] UpdatePaymentAccountDto input) =>
        service.UpdateAsync(id, input);

    [HttpDelete("{id:guid}")]
    public Task DeleteAsync(Guid id) => service.DeleteAsync(id);

    /// <summary>
    /// "Tải ảnh QR" — multipart upload against an account that already exists.
    /// The file arrives as a form field, so the DTO is bound by hand rather than
    /// from the JSON body.
    /// </summary>
    [HttpPost("{id:guid}/qr-image")]
    public Task<PaymentAccountDto> UploadQrImageAsync(Guid id, [FromForm] IFormFile file) =>
        service.UploadQrImageAsync(id, new UploadPaymentAccountQrImageDto
        {
            File = new RemoteStreamContent(
                file.OpenReadStream(),
                file.FileName,
                file.ContentType,
                file.Length)
        });

    [HttpGet("{id:guid}/qr-image")]
    public async Task<IActionResult> GetQrImageAsync(Guid id)
    {
        var content = await service.GetQrImageAsync(id);

        return File(content.GetStream(), content.ContentType ?? "application/octet-stream");
    }

    [HttpDelete("{id:guid}/qr-image")]
    public Task<PaymentAccountDto> DeleteQrImageAsync(Guid id) => service.DeleteQrImageAsync(id);
}
