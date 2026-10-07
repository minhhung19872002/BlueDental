using System;
using BlueDental.Appointments;
using Shouldly;
using Volo.Abp;
using Xunit;

namespace BlueDental.Marketing;

/// <summary>
/// Marketing → Ticket (F-55): Mới → Đang chăm sóc → Đã đặt hẹn → Đã đến,
/// Không tiềm năng by hand, the SLA clock, and following the booked appointment.
/// </summary>
public class TicketTests
{
    private static readonly DateTime Now = new(2026, 10, 7, 2, 0, 0, DateTimeKind.Utc);
    private readonly Guid _branchId = Guid.NewGuid();
    private readonly Guid _callerId = Guid.NewGuid();
    private readonly Guid _appointmentId = Guid.NewGuid();

    private Ticket NewTicket(Guid? assigneeId = null) =>
        Ticket.Create(Guid.NewGuid(), Guid.NewGuid(), _branchId, "TK000001",
            new TicketDetails("  Khách thử  ", "+84 912 345 678", null, null, null, Guid.NewGuid()),
            TicketChannel.Manual, assigneeId, Now).Ticket;

    private Ticket Booked()
    {
        var ticket = NewTicket();
        ticket.MarkBooked(Guid.NewGuid(), _appointmentId);
        return ticket;
    }

    [Fact]
    public void A_New_Ticket_Is_Mới_With_A_Normalised_Phone_And_A_Created_Line()
    {
        var (ticket, activity) = Ticket.Create(Guid.NewGuid(), Guid.NewGuid(), _branchId, "TK000001",
            new TicketDetails("  Khách thử  ", "+84 912.345-678", " ", null, null, Guid.NewGuid()),
            TicketChannel.Website, null, Now);

        ticket.Status.ShouldBe(TicketStatus.New);
        ticket.FullName.ShouldBe("Khách thử");
        ticket.Phone.ShouldBe("0912345678");
        ticket.Email.ShouldBeNull();
        ticket.SourceEntryId.ShouldBeNull(); // a channel without its source group is dropped
        ticket.AssigneeId.ShouldBeNull();
        ticket.ReceivedAt.ShouldBe(Now);
        activity.Kind.ShouldBe(TicketActivityKind.Created);
        activity.FromStatus.ShouldBeNull();
        activity.ToStatus.ShouldBe(TicketStatus.New);
    }

    [Theory]
    [InlineData("0912345678", "0912345678")]
    [InlineData("84912345678", "0912345678")]
    [InlineData("(091) 234-5678", "0912345678")]
    [InlineData("02812345678", "02812345678")]
    public void Phones_Are_Normalised(string raw, string expected)
    {
        TicketPhone.Normalize(raw).ShouldBe(expected);
    }

    [Theory]
    [InlineData("")]
    [InlineData("12345")]
    [InlineData("091234567a")]
    [InlineData("091234567890")]
    public void A_Bad_Phone_Is_Refused(string raw)
    {
        Should.Throw<BusinessException>(() => TicketPhone.Normalize(raw))
            .Code.ShouldBe(BlueDentalDomainErrorCodes.MarketingTicket.InvalidPhone);
    }

    [Fact]
    public void Phone_Variants_Cover_The_Spellings_Patients_Keep()
    {
        TicketPhone.Variants("0912345678").ShouldBe(["0912345678", "+84912345678", "84912345678"]);
    }

    [Fact]
    public void The_First_Contact_Moves_Mới_To_Đang_Chăm_Sóc_And_Claims_A_Pool_Ticket()
    {
        var ticket = NewTicket();

        var activity = ticket.RecordContact(Guid.NewGuid(), _callerId, TicketContactResult.Interested, " hỏi giá ", null, Now);

        ticket.Status.ShouldBe(TicketStatus.InCare);
        ticket.AssigneeId.ShouldBe(_callerId);
        ticket.ContactCount.ShouldBe(1);
        ticket.LastContactResult.ShouldBe(TicketContactResult.Interested);
        activity.FromStatus.ShouldBe(TicketStatus.New);
        activity.ToStatus.ShouldBe(TicketStatus.InCare);
        activity.Note.ShouldBe("hỏi giá");
    }

