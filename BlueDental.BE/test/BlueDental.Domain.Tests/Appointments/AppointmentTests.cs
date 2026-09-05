using System;
using BlueDental.Appointments.Values;
using Volo.Abp;
using Xunit;

namespace BlueDental.Appointments;

public class AppointmentTests
{
    private readonly Guid _patientId = Guid.NewGuid();
    private readonly Guid _dentistId = Guid.NewGuid();
    private readonly Guid _branchId = Guid.NewGuid();
    private readonly AppointmentSlot _slot = new(DateTime.UtcNow.AddHours(1), DateTime.UtcNow.AddHours(2));

    [Fact]
    public void Should_Create_Appointment_With_Requested_Status()
    {
        var appointment = new Appointment(
            Guid.NewGuid(),
            _patientId,
            _dentistId,
            _branchId,
            _slot,
            AppointmentType.Consultation,
            null,
            "Kiem tra rang");

        Assert.Equal(AppointmentStatus.Requested, appointment.Status);
        Assert.Equal(_patientId, appointment.PatientId);
        Assert.Equal(_dentistId, appointment.DentistId);
    }

    [Fact]
    public void Should_Transition_Lifecycle_Correctly()
    {
        var appointment = new Appointment(
            Guid.NewGuid(),
            _patientId,
            _dentistId,
            _branchId,
            _slot,
            AppointmentType.Consultation);

        // Requested -> Confirmed
        appointment.Confirm();
        Assert.Equal(AppointmentStatus.Confirmed, appointment.Status);

        // Confirmed -> CheckedIn
        appointment.CheckIn();
        Assert.Equal(AppointmentStatus.CheckedIn, appointment.Status);
        Assert.NotNull(appointment.CheckedInAt);

        // CheckedIn -> InProgress
        appointment.Start();
        Assert.Equal(AppointmentStatus.InProgress, appointment.Status);
        Assert.NotNull(appointment.StartedAt);

        // InProgress -> Completed
        appointment.Complete("Kiem tra hoan tat");
        Assert.Equal(AppointmentStatus.Completed, appointment.Status);
        Assert.NotNull(appointment.CompletedAt);
    }

    [Fact]
    public void Should_Throw_When_Invalid_Transition()
    {
        var appointment = new Appointment(
            Guid.NewGuid(),
            _patientId,
            _dentistId,
            _branchId,
            _slot,
            AppointmentType.Consultation);

        // Cannot start directly from Requested
        Assert.Throws<BusinessException>(() => appointment.Start());
    }

    /// <summary>
    /// The booking dialog picks a swatch and may leave a note; both ride along
    /// with the appointment from the moment it is created. The colour is stored
    /// as the swatch key, so it round-trips unchanged.
    /// </summary>
    [Fact]
    public void Should_Carry_The_Colour_And_The_Note_From_Creation()
    {
        var appointment = new Appointment(
            Guid.NewGuid(),
            _patientId,
            _dentistId,
            _branchId,
            _slot,
            AppointmentType.Consultation,
            null,
            "Kiem tra rang",
            "green",
            "Benh nhan hen buoi chieu");

        Assert.Equal("green", appointment.Color);
        Assert.Equal("Benh nhan hen buoi chieu", appointment.Notes);
    }

    /// <summary>
    /// The booking form edits the reason, the note and the colour in the same
    /// submit as it moves the slot, so rescheduling alone is not enough.
    /// </summary>
    [Fact]
    public void UpdateDetails_Should_Revise_Reason_Note_And_Colour()
    {
        var appointment = new Appointment(
            Guid.NewGuid(),
            _patientId,
            _dentistId,
            _branchId,
            _slot,
            AppointmentType.Consultation,
            null,
            "Kham tong quat");

        appointment.UpdateDetails("Nieng rang", "Goi truoc mot ngay", "orange");

        Assert.Equal("Nieng rang", appointment.ChiefComplaint);
        Assert.Equal("Goi truoc mot ngay", appointment.Notes);
        Assert.Equal("orange", appointment.Color);
    }

    /// <summary>None of those three is part of the workflow, so any status may
    /// be edited.</summary>
    [Fact]
    public void UpdateDetails_Should_Be_Allowed_In_Any_Status()
    {
        var appointment = new Appointment(
            Guid.NewGuid(),
            _patientId,
            _dentistId,
            _branchId,
            _slot,
            AppointmentType.Consultation);

        appointment.Confirm();
        appointment.CheckIn();
        appointment.Start();

        appointment.UpdateDetails("Da doi", null, "red");

        Assert.Equal("Da doi", appointment.ChiefComplaint);
        Assert.Equal("red", appointment.Color);
        Assert.Equal(AppointmentStatus.InProgress, appointment.Status);
    }

    /// <summary>
    /// Saving the edit dialog always goes through Reschedule, and the dialog
    /// states the status separately. Moving a booking therefore never changes
    /// its status on its own: a late appointment moved to next week is still
    /// late, and editing the note of one does not put it back on the book.
    /// </summary>
    [Fact]
    public void Reschedule_Should_Keep_The_Status_When_Nothing_Moved()
    {
        var appointment = NewAppointment();
        appointment.MarkNoShow();

        appointment.Reschedule(new AppointmentSlot(_slot.Start, _slot.End), _dentistId);

        Assert.Equal(AppointmentStatus.NoShow, appointment.Status);
    }

    [Fact]
    public void Reschedule_Should_Keep_A_Checked_In_Patient_Checked_In()
    {
        var appointment = NewAppointment();
        appointment.Confirm();
        appointment.CheckIn();

        appointment.Reschedule(_slot);

        Assert.Equal(AppointmentStatus.CheckedIn, appointment.Status);
    }

