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

    [Fact]
    public void Should_Open_With_Default_Colour_And_Carry_The_Note()
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
            "Benh nhan hen buoi chieu");

        Assert.Equal(AppointmentColor.Default, appointment.Color);
        Assert.Equal("Benh nhan hen buoi chieu", appointment.Notes);
    }

    /// <summary>
    /// The booking form edits the reason, the note and the colour in the same
    /// submit as it moves the slot. Rescheduling alone used to be everything the
    /// update did, so those three were silently dropped.
    /// </summary>
    [Fact]
    public void SetDetails_Should_Revise_Reason_Note_And_Colour()
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

        appointment.SetDetails("Nieng rang", "Goi truoc mot ngay", AppointmentColor.Green);

        Assert.Equal("Nieng rang", appointment.ChiefComplaint);
        Assert.Equal("Goi truoc mot ngay", appointment.Notes);
        Assert.Equal(AppointmentColor.Green, appointment.Color);
    }

    [Fact]
    public void SetDetails_Should_Be_Allowed_In_Any_Status()
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

        appointment.SetDetails("Da doi", null, AppointmentColor.Red);

        Assert.Equal("Da doi", appointment.ChiefComplaint);
        Assert.Equal(AppointmentColor.Red, appointment.Color);
        Assert.Equal(AppointmentStatus.InProgress, appointment.Status);
    }
}
