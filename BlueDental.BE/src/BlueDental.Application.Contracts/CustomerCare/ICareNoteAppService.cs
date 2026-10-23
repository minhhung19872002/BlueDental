using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Volo.Abp.Application.Services;

namespace BlueDental.CustomerCare;

/// <summary>
/// Care notes (BA P2210): written from the Hộp thư Zalo chat or from the
/// record's Lịch sử chăm sóc, and shown in both — write, change, strike
/// through, each step logged.
/// </summary>
public interface ICareNoteAppService : IApplicationService
{
    /// <summary>The conversation's notes and its linked record's, newest first, struck ones included.</summary>
    Task<List<CareNoteDto>> GetForConversationAsync(Guid conversationId);

    Task<CareNoteDto> CreateForConversationAsync(Guid conversationId, SaveCareNoteInput input);

    /// <summary>The record's notes and those of the conversations linked to it.</summary>
    Task<List<CareNoteDto>> GetForPatientAsync(Guid patientId);

    Task<CareNoteDto> CreateForPatientAsync(Guid patientId, SaveCareNoteInput input);

    Task<CareNoteDto> UpdateAsync(Guid id, SaveCareNoteInput input);

    /// <summary>Strikes the note through; it stays listed, with who deleted it.</summary>
    Task<CareNoteDto> DeleteAsync(Guid id);
}

/// <summary>"Lịch sử chăm sóc khách hàng" on the record's Chăm sóc KH tab (BA P2210).</summary>
public interface IPatientCareHistoryAppService : IApplicationService
{
    Task<List<CareHistoryEntryDto>> GetListAsync(Guid patientId, GetPatientCareHistoryInput input);

    Task<PatientCareOverviewDto> GetOverviewAsync(Guid patientId);
}
