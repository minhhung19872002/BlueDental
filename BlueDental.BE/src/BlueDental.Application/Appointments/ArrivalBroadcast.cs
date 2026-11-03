using System;
using Microsoft.Extensions.DependencyInjection;
using Volo.Abp.DependencyInjection;
using Volo.Abp.Uow;

namespace BlueDental.Appointments;

/// <summary>
/// Tells the branch's "Đã đến" panels to refetch once the change is
/// committed — a refetch before then would read the old rows. A host without
/// a notifier (the application tests) simply has no live panels to tell.
/// </summary>
public class ArrivalBroadcast(IUnitOfWorkManager unitOfWorkManager, IServiceProvider serviceProvider)
    : ITransientDependency
{
    public void AfterCommit(Guid branchId)
    {
        var notifier = serviceProvider.GetService<IAppointmentNotifier>();
        if (notifier is null) return;

        if (unitOfWorkManager.Current is { } unitOfWork)
        {
            unitOfWork.OnCompleted(() => notifier.NotifyArrivalsChangedAsync(branchId));
            return;
        }

        _ = notifier.NotifyArrivalsChangedAsync(branchId);
    }
}
