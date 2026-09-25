using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using BlueDental.Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Volo.Abp;

namespace BlueDental.ClinicIntegration;

/// <summary>
/// The reference's <c>/v1/clinic-integration/sync/{branchId}/…</c>, under
/// BlueDental's <c>api/v1/app</c> prefix.
/// </summary>
[RemoteService]
[Authorize]
[Route("api/v1/app/clinic-integration/sync/{clinicBranchId:guid}")]
public sealed class ClinicIntegrationSyncController(IClinicIntegrationSyncAppService service) : BlueDentalController
{
    [HttpGet("flags")]
    public Task<ClinicSyncFlagsDto> GetFlagsAsync(Guid clinicBranchId) => service.GetFlagsAsync(clinicBranchId);

    [HttpGet("service-catalog-groups")]
    public Task<List<ServiceCatalogGroupDto>> GetServiceCatalogGroupsAsync(Guid clinicBranchId) =>
        service.GetServiceCatalogGroupsAsync(clinicBranchId);

    [HttpPost("service-catalog")]
    public Task<ServiceCatalogSyncResultDto> SyncServiceCatalogAsync(
        Guid clinicBranchId, [FromBody] SyncServiceCatalogInput input) =>
        service.SyncServiceCatalogAsync(clinicBranchId, input);
}

/// <summary>The reference's <c>/v1/connections</c>, keyed by branch as it is there.</summary>
[RemoteService]
[Authorize]
[Route("api/v1/app/connections")]
public sealed class ClinicConnectionController(IClinicConnectionAppService service) : BlueDentalController
{
    [HttpGet("{clinicBranchId:guid}")]
    public Task<ClinicConnectionDto> GetAsync(Guid clinicBranchId) => service.GetAsync(clinicBranchId);

    [HttpPost]
    public Task<ClinicConnectionDto> CreateAsync([FromBody] CreateClinicConnectionDto input) =>
        service.CreateAsync(input);

    [HttpPatch("{clinicBranchId:guid}")]
    public Task<ClinicConnectionDto> UpdateAsync(Guid clinicBranchId, [FromBody] UpdateClinicConnectionDto input) =>
        service.UpdateAsync(clinicBranchId, input);

    [HttpPost("{clinicBranchId:guid}/handshake")]
    public Task<ClinicConnectionDto> HandshakeAsync(Guid clinicBranchId) => service.HandshakeAsync(clinicBranchId);

    [HttpPatch("{clinicBranchId:guid}/sync-flags")]
    public Task<ClinicConnectionDto> UpdateSyncFlagsAsync(
        Guid clinicBranchId, [FromBody] UpdateClinicSyncFlagsDto input) =>
        service.UpdateSyncFlagsAsync(clinicBranchId, input);
}
