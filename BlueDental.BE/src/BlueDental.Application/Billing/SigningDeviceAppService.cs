using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Organizations;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp.Domain.Repositories;

namespace BlueDental.Billing;

/// <summary>Cài đặt → Kết nối iPad: pair an iPad with a branch, or end its access.</summary>
[Authorize]
public class SigningDeviceAppService(
    IRepository<SigningDevice, Guid> devices,
    ReceiptSigningDesk desk,
    BranchAccessChecker branchAccess) : BlueDentalAppService, ISigningDeviceAppService
{
    [Authorize(BlueDentalPermissions.Organizations.View)]
    public async Task<List<SigningDeviceDto>> GetListAsync(Guid clinicBranchId)
    {
        await branchAccess.CheckAsync(clinicBranchId);
        var list = await devices.GetListAsync(d => d.ClinicBranchId == clinicBranchId);
        return list
            .OrderBy(d => d.RevokedAt != null)
            .ThenByDescending(d => d.CreationTime)
            .Select(ToDto<SigningDeviceDto>)
            .ToList();
    }

    [Authorize(BlueDentalPermissions.Organizations.Edit)]
    public async Task<PairedSigningDeviceDto> CreateAsync(CreateSigningDeviceDto input)
    {
        await branchAccess.CheckAsync(input.ClinicBranchId);
        var (device, token) = SigningDevice.Pair(GuidGenerator.Create(), input.ClinicBranchId, input.Name);
        await devices.InsertAsync(device, autoSave: true);

        var paired = ToDto<PairedSigningDeviceDto>(device);
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
        // The iPad reloads on the signal, is refused, and asks to be paired again.
        desk.Notify(device.ClinicBranchId, Guid.Empty);
    }

    private static TDto ToDto<TDto>(SigningDevice device) where TDto : SigningDeviceDto, new() => new()
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
