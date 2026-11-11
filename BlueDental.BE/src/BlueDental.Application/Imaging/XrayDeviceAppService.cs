using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Organizations;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp.Domain.Repositories;

namespace BlueDental.Imaging;

/// <summary>Cài đặt → Máy X-quang: pair the PC beside the X-ray machine with a branch, or end its access (F-95).</summary>
[Authorize]
public class XrayDeviceAppService(
    IRepository<XrayDevice, Guid> devices,
    BranchAccessChecker branchAccess) : BlueDentalAppService, IXrayDeviceAppService
{
    [Authorize(BlueDentalPermissions.Organizations.View)]
    public async Task<List<XrayDeviceDto>> GetListAsync(Guid clinicBranchId)
    {
        await branchAccess.CheckAsync(clinicBranchId);
        var list = await devices.GetListAsync(d => d.ClinicBranchId == clinicBranchId);
        return list
            .OrderBy(d => d.RevokedAt != null)
            .ThenByDescending(d => d.CreationTime)
            .Select(ToDto<XrayDeviceDto>)
            .ToList();
    }

    [Authorize(BlueDentalPermissions.Organizations.Edit)]
    public async Task<PairedXrayDeviceDto> CreateAsync(CreateXrayDeviceDto input)
    {
        await branchAccess.CheckAsync(input.ClinicBranchId);
        var (device, token) = XrayDevice.Pair(GuidGenerator.Create(), input.ClinicBranchId, input.Name);
        await devices.InsertAsync(device, autoSave: true);

        var paired = ToDto<PairedXrayDeviceDto>(device);
        paired.Token = token;
        return paired;
    }

    [Authorize(BlueDentalPermissions.Organizations.Edit)]
    public async Task RevokeAsync(Guid id)
    {
        var device = await devices.GetAsync(id);
        await branchAccess.CheckAsync(device.ClinicBranchId);
        device.Revoke(DateTimeOffset.UtcNow);
        await devices.UpdateAsync(device, autoSave: true);
    }

    [Authorize(BlueDentalAbilityPermissions.TreatmentImage.Read)]
    public async Task<bool> HasActiveAsync(Guid clinicBranchId)
    {
        await branchAccess.CheckAsync(clinicBranchId);
        return await devices.AnyAsync(d => d.ClinicBranchId == clinicBranchId && d.RevokedAt == null);
    }

    private static TDto ToDto<TDto>(XrayDevice device) where TDto : XrayDeviceDto, new() => new()
    {
        Id = device.Id,
        ClinicBranchId = device.ClinicBranchId,
        Name = device.Name,
        CreationTime = device.CreationTime,
        LastSeenAt = device.LastSeenAt,
        RevokedAt = device.RevokedAt,
        IsActive = device.IsActive
    };
}
