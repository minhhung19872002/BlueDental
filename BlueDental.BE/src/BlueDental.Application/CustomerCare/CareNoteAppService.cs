using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Organizations;
using BlueDental.PatientManagement;
using BlueDental.Permissions;
using BlueDental.ZaloInbox;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp.Authorization;
using Volo.Abp.Domain.Entities;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Users;

namespace BlueDental.CustomerCare;

/// <summary>
/// Care notes (BA P2210): Tạo records who and when, Sửa logs who and when with
/// the text before, Xoá strikes the note through and logs who. The chat's
/// "Ghi chú nội bộ" (cskhInbox) and the record's "Ghi nhận chăm sóc"
/// (treatmentCskh) are the same notes; changing or striking one takes the
/// handling leaf of either screen. Everything stays inside the current branch.
/// </summary>
[Authorize]
public class CareNoteAppService(
    IRepository<CareNote, Guid> notes,
    IRepository<ZaloConversation, Guid> conversations,
    IRepository<Patient, Guid> patients,
    CareNoteReader reader,
    BranchAccessChecker branchAccess,
    ICurrentClinicBranchResolver branchResolver) : BlueDentalAppService, ICareNoteAppService
{
    [Authorize(BlueDentalAbilityPermissions.CskhInbox.Read)]
    public async Task<List<CareNoteDto>> GetForConversationAsync(Guid conversationId)
    {
        var conversation = await GetConversationAsync(conversationId);
        var patientId = conversation.PatientId;
        return await reader.ListAsync(conversation.ClinicBranchId, n =>
            n.ConversationId == conversation.Id || (patientId != null && n.PatientId == patientId));
    }

    /// <summary>A chat note of a linked conversation names the record too, so the record's history shows it.</summary>
    [Authorize(BlueDentalAbilityPermissions.CskhInbox.Update)]
    public async Task<CareNoteDto> CreateForConversationAsync(Guid conversationId, SaveCareNoteInput input)
    {
        var conversation = await GetConversationAsync(conversationId);
        return await InsertAsync(CareNote.Write(
            GuidGenerator.Create(), conversation.ClinicBranchId, conversation.Id, conversation.PatientId,
            input.Content, input.Outcome, CurrentUser.GetId(), Clock.Now));
    }

    [Authorize(BlueDentalAbilityPermissions.TreatmentCskh.Read)]
    public async Task<List<CareNoteDto>> GetForPatientAsync(Guid patientId)
    {
        var branchId = await GetPatientBranchAsync(patientId);
        var chats = await AsyncExecuter.ToListAsync((await conversations.GetQueryableAsync())
            .Where(c => c.ClinicBranchId == branchId && c.PatientId == patientId)
            .Select(c => c.Id));
        return await reader.ListAsync(branchId, CareNoteReader.OfPatient(patientId, chats));
    }

    /// <summary>Written on the record, the note joins its latest Zalo conversation too, when there is one.</summary>
    [Authorize(BlueDentalAbilityPermissions.TreatmentCskh.Create)]
    public async Task<CareNoteDto> CreateForPatientAsync(Guid patientId, SaveCareNoteInput input)
    {
        var branchId = await GetPatientBranchAsync(patientId);
        var conversation = await AsyncExecuter.FirstOrDefaultAsync((await conversations.GetQueryableAsync())
            .Where(c => c.ClinicBranchId == branchId && c.PatientId == patientId)
            .OrderByDescending(c => c.LastMessageAt));
        return await InsertAsync(CareNote.Write(
            GuidGenerator.Create(), branchId, conversation?.Id, patientId,
            input.Content, input.Outcome, CurrentUser.GetId(), Clock.Now));
    }

    public async Task<CareNoteDto> UpdateAsync(Guid id, SaveCareNoteInput input)
    {
        await CheckCanChangeAsync();
        var note = await GetNoteAsync(id);
        note.Edit(input.Content, CurrentUser.GetId(), Clock.Now);
        await notes.UpdateAsync(note, autoSave: true);
        return (await reader.ToDtosAsync([note]))[0];
    }

    public async Task<CareNoteDto> DeleteAsync(Guid id)
    {
        await CheckCanChangeAsync();
        var note = await GetNoteAsync(id);
        note.Remove(CurrentUser.GetId(), Clock.Now);
        await notes.UpdateAsync(note, autoSave: true);
        return (await reader.ToDtosAsync([note]))[0];
    }

    private async Task<CareNoteDto> InsertAsync(CareNote note)
    {
        await notes.InsertAsync(note, autoSave: true);
        return (await reader.ToDtosAsync([note]))[0];
    }

    /// <summary>Hộp thư Zalo › Xử lý or Chăm sóc KH › Sửa: either screen may change the notes they share.</summary>
    private async Task CheckCanChangeAsync()
    {
        if (!await AuthorizationService.IsGrantedAsync(BlueDentalAbilityPermissions.CskhInbox.Update)
            && !await AuthorizationService.IsGrantedAsync(BlueDentalAbilityPermissions.TreatmentCskh.Update))
        {
            throw new AbpAuthorizationException(code: AbpAuthorizationErrorCodes.GivenPolicyHasNotGranted);
        }
    }

    private async Task<Guid> GetBranchIdAsync()
    {
        var branchId = branchResolver.GetRequiredClinicBranchId();
        await branchAccess.CheckAsync(branchId);
        return branchId;
    }

    private async Task<Guid> GetPatientBranchAsync(Guid patientId)
    {
        var branchId = await GetBranchIdAsync();
        return await patients.AnyAsync(p => p.Id == patientId && p.BranchId == branchId)
            ? branchId
            : throw new EntityNotFoundException(typeof(Patient), patientId);
    }

    private async Task<ZaloConversation> GetConversationAsync(Guid id)
    {
        var branchId = await GetBranchIdAsync();
        return await conversations.FirstOrDefaultAsync(c => c.Id == id && c.ClinicBranchId == branchId)
            ?? throw new EntityNotFoundException(typeof(ZaloConversation), id);
    }

    private async Task<CareNote> GetNoteAsync(Guid id)
    {
        var branchId = await GetBranchIdAsync();
        return await AsyncExecuter.FirstOrDefaultAsync((await notes.WithDetailsAsync(n => n.Revisions))
                .Where(n => n.Id == id && n.ClinicBranchId == branchId))
            ?? throw new EntityNotFoundException(typeof(CareNote), id);
    }
}
