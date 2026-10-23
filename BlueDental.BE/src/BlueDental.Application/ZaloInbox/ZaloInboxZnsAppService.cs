using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.CustomerCare.Messaging;
using BlueDental.Organizations;
using BlueDental.PatientManagement;
using BlueDental.Permissions;
using BlueDental.Tools;
using BlueDental.Zalo;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp;
using Volo.Abp.Domain.Entities;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Uow;
using Volo.Abp.Users;

namespace BlueDental.ZaloInbox;

/// <summary>
/// The ZNS row over the Hộp thư Zalo composer (BA P2210): the newest three
/// templates as chips, "Xem thêm" for all. Picking one fills it with the
/// customer of the chat for checking; sending puts it on the linked record's
/// phone. A ZNS has no free text — Zalo fills its approved layout from the
/// parameters — so what is checked is each parameter's value, and a second
/// pick replaces the first instead of being typed into the reply.
/// </summary>
[Authorize(BlueDentalAbilityPermissions.CskhInbox.Read)]
public class ZaloInboxZnsAppService(
    IRepository<MessageTemplate, Guid> templates,
    IRepository<ZaloConversation, Guid> conversations,
    IRepository<Patient, Guid> patients,
    IRepository<MessageLog, Guid> messageLogs,
    MessageVariableResolver variables,
    MessageValueMasker masker,
    ZaloInboxReader reader,
    ZaloOaGateway zalo,
    IZaloApiClient zaloApi,
    BranchAccessChecker branchAccess,
    ICurrentClinicBranchResolver branchResolver) : BlueDentalAppService, IZaloInboxZnsAppService
{
    public async Task<List<ZaloInboxTemplateDto>> GetTemplatesAsync()
    {
        var branchId = await GetBranchIdAsync();
        var list = await templates.GetListAsync(t =>
            t.ClinicBranchId == branchId && t.Channel == MessageChannelType.Zalo && t.IsActive);
        return [.. list.Where(t => t.CanSend)
            .OrderByDescending(t => t.CreationTime)
            .Select(t => new ZaloInboxTemplateDto
            {
                Id = t.Id,
                Name = t.Name,
                Purpose = t.Purpose,
                ExternalTemplateId = t.ExternalTemplateId,
                CreationTime = t.CreationTime,
            })];
    }

    public async Task<ZaloZnsPreviewDto> PreviewAsync(Guid conversationId, ZaloZnsInput input)
    {
        var conversation = await GetConversationAsync(conversationId);
        var template = await GetTemplateAsync(conversation.ClinicBranchId, input.TemplateId);
        var preview = new ZaloZnsPreviewDto { TemplateId = template.Id, TemplateName = template.Name };

        var connection = await zalo.FindConnectionAsync(conversation.ClinicBranchId);
        var detail = connection == null
            ? null
            : await zalo.FetchTemplateDetailAsync(conversation.ClinicBranchId, connection, template.ExternalTemplateId!);
        preview.PreviewUrl = detail?.PreviewUrl;
        preview.Price = detail?.Price;

        var patient = await FindRecordAsync(conversation);
        if (patient == null)
        {
            preview.Params = [.. template.GetParamMap().Keys.Select(name => new ZaloZnsParamDto { Name = name })];
            preview.Block = ZaloZnsBlock.NoPatient;
            return preview;
        }

        var values = (await variables.ResolveAsync(conversation.ClinicBranchId, [patient]))[patient.Id];
        var check = MessageRecipientBuilder.Check(template, detail?.Params, values);
        var shown = MessageComposer.Compose(template, await masker.MaskAsync(values));
        preview.Params = [.. shown.Params.Select(p => new ZaloZnsParamDto { Name = p.Name, Value = p.Value })];
        preview.Missing = [.. check.Missing];
        preview.Phone = patient.Contact?.PhoneNumber;
        preview.Block = connection is not { CanSend: true } ? ZaloZnsBlock.NotConnected
            : MessageRecipientBuilder.NormalizePhone(patient.Contact?.PhoneNumber) == null ? ZaloZnsBlock.NoPhone
            : check.Missing.Count > 0 ? ZaloZnsBlock.MissingData
            : null;
        return preview;
    }

    /// <summary>
    /// Only the holder sends, as with a reply. The ZNS is logged like a CSKH
    /// send — Thống kê CSKH counts it — and a refusal is logged too before it
    /// is told, so the failed bubble stays in the chat.
    /// </summary>
    [Authorize(BlueDentalAbilityPermissions.CskhInbox.Update)]
    public async Task<ZaloChatEntryDto> SendAsync(Guid conversationId, ZaloZnsInput input)
    {
        var conversation = await GetConversationAsync(conversationId);
        var me = CurrentUser.GetId();
        conversation.EnsureHeldBy(me, Clock.Now);
        var branchId = conversation.ClinicBranchId;
        var template = await GetTemplateAsync(branchId, input.TemplateId);
        var connection = await zalo.GetConnectionAsync(branchId);
        connection.EnsureCanSend();

        var patient = await FindRecordAsync(conversation);
        var phone = MessageRecipientBuilder.NormalizePhone(patient?.Contact?.PhoneNumber);
        if (patient == null || phone == null)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.ZaloInbox.NoPatientPhone);
        }

        var detail = await zalo.FetchTemplateDetailAsync(branchId, connection, template.ExternalTemplateId!);
        var values = (await variables.ResolveAsync(branchId, [patient]))[patient.Id];
        var check = MessageRecipientBuilder.Check(template, detail.Params, values);
        if (check.Missing.Count > 0 || check.ZnsValues == null)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Tools.ZaloTemplateDataMissing)
                .WithData("params", string.Join(", ", check.Missing));
        }

        var log = new MessageLog(
                GuidGenerator.Create(), branchId, patient.Id, template.Id, patient.FullName, phone,
                check.Message.Text, MessageChannelType.Zalo, MessageSendStatus.Pending, null, null)
            .SetExternalTemplate(template.ExternalTemplateId, template.Name);
        var outcome = await zalo.CallWithTokenAsync(connection,
            token => zaloApi.SendTemplateMessageAsync(token, phone, detail.TemplateId, check.ZnsValues, log.Id.ToString("N")),
            o => o.Call);
        var now = Clock.Now;
        if (outcome.Call.Succeeded)
        {
            log.MarkSent(outcome.MessageId, now, detail.Price);
        }
        else
        {
            log.MarkFailed(outcome.Call.Error);
        }

        using (var uow = UnitOfWorkManager.Begin(requiresNew: true))
        {
            await messageLogs.InsertAsync(log);
            await zalo.LogAsync(branchId, "zns-inbox", outcome.Call, outcome.Call.Succeeded ? 1 : 0);
            await uow.CompleteAsync();
        }

        if (!outcome.Call.Succeeded)
        {
            throw ZaloOaGateway.Refused(outcome.Call);
        }

        conversation.RecordReply(me, now, "[ZNS] " + template.Name, now);
        await conversations.UpdateAsync(conversation, autoSave: true);
        return ZaloInboxReader.ToEntry(log, await reader.UserNamesAsync([me]));
    }

    private async Task<Patient?> FindRecordAsync(ZaloConversation conversation) =>
        conversation.PatientId is { } id
            ? await patients.FirstOrDefaultAsync(p => p.Id == id && p.BranchId == conversation.ClinicBranchId)
            : null;

    private async Task<MessageTemplate> GetTemplateAsync(Guid branchId, Guid id)
    {
        var template = await templates.FirstOrDefaultAsync(t => t.Id == id && t.ClinicBranchId == branchId)
            ?? throw new EntityNotFoundException(typeof(MessageTemplate), id);
        return template is { Channel: MessageChannelType.Zalo, CanSend: true }
            ? template
            : throw new BusinessException(BlueDentalDomainErrorCodes.Tools.SendTemplateNotReady);
    }

    private async Task<Guid> GetBranchIdAsync()
    {
        var branchId = branchResolver.GetRequiredClinicBranchId();
        await branchAccess.CheckAsync(branchId);
        return branchId;
    }

    private async Task<ZaloConversation> GetConversationAsync(Guid id)
    {
        var branchId = await GetBranchIdAsync();
        return await conversations.FirstOrDefaultAsync(c => c.Id == id && c.ClinicBranchId == branchId)
            ?? throw new EntityNotFoundException(typeof(ZaloConversation), id);
    }
}
