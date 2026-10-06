using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace BlueDental.Appointments;

/// <summary>
/// Tells open screens that appointments of a branch changed without anyone
/// saving them — e.g. bookings turning Trễ hẹn when their time passes — so
/// they refetch instead of waiting for a reload. Carries only branch ids.
/// </summary>
public interface IAppointmentNotifier
{
    Task NotifyAppointmentsChangedAsync(IReadOnlyCollection<Guid> branchIds);
}
