using System;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Organizations;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Authorization;
using Volo.Abp.Domain.Repositories;

namespace BlueDental.Marketing;

/// <summary>
/// Marketing → Thẻ ticket (/marketing/tags). The list is readable by whoever
/// works tickets too — the ticket screen shows and picks tags.
/// </summary>
[Authorize]
public class MarketingTicketTagAppService(
    IRepository<TicketTag, Guid> repository,
    ICurrentClinicBranchResolver branchResolver,
    BranchAccessChecker branchAccess) : BlueDentalAppService, IMarketingTicketTagAppService
{
    public async Task<ListResultDto<TicketTagDto>> GetListAsync(GetTicketTagListInput input)
    {
        if (!await AuthorizationService.IsGrantedAsync(BlueDentalAbilityPermissions.MarketingTicketTag.Read)
            && !await AuthorizationService.IsGrantedAsync(BlueDentalAbilityPermissions.MarketingTicket.Read))
        {
            throw new AbpAuthorizationException();
        }

        var branchFilter = await branchAccess.ResolveFilterAsync(input.ClinicBranchId);
        var query = await repository.GetQueryableAsync();
        if (branchFilter.Count > 0)
        {
            query = query.Where(x => branchFilter.Contains(x.ClinicBranchId));
        }

        var term = input.Filter?.Trim().ToLowerInvariant();
        if (!string.IsNullOrEmpty(term))
        {
            query = query.Where(x => x.Name.ToLower().Contains(term));
        }

        var tags = await AsyncExecuter.ToListAsync(query.OrderBy(x => x.Name));
        return new ListResultDto<TicketTagDto>(tags.Select(Map).ToList());
    }

    [Authorize(BlueDentalAbilityPermissions.MarketingTicketTag.Create)]
    public async Task<TicketTagDto> CreateAsync(CreateTicketTagDto input)
    {
        var branchId = await branchAccess.ResolveWriteTargetAsync(
            input.ClinicBranchId ?? Guid.Empty, branchResolver.GetRequiredClinicBranchId());
        await CheckNameAsync(branchId, input.Name, exceptId: null);

        var tag = new TicketTag(GuidGenerator.Create(), branchId, input.Name, input.Color, input.MaxProcessingDays);
        await repository.InsertAsync(tag, autoSave: true);
        return Map(tag);
    }

    /// <summary>
    /// A new Thời gian xử lý applies to tickets tagged from now on; the
    /// deadline of a ticket already running is left as it was promised.
    /// </summary>
    [Authorize(BlueDentalAbilityPermissions.MarketingTicketTag.Update)]
    public async Task<TicketTagDto> UpdateAsync(Guid id, UpdateTicketTagDto input)
    {
        var tag = await GetCheckedAsync(id);
        await CheckNameAsync(tag.ClinicBranchId, input.Name, tag.Id);
        tag.Update(input.Name, input.Color, input.MaxProcessingDays);
        await repository.UpdateAsync(tag, autoSave: true);
        return Map(tag);
    }

    [Authorize(BlueDentalAbilityPermissions.MarketingTicketTag.Delete)]
    public async Task DeleteAsync(Guid id)
    {
        var tag = await GetCheckedAsync(id);
        await repository.DeleteAsync(tag, autoSave: true);
    }

    private async Task<TicketTag> GetCheckedAsync(Guid id)
    {
        var tag = await repository.GetAsync(id);
        await branchAccess.CheckAsync(tag.ClinicBranchId);
        return tag;
    }

    private async Task CheckNameAsync(Guid branchId, string name, Guid? exceptId)
    {
        var normalized = name.Trim().ToLower();
        if (await repository.AnyAsync(x => x.ClinicBranchId == branchId && x.Id != exceptId && x.Name.ToLower() == normalized))
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.MarketingTicket.DuplicateTagName);
        }
    }

    private static TicketTagDto Map(TicketTag tag) => new()
    {
        Id = tag.Id,
        ClinicBranchId = tag.ClinicBranchId,
        Name = tag.Name,
        Color = tag.Color,
        MaxProcessingDays = tag.MaxProcessingDays,
        CreationTime = tag.CreationTime,
    };
}
