using System;
using System.Collections.Generic;
using System.Linq;
using System.Linq.Expressions;
using System.Threading.Tasks;
using BlueDental.Appointments;
using BlueDental.Billing;
using BlueDental.Labo;
using BlueDental.TreatmentManagement;
using Volo.Abp.Data;
using Volo.Abp.DependencyInjection;
using Volo.Abp.Domain.Entities;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Linq;

namespace BlueDental.PatientManagement.Roster;

/// <summary>
/// Which patients already have clinical or money records. The roster's D rows
/// may only delete a record nobody has worked on yet (a duplicate, a typo):
/// deleting one with appointments, slips, payments, invoices, prescriptions or
/// labo orders would leave those rows pointing at a hidden patient.
/// </summary>
public class PatientRecordCheck : ITransientDependency
{
    private readonly IRepository<Appointment, Guid> _appointments;
    private readonly IRepository<TreatmentPlan, Guid> _plans;
    private readonly IRepository<PatientPayment, Guid> _payments;
    private readonly IRepository<Invoice, Guid> _invoices;
    private readonly IRepository<Prescription, Guid> _prescriptions;
    private readonly IRepository<LaboOrder, Guid> _laboOrders;
    private readonly IAsyncQueryableExecuter _executer;
    private readonly IDataFilter _dataFilter;

    public PatientRecordCheck(
        IRepository<Appointment, Guid> appointments,
        IRepository<TreatmentPlan, Guid> plans,
        IRepository<PatientPayment, Guid> payments,
        IRepository<Invoice, Guid> invoices,
        IRepository<Prescription, Guid> prescriptions,
        IRepository<LaboOrder, Guid> laboOrders,
        IAsyncQueryableExecuter executer,
        IDataFilter dataFilter)
    {
        _appointments = appointments;
        _plans = plans;
        _payments = payments;
        _invoices = invoices;
        _prescriptions = prescriptions;
        _laboOrders = laboOrders;
        _executer = executer;
        _dataFilter = dataFilter;
    }

    /// <summary>The ids among <paramref name="patientIds"/> that something already refers to.</summary>
    public async Task<HashSet<Guid>> WithRecordsAsync(IReadOnlyCollection<Guid> patientIds)
    {
        var found = new HashSet<Guid>();
        if (patientIds.Count == 0)
        {
            return found;
        }

        var ids = patientIds.ToList();
        found.UnionWith(await PatientIdsAsync(_appointments, a => ids.Contains(a.PatientId), a => a.PatientId));
        found.UnionWith(await PatientIdsAsync(_plans, p => ids.Contains(p.PatientId), p => p.PatientId));
        found.UnionWith(await PatientIdsAsync(_invoices, i => ids.Contains(i.PatientId), i => i.PatientId));
        found.UnionWith(await PatientIdsAsync(_prescriptions, p => ids.Contains(p.PatientId), p => p.PatientId));
        found.UnionWith(await PatientIdsAsync(_laboOrders, o => ids.Contains(o.PatientId), o => o.PatientId));

        // A pending or cancelled payment is still money the patient handled.
        using (_dataFilter.Disable<ISettleable>())
        {
            found.UnionWith(await PatientIdsAsync(_payments, p => ids.Contains(p.PatientId), p => p.PatientId));
        }

        return found;
    }

    private async Task<List<Guid>> PatientIdsAsync<T>(
        IRepository<T, Guid> repository,
        Expression<Func<T, bool>> refersTo,
        Expression<Func<T, Guid>> patientId)
        where T : class, IEntity<Guid>
    {
        var query = await repository.GetQueryableAsync();
        return await _executer.ToListAsync(query.Where(refersTo).Select(patientId).Distinct());
    }
}
