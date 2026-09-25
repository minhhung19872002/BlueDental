using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Catalogs;
using BlueDental.Organizations;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp;
using Volo.Abp.Application.Services;
using Volo.Abp.Data;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Security.Encryption;

namespace BlueDental.ClinicIntegration;

/// <summary>
/// "Đồng bộ danh mục dịch vụ" on the Danh mục screen: sends the chosen
/// services of a branch to its partner system.
/// </summary>
[Authorize]
public class ClinicIntegrationSyncAppService : ApplicationService, IClinicIntegrationSyncAppService
{
    /// <summary>Services per partner request; a big catalog goes over in several.</summary>
    public const int BatchSize = 50;

    private readonly IRepository<ClinicConnection, Guid> _connections;
    private readonly IRepository<ServiceCatalogSyncState, Guid> _syncStates;
    private readonly IRepository<IntegrationCallLog, Guid> _callLogs;
    private readonly IRepository<CatalogEntry, Guid> _entries;
    private readonly IRepository<Taxonomy, Guid> _taxonomies;
    private readonly BranchAccessChecker _branchAccess;
    private readonly IDataFilter<ISoftDelete> _softDeleteFilter;
    private readonly IStringEncryptionService _encryption;
    private readonly IClinicPartnerClient _partner;

    public ClinicIntegrationSyncAppService(
        IRepository<ClinicConnection, Guid> connections,
        IRepository<ServiceCatalogSyncState, Guid> syncStates,
        IRepository<IntegrationCallLog, Guid> callLogs,
        IRepository<CatalogEntry, Guid> entries,
        IRepository<Taxonomy, Guid> taxonomies,
        BranchAccessChecker branchAccess,
        IDataFilter<ISoftDelete> softDeleteFilter,
        IStringEncryptionService encryption,
        IClinicPartnerClient partner)
    {
        _connections = connections;
        _syncStates = syncStates;
        _callLogs = callLogs;
        _entries = entries;
        _taxonomies = taxonomies;
        _branchAccess = branchAccess;
        _softDeleteFilter = softDeleteFilter;
        _encryption = encryption;
        _partner = partner;
    }

    public async Task<ClinicSyncFlagsDto> GetFlagsAsync(Guid clinicBranchId)
    {
        await CheckServiceAbilityAsync(BlueDentalAbilities.Actions.Read);
        await _branchAccess.CheckAsync(clinicBranchId);

        var connection = await _connections.FirstOrDefaultAsync(c => c.ClinicBranchId == clinicBranchId);
        if (connection == null)
        {
            return new ClinicSyncFlagsDto { Status = ClinicConnectionStatusText.None };
        }

        return new ClinicSyncFlagsDto
        {
            Status = ClinicConnectionStatusText.Of(connection.Status),
            InvoiceSyncEnabled = connection.CanSyncInvoices,
            ServiceCatalogSyncEnabled = connection.CanSyncServiceCatalog
        };
    }

    public async Task<List<ServiceCatalogGroupDto>> GetServiceCatalogGroupsAsync(Guid clinicBranchId)
    {
        await CheckServiceAbilityAsync(BlueDentalAbilities.Actions.Read);
        await _branchAccess.CheckAsync(clinicBranchId);

        var taxonomyQuery = await _taxonomies.GetQueryableAsync();
        var groups = taxonomyQuery
            .Where(t => t.ClinicBranchId == clinicBranchId && t.Group == TaxonomyGroups.CareService)
            .OrderBy(t => t.SortOrder)
            .ThenByDescending(t => t.CreationTime)
            .ToList();

        var entries = await LoadServicesAsync(clinicBranchId, e => true);
        var fingerprints = await CurrentFingerprintsAsync(clinicBranchId, entries);
        var byGroup = entries.ToLookup(e => e.TaxonomyId);

        return groups.Select(group =>
        {
            var services = byGroup[group.Id]
                .OrderBy(e => e.SortOrder)
                .ThenByDescending(e => e.CreationTime)
                .Select(e => new ServiceCatalogSyncItemDto
                {
                    Id = e.Id,
                    Name = e.Name,
                    Code = string.IsNullOrWhiteSpace(e.Code) ? null : e.Code,
                    Synced = fingerprints.TryGetValue(e.Id, out var synced) && synced,
                    IsDeleted = e.IsDeleted
                })
                .ToList();

            return new ServiceCatalogGroupDto
            {
                TaxonomyId = group.Id,
                Name = group.Name,
                TotalServices = services.Count,
                SyncedServices = services.Count(s => s.Synced),
                Services = services
            };
        }).ToList();
    }

