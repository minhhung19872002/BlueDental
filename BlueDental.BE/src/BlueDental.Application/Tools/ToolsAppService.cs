using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Organizations;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Identity;

namespace BlueDental.Tools;

[Authorize(BlueDentalPermissions.Tools.Default)]
public class ToolsAppService(
    IRepository<CallConfiguration, Guid> callConfigurationRepo,
    IRepository<CallAssignment, Guid> callAssignmentRepo,
    IRepository<CallLog, Guid> callLogRepo,
    IRepository<MessageTemplate, Guid> messageTemplateRepo,
    IRepository<MessageLog, Guid> messageLogRepo,
    IRepository<ClinicBranch, Guid> branchRepo,
    IIdentityUserRepository userRepo,
    ICurrentClinicBranchResolver branchResolver) : ApplicationService, IToolsAppService
{
    // ── Call Configuration ────────────────────────────────────────────────

    [Authorize(BlueDentalPermissions.Tools.View)]
    public async Task<PagedResultDto<CallConfigurationDto>> GetCallConfigurationListAsync(GetCallConfigurationListInput input)
    {
        var branchId = branchResolver.GetRequiredClinicBranchId();
        var q = (await callConfigurationRepo.GetQueryableAsync())
            .Where(x => x.ClinicBranchId == branchId);
        if (!string.IsNullOrWhiteSpace(input.Filter))
            q = q.Where(x => x.Name.Contains(input.Filter));

        var totalCount = q.Count();
        var items = q.OrderByDescending(x => x.CreationTime)
            .Skip(input.SkipCount).Take(input.MaxResultCount).ToList();

        var branchName = (await branchRepo.FindAsync(branchId))?.Name ?? string.Empty;
        var dtos = items.Select(x => ToDto(x, branchName)).ToList();
        return new PagedResultDto<CallConfigurationDto>(totalCount, dtos);
    }

    [Authorize(BlueDentalPermissions.Tools.Manage)]
    public async Task<CallConfigurationDto> CreateCallConfigurationAsync(CreateCallConfigurationDto input)
    {
        var branchId = branchResolver.GetRequiredClinicBranchId();
        var entity = new CallConfiguration(
            GuidGenerator.Create(), branchId, input.Name, (CallProvider)input.Provider,
            input.ApiKey, input.SecretKey, input.IsActive);
        await callConfigurationRepo.InsertAsync(entity);

        var branchName = (await branchRepo.FindAsync(branchId))?.Name ?? string.Empty;
        return ToDto(entity, branchName);
    }

    [Authorize(BlueDentalPermissions.Tools.Manage)]
    public async Task<CallConfigurationDto> UpdateCallConfigurationAsync(Guid id, UpdateCallConfigurationDto input)
    {
        var branchId = branchResolver.GetRequiredClinicBranchId();
        var entity = await GetBranchConfigurationAsync(id, branchId);
        entity.Update(input.Name, (CallProvider)input.Provider, input.ApiKey, input.SecretKey, input.IsActive);
        await callConfigurationRepo.UpdateAsync(entity);

        var branchName = (await branchRepo.FindAsync(branchId))?.Name ?? string.Empty;
        return ToDto(entity, branchName);
    }

    [Authorize(BlueDentalPermissions.Tools.Manage)]
    public async Task DeleteCallConfigurationAsync(Guid id)
    {
        var branchId = branchResolver.GetRequiredClinicBranchId();
        var entity = await GetBranchConfigurationAsync(id, branchId);
        await callConfigurationRepo.DeleteAsync(entity);
    }

    private async Task<CallConfiguration> GetBranchConfigurationAsync(Guid id, Guid branchId)
    {
        var entity = await callConfigurationRepo.FindAsync(id);
        if (entity is null || entity.ClinicBranchId != branchId)
            throw new BusinessException(BlueDentalDomainErrorCodes.Tools.ConfigurationNotFound);
        return entity;
    }

    private static CallConfigurationDto ToDto(CallConfiguration x, string branchName) => new()
    {
        Id = x.Id,
        BranchId = x.ClinicBranchId,
        BranchName = branchName,
        Name = x.Name,
        Provider = (int)x.Provider,
        ApiKey = x.ApiKey,
        IsActive = x.IsActive,
        CreationTime = x.CreationTime,
    };

    // ── Call Assignment ───────────────────────────────────────────────────

    [Authorize(BlueDentalPermissions.Tools.View)]
    public async Task<PagedResultDto<CallAssignmentDto>> GetCallAssignmentListAsync(GetCallAssignmentListInput input)
    {
        var branchId = branchResolver.GetRequiredClinicBranchId();
        var q = (await callAssignmentRepo.GetQueryableAsync())
            .Where(x => x.ClinicBranchId == branchId);
        if (!string.IsNullOrWhiteSpace(input.Filter))
            q = q.Where(x => x.Sip.Contains(input.Filter));

        var totalCount = q.Count();
        var items = q.OrderByDescending(x => x.CreationTime)
            .Skip(input.SkipCount).Take(input.MaxResultCount).ToList();

        var configIds = items.Select(x => x.CallConfigurationId).Distinct().ToList();
        var configs = (await callConfigurationRepo.GetQueryableAsync())
            .Where(c => configIds.Contains(c.Id))
            .ToDictionary(c => c.Id);

        var userMap = new Dictionary<Guid, string>();
        foreach (var sid in items.Select(x => x.StaffId).Distinct())
        {
            var user = await userRepo.FindAsync(sid);
            if (user is not null) userMap[sid] = user.Name ?? user.UserName ?? string.Empty;
        }

        var dtos = items.Select(x => ToDto(
            x,
            configs.GetValueOrDefault(x.CallConfigurationId),
            userMap.GetValueOrDefault(x.StaffId, string.Empty))).ToList();
        return new PagedResultDto<CallAssignmentDto>(totalCount, dtos);
    }

    [Authorize(BlueDentalPermissions.Tools.Manage)]
    public async Task<CallAssignmentDto> CreateCallAssignmentAsync(CreateCallAssignmentDto input)
    {
        var branchId = branchResolver.GetRequiredClinicBranchId();
        var config = await GetBranchConfigurationAsync(input.CallConfigurationId, branchId);
        await CheckDuplicateSipAsync(input.Sip, branchId, excludeId: null);

        var entity = new CallAssignment(
            GuidGenerator.Create(), branchId, input.Sip,
            input.CallConfigurationId, input.StaffId, input.IsActive);
        await callAssignmentRepo.InsertAsync(entity);

        return ToDto(entity, config, await ResolveStaffNameAsync(input.StaffId));
    }

    [Authorize(BlueDentalPermissions.Tools.Manage)]
    public async Task<CallAssignmentDto> UpdateCallAssignmentAsync(Guid id, UpdateCallAssignmentDto input)
    {
        var branchId = branchResolver.GetRequiredClinicBranchId();
        var entity = await callAssignmentRepo.GetAsync(id);
        var config = await GetBranchConfigurationAsync(input.CallConfigurationId, branchId);
        await CheckDuplicateSipAsync(input.Sip, branchId, excludeId: id);

        entity.Update(input.Sip, input.CallConfigurationId, input.StaffId, input.IsActive);
        await callAssignmentRepo.UpdateAsync(entity);

        return ToDto(entity, config, await ResolveStaffNameAsync(input.StaffId));
    }

    [Authorize(BlueDentalPermissions.Tools.Manage)]
    public async Task DeleteCallAssignmentAsync(Guid id) =>
        await callAssignmentRepo.DeleteAsync(id);

    private async Task CheckDuplicateSipAsync(string sip, Guid branchId, Guid? excludeId)
    {
        var exists = await callAssignmentRepo.AnyAsync(x =>
            x.ClinicBranchId == branchId && x.Sip == sip && (excludeId == null || x.Id != excludeId));
        if (exists)
            throw new BusinessException(BlueDentalDomainErrorCodes.Tools.DuplicateSip);
    }

    private async Task<string> ResolveStaffNameAsync(Guid staffId)
    {
        var user = await userRepo.FindAsync(staffId);
        return user?.Name ?? user?.UserName ?? string.Empty;
    }

    private static CallAssignmentDto ToDto(CallAssignment x, CallConfiguration? config, string staffName) => new()
    {
        Id = x.Id,
        Sip = x.Sip,
        CallConfigurationId = x.CallConfigurationId,
        ConfigurationName = config?.Name ?? string.Empty,
        StaffId = x.StaffId,
        StaffName = staffName,
        Provider = (int)(config?.Provider ?? CallProvider.Voip24h),
        IsActive = x.IsActive,
        CreationTime = x.CreationTime,
    };

    // ── Call Log ──────────────────────────────────────────────────────────

    [Authorize(BlueDentalPermissions.Tools.View)]
    public async Task<PagedResultDto<CallLogDto>> GetCallLogListAsync(GetCallLogListInput input)
    {
        var branchId = branchResolver.GetRequiredClinicBranchId();
        var q = (await callLogRepo.GetQueryableAsync())
            .Where(x => x.ClinicBranchId == branchId);
        if (input.FromDate.HasValue)
            q = q.Where(x => x.CalledAt >= input.FromDate.Value);
        if (input.ToDate.HasValue)
            q = q.Where(x => x.CalledAt < input.ToDate.Value);
        if (input.StaffId.HasValue)
            q = q.Where(x => x.StaffId == input.StaffId.Value);

        var totalCount = q.Count();
        var items = q.OrderByDescending(x => x.CalledAt)
            .Skip(input.SkipCount).Take(input.MaxResultCount).ToList();

        var branchName = (await branchRepo.FindAsync(branchId))?.Name ?? string.Empty;
        var dtos = items.Select(x => ToDto(x, branchName)).ToList();
        return new PagedResultDto<CallLogDto>(totalCount, dtos);
    }

    [Authorize(BlueDentalPermissions.Tools.Manage)]
    public async Task<CallLogDto> CreateCallLogAsync(CreateCallLogDto input)
    {
        var branchId = branchResolver.GetRequiredClinicBranchId();
        var entity = new CallLog(
            GuidGenerator.Create(), branchId, input.StaffId, input.StaffName,
            input.CallCode, input.ExtensionCode, input.PhoneNumber,
            (CallLogStatus)input.Status, (CallProvider)input.Provider, input.CalledAt);
        await callLogRepo.InsertAsync(entity);

        var branchName = (await branchRepo.FindAsync(branchId))?.Name ?? string.Empty;
        return ToDto(entity, branchName);
    }

    private static CallLogDto ToDto(CallLog x, string branchName) => new()
    {
        Id = x.Id,
        StaffId = x.StaffId,
        StaffName = x.StaffName,
        BranchName = branchName,
        CallCode = x.CallCode,
        ExtensionCode = x.ExtensionCode,
        PhoneNumber = x.PhoneNumber,
        Status = (int)x.Status,
        Provider = (int)x.Provider,
        CalledAt = x.CalledAt,
    };

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
