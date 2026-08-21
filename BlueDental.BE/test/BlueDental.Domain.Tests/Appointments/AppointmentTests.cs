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
}
