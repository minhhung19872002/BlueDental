using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Billing;
using BlueDental.CustomerCare;
using BlueDental.EInvoicing;
using BlueDental.Labo;
using BlueDental.PatientManagement;
using BlueDental.Promotions;
using Volo.Abp.DependencyInjection;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Linq;

namespace BlueDental.TreatmentManagement;

/// <summary>
/// "Xoá phiếu điều trị" (owner 2026-10-14): the slip goes as if it had never
/// been opened. Everything written against it is soft-deleted with it, so it
/// shows nowhere and counts nowhere — money, dư nợ, reports and CSKH all read
/// through the soft-delete filter:
/// <list type="bullet">
/// <item>its receipts and refunds, and the e-invoices issued for the slip or
/// those receipts (the provider's copy is not cancelled from here);</item>
/// <item>its công đoạn, labo orders, re-exams, treatment records and the
/// images filed under the slip or its công đoạn;</item>
/// <item>prescriptions written only from its diagnoses — one that also names
/// another slip keeps its snapshot and stays;</item>
/// <item>sau-điều-trị care tasks that follow only its công đoạn; a task that
/// also follows another slip's công đoạn just lets go of these;</item>
/// <item>the voucher uses it burnt are given back;</item>
/// <item>its consulting lines go back to accepted, free for a new slip.</item>
/// </list>
/// Soft-deleted, not erased: every row is still in the database.
/// </summary>
public class TreatmentPlanDeletion(
    IRepository<TreatmentPlan, Guid> planRepository,
    IRepository<PatientAdvise, Guid> adviseRepository,
    IRepository<PatientPayment, Guid> paymentRepository,
    IRepository<ElectronicInvoice, Guid> invoiceRepository,
    IRepository<TreatmentStage, Guid> stageRepository,
    IRepository<LaboOrder, Guid> laboRepository,
    IRepository<PatientReExamination, Guid> reExaminationRepository,
    IRepository<TreatmentRecord, Guid> recordRepository,
    IRepository<PatientImage, Guid> imageRepository,
    IRepository<Prescription, Guid> prescriptionRepository,
    IRepository<CareRecord, Guid> careRepository,
    IRepository<Voucher, Guid> voucherRepository,
    IAsyncQueryableExecuter asyncExecuter) : ITransientDependency
{
    public async Task DeleteAsync(TreatmentPlan plan)
    {
        var lineIds = plan.Services.Select(s => s.Id).ToList();

        var paymentIds = await DeleteWhereAsync(paymentRepository, p => p.TreatmentPlanId == plan.Id);
        await DeleteWhereAsync(invoiceRepository, i =>
            i.TreatmentPlanId == plan.Id
            || (i.PatientPaymentId.HasValue && paymentIds.Contains(i.PatientPaymentId.Value)));

        var stageIds = await DeleteWhereAsync(stageRepository, s => lineIds.Contains(s.TreatmentServiceId));
        await DeleteWhereAsync(laboRepository, o =>
            (o.TreatmentServiceId.HasValue && lineIds.Contains(o.TreatmentServiceId.Value))
            || (o.TreatmentStageId.HasValue && stageIds.Contains(o.TreatmentStageId.Value)));
        await DeleteWhereAsync(reExaminationRepository, r => lineIds.Contains(r.TreatmentServiceId));
        await DeleteWhereAsync(recordRepository, r => r.TreatmentPlanId == plan.Id);
        await DeleteWhereAsync(imageRepository, i =>
            i.TreatmentPlanId == plan.Id
            || (i.TreatmentStageId.HasValue && stageIds.Contains(i.TreatmentStageId.Value)));

        await DeletePrescriptionsAsync(plan.Id);
        await DropCareAsync(plan.PatientId, stageIds);
        await ReleaseVouchersAsync(plan);
        await ReleaseAdvisesAsync(plan.Id);

        await planRepository.DeleteAsync(plan, autoSave: true);
    }

    private static async Task<List<Guid>> DeleteWhereAsync<TEntity>(
        IRepository<TEntity, Guid> repository,
        System.Linq.Expressions.Expression<Func<TEntity, bool>> predicate)
        where TEntity : class, Volo.Abp.Domain.Entities.IEntity<Guid>
    {
        var found = await repository.GetListAsync(predicate);
        if (found.Count > 0)
        {
            await repository.DeleteManyAsync(found, autoSave: true);
        }

        return found.Select(e => e.Id).ToList();
    }

    private async Task DeletePrescriptionsAsync(Guid planId)
    {
        var query = (await prescriptionRepository.WithDetailsAsync(p => p.Diagnoses))
            .Where(p => p.Diagnoses.Any(d => d.TreatmentPlanId == planId));
        var onlyThisSlip = (await asyncExecuter.ToListAsync(query))
            .Where(p => p.Diagnoses.All(d => d.TreatmentPlanId == planId))
            .ToList();

        if (onlyThisSlip.Count > 0)
        {
            await prescriptionRepository.DeleteManyAsync(onlyThisSlip, autoSave: true);
        }
    }

    private async Task DropCareAsync(Guid patientId, IReadOnlyCollection<Guid> stageIds)
    {
        if (stageIds.Count == 0)
        {
            return;
        }

        var touched = (await careRepository.GetListAsync(c => c.PatientId == patientId))
            .Where(c => c.StageIds.Any(stageIds.Contains))
            .ToList();
        var gone = touched.Where(c => c.StageIds.All(stageIds.Contains)).ToList();
        var kept = touched.Except(gone).ToList();

        foreach (var care in kept)
        {
            care.LinkStages(care.StageIds.Where(id => !stageIds.Contains(id)).ToList());
        }

        if (gone.Count > 0)
        {
            await careRepository.DeleteManyAsync(gone, autoSave: true);
        }

        if (kept.Count > 0)
        {
            await careRepository.UpdateManyAsync(kept, autoSave: true);
        }
    }

    private async Task ReleaseVouchersAsync(TreatmentPlan plan)
    {
        var voucherIds = plan.AppliedVouchers.Select(v => v.VoucherId).ToList();
        if (voucherIds.Count == 0)
        {
            return;
        }

        var vouchers = await voucherRepository.GetListAsync(v => voucherIds.Contains(v.Id));
        foreach (var voucher in vouchers)
        {
            voucher.Release();
        }

        await voucherRepository.UpdateManyAsync(vouchers, autoSave: true);
    }

    private async Task ReleaseAdvisesAsync(Guid planId)
    {
        var advises = await adviseRepository.GetListAsync(a => a.TreatmentPlanId == planId);
        foreach (var advise in advises)
        {
            advise.ReleaseFromPlan();
        }

        if (advises.Count > 0)
        {
            await adviseRepository.UpdateManyAsync(advises, autoSave: true);
        }
    }
}
