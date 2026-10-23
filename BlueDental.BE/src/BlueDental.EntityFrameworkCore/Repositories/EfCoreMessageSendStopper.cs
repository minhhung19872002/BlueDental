using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using BlueDental.Tools;
using Microsoft.EntityFrameworkCore;
using Volo.Abp.DependencyInjection;
using Volo.Abp.EntityFrameworkCore;

namespace BlueDental.EntityFrameworkCore.Repositories;

public class EfCoreMessageSendStopper : IMessageSendStopper, ITransientDependency
{
    private readonly IDbContextProvider<BlueDentalDbContext> _dbContextProvider;

    public EfCoreMessageSendStopper(IDbContextProvider<BlueDentalDbContext> dbContextProvider)
    {
        _dbContextProvider = dbContextProvider;
    }

    public async Task<int> StopWaitingAsync(Guid sendBatchId, CancellationToken cancellationToken = default)
    {
        var dbContext = await _dbContextProvider.GetDbContextAsync();
        return await dbContext.MessageLogs
            .Where(m => m.SendBatchId == sendBatchId && m.Status == MessageSendStatus.Pending)
            .ExecuteUpdateAsync(set => set.SetProperty(m => m.Status, MessageSendStatus.Stopped), cancellationToken);
    }
}
