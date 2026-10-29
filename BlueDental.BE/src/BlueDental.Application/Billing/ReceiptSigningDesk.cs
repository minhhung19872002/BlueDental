using System;
using System.Threading.Tasks;
using Volo.Abp;
using Volo.Abp.DependencyInjection;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Guids;
using Volo.Abp.Uow;

namespace BlueDental.Billing;

/// <summary>
/// The branch's iPad queue of one (P2610): which receipt it shows, sending a
/// receipt to it, and ending the session when the receipt moves on. Every
/// change is announced once the transaction has committed, so a screen that
/// reloads on the signal reads the new state.
/// </summary>
public class ReceiptSigningDesk(
    IRepository<ReceiptSigningSession, Guid> sessions,
    IRepository<SigningDevice, Guid> devices,
    IReceiptSigningNotifier notifier,
    IUnitOfWorkManager unitOfWorkManager,
    IGuidGenerator guidGenerator) : ITransientDependency
{
    public Task<ReceiptSigningSession?> OpenOfBranchAsync(Guid clinicBranchId) =>
        sessions.FirstOrDefaultAsync(x => x.ClinicBranchId == clinicBranchId && x.ClosedAt == null);

    public Task<bool> HasDeviceAsync(Guid clinicBranchId) =>
        devices.AnyAsync(x => x.ClinicBranchId == clinicBranchId && x.RevokedAt == null);

    /// <summary>
    /// Gửi tới iPad / Gửi lại. The iPad showing another receipt refuses unless
    /// the cashier chose to end that session (<paramref name="replace"/>).
    /// </summary>
    public async Task<ReceiptSigningSession> SendAsync(PatientPayment payment, bool replace)
    {
        if (!payment.IsPending)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Billing.ReceiptNotSendable);
        }

        if (payment.IsSignedOnPaper)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Billing.ReceiptSignedOnPaper);
        }

        if (!await HasDeviceAsync(payment.ClinicBranchId))
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Billing.SigningDeviceMissing);
        }

        var now = DateTimeOffset.UtcNow;
        var open = await OpenOfBranchAsync(payment.ClinicBranchId);
        if (open != null && open.PatientPaymentId == payment.Id)
        {
            open.Resend(now);
            await sessions.UpdateAsync(open, autoSave: true);
            Notify(payment.ClinicBranchId, payment.Id);
            return open;
        }

        if (open != null)
        {
            if (!replace)
            {
                throw new BusinessException(BlueDentalDomainErrorCodes.Billing.SigningDeviceBusy)
                    .WithData("0", open.PaymentCode);
            }

            // Saved first: the branch may hold one open session only.
            open.Close(SigningCloseReason.Replaced, now);
            await sessions.UpdateAsync(open, autoSave: true);
            Notify(open.ClinicBranchId, open.PatientPaymentId);
        }

        var session = ReceiptSigningSession.Open(
            guidGenerator.Create(), payment.ClinicBranchId, payment.Id, payment.Code, now);
        await sessions.InsertAsync(session, autoSave: true);
        Notify(payment.ClinicBranchId, payment.Id);
        return session;
    }

    /// <summary>
    /// A new receipt goes straight to the iPad when the branch has one and it
    /// is free; otherwise the cashier sends it from the receipt page.
    /// </summary>
    public async Task SendIfFreeAsync(PatientPayment payment)
    {
        if (!payment.IsPending
            || payment.IsSignedOnPaper
            || !await HasDeviceAsync(payment.ClinicBranchId)
            || await OpenOfBranchAsync(payment.ClinicBranchId) != null)
        {
            return;
        }

        await SendAsync(payment, replace: false);
    }

    /// <summary>The receipt was exported, revised or cancelled: its session, if open, ends.</summary>
    public async Task CloseOfPaymentAsync(PatientPayment payment, SigningCloseReason reason)
    {
        var open = await sessions.FirstOrDefaultAsync(x => x.PatientPaymentId == payment.Id && x.ClosedAt == null);
        if (open == null)
        {
            return;
        }

        open.Close(reason, DateTimeOffset.UtcNow);
        await sessions.UpdateAsync(open, autoSave: true);
        Notify(open.ClinicBranchId, open.PatientPaymentId);
    }

    public void Notify(Guid clinicBranchId, Guid patientPaymentId)
    {
        var uow = unitOfWorkManager.Current;
        if (uow == null)
        {
            _ = notifier.NotifyChangedAsync(clinicBranchId, patientPaymentId);
            return;
        }

        uow.OnCompleted(() => notifier.NotifyChangedAsync(clinicBranchId, patientPaymentId));
    }
}

/// <summary>Stands in where no SignalR host runs (tests, the migrator).</summary>
[Dependency(TryRegister = true)]
public class NullReceiptSigningNotifier : IReceiptSigningNotifier, ITransientDependency
{
    public Task NotifyChangedAsync(Guid clinicBranchId, Guid patientPaymentId) => Task.CompletedTask;
}
