using System;
using System.Threading.Tasks;
using BlueDental.Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Volo.Abp;
using Volo.Abp.Application.Dtos;

namespace BlueDental.TreatmentManagement;

/// <summary>
/// Tái khám — the follow-up raised from a finished công đoạn.
///
/// Its own resource, not a verb on a công đoạn: the reference's timeline returns
/// a re-examination as a row of its own (`type: "re_examination"`, code REX001),
/// so BlueDental keeps it as its own aggregate rather than a flagged stage.
/// </summary>
[RemoteService]
[Authorize]
[Route("api/v1/app/patient-re-examinations")]
public sealed class PatientReExaminationController(IPatientReExaminationAppService service)
    : BlueDentalController
{
    [HttpGet]
    public Task<PagedResultDto<PatientReExaminationDto>> GetListAsync(
        [FromQuery] GetPatientReExaminationListInput input) => service.GetListAsync(input);

    [HttpPost]
    public Task<PatientReExaminationDto> CreateAsync(
        [FromBody] CreatePatientReExaminationDto input) => service.CreateAsync(input);

    [HttpPost("{id:guid}/images")]
    public Task<PatientReExaminationDto> AttachImageAsync(
        Guid id, [FromBody] AttachStageImageDto input) => service.AttachImageAsync(id, input);
}
