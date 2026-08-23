using System;
using System.Threading.Tasks;
using BlueDental.Controllers;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Volo.Abp;
using Volo.Abp.Application.Dtos;

namespace BlueDental.TreatmentManagement;

[RemoteService]
[Authorize(BlueDentalPermissions.TreatmentManagement.Default)]
[Route("api/v1/app/prescriptions")]
public sealed class PrescriptionController(IPrescriptionAppService service) : BlueDentalController
{
    [HttpGet]
    public Task<PagedResultDto<PrescriptionDto>> GetListAsync([FromQuery] GetPrescriptionListInput input) =>
        service.GetListAsync(input);

    [HttpGet("{id:guid}")]
    public Task<PrescriptionDto> GetAsync(Guid id) => service.GetAsync(id);
}
