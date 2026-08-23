using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Organizations;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Identity;

namespace BlueDental.Tools;

[Authorize(BlueDentalPermissions.Tools.Default)]
public class ToolsAppService(
    IRepository<CallAssignment, Guid> callAssignmentRepo,
    IRepository<CallLog, Guid> callLogRepo,
    IRepository<MessageTemplate, Guid> messageTemplateRepo,
    IRepository<MessageLog, Guid> messageLogRepo,
    IIdentityUserRepository userRepo,
    ICurrentClinicBranchResolver branchResolver) : ApplicationService, IToolsAppService
{
    // ── Call Assignment ───────────────────────────────────────────────────

    [Authorize(BlueDentalPermissions.Tools.View)]
    public async Task<PagedResultDto<CallAssignmentDto>> GetCallAssignmentListAsync(GetCallAssignmentListInput input)
    {
        var branchId = branchResolver.GetRequiredClinicBranchId();
        var q = (await callAssignmentRepo.GetQueryableAsync()).AsQueryable();

        q = q.Where(x => x.ClinicBranchId == branchId);
        if (input.Status.HasValue)
            q = q.Where(x => (int)x.Status == input.Status.Value);
        if (input.StaffId.HasValue)
            q = q.Where(x => x.StaffId == input.StaffId.Value);
        if (!string.IsNullOrWhiteSpace(input.Filter))
            q = q.Where(x => x.PatientName.Contains(input.Filter) || x.PhoneNumber.Contains(input.Filter));

        var totalCount = q.Count();
        var items = q.OrderByDescending(x => x.CreationTime)
            .Skip(input.SkipCount).Take(input.MaxResultCount).ToList();

        var staffIds = items.Select(x => x.StaffId).Distinct().ToList();
        var userMap = new Dictionary<Guid, string>();
        foreach (var sid in staffIds)
        {
            var user = await userRepo.FindAsync(sid);
            if (user is not null) userMap[sid] = user.Name ?? user.UserName ?? string.Empty;
        }

        var dtos = items.Select(x => new CallAssignmentDto
        {
            Id = x.Id,
            PatientId = x.PatientId,
            StaffId = x.StaffId,
            PatientName = x.PatientName,
            PhoneNumber = x.PhoneNumber,
            StaffName = userMap.GetValueOrDefault(x.StaffId),
            Notes = x.Notes,
            Status = (int)x.Status,
            CalledAt = x.CalledAt,
            CreationTime = x.CreationTime,
        }).ToList();

        return new PagedResultDto<CallAssignmentDto>(totalCount, dtos);
    }

    [Authorize(BlueDentalPermissions.Tools.Manage)]
    public async Task<CallAssignmentDto> CreateCallAssignmentAsync(CreateCallAssignmentDto input)
    {
        var branchId = branchResolver.GetRequiredClinicBranchId();
        var entity = new CallAssignment(
            GuidGenerator.Create(), branchId, input.PatientId, input.StaffId,
            input.PatientName, input.PhoneNumber, input.Notes);
        await callAssignmentRepo.InsertAsync(entity);

        var user = await userRepo.FindAsync(input.StaffId);
        return new CallAssignmentDto
        {
            Id = entity.Id,
            PatientId = entity.PatientId,
            StaffId = entity.StaffId,
            PatientName = entity.PatientName,
            PhoneNumber = entity.PhoneNumber,
            StaffName = user?.Name ?? user?.UserName,
            Notes = entity.Notes,
            Status = (int)entity.Status,
            CreationTime = entity.CreationTime,
        };
    }

    [Authorize(BlueDentalPermissions.Tools.Manage)]
    public async Task<CallAssignmentDto> UpdateCallAssignmentStatusAsync(Guid id, UpdateCallAssignmentStatusDto input)
    {
        var entity = await callAssignmentRepo.GetAsync(id);
        if (input.Status == (int)CallAssignmentStatus.Called)
            entity.MarkCalled(input.Notes);
        else if (input.Status == (int)CallAssignmentStatus.Unreachable)
            entity.MarkUnreachable(input.Notes);

        await callAssignmentRepo.UpdateAsync(entity);

        var user = await userRepo.FindAsync(entity.StaffId);
        return new CallAssignmentDto
        {
            Id = entity.Id,
            PatientId = entity.PatientId,
            StaffId = entity.StaffId,
            PatientName = entity.PatientName,
            PhoneNumber = entity.PhoneNumber,
            StaffName = user?.Name ?? user?.UserName,
            Notes = entity.Notes,
            Status = (int)entity.Status,
            CalledAt = entity.CalledAt,
            CreationTime = entity.CreationTime,
        };
    }

    [Authorize(BlueDentalPermissions.Tools.Manage)]
    public async Task DeleteCallAssignmentAsync(Guid id) =>
        await callAssignmentRepo.DeleteAsync(id);

    // ── Call Log ──────────────────────────────────────────────────────────

    [Authorize(BlueDentalPermissions.Tools.View)]
    public async Task<PagedResultDto<CallLogDto>> GetCallLogListAsync(GetCallLogListInput input)
    {
        var branchId = branchResolver.GetRequiredClinicBranchId();
        var q = (await callLogRepo.GetQueryableAsync()).AsQueryable();

        q = q.Where(x => x.ClinicBranchId == branchId);
        if (input.Direction.HasValue)
            q = q.Where(x => (int)x.Direction == input.Direction.Value);
        if (input.Status.HasValue)
            q = q.Where(x => (int)x.Status == input.Status.Value);
        if (!string.IsNullOrWhiteSpace(input.Filter))
            q = q.Where(x => x.PatientName.Contains(input.Filter) || x.PhoneNumber.Contains(input.Filter));

        var totalCount = q.Count();
        var items = q.OrderByDescending(x => x.CreationTime)
            .Skip(input.SkipCount).Take(input.MaxResultCount).ToList();

        var dtos = items.Select(x => new CallLogDto
        {
            Id = x.Id,
            PatientId = x.PatientId,
            StaffId = x.StaffId,
            PatientName = x.PatientName,
            PhoneNumber = x.PhoneNumber,
            StaffName = x.StaffName,
            DurationSeconds = x.DurationSeconds,
            Direction = (int)x.Direction,
            Status = (int)x.Status,
            Notes = x.Notes,
            CreationTime = x.CreationTime,
        }).ToList();

        return new PagedResultDto<CallLogDto>(totalCount, dtos);
    }

    [Authorize(BlueDentalPermissions.Tools.Manage)]
    public async Task<CallLogDto> CreateCallLogAsync(CreateCallLogDto input)
    {
        var branchId = branchResolver.GetRequiredClinicBranchId();
        var entity = new CallLog(
            GuidGenerator.Create(), branchId, input.PatientId, input.StaffId,
            input.PatientName, input.PhoneNumber, input.StaffName,
            input.DurationSeconds, (CallDirection)input.Direction,
            (CallLogStatus)input.Status, input.Notes);
        await callLogRepo.InsertAsync(entity);

        return new CallLogDto
        {
            Id = entity.Id,
            PatientId = entity.PatientId,
            StaffId = entity.StaffId,
            PatientName = entity.PatientName,
            PhoneNumber = entity.PhoneNumber,
            StaffName = entity.StaffName,
            DurationSeconds = entity.DurationSeconds,
            Direction = (int)entity.Direction,
            Status = (int)entity.Status,
            Notes = entity.Notes,
            CreationTime = entity.CreationTime,
        };
    }

    [Authorize(BlueDentalPermissions.Tools.Manage)]
    public async Task DeleteCallLogAsync(Guid id) =>
        await callLogRepo.DeleteAsync(id);

    // ── Message Template ──────────────────────────────────────────────────

    [Authorize(BlueDentalPermissions.Tools.View)]
    public async Task<PagedResultDto<MessageTemplateDto>> GetMessageTemplateListAsync(GetMessageTemplateListInput input)
    {
        var branchId = branchResolver.GetRequiredClinicBranchId();
        var q = (await messageTemplateRepo.GetQueryableAsync()).AsQueryable();

        q = q.Where(x => x.ClinicBranchId == branchId);
        if (input.Channel.HasValue)
            q = q.Where(x => (int)x.Channel == input.Channel.Value);
        if (!string.IsNullOrWhiteSpace(input.Filter))
            q = q.Where(x => x.Name.Contains(input.Filter) || x.Content.Contains(input.Filter));

        var totalCount = q.Count();
        var items = q.OrderByDescending(x => x.CreationTime)
            .Skip(input.SkipCount).Take(input.MaxResultCount).ToList();

        var dtos = items.Select(x => new MessageTemplateDto
        {
            Id = x.Id,
            Name = x.Name,
            Content = x.Content,
            Channel = (int)x.Channel,
            Category = x.Category,
            IsActive = x.IsActive,
            CreationTime = x.CreationTime,
            LastModificationTime = x.LastModificationTime,
        }).ToList();

        return new PagedResultDto<MessageTemplateDto>(totalCount, dtos);
    }

    [Authorize(BlueDentalPermissions.Tools.Manage)]
    public async Task<MessageTemplateDto> CreateMessageTemplateAsync(CreateMessageTemplateDto input)
    {
        var branchId = branchResolver.GetRequiredClinicBranchId();
        var entity = new MessageTemplate(
            GuidGenerator.Create(), branchId, input.Name, input.Content,
            (MessageChannelType)input.Channel, input.Category);
        await messageTemplateRepo.InsertAsync(entity);

        return new MessageTemplateDto
        {
            Id = entity.Id,
            Name = entity.Name,
            Content = entity.Content,
            Channel = (int)entity.Channel,
            Category = entity.Category,
            IsActive = entity.IsActive,
            CreationTime = entity.CreationTime,
        };
    }

    [Authorize(BlueDentalPermissions.Tools.Manage)]
    public async Task<MessageTemplateDto> UpdateMessageTemplateAsync(Guid id, UpdateMessageTemplateDto input)
    {
        var entity = await messageTemplateRepo.GetAsync(id);
        entity.Update(input.Name, input.Content, input.Category);
        await messageTemplateRepo.UpdateAsync(entity);

        return new MessageTemplateDto
        {
            Id = entity.Id,
            Name = entity.Name,
            Content = entity.Content,
            Channel = (int)entity.Channel,
            Category = entity.Category,
            IsActive = entity.IsActive,
            CreationTime = entity.CreationTime,
            LastModificationTime = entity.LastModificationTime,
        };
    }

    [Authorize(BlueDentalPermissions.Tools.Manage)]
    public async Task DeleteMessageTemplateAsync(Guid id) =>
        await messageTemplateRepo.DeleteAsync(id);

    // ── Message Log ───────────────────────────────────────────────────────

    [Authorize(BlueDentalPermissions.Tools.View)]
    public async Task<PagedResultDto<MessageLogDto>> GetMessageLogListAsync(GetMessageLogListInput input)
    {
        var branchId = branchResolver.GetRequiredClinicBranchId();
        var q = (await messageLogRepo.GetQueryableAsync()).AsQueryable();

        q = q.Where(x => x.ClinicBranchId == branchId);
        if (input.Channel.HasValue)
            q = q.Where(x => (int)x.Channel == input.Channel.Value);
        if (input.Status.HasValue)
            q = q.Where(x => (int)x.Status == input.Status.Value);
        if (!string.IsNullOrWhiteSpace(input.Filter))
            q = q.Where(x => x.RecipientName.Contains(input.Filter) || x.RecipientPhone.Contains(input.Filter));

        var totalCount = q.Count();
        var items = q.OrderByDescending(x => x.CreationTime)
            .Skip(input.SkipCount).Take(input.MaxResultCount).ToList();

        var dtos = items.Select(x => new MessageLogDto
        {
            Id = x.Id,
            PatientId = x.PatientId,
            TemplateId = x.TemplateId,
            RecipientName = x.RecipientName,
            RecipientPhone = x.RecipientPhone,
            Content = x.Content,
            Channel = (int)x.Channel,
            Status = (int)x.Status,
            SentAt = x.SentAt,
            ErrorMessage = x.ErrorMessage,
            CreationTime = x.CreationTime,
        }).ToList();

        return new PagedResultDto<MessageLogDto>(totalCount, dtos);
    }
}
