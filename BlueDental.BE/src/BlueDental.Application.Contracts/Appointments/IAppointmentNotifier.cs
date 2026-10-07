using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace BlueDental.Appointments;

/// <summary>
/// Tells open screens that bookings turned Trễ hẹn without anyone saving them
/// — their time passed with no arrival — so they refetch and say so instead of
/// waiting for a reload. Carries only ids: each screen reads the bookings back
/// through the API, which applies its own branch and permission checks.
/// </summary>
public interface IAppointmentNotifier
{
    Task NotifyMarkedLateAsync(IReadOnlyCollection<LateAppointmentBatch> batches);
}

/// <summary>The bookings of one branch that one pass moved to Trễ hẹn.</summary>
public record LateAppointmentBatch(Guid BranchId, IReadOnlyList<Guid> AppointmentIds);
