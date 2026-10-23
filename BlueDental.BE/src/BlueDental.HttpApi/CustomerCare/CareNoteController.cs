using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using BlueDental.Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Volo.Abp;

namespace BlueDental.CustomerCare;

/// <summary>
/// Care notes (BA P2210): the Hộp thư Zalo chat's "Ghi chú nội bộ" and the
/// record's "Ghi nhận chăm sóc" — one set of notes, reached from either side.
/// </summary>
[RemoteService]
[Authorize]
public sealed class CareNoteController(ICareNoteAppService notes) : BlueDentalController
{
    [HttpGet("api/v1/app/zalo-inbox/conversations/{conversationId:guid}/notes")]
    public Task<List<CareNoteDto>> GetForConversationAsync(Guid conversationId) =>
        notes.GetForConversationAsync(conversationId);

    [HttpPost("api/v1/app/zalo-inbox/conversations/{conversationId:guid}/notes")]
    public Task<CareNoteDto> CreateForConversationAsync(Guid conversationId, [FromBody] SaveCareNoteInput input) =>
        notes.CreateForConversationAsync(conversationId, input);

    [HttpGet("api/v1/app/patients/{patientId:guid}/care-notes")]
    public Task<List<CareNoteDto>> GetForPatientAsync(Guid patientId) => notes.GetForPatientAsync(patientId);

    [HttpPost("api/v1/app/patients/{patientId:guid}/care-notes")]
    public Task<CareNoteDto> CreateForPatientAsync(Guid patientId, [FromBody] SaveCareNoteInput input) =>
        notes.CreateForPatientAsync(patientId, input);

    [HttpPut("api/v1/app/care-notes/{id:guid}")]
    public Task<CareNoteDto> UpdateAsync(Guid id, [FromBody] SaveCareNoteInput input) => notes.UpdateAsync(id, input);

    [HttpDelete("api/v1/app/care-notes/{id:guid}")]
    public Task<CareNoteDto> DeleteAsync(Guid id) => notes.DeleteAsync(id);
}

/// <summary>"Lịch sử chăm sóc khách hàng" of the record's Chăm sóc KH tab (BA P2210).</summary>
[RemoteService]
[Authorize]
[Route("api/v1/app/patients/{patientId:guid}/care-history")]
public sealed class PatientCareHistoryController(IPatientCareHistoryAppService history) : BlueDentalController
{
    [HttpGet]
    public Task<List<CareHistoryEntryDto>> GetListAsync(Guid patientId, [FromQuery] GetPatientCareHistoryInput input) =>
        history.GetListAsync(patientId, input);

    [HttpGet("overview")]
    public Task<PatientCareOverviewDto> GetOverviewAsync(Guid patientId) => history.GetOverviewAsync(patientId);
}