    public async Task<ServiceCatalogSyncResultDto> SyncServiceCatalogAsync(
        Guid clinicBranchId, SyncServiceCatalogInput input)
    {
        await CheckServiceAbilityAsync(BlueDentalAbilities.Actions.Update);
        await _branchAccess.CheckAsync(clinicBranchId);

        var connection = await _connections.FirstOrDefaultAsync(c => c.ClinicBranchId == clinicBranchId)
            ?? throw new BusinessException(BlueDentalDomainErrorCodes.ClinicIntegration.ServiceCatalogSyncDisabled);
        connection.EnsureCanSyncServiceCatalog();

        var selected = await ResolveSelectionAsync(clinicBranchId, input);
        var groupNames = await GroupNamesAsync(selected);
        var states = (await _syncStates.GetListAsync(s => s.ClinicBranchId == clinicBranchId))
            .ToDictionary(s => s.CatalogEntryId);

        var report = new ServiceCatalogSyncReport();
        var toSend = new List<(CatalogEntry Entry, PartnerServiceItem Item, string Fingerprint)>();

        foreach (var entry in selected)
        {
            if (string.IsNullOrWhiteSpace(entry.Code))
            {
                report.SkipWithReason(entry.Id, null, L["ClinicIntegration:Sync:NoCode", entry.Name]);
                continue;
            }

            var item = ServiceCatalogPayload.From(entry, groupNames.GetValueOrDefault(entry.TaxonomyId));
            var fingerprint = ServiceCatalogPayload.Fingerprint(item);
            if (states.TryGetValue(entry.Id, out var state) && state.IsCurrent(fingerprint))
            {
                report.SkipUnchanged(entry.Id, item.Code);
                continue;
            }

            toSend.Add((entry, item, fingerprint));
        }

        var endpoint = new PartnerEndpoint(connection.BaseUrl, Decrypt(connection.ApiKeyCipher));
        var batches = toSend.Chunk(BatchSize).ToList();
        for (var i = 0; i < batches.Count; i++)
        {
            await SendBatchAsync(clinicBranchId, endpoint, batches[i], i + 1, batches.Count, report, states);
        }

        return ToDto(report);
    }

    private async Task SendBatchAsync(
        Guid clinicBranchId,
        PartnerEndpoint endpoint,
        IReadOnlyList<(CatalogEntry Entry, PartnerServiceItem Item, string Fingerprint)> batch,
        int number,
        int count,
        ServiceCatalogSyncReport report,
        Dictionary<Guid, ServiceCatalogSyncState> states)
    {
        var items = batch.Select(b => b.Item).ToList();
        var outcome = await _partner.UpsertServicesAsync(endpoint, clinicBranchId, items);

        await _callLogs.InsertAsync(new IntegrationCallLog(
            GuidGenerator.Create(), clinicBranchId, "service-catalog", outcome.RequestPath,
            outcome.StatusCode, outcome.Succeeded, outcome.DurationMs, items.Count, outcome.Error));

        if (!outcome.Succeeded)
        {
            report.FailBatch(items, L["ClinicIntegration:Sync:BatchFailed", number, count], outcome.Error);
            return;
        }

        var answers = ServiceCatalogSyncReport.Index(outcome.Results);
        var noAnswer = L["ClinicIntegration:Sync:NoAnswer"];

        foreach (var (entry, item, fingerprint) in batch)
        {
            var result = answers.GetValueOrDefault(item.ExternalId);
            if (!report.Record(item, result, noAnswer))
            {
                continue;
            }

            if (!states.TryGetValue(entry.Id, out var state))
            {
                state = new ServiceCatalogSyncState(GuidGenerator.Create(), clinicBranchId, entry.Id);
                state.MarkSynced(fingerprint, result?.SystemId, Clock.Now);
                await _syncStates.InsertAsync(state, autoSave: true);
                states[entry.Id] = state;
                continue;
            }

            state.MarkSynced(fingerprint, result?.SystemId, Clock.Now);
            await _syncStates.UpdateAsync(state, autoSave: true);
        }
    }

