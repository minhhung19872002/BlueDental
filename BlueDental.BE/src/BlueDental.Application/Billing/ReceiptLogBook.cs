using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Volo.Abp.DependencyInjection;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Guids;
using Volo.Abp.Linq;
using Volo.Abp.Uow;

namespace BlueDental.Billing;

/// <summary>
/// Writes and reads a receipt's log (<see cref="PaymentReceiptLog"/>). Each
/// write rides the caller's unit of work, so a step that fails leaves no line,
/// and is sealed to the receipt's last line (R-1082).
/// </summary>
public class ReceiptLogBook(
    IRepository<PaymentReceiptLog, Guid> logs,
    IGuidGenerator guidGenerator,
    IAsyncQueryableExecuter asyncExecuter,
    IReceiptCipher cipher,
    IUnitOfWorkManager unitOfWorkManager) : ITransientDependency
{
    public Task PrintedForPaperAsync(PatientPayment payment) =>
        AppendAsync(PaymentReceiptLog.PrintedForPaper(guidGenerator.Create(), payment));

    public Task PaperTakenBackAsync(PatientPayment payment, DateTimeOffset at, Guid? userId) =>
        AppendAsync(PaymentReceiptLog.PaperTakenBack(guidGenerator.Create(), payment, at, userId));

    public Task ExportedAsync(PatientPayment payment, DateTimeOffset customerSignedAt) =>
        AppendAsync(PaymentReceiptLog.Exported(guidGenerator.Create(), payment, customerSignedAt));

    public Task CancelledAsync(PatientPayment payment) =>
        AppendAsync(PaymentReceiptLog.Cancelled(guidGenerator.Create(), payment));

    /// <summary>The receipt's lines in the order they were written.</summary>
    public async Task<List<PaymentReceiptLog>> OfAsync(Guid patientPaymentId)
    {
        var query = await logs.GetQueryableAsync();
        return await asyncExecuter.ToListAsync(query
            .Where(x => x.PatientPaymentId == patientPaymentId)
            .OrderBy(x => x.Sequence));
    }

    private async Task AppendAsync(PaymentReceiptLog line)
    {
        // Not saved early: a save here would also write the caller's half-done
        // change, and its later checks would read it (a cancel then refused
        // itself as refunded, R-915). A line written earlier in this unit of
        // work is remembered instead. Two writers at once collide on
        // (receipt, sequence) when they save.
        var written = unitOfWorkManager.Current?.GetOrAddItem(
            nameof(ReceiptLogBook), _ => new Dictionary<Guid, PaymentReceiptLog>());
        var last = written?.GetValueOrDefault(line.PatientPaymentId) ?? await LastSavedAsync(line.PatientPaymentId);
        line.SealAfter(last, cipher);
        await logs.InsertAsync(line);
        if (written != null)
        {
            written[line.PatientPaymentId] = line;
        }
    }

    private async Task<PaymentReceiptLog?> LastSavedAsync(Guid patientPaymentId)
    {
        var query = await logs.GetQueryableAsync();
        return await asyncExecuter.FirstOrDefaultAsync(query
            .Where(x => x.PatientPaymentId == patientPaymentId)
            .OrderByDescending(x => x.Sequence));
    }
}
