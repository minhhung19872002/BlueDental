using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Volo.Abp.BackgroundWorkers;
using Volo.Abp.BlobStoring;
using Volo.Abp.Data;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Threading;
using Volo.Abp.Uow;

namespace BlueDental.Chat;

/// <summary>
/// Deletes chat files that were uploaded but never sent (the composer was
/// closed, the send failed) once they are <see cref="ChatOptions.OrphanAttachmentHours"/>
/// old, row and sealed blob both (R-1158). A sent file is never touched: it
/// has a MessageId, and messages are kept forever.
/// </summary>
public class ChatOrphanAttachmentWorker : AsyncPeriodicBackgroundWorkerBase
{
    private const int BatchSize = 200;

    private readonly ChatOptions _options;

    public ChatOrphanAttachmentWorker(
        AbpAsyncTimer timer,
        IServiceScopeFactory serviceScopeFactory,
        IOptions<ChatOptions> options)
        : base(timer, serviceScopeFactory)
    {
        _options = options.Value;
        Timer.Period = Math.Max(1, _options.OrphanSweepSeconds) * 1000;
    }

    protected override async Task DoWorkAsync(PeriodicBackgroundWorkerContext workerContext)
    {
        var services = workerContext.ServiceProvider;
        var unitOfWorkManager = services.GetRequiredService<IUnitOfWorkManager>();
        var attachments = services.GetRequiredService<IRepository<ChatAttachment, Guid>>();
        var blobs = services.GetRequiredService<IBlobContainer>();
        var cutoff = DateTime.UtcNow.AddHours(-_options.OrphanAttachmentHours);
        var deleted = 0;

        while (true)
        {
            var orphanIds = await FindOrphansAsync(unitOfWorkManager, attachments, cutoff);
            var deletedNow = 0;
            foreach (var id in orphanIds)
            {
                var blobName = await DeleteRowAsync(unitOfWorkManager, attachments, id);
                if (blobName is null)
                {
                    continue;
                }

                deletedNow++;
                if (!await blobs.DeleteAsync(blobName))
                {
                    Logger.LogWarning("Chat: orphan file {AttachmentId} had no blob to delete.", id);
                }
            }

            deleted += deletedNow;
            if (orphanIds.Count < BatchSize || deletedNow == 0)
            {
                break;
            }
        }

        if (deleted > 0)
        {
            Logger.LogInformation("Chat: deleted {Count} file(s) uploaded but never sent.", deleted);
        }
    }

    private static async Task<List<Guid>> FindOrphansAsync(
        IUnitOfWorkManager unitOfWorkManager, IRepository<ChatAttachment, Guid> attachments, DateTime cutoff)
    {
        using var uow = unitOfWorkManager.Begin(requiresNew: true);
        var query = (await attachments.GetQueryableAsync())
            .Where(a => a.MessageId == null && a.CreationTime < cutoff)
            .OrderBy(a => a.CreationTime)
            .Select(a => a.Id)
            .Take(BatchSize);
        var ids = await attachments.AsyncExecuter.ToListAsync(query);
        await uow.CompleteAsync();
        return ids;
    }

    /// <summary>
    /// The row goes first, in its own unit of work: a send racing the sweep
    /// changes the row's concurrency stamp, this delete fails, and the file
    /// stays whole. Returns the blob to delete, or null when the row stays.
    /// </summary>
    private static async Task<string?> DeleteRowAsync(
        IUnitOfWorkManager unitOfWorkManager, IRepository<ChatAttachment, Guid> attachments, Guid id)
    {
        try
        {
            using var uow = unitOfWorkManager.Begin(requiresNew: true);
            var row = await attachments.FindAsync(id);
            if (row is null || row.MessageId is not null)
            {
                return null;
            }

            await attachments.DeleteAsync(row, autoSave: true);
            await uow.CompleteAsync();
            return row.BlobName;
        }
        catch (AbpDbConcurrencyException)
        {
            return null;
        }
    }
}
