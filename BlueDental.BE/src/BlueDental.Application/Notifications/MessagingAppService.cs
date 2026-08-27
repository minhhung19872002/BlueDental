using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Organizations;
using BlueDental.Permissions;
using BlueDental.Tools;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;
using Volo.Abp.Domain.Repositories;

namespace BlueDental.Notifications;

/// <summary>
/// The CSKH "Lưu tin nhắn" dialog lists. Templates come from the existing
/// Tools <see cref="MessageTemplate"/> catalog (SMS channel, active only);
/// configures are the per-module <see cref="ClinicConfigure"/> rows.
/// Both are branch-scoped.
/// </summary>
[Authorize(BlueDentalPermissions.CustomerCare.View)]
public class MessagingAppService : ApplicationService, IMessagingAppService
{
    private readonly IRepository<MessageTemplate, Guid> _templateRepository;
    private readonly IRepository<ClinicConfigure, Guid> _configureRepository;
    private readonly ICurrentClinicBranchResolver _branchResolver;

    public MessagingAppService(
        IRepository<MessageTemplate, Guid> templateRepository,
        IRepository<ClinicConfigure, Guid> configureRepository,
        ICurrentClinicBranchResolver branchResolver)
    {
        _templateRepository = templateRepository;
        _configureRepository = configureRepository;
        _branchResolver = branchResolver;
    }

    public async Task<PagedResultDto<SmsTemplateDto>> GetSmsTemplatesAsync(GetSmsTemplatesInput input)
    {
        var branchId = _branchResolver.GetRequiredClinicBranchId();
        var query = (await _templateRepository.GetQueryableAsync())
            .Where(x => x.ClinicBranchId == branchId)
            .Where(x => x.Channel == MessageChannelType.Sms && x.IsActive);

        if (!string.IsNullOrWhiteSpace(input.Filter))
        {
            var filter = input.Filter.Trim().ToLower();
            query = query.Where(x => x.Name.ToLower().Contains(filter));
        }

        var totalCount = await AsyncExecuter.CountAsync(query);
        var items = await AsyncExecuter.ToListAsync(query
            .OrderBy(x => x.Name)
            .Skip(input.SkipCount)
            .Take(input.MaxResultCount));

        return new PagedResultDto<SmsTemplateDto>(
            totalCount,
            ObjectMapper.Map<List<MessageTemplate>, List<SmsTemplateDto>>(items));
    }

    public async Task<PagedResultDto<ClinicConfigureDto>> GetClinicConfiguresAsync(
        GetClinicConfiguresInput input)
    {
        var branchId = _branchResolver.GetRequiredClinicBranchId();
        var query = (await _configureRepository.GetQueryableAsync())
            .Where(x => x.BranchId == branchId);

        if (!string.IsNullOrWhiteSpace(input.Module))
            query = query.Where(x => x.Module == input.Module);
        if (input.IsEnabled.HasValue)
            query = query.Where(x => x.IsEnabled == input.IsEnabled.Value);

        if (!string.IsNullOrWhiteSpace(input.Filter))
        {
            var filter = input.Filter.Trim().ToLower();
            query = query.Where(x => x.Name.ToLower().Contains(filter));
        }

        var totalCount = await AsyncExecuter.CountAsync(query);
        var items = await AsyncExecuter.ToListAsync(query
            .OrderBy(x => x.Name)
            .Skip(input.SkipCount)
            .Take(input.MaxResultCount));

        return new PagedResultDto<ClinicConfigureDto>(
            totalCount,
            ObjectMapper.Map<List<ClinicConfigure>, List<ClinicConfigureDto>>(items));
    }
}
