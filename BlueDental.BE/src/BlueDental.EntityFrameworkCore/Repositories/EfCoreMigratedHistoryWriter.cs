using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using BlueDental.Data;
using BlueDental.EntityFrameworkCore;
using BlueDental.PatientManagement;
using BlueDental.TreatmentManagement;
using Volo.Abp.DependencyInjection;
using Volo.Abp.EntityFrameworkCore;

namespace BlueDental.EntityFrameworkCore.Repositories;

public class EfCoreMigratedHistoryWriter : IMigratedHistoryWriter, ITransientDependency
{
    /// <summary>
    /// Patients per save, each with all of its slips and stages. One save over
    /// 5 000 patients / 20 000 stages slowed with every tracked entity; batches
    /// plus no created-events keep it at ~11 s (10 000 / 40 000: ~22 s).
    /// </summary>
    private const int PatientsPerBatch = 200;

    private readonly IDbContextProvider<BlueDentalDbContext> _dbContextProvider;

    public EfCoreMigratedHistoryWriter(IDbContextProvider<BlueDentalDbContext> dbContextProvider)
    {
        _dbContextProvider = dbContextProvider;
    }

    public async Task WriteAsync(
        IReadOnlyList<Patient> patients,
        IReadOnlyList<TreatmentPlan> plans,
        IReadOnlyList<TreatmentStage> stages,
        CancellationToken cancellationToken = default)
    {
        var dbContext = await _dbContextProvider.GetDbContextAsync();
        var plansOf = plans.ToLookup(p => p.PatientId);
        var stagesOf = stages.ToLookup(s => s.PatientId);

        dbContext.SkipEntityCreatedEvents = true;
        try
        {
            foreach (var batch in patients.Chunk(PatientsPerBatch))
            {
                await dbContext.AddRangeAsync(batch, cancellationToken);
                await dbContext.AddRangeAsync(batch.SelectMany(p => plansOf[p.Id]), cancellationToken);
                await dbContext.AddRangeAsync(batch.SelectMany(p => stagesOf[p.Id]), cancellationToken);
                await dbContext.SaveChangesAsync(cancellationToken);

                // Saved rows stay in the transaction; nothing reads them back here,
                // so the tracker can let go of them before the next batch.
                dbContext.ChangeTracker.Clear();
            }
        }
        finally
        {
            dbContext.SkipEntityCreatedEvents = false;
        }
    }
}
