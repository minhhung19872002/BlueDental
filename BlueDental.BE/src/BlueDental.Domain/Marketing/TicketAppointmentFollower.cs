using System.Threading.Tasks;
using BlueDental.Appointments;
using Volo.Abp.DependencyInjection;
using Volo.Abp.Domain.Entities.Events;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.EventBus;
using Volo.Abp.Guids;

namespace BlueDental.Marketing;

/// <summary>
/// Keeps a booked ticket in step with its appointment, wherever the
/// appointment is changed from (Lịch hẹn, Tiếp nhận, the missed-booking
/// worker): check-in makes the ticket Đã đến, a cancel or a miss sends it back
/// to Đang chăm sóc. Runs inside the unit of work that changed the appointment.
/// </summary>
public class TicketAppointmentFollower(
    IRepository<Ticket, System.Guid> ticketRepository,
    IRepository<TicketActivity, System.Guid> activityRepository,
    IGuidGenerator guidGenerator)
    : ILocalEventHandler<EntityChangedEventData<Appointment>>, ITransientDependency
{
    public async Task HandleEventAsync(EntityChangedEventData<Appointment> eventData)
    {
        var appointment = eventData.Entity;
        var tickets = await ticketRepository.GetListAsync(t => t.AppointmentId == appointment.Id);
        if (tickets.Count == 0)
        {
            return;
        }

        AppointmentStatus? status = eventData is EntityDeletedEventData<Appointment> || appointment.IsDeleted
            ? null
            : appointment.Status;

        foreach (var ticket in tickets)
        {
            var activity = ticket.FollowAppointment(
                guidGenerator.Create(), appointment.Id, appointment.PatientId, status);
            await ticketRepository.UpdateAsync(ticket);
            if (activity is not null)
            {
                await activityRepository.InsertAsync(activity);
            }
        }
    }
}
