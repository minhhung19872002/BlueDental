using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Volo.Abp.DependencyInjection;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Guids;
using Volo.Abp.Linq;

namespace BlueDental.Billing;

/// <summary>
/// Writes and reads a receipt's log (<see cref="PaymentReceiptLog"/>). Each
/// write rides the caller's unit of work, so a step that fails leaves no line.
/// </summary>
public class ReceiptLogBook(
    IRepository<PaymentReceiptLog, Guid> logs,
    IGuidGenerator guidGenerator,
    IAsyncQueryableExecuter asyncExecuter) : ITransientDependency
{
    public Task PrintedForPaperAsync(PatientPayment payment) =>
        logs.InsertAsync(PaymentReceiptLog.PrintedForPaper(guidGenerator.Create(), payment));

    public Task PaperTakenBackAsync(PatientPayment payment, DateTimeOffset at, Guid? userId) =>
        logs.InsertAsync(PaymentReceiptLog.PaperTakenBack(guidGenerator.Create(), payment, at, userId));

    public Task ExportedAsync(PatientPayment payment, DateTimeOffset customerSignedAt) =>
        logs.InsertAsync(PaymentReceiptLog.Exported(guidGenerator.Create(), payment, customerSignedAt));

    public Task CancelledAsync(PatientPayment payment) =>
        logs.InsertAsync(PaymentReceiptLog.Cancelled(guidGenerator.Create(), payment));

    /// <summary>The receipt's lines, oldest first.</summary>
    public async Task<List<PaymentReceiptLog>> OfAsync(Guid patientPaymentId)
    {
        var query = await logs.GetQueryableAsync();
        return await asyncExecuter.ToListAsync(query
            .Where(x => x.PatientPaymentId == patientPaymentId)
            .OrderBy(x => x.At));
    }
}
