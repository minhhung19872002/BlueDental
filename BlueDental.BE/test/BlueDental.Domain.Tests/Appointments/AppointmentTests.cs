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

        appointment.Confirm();
        appointment.CheckIn();
        appointment.Start();
        appointment.Complete();

        // Cannot start a completed appointment
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
        appointment.Cancel(CancellationReason.PatientRequest, "sick");
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

        appointment.ChangeStatus(AppointmentStatus.Cancelled, CancellationReason.PatientNoResponse, " no answer ");

        Assert.Equal(AppointmentStatus.Cancelled, appointment.Status);
        Assert.Equal(CancellationReason.PatientNoResponse, appointment.CancellationReason);
        Assert.Equal("no answer", appointment.CancellationNote);
    }

    /// <summary>Bug list #16: a cancel without a written reason is refused.</summary>
    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Cancel_Should_Require_A_Reason(string? note)
    {
        var appointment = NewAppointment();

        var ex = Assert.Throws<BusinessException>(() => appointment.Cancel(CancellationReason.PatientRequest, note));
        Assert.Equal(BlueDentalDomainErrorCodes.Appointments.CancellationReasonRequired, ex.Code);
        Assert.Throws<BusinessException>(() =>
            appointment.ChangeStatus(AppointmentStatus.Cancelled, CancellationReason.PatientRequest, note));
        Assert.Equal(AppointmentStatus.Requested, appointment.Status);
        Assert.Null(appointment.CancelledAt);
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

        appointment.ChangeStatus(AppointmentStatus.Cancelled, CancellationReason.PatientRequest, "busy");
        appointment.ChangeStatus(AppointmentStatus.NoShow, CancellationReason.PatientRequest);
        Assert.Equal(AppointmentStatus.NoShow, appointment.Status);
        Assert.Null(appointment.CancellationReason);

        appointment.ChangeStatus(AppointmentStatus.Cancelled, CancellationReason.Other, "moved away");
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

    [Fact]
    public void BookFollowUp_Should_Book_The_Next_Visit_And_Link_It()
    {
        var appointment = NewAppointment();
        appointment.Complete();
        var nextSlot = new AppointmentSlot(DateTime.UtcNow.AddDays(7), DateTime.UtcNow.AddDays(7).AddMinutes(30));
        var followUpId = Guid.NewGuid();

        var followUp = appointment.BookFollowUp(followUpId, nextSlot, null, chiefComplaint: "Tai kham");

        Assert.Equal(AppointmentOutcome.FollowUp, appointment.Outcome);
        Assert.Equal(followUpId, appointment.FollowUpAppointmentId);
        Assert.Equal(followUpId, followUp.Id);
        Assert.Equal(_patientId, followUp.PatientId);
        Assert.Equal(_dentistId, followUp.DentistId);
        Assert.Equal(_branchId, followUp.BranchId);
        Assert.Equal(AppointmentType.FollowUp, followUp.Type);
        Assert.Equal(AppointmentStatus.Requested, followUp.Status);
        Assert.Equal("Tai kham", followUp.ChiefComplaint);
    }

    [Fact]
    public void BookFollowUp_Should_Use_The_Named_Dentist()
    {
        var appointment = NewAppointment();
        var otherDentist = Guid.NewGuid();

        var followUp = appointment.BookFollowUp(Guid.NewGuid(), _slot, null, otherDentist);

        Assert.Equal(otherDentist, followUp.DentistId);
        Assert.Equal(_dentistId, appointment.DentistId);
    }

    [Fact]
    public void BookFollowUp_Should_Refuse_A_Second_Live_Follow_Up()
    {
        var appointment = NewAppointment();
        var first = appointment.BookFollowUp(Guid.NewGuid(), _slot, null);

        Assert.Throws<BusinessException>(() => appointment.BookFollowUp(Guid.NewGuid(), _slot, first));
    }

    [Fact]
    public void BookFollowUp_Should_Replace_A_Cancelled_Follow_Up()
    {
        var appointment = NewAppointment();
        var first = appointment.BookFollowUp(Guid.NewGuid(), _slot, null);
        first.Cancel(CancellationReason.PatientRequest, "sick");
        var secondId = Guid.NewGuid();

        appointment.BookFollowUp(secondId, _slot, first);

        Assert.Equal(secondId, appointment.FollowUpAppointmentId);
    }

    [Fact]
    public void BookFollowUp_Should_Refuse_A_Cancelled_Visit()
    {
        var appointment = NewAppointment();
        appointment.Cancel(CancellationReason.PatientRequest, "sick");

        Assert.Throws<BusinessException>(() => appointment.BookFollowUp(Guid.NewGuid(), _slot, null));
        Assert.Null(appointment.FollowUpAppointmentId);
    }

    [Fact]
    public void BookFollowUp_Should_Stop_A_Revisit_Before_The_Chair_At_Step_Two()
    {
        var appointment = NewAppointment();
        appointment.CheckIn();
        var followUpId = Guid.NewGuid();

        appointment.BookFollowUp(followUpId, _slot, null, outcome: AppointmentOutcome.Revisit);

        Assert.Equal(AppointmentOutcome.Revisit, appointment.Outcome);
        Assert.Equal(followUpId, appointment.FollowUpAppointmentId);
        Assert.Equal(AppointmentStatus.InProgress, appointment.Status);
        Assert.NotNull(appointment.StartedAt);
        Assert.Null(appointment.CompletedAt);
    }

    [Fact]
    public void BookFollowUp_Should_Finish_A_Revisit_In_The_Chair_At_Step_Three()
    {
        var appointment = NewAppointment();
        appointment.Start();

        appointment.BookFollowUp(Guid.NewGuid(), _slot, null, outcome: AppointmentOutcome.Revisit);

        Assert.Equal(AppointmentStatus.Completed, appointment.Status);
        Assert.NotNull(appointment.CompletedAt);
    }

    [Fact]
    public void BookFollowUp_Should_Leave_The_Bar_Alone_For_A_Follow_Up()
    {
        var appointment = NewAppointment();

        appointment.BookFollowUp(Guid.NewGuid(), _slot, null);

        Assert.Equal(AppointmentOutcome.FollowUp, appointment.Outcome);
        Assert.Null(appointment.CompletedAt);
    }

    [Theory]
    [InlineData(AppointmentOutcome.EndTreatment)]
    [InlineData(AppointmentOutcome.TransferDoctor)]
    public void BookFollowUp_Should_Refuse_An_Outcome_Without_A_Next_Visit(AppointmentOutcome outcome)
    {
        var appointment = NewAppointment();

        Assert.Throws<BusinessException>(() => appointment.BookFollowUp(Guid.NewGuid(), _slot, null, outcome: outcome));
        Assert.Null(appointment.FollowUpAppointmentId);
    }

    [Fact]
    public void AttachPatient_Turns_A_Temporary_Appointment_Into_The_Patients()
    {
        var appointment = Appointment.CreateTemporary(
            Guid.NewGuid(), "Khach tam", "0900000000", _branchId, _slot, _dentistId);

        appointment.AttachPatient(_patientId);

        Assert.False(appointment.IsTemporary);
        Assert.Equal(_patientId, appointment.PatientId);
        Assert.Null(appointment.PatientName);
        Assert.Null(appointment.PatientPhone);
    }

    [Fact]
    public void AttachPatient_Refuses_An_Appointment_That_Is_Not_Temporary()
    {
        var appointment = NewAppointment();

        var ex = Assert.Throws<BusinessException>(() => appointment.AttachPatient(Guid.NewGuid()));
        Assert.Equal(BlueDentalDomainErrorCodes.Appointments.NotTemporary, ex.Code);
    }

    /// <summary>
    /// Bug list item 17: a booking turns Trễ hẹn as soon as its start time
    /// passes without an arrival — no grace (owner 2026-10-06).
    /// </summary>
    [Fact]
    public void IsMissedAt_Should_Hold_As_Soon_As_The_Start_Time_Passes()
    {
        var appointment = NewAppointment();

        Assert.False(appointment.IsMissedAt(_slot.Start.AddSeconds(-1)));
        Assert.True(appointment.IsMissedAt(_slot.Start));

        appointment.Confirm();
        Assert.True(appointment.IsMissedAt(_slot.End.AddHours(1)));
    }

    [Fact]
    public void IsMissedAt_Should_Not_Hold_For_An_Arrived_Cancelled_Or_Already_Late_Booking()
    {
        var after = _slot.End.AddHours(1);

        var arrived = NewAppointment();
        arrived.CheckIn();
        Assert.False(arrived.IsMissedAt(after));

        var cancelled = NewAppointment();
        cancelled.Cancel(CancellationReason.PatientRequest);
        Assert.False(cancelled.IsMissedAt(after));

        var late = NewAppointment();
        late.MarkNoShow();
        Assert.False(late.IsMissedAt(after));
    }

    [Fact]
    public void CheckIn_Should_Receive_A_Patient_Who_Arrives_After_Being_Marked_Late()
    {
        var appointment = NewAppointment();
        appointment.MarkNoShow();

        appointment.CheckIn();

        Assert.Equal(AppointmentStatus.CheckedIn, appointment.Status);
        Assert.NotNull(appointment.CheckedInAt);
    }

    private Appointment NewAppointment() =>
        new(Guid.NewGuid(), _patientId, _dentistId, _branchId, _slot, AppointmentType.Consultation);
}
