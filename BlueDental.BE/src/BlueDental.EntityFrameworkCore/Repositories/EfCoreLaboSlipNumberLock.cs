using System;
using System.Threading.Tasks;
using BlueDental.Labo;
using Microsoft.EntityFrameworkCore;
using Volo.Abp.DependencyInjection;
using Volo.Abp.EntityFrameworkCore;

namespace BlueDental.EntityFrameworkCore.Repositories;

/// <summary>
/// A PostgreSQL transaction-level advisory lock per patient: released by the
/// commit or rollback of the request's unit of work, never left behind.
/// </summary>
public class EfCoreLaboSlipNumberLock : ILaboSlipNumberLock, ITransientDependency
{
    /// <summary>The lock's first key, keeping it apart from any other advisory lock.</summary>
    private const int LaboSlipNumberKey = 1288;

    private readonly IDbContextProvider<BlueDentalDbContext> _dbContextProvider;

    public EfCoreLaboSlipNumberLock(IDbContextProvider<BlueDentalDbContext> dbContextProvider)
    {
        _dbContextProvider = dbContextProvider;
    }

    public async Task WaitForPatientAsync(Guid patientId)
    {
        var dbContext = await _dbContextProvider.GetDbContextAsync();
        var patientKey = PatientKey(patientId);
        await dbContext.Database.ExecuteSqlInterpolatedAsync(
            $"SELECT pg_advisory_xact_lock({LaboSlipNumberKey}, {patientKey})");
    }

    /// <summary>The patient id folded to an int; two patients sharing one only wait on each other.</summary>
    private static int PatientKey(Guid patientId)
    {
        var bytes = patientId.ToByteArray();
        var key = 0;
        for (var i = 0; i < bytes.Length; i += 4)
        {
            key ^= BitConverter.ToInt32(bytes, i);
        }

        return key;
    }
}
