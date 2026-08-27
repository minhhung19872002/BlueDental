using System;
using System.Threading.Tasks;
using BlueDental.Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Volo.Abp;
using Volo.Abp.Application.Dtos;

namespace BlueDental.PatientManagement;

[RemoteService]
[Authorize]
[Route("api/v1/app/patients")]
public sealed class PatientController(IPatientAppService service) : BlueDentalController
{
    [HttpGet]
    public Task<PagedResultDto<PatientListItemDto>> GetListAsync([FromQuery] GetPatientListInput input) =>
        service.GetListAsync(input);

    [HttpGet("{id:guid}")]
    public Task<PatientDto> GetAsync(Guid id) => service.GetAsync(id);

    /// <summary>The code the "Tạo hồ sơ" dialog opens with.</summary>
    [HttpGet("code-estimate")]
    public Task<PatientCodeEstimateDto> GetCodeEstimateAsync() => service.GetCodeEstimateAsync();

    /// <summary>Duplicate-phone check behind the dialog's Điện thoại field.</summary>
    [HttpGet("check-phone")]
    public Task<PhoneAvailabilityDto> CheckPhoneAsync(
        [FromQuery] string phone,
        [FromQuery] Guid? excludeId = null) =>
        service.CheckPhoneAsync(phone, excludeId);

    [HttpPost]
    public Task<PatientDto> RegisterAsync([FromBody] RegisterPatientDto input) =>
        service.RegisterAsync(input);

    [HttpPut("{id:guid}")]
    public Task<PatientDto> UpdateAsync(Guid id, [FromBody] UpdatePatientDto input) =>
        service.UpdateAsync(id, input);

    [HttpGet("excel")]
    public async Task<IActionResult> ExportAsync([FromQuery] GetPatientListInput input) =>
        Excel(await service.ExportAsync(input), "danh-sach-benh-nhan");

    [HttpPost("{id:guid}/deactivate")]
    public Task DeactivateAsync(Guid id) => service.DeactivateAsync(id);
}