    [Fact]
    public void Reschedule_Should_Move_A_Late_Appointment_And_Leave_It_Late()
    {
        var appointment = NewAppointment();
        appointment.MarkNoShow();
        var later = new AppointmentSlot(_slot.Start.AddDays(1), _slot.End.AddDays(1));

        appointment.Reschedule(later, Guid.NewGuid());

        Assert.Equal(AppointmentStatus.NoShow, appointment.Status);
        Assert.Equal(later.Start, appointment.Slot.Start);
    }

    [Fact]
    public void Reschedule_Should_Move_A_Cancelled_Appointment()
    {
        var appointment = NewAppointment();
        appointment.Cancel(CancellationReason.PatientRequest);
        var later = new AppointmentSlot(_slot.Start.AddDays(1), _slot.End.AddDays(1));

        appointment.Reschedule(later);

        Assert.Equal(AppointmentStatus.Cancelled, appointment.Status);
        Assert.Equal(later.Start, appointment.Slot.Start);
    }

    [Fact]
    public void Reschedule_Should_Refuse_To_Move_A_Visit_In_The_Chair()
    {
        var appointment = NewAppointment();
        appointment.Confirm();
        appointment.CheckIn();
        appointment.Start();

        Assert.Throws<BusinessException>(() =>
            appointment.Reschedule(new AppointmentSlot(_slot.Start.AddDays(1), _slot.End.AddDays(1))));
    }

    /// <summary>
    /// Trạng thái in the edit dialog always offers Đã hẹn, Đã huỷ and Trễ hẹn,
    /// whatever the appointment is now.
    /// </summary>
    [Fact]
    public void ChangeStatus_Should_Cancel_With_The_Given_Reason()
    {
        var appointment = NewAppointment();

        appointment.ChangeStatus(AppointmentStatus.Cancelled, CancellationReason.PatientNoResponse);

        Assert.Equal(AppointmentStatus.Cancelled, appointment.Status);
        Assert.Equal(CancellationReason.PatientNoResponse, appointment.CancellationReason);
    }

    [Fact]
    public void ChangeStatus_Should_Mark_No_Show()
    {
        var appointment = NewAppointment();
        appointment.Confirm();

        appointment.ChangeStatus(AppointmentStatus.NoShow, CancellationReason.PatientRequest);

        Assert.Equal(AppointmentStatus.NoShow, appointment.Status);
    }

    [Fact]
    public void ChangeStatus_Should_Do_Nothing_Within_The_Same_Group()
    {
        var booked = NewAppointment();
        booked.Confirm();
        booked.ChangeStatus(AppointmentStatus.Requested, CancellationReason.PatientRequest);
        Assert.Equal(AppointmentStatus.Confirmed, booked.Status);

        var done = NewAppointment();
        done.Confirm();
        done.CheckIn();
        done.Start();
        done.Complete();
        done.ChangeStatus(AppointmentStatus.InProgress, CancellationReason.PatientRequest);
        Assert.Equal(AppointmentStatus.Completed, done.Status);
    }

    [Fact]
    public void ChangeStatus_Should_Put_A_Cancelled_Appointment_Back_On_The_Book()
    {
        var appointment = NewAppointment();
        appointment.Cancel(CancellationReason.PatientRequest, "sick");

        appointment.ChangeStatus(AppointmentStatus.Requested, CancellationReason.PatientRequest);

        Assert.Equal(AppointmentStatus.Confirmed, appointment.Status);
        Assert.Null(appointment.CancellationReason);
        Assert.Null(appointment.CancellationNote);
    }

    [Fact]
    public void ChangeStatus_Should_Put_A_Late_Appointment_Back_On_The_Book()
    {
        var appointment = NewAppointment();
        appointment.MarkNoShow();

        appointment.ChangeStatus(AppointmentStatus.Confirmed, CancellationReason.PatientRequest);

        Assert.Equal(AppointmentStatus.Confirmed, appointment.Status);
    }

    [Fact]
    public void ChangeStatus_Should_Move_Between_Cancelled_And_Late()
    {
        var appointment = NewAppointment();

        appointment.ChangeStatus(AppointmentStatus.Cancelled, CancellationReason.PatientRequest);
        appointment.ChangeStatus(AppointmentStatus.NoShow, CancellationReason.PatientRequest);
        Assert.Equal(AppointmentStatus.NoShow, appointment.Status);
        Assert.Null(appointment.CancellationReason);

        appointment.ChangeStatus(AppointmentStatus.Cancelled, CancellationReason.Other);
        Assert.Equal(AppointmentStatus.Cancelled, appointment.Status);
        Assert.Equal(CancellationReason.Other, appointment.CancellationReason);
    }

    [Fact]
    public void ChangeStatus_Should_Refuse_The_Arrival_Statuses()
    {
        var appointment = NewAppointment();

        Assert.Throws<BusinessException>(() =>
            appointment.ChangeStatus(AppointmentStatus.CheckedIn, CancellationReason.PatientRequest));
    }

    [Fact]
    public void ChangeStatus_Should_Not_Undo_An_Arrival()
    {
        var appointment = NewAppointment();
        appointment.Confirm();
        appointment.CheckIn();

        Assert.Throws<BusinessException>(() =>
            appointment.ChangeStatus(AppointmentStatus.Requested, CancellationReason.PatientRequest));
        Assert.Throws<BusinessException>(() =>
            appointment.ChangeStatus(AppointmentStatus.NoShow, CancellationReason.PatientRequest));
        Assert.Equal(AppointmentStatus.CheckedIn, appointment.Status);
    }

    private Appointment NewAppointment() =>
        new(Guid.NewGuid(), _patientId, _dentistId, _branchId, _slot, AppointmentType.Consultation);
}
