using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.TreatmentManagement;
using Volo.Abp;
using Volo.Abp.Data;
using Volo.Abp.DependencyInjection;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Linq;

namespace BlueDental.Catalogs;

/// <summary>
/// A service's công đoạn that a patient's công đoạn has already ticked cannot
/// be dropped: the tick stores the step's id, so a fresh id (or none) blanks the
/// step's name on the treatment record and payroll skips its commission. Saving
/// the list with the step renamed keeps its id and is fine — only a removal is
/// refused. The dialog's bin, the dialog's Excel import and the catalog import
/// all reach it.
/// </summary>
public class UsedStageGuard : ITransientDependency
{
    private readonly IRepository<TreatmentStage, Guid> _treatmentStageRepository;
    private readonly IDataFilter<ISoftDelete> _softDeleteFilter;
    private readonly IAsyncQueryableExecuter _asyncExecuter;

    public UsedStageGuard(
        IRepository<TreatmentStage, Guid> treatmentStageRepository,
        IDataFilter<ISoftDelete> softDeleteFilter,
        IAsyncQueryableExecuter asyncExecuter)
    {
        _treatmentStageRepository = treatmentStageRepository;
        _softDeleteFilter = softDeleteFilter;
        _asyncExecuter = asyncExecuter;
    }

    /// <param name="entry">The service as stored, before the new list is applied.</param>
    /// <param name="incoming">The new list; null leaves the stored one as it is.</param>
    public async Task EnsureRemovedStagesUnusedAsync(CatalogEntry entry, IEnumerable<ServiceStageDto>? incoming)
    {
        if (incoming == null || entry.Stages.Count == 0)
        {
            return;
        }

        // Same rule as CatalogEntry.SyncStages: a stage survives only when a
        // row carries its id.
        var keptIds = incoming.Select(s => s.Id).Where(id => id != Guid.Empty).ToHashSet();
        var removed = entry.Stages.Where(s => !keptIds.Contains(s.Id)).ToList();
        if (removed.Count == 0)
        {
            return;
        }

        var removedIds = removed.Select(s => s.Id).ToList();

        // A deleted công đoạn of a patient does not hold the step, so the
        // filter is switched back on even when the caller turned it off.
        List<Guid> usedIds;
        using (_softDeleteFilter.Enable())
        {
            var stages = await _treatmentStageRepository.GetQueryableAsync();
            usedIds = await _asyncExecuter.ToListAsync(stages
                .SelectMany(s => s.ServiceItems)
                .Select(i => i.CatalogServiceStageId)
                .Where(id => removedIds.Contains(id))
                .Distinct());
        }

        if (usedIds.Count == 0)
        {
            return;
        }

        var names = removed
            .Where(s => usedIds.Contains(s.Id))
            .OrderBy(s => s.SortOrder)
            .Select(s => s.Name);

        throw new BusinessException(
                BlueDentalDomainErrorCodes.Catalogs.StageInUse,
                "A patient's treatment stage still uses a step this save would remove.")
            .WithData("stageNames", string.Join(", ", names));
    }
}