    [Fact]
    public void A_Later_Contact_Keeps_The_Owner_And_Writes_No_Status_Change()
    {
        var owner = Guid.NewGuid();
        var ticket = NewTicket(owner);
        ticket.RecordContact(Guid.NewGuid(), owner, TicketContactResult.NoAnswer, null, null, Now);

        var activity = ticket.RecordContact(Guid.NewGuid(), _callerId, TicketContactResult.NoAnswer, null, null, Now);

        ticket.AssigneeId.ShouldBe(owner);
        ticket.ContactCount.ShouldBe(2);
        activity.FromStatus.ShouldBeNull();
        activity.ToStatus.ShouldBeNull();
    }

    [Fact]
    public void A_Call_Back_Needs_A_Future_Time_And_Is_Cleared_By_The_Next_Result()
    {
        var ticket = NewTicket();

        Should.Throw<BusinessException>(() =>
                ticket.RecordContact(Guid.NewGuid(), _callerId, TicketContactResult.CallBack, null, Now, Now))
            .Code.ShouldBe(BlueDentalDomainErrorCodes.MarketingTicket.CallBackTimeRequired);

        ticket.RecordContact(Guid.NewGuid(), _callerId, TicketContactResult.CallBack, null, Now.AddHours(3), Now);
        ticket.NextCallAt.ShouldBe(Now.AddHours(3));

        ticket.RecordContact(Guid.NewGuid(), _callerId, TicketContactResult.Interested, null, Now.AddHours(5), Now);
        ticket.NextCallAt.ShouldBeNull();
    }

    [Fact]
    public void The_Deadline_Is_The_Shortest_Tag_Time_And_Restarts_On_Assignment()
    {
        var ticket = NewTicket();
        ticket.DueAt.ShouldBeNull();

        ticket.SetTags([Guid.NewGuid(), Guid.NewGuid()], processingDays: 2);
        ticket.DueAt.ShouldBe(Now.AddDays(2));
        ticket.IsOverdue(Now.AddDays(2).AddMinutes(1)).ShouldBeTrue();

        ticket.Assign(Guid.NewGuid(), _callerId, Now.AddDays(1));
        ticket.DueAt.ShouldBe(Now.AddDays(3));
        ticket.IsOverdue(Now.AddDays(2).AddMinutes(1)).ShouldBeFalse();
    }

    [Fact]
    public void A_Booked_Ticket_Is_Never_Overdue()
    {
        var ticket = NewTicket();
        ticket.SetTags([Guid.NewGuid()], processingDays: 1);
        ticket.MarkBooked(Guid.NewGuid(), _appointmentId);

        ticket.IsOverdue(Now.AddDays(5)).ShouldBeFalse();
    }

    [Fact]
    public void Không_Tiềm_Năng_Needs_A_Reason_Closes_The_Ticket_And_Can_Be_Reopened()
    {
        var ticket = NewTicket();
        Should.Throw<ArgumentException>(() => ticket.MarkNotPotential(Guid.NewGuid(), " "));

        ticket.MarkNotPotential(Guid.NewGuid(), " Không có nhu cầu ");
        ticket.Status.ShouldBe(TicketStatus.NotPotential);
        ticket.NotPotentialReason.ShouldBe("Không có nhu cầu");
        ticket.IsOpen.ShouldBeFalse();
        Should.Throw<BusinessException>(() =>
                ticket.RecordContact(Guid.NewGuid(), _callerId, TicketContactResult.Interested, null, null, Now))
            .Code.ShouldBe(BlueDentalDomainErrorCodes.MarketingTicket.TicketClosed);

        ticket.Reopen(Guid.NewGuid());
        ticket.Status.ShouldBe(TicketStatus.InCare);
        ticket.NotPotentialReason.ShouldBeNull();
    }

    [Fact]
    public void Only_Mới_Or_Đang_Chăm_Sóc_Can_Be_Booked_Or_Closed()
    {
        var ticket = Booked();

        Should.Throw<BusinessException>(() => ticket.MarkBooked(Guid.NewGuid(), Guid.NewGuid()))
            .Code.ShouldBe(BlueDentalDomainErrorCodes.MarketingTicket.InvalidTransition);
        Should.Throw<BusinessException>(() => ticket.MarkNotPotential(Guid.NewGuid(), "x"))
            .Code.ShouldBe(BlueDentalDomainErrorCodes.MarketingTicket.InvalidTransition);
        Should.Throw<BusinessException>(() => ticket.Reopen(Guid.NewGuid()))
            .Code.ShouldBe(BlueDentalDomainErrorCodes.MarketingTicket.InvalidTransition);
    }

