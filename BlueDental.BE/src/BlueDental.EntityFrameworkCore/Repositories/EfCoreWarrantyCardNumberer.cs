using System;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.TreatmentManagement;
using Microsoft.EntityFrameworkCore;
using Volo.Abp.DependencyInjection;
using Volo.Abp.EntityFrameworkCore;

namespace BlueDental.EntityFrameworkCore.Repositories;

/// <summary>
/// One upsert both claims the numbers and returns them: the row lock it takes
/// makes a second activation on the same line and day wait for this
/// transaction instead of reading the same last number (R-1090).
/// </summary>
public class EfCoreWarrantyCardNumberer : IWarrantyCardNumberer, ITransientDependency
{
    private readonly IDbContextProvider<BlueDentalDbContext> _dbContextProvider;

    public EfCoreWarrantyCardNumberer(IDbContextProvider<BlueDentalDbContext> dbContextProvider)
    {
        _dbContextProvider = dbContextProvider;
    }

    public async Task<int> ReserveAsync(Guid treatmentServiceId, DateOnly startDate, int count)
    {
        if (count < 1)
        {
            throw new ArgumentOutOfRangeException(nameof(count));
        }

        var dbContext = await _dbContextProvider.GetDbContextAsync();
        var last = (await dbContext.Database
            .SqlQuery<int>($"""
                INSERT INTO bd_warranty_card_sequences ("TreatmentServiceId", "StartDate", "LastNo")
                VALUES ({treatmentServiceId}, {startDate}, {count})
                ON CONFLICT ("TreatmentServiceId", "StartDate")
                DO UPDATE SET "LastNo" = bd_warranty_card_sequences."LastNo" + EXCLUDED."LastNo"
                RETURNING "LastNo" AS "Value"
                """)
            .ToListAsync())
            .Single();
        return last - count + 1;
    }
}
