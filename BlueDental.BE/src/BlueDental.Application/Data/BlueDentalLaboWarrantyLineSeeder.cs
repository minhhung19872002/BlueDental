using System;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.TreatmentManagement;
using Volo.Abp.Data;
using Volo.Abp.DependencyInjection;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Linq;

namespace BlueDental.Data;

/// <summary>
/// Puts back the service lines a Labo warranty had pulled back to "Đang điều
/// trị" before the lab's warranty stopped counting in the line (BA 2026-11-02):
/// each unfinished line that holds one is read again by <see cref="ServiceLineProgress"/>.
///
/// Idempotent: a line the rule now finishes is left finished, and one still
/// at work is left as it is, so it is safe to run on every migration.
/// </summary>
public class BlueDentalLaboWarrantyLineSeeder(
    IRepository<TreatmentPlan, Guid> planRepository,
    IRepository<TreatmentStage, Guid> stageRepository,
    ServiceLineProgress lineProgress,
    IAsyncQueryableExecuter asyncExecuter) : IDataSeedContributor, ITransientDependency
{
    public Task SeedAsync(DataSeedContext context) => RecomputeAsync();

    public async Task<int> RecomputeAsync()
    {
        var query = await stageRepository.GetQueryableAsync();
        var lineIds = query
            .Where(w => w.IsGuarantee && w.WarrantyKind == WarrantyCardKind.Labo)
            .Select(w => w.TreatmentServiceId);
        var stages = await asyncExecuter.ToListAsync(query
            .Where(s => s.TreatmentId != null && lineIds.Contains(s.TreatmentServiceId)));
        if (stages.Count == 0)
        {
            return 0;
        }

        var planIds = stages.Select(s => s.TreatmentId!.Value).Distinct().ToList();
        var plans = await asyncExecuter.ToListAsync((await planRepository.WithDetailsAsync(p => p.Services))
            .Where(p => planIds.Contains(p.Id)));

        var finished = 0;
        foreach (var plan in plans)
        {
            var changed = false;
            foreach (var line in plan.Services.Where(l => !l.IsCompleted).ToList())
            {
                var lineStages = stages.Where(s => s.TreatmentServiceId == line.Id).ToList();
                if (lineStages.Count == 0 || !lineProgress.Move(plan, line, lineStages) || !line.IsCompleted)
                {
                    continue;
                }

                changed = true;
                finished++;
            }

            if (changed)
            {
                await planRepository.UpdateAsync(plan, autoSave: true);
            }
        }

        return finished;
    }
}
