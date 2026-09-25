using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Volo.Abp.Application.Services;

namespace BlueDental.ClinicIntegration;

/// <summary>The reference's <c>/v1/clinic-integration/sync/…</c> endpoints the Danh mục screen uses.</summary>
public interface IClinicIntegrationSyncAppService : IApplicationService
{
    Task<ClinicSyncFlagsDto> GetFlagsAsync(Guid clinicBranchId);

    Task<List<ServiceCatalogGroupDto>> GetServiceCatalogGroupsAsync(Guid clinicBranchId);

    Task<ServiceCatalogSyncResultDto> SyncServiceCatalogAsync(Guid clinicBranchId, SyncServiceCatalogInput input);
}

/// <summary>The reference's <c>/v1/connections</c> resource, keyed by branch.</summary>
public interface IClinicConnectionAppService : IApplicationService
{
    Task<ClinicConnectionDto> GetAsync(Guid clinicBranchId);

    Task<ClinicConnectionDto> CreateAsync(CreateClinicConnectionDto input);

    Task<ClinicConnectionDto> UpdateAsync(Guid clinicBranchId, UpdateClinicConnectionDto input);

    Task<ClinicConnectionDto> HandshakeAsync(Guid clinicBranchId);

    Task<ClinicConnectionDto> UpdateSyncFlagsAsync(Guid clinicBranchId, UpdateClinicSyncFlagsDto input);
}