    [Theory]
    [InlineData(AppointmentStatus.CheckedIn)]
    [InlineData(AppointmentStatus.InProgress)]
    [InlineData(AppointmentStatus.Completed)]
    public void A_Checked_In_Appointment_Makes_The_Ticket_Đã_Đến(AppointmentStatus status)
    {
        var ticket = Booked();
        var patientId = Guid.NewGuid();

        var activity = ticket.FollowAppointment(Guid.NewGuid(), _appointmentId, patientId, status);

        ticket.Status.ShouldBe(TicketStatus.Arrived);
        ticket.PatientId.ShouldBe(patientId);
        activity.ShouldNotBeNull();
        activity.Kind.ShouldBe(TicketActivityKind.AppointmentChanged);
        activity.AppointmentId.ShouldBe(_appointmentId);
    }

    [Theory]
    [InlineData(AppointmentStatus.Cancelled)]
    [InlineData(AppointmentStatus.NoShow)]
    [InlineData(null)]
    public void A_Cancelled_Missed_Or_Deleted_Appointment_Returns_The_Ticket_To_Care(AppointmentStatus? status)
    {
        var ticket = Booked();

        ticket.FollowAppointment(Guid.NewGuid(), _appointmentId, Guid.Empty, status).ShouldNotBeNull();

        ticket.Status.ShouldBe(TicketStatus.InCare);
        ticket.AppointmentId.ShouldBe(_appointmentId);
        ticket.PatientId.ShouldBeNull();
    }

    [Fact]
    public void A_Restored_Appointment_Books_The_Ticket_Again_And_A_Late_Check_In_Still_Counts()
    {
        var ticket = Booked();
        ticket.FollowAppointment(Guid.NewGuid(), _appointmentId, Guid.Empty, AppointmentStatus.NoShow);

        ticket.FollowAppointment(Guid.NewGuid(), _appointmentId, Guid.Empty, AppointmentStatus.Confirmed);
        ticket.Status.ShouldBe(TicketStatus.Booked);

        ticket.FollowAppointment(Guid.NewGuid(), _appointmentId, Guid.Empty, AppointmentStatus.NoShow);
        ticket.FollowAppointment(Guid.NewGuid(), _appointmentId, Guid.Empty, AppointmentStatus.CheckedIn);
        ticket.Status.ShouldBe(TicketStatus.Arrived);
    }

    [Fact]
    public void Other_Appointments_And_Closed_Tickets_Are_Left_Alone()
    {
        var ticket = Booked();
        ticket.FollowAppointment(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), AppointmentStatus.CheckedIn).ShouldBeNull();
        ticket.Status.ShouldBe(TicketStatus.Booked);

        ticket.FollowAppointment(Guid.NewGuid(), _appointmentId, Guid.Empty, AppointmentStatus.CheckedIn);
        ticket.FollowAppointment(Guid.NewGuid(), _appointmentId, Guid.Empty, AppointmentStatus.Cancelled).ShouldBeNull();
        ticket.Status.ShouldBe(TicketStatus.Arrived);

        var closed = NewTicket();
        closed.MarkNotPotential(Guid.NewGuid(), "x");
        closed.FollowAppointment(Guid.NewGuid(), Guid.Empty, Guid.Empty, AppointmentStatus.CheckedIn).ShouldBeNull();
    }

    [Fact]
    public void Delete_Records_Its_Reason_And_Restore_Clears_It()
    {
        var ticket = NewTicket();

        ticket.MarkDeleted(Guid.NewGuid(), " Trùng ").Note.ShouldBe("Trùng");
        ticket.DeleteReason.ShouldBe("Trùng");

        ticket.Restore(Guid.NewGuid()).Kind.ShouldBe(TicketActivityKind.Restored);
        ticket.IsDeleted.ShouldBeFalse();
        ticket.DeleteReason.ShouldBeNull();
    }
}
