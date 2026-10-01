using System;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Organizations;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Domain.Repositories;

namespace BlueDental.EInvoicing;

/// <summary>
/// Công cụ › Hóa đơn › Cấu hình. One active account per branch; the password
/// goes in encrypted and never comes back out.
/// </summary>
[Authorize]
public class EInvoiceConfigAppService : BlueDentalAppService, IEInvoiceConfigAppService
{
    private readonly IRepository<EInvoiceProviderConfig, Guid> _configs;
    private readonly BranchAccessChecker _branchAccess;
    private readonly EasyInvoiceSettingsResolver _resolver;

    public EInvoiceConfigAppService(
        IRepository<EInvoiceProviderConfig, Guid> configs,
        BranchAccessChecker branchAccess,
        EasyInvoiceSettingsResolver resolver)
    {
        _configs = configs;
        _branchAccess = branchAccess;
        _resolver = resolver;
    }

    [Authorize(BlueDentalPermissions.Tools.View)]
    public async Task<ListResultDto<EInvoiceConfigDto>> GetListAsync(GetEInvoiceConfigListInput input)
    {
        var branchFilter = await _branchAccess.ResolveFilterAsync(input.ClinicBranchId);
        var query = await _configs.GetQueryableAsync();
        if (branchFilter.Count > 0)
        {
            query = query.Where(c => branchFilter.Contains(c.ClinicBranchId));
        }

        var items = await AsyncExecuter.ToListAsync(query.OrderByDescending(c => c.CreationTime));
        return new ListResultDto<EInvoiceConfigDto>(items.Select(Map).ToList());
    }

    [Authorize(BlueDentalPermissions.Tools.View)]
    public async Task<EInvoiceConfigDto> GetAsync(Guid id) => Map(await GetCheckedAsync(id));

    [Authorize(BlueDentalPermissions.Tools.Manage)]
    public async Task<EInvoiceConfigDto> CreateAsync(CreateUpdateEInvoiceConfigDto input)
    {
        await _branchAccess.CheckAsync(input.ClinicBranchId);
        if (string.IsNullOrWhiteSpace(input.Password))
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.EInvoicing.ConfigIncomplete);
        }

        if (input.IsActive)
        {
            await EnsureNoOtherActiveAsync(input.ClinicBranchId, null);
        }

        var config = new EInvoiceProviderConfig(
            GuidGenerator.Create(), input.ClinicBranchId, input.Name ?? string.Empty, input.AppId,
            input.Username ?? string.Empty, _resolver.Encrypt(input.Password), input.TaxCode ?? string.Empty,
            input.TaxByService, input.TaxByPeriod, input.IsActive);

        await _configs.InsertAsync(config, autoSave: true);
        return Map(config);
    }

    /// <summary>The branch is fixed at creation: invoices already filed point at this account.</summary>
    [Authorize(BlueDentalPermissions.Tools.Manage)]
    public async Task<EInvoiceConfigDto> UpdateAsync(Guid id, CreateUpdateEInvoiceConfigDto input)
    {
        var config = await GetCheckedAsync(id);
        if (input.IsActive)
        {
            await EnsureNoOtherActiveAsync(config.ClinicBranchId, config.Id);
        }

        var cipher = string.IsNullOrWhiteSpace(input.Password) ? null : _resolver.Encrypt(input.Password);
        config.Change(input.Name ?? string.Empty, input.AppId, input.Username ?? string.Empty, cipher,
            input.TaxCode ?? string.Empty, input.TaxByService, input.TaxByPeriod, input.IsActive);

        await _configs.UpdateAsync(config, autoSave: true);
        return Map(config);
    }

    /// <summary>Soft delete: invoices filed under the account still find it for lookups.</summary>
    [Authorize(BlueDentalPermissions.Tools.Manage)]
    public async Task DeleteAsync(Guid id)
    {
        var config = await GetCheckedAsync(id);
        await _configs.DeleteAsync(config);
    }

    private async Task<EInvoiceProviderConfig> GetCheckedAsync(Guid id)
    {
        var config = await _configs.GetAsync(id);
        await _branchAccess.CheckAsync(config.ClinicBranchId);
        return config;
    }

    private async Task EnsureNoOtherActiveAsync(Guid clinicBranchId, Guid? exceptId)
    {
        if (await _configs.AnyAsync(c => c.ClinicBranchId == clinicBranchId && c.IsActive && c.Id != exceptId))
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.EInvoicing.DuplicateActiveConfig);
        }
    }

    private static EInvoiceConfigDto Map(EInvoiceProviderConfig config) => new()
    {
        Id = config.Id,
        ClinicBranchId = config.ClinicBranchId,
        Name = config.Name,
        Provider = config.Provider,
        AppId = config.AppId,
        Username = config.Username,
        HasPassword = !string.IsNullOrEmpty(config.PasswordCipher),
        TaxCode = config.TaxCode,
        TaxByService = config.TaxByService,
        TaxByPeriod = config.TaxByPeriod,
        IsActive = config.IsActive,
        LastPattern = config.LastPattern,
        LastSerial = config.LastSerial,
        CreationTime = config.CreationTime
    };
}