    /// <summary>
    /// Whole groups plus single picks, de-duplicated. Deleted services count —
    /// the reference's dialog lists and offers them — so the partner learns of
    /// the deletion. Anything outside this branch's service catalog is refused.
    /// </summary>
    private async Task<List<CatalogEntry>> ResolveSelectionAsync(Guid clinicBranchId, SyncServiceCatalogInput input)
    {
        var taxonomyIds = (input.TaxonomyIds ?? []).Distinct().ToList();
        var serviceIds = (input.ServiceIds ?? []).Distinct().ToList();

        if (taxonomyIds.Count == 0 && serviceIds.Count == 0)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.ClinicIntegration.EmptySelection);
        }

        if (taxonomyIds.Count > 0)
        {
            var known = await _taxonomies.CountAsync(t =>
                taxonomyIds.Contains(t.Id)
                && t.ClinicBranchId == clinicBranchId
                && t.Group == TaxonomyGroups.CareService);
            if (known != taxonomyIds.Count)
            {
                throw new BusinessException(BlueDentalDomainErrorCodes.ClinicIntegration.ServiceNotInBranch);
            }
        }

        var selected = await LoadServicesAsync(clinicBranchId,
            e => taxonomyIds.Contains(e.TaxonomyId) || serviceIds.Contains(e.Id));

        var foundIds = selected.Select(e => e.Id).ToHashSet();
        if (serviceIds.Any(id => !foundIds.Contains(id)))
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.ClinicIntegration.ServiceNotInBranch);
        }

        return selected;
    }

    /// <summary>The branch's services, soft-deleted ones included, with their price config.</summary>
    private async Task<List<CatalogEntry>> LoadServicesAsync(
        Guid clinicBranchId, System.Linq.Expressions.Expression<Func<CatalogEntry, bool>> filter)
    {
        using var _ = _softDeleteFilter.Disable();
        var query = await _entries.WithDetailsAsync(e => e.ServiceConfig!);

        return query
            .Where(e => e.ClinicBranchId == clinicBranchId && e.Group == TaxonomyGroups.CareService)
            .Where(filter)
            .ToList();
    }

    /// <summary>Per service: does the partner hold exactly what it would receive now?</summary>
    private async Task<Dictionary<Guid, bool>> CurrentFingerprintsAsync(
        Guid clinicBranchId, IReadOnlyCollection<CatalogEntry> entries)
    {
        var states = (await _syncStates.GetListAsync(s => s.ClinicBranchId == clinicBranchId))
            .ToDictionary(s => s.CatalogEntryId);
        var groupNames = await GroupNamesAsync(entries);

        return entries.ToDictionary(
            e => e.Id,
            e => !string.IsNullOrWhiteSpace(e.Code)
                && states.TryGetValue(e.Id, out var state)
                && state.IsCurrent(ServiceCatalogPayload.Fingerprint(
                    ServiceCatalogPayload.From(e, groupNames.GetValueOrDefault(e.TaxonomyId)))));
    }

    private async Task<Dictionary<Guid, string>> GroupNamesAsync(IEnumerable<CatalogEntry> entries)
    {
        var ids = entries.Select(e => e.TaxonomyId).Distinct().ToList();
        if (ids.Count == 0)
        {
            return [];
        }

        var query = await _taxonomies.GetQueryableAsync();
        return query.Where(t => ids.Contains(t.Id)).ToDictionary(t => t.Id, t => t.Name);
    }

    /// <summary>The Danh mục screen's own ability for services, not the catalog-wide legacy name.</summary>
    private Task CheckServiceAbilityAsync(string action) =>
        CheckPolicyAsync(BlueDentalAbilities.Permission(BlueDentalAbilities.Subjects.CatalogService, action));

    private string Decrypt(string cipher) =>
        _encryption.Decrypt(cipher)
        ?? throw new InvalidOperationException("The stored API key could not be decrypted.");

    private static ServiceCatalogSyncResultDto ToDto(ServiceCatalogSyncReport report) => new()
    {
        Summary = new ServiceCatalogSyncSummaryDto
        {
            Total = report.Total,
            Sent = report.Sent,
            Updated = report.Updated,
            Failed = report.Failed,
            Skipped = report.Skipped
        },
        Duplicated = report.Duplicated
            .Select(d => new ServiceCatalogSyncDuplicateDto
            {
                Code = d.Code, DentalName = d.DentalName, SystemName = d.SystemName, ExternalId = d.ExternalId
            })
            .ToList(),
        Warned = report.Warned.Select(ToNote).ToList(),
        Skipped = report.SkippedItems.Select(ToNote).ToList(),
        Updated = report.UpdatedItems
            .Select(u => new ServiceCatalogSyncUpdateDto { Code = u.Code, ExternalId = u.ExternalId, Relinked = u.Relinked })
            .ToList(),
        BatchErrors = report.BatchErrors
            .Select(e => new ServiceCatalogSyncBatchErrorDto { Reason = e.Reason, Message = e.Message })
            .ToList()
    };

    private static ServiceCatalogSyncNoteDto ToNote(SyncNote note) => new()
    {
        Code = note.Code, Reason = note.Reason, ExternalId = note.ExternalId
    };
}
