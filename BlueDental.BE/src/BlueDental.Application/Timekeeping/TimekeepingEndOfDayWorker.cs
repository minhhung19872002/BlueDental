using System;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Organizations;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Volo.Abp.BackgroundWorkers;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Threading;
using Volo.Abp.Uow;

namespace BlueDental.Timekeeping;

/// <summary>
/// Runs hourly. For each clinic branch, closes yesterday's open shifts
/// (nghỉ ngang) and marks no-show staff (registered Working but never
/// checked in) as Abandoned.
/// </summary>
public class TimekeepingEndOfDayWorker : AsyncPeriodicBackgroundWorkerBase
{
    public TimekeepingEndOfDayWorker(
        AbpAsyncTimer timer,
        IServiceScopeFactory serviceScopeFactory)
        : base(timer, serviceScopeFactory)
    {
        Timer.Period = 60 * 60 * 1000; // every hour
    }

    [UnitOfWork]
    protected override async Task DoWorkAsync(PeriodicBackgroundWorkerContext workerContext)
    {
        var tkRepo = workerContext.ServiceProvider
            .GetRequiredService<IRepository<TimeKeepingRecord, Guid>>();
        var branchRepo = workerContext.ServiceProvider
            .GetRequiredService<IRepository<ClinicBranch, Guid>>();

        var yesterday = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(-1);

        var branchQuery = await branchRepo.GetQueryableAsync();
        var branchIds = branchQuery.Select(b => b.Id).ToList();

        var query = await tkRepo.GetQueryableAsync();
        var records = query
            .Where(x => x.WorkDate <= yesterday)
            .Where(x => branchIds.Contains(x.ClinicBranchId))
            .ToList();

        var count = 0;

        // 1) Close open shifts (started but never checked out)
        foreach (var record in records.Where(x => x.HasOpenShift))
        {
            record.MarkAbandoned("Tự động đóng cuối ngày.");
            await tkRepo.UpdateAsync(record);
            count++;
        }

        // 2) Mark no-shows (registered Working but never checked in)
        foreach (var record in records.Where(x =>
            x.Registration == WorkRegistration.Working &&
            x.Status == AttendanceStatus.NotStarted &&
            !x.HasAnyAttendance))
        {
            record.MarkNoShow("Đăng ký làm việc nhưng không vào ca.");
            await tkRepo.UpdateAsync(record);
            count++;
        }

        if (count > 0)
        {
            Logger.LogInformation(
                "TimekeepingEndOfDayWorker: closed {Count} record(s) for {Date} and earlier.",
                count, yesterday);
        }
    }
}
