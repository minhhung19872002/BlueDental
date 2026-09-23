using System;
using Volo.Abp;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.Queue;

public class QueueTicket : FullAuditedAggregateRoot<Guid>
{
    public Guid ClinicBranchId { get; private set; }
    public DateOnly QueueDate { get; private set; }
    public int TicketNumber { get; private set; }
    public string DisplayNumber { get; private set; } = default!;
    public Guid PatientId { get; private set; }
    public Guid? AppointmentId { get; private set; }
    public QueueTicketStatus Status { get; private set; }
    public QueueTicketPriority Priority { get; private set; }
    public string? ServiceType { get; private set; }
    public Guid? DentistId { get; private set; }
    public Guid? CounterId { get; private set; }
    public DateTimeOffset? CalledAt { get; private set; }
    public DateTimeOffset? ServingAt { get; private set; }
    public DateTimeOffset? CompletedAt { get; private set; }
    public DateTimeOffset? SkippedAt { get; private set; }
    public int CallCount { get; private set; }
    public string? Note { get; private set; }

    protected QueueTicket() { }

    public QueueTicket(
        Guid id,
        Guid clinicBranchId,
        DateOnly queueDate,
        int ticketNumber,
        string displayNumber,
        Guid patientId,
        Guid? appointmentId = null,
        QueueTicketPriority priority = QueueTicketPriority.Normal,
        string? serviceType = null,
        Guid? dentistId = null,
        string? note = null,
        Guid? counterId = null)
        : base(id)
    {
        Check.NotNullOrWhiteSpace(displayNumber, nameof(displayNumber));

        ClinicBranchId = clinicBranchId;
        QueueDate = queueDate;
        TicketNumber = ticketNumber;
        DisplayNumber = displayNumber;
        PatientId = patientId;
        AppointmentId = appointmentId;
        Status = QueueTicketStatus.Waiting;
        Priority = priority;
        ServiceType = serviceType;
        DentistId = dentistId;
        Note = note;
        CounterId = counterId;
        CallCount = 0;
    }

    public QueueTicket Call(Guid? counterId = null)
    {
        if (Status is not (QueueTicketStatus.Waiting or QueueTicketStatus.Skipped))
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Queue.InvalidTransition,
                $"Cannot call a ticket in status '{Status}'. Expected 'Waiting' or 'Skipped'.");
        }

        Status = QueueTicketStatus.Called;
        CalledAt = DateTimeOffset.UtcNow;
        CallCount++;
        SkippedAt = null;
        if (counterId.HasValue)
            CounterId = counterId.Value;
        return this;
    }

    public QueueTicket Serve()
    {
        EnsureStatus(QueueTicketStatus.Called, nameof(Serve));
        Status = QueueTicketStatus.Serving;
        ServingAt = DateTimeOffset.UtcNow;
        return this;
    }

    public QueueTicket Complete()
    {
        if (Status is not (QueueTicketStatus.Called or QueueTicketStatus.Serving))
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Queue.InvalidTransition,
                $"Cannot complete a ticket in status '{Status}'. Expected 'Called' or 'Serving'.");
        }

        Status = QueueTicketStatus.Completed;
        CompletedAt = DateTimeOffset.UtcNow;
        return this;
    }

    public QueueTicket Skip()
    {
        if (Status is not (QueueTicketStatus.Waiting or QueueTicketStatus.Called))
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Queue.InvalidTransition,
                $"Cannot skip a ticket in status '{Status}'. Expected 'Waiting' or 'Called'.");
        }

        Status = QueueTicketStatus.Skipped;
        SkippedAt = DateTimeOffset.UtcNow;
        return this;
    }

    public QueueTicket Expire()
    {
        if (Status is QueueTicketStatus.Completed or QueueTicketStatus.Expired)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Queue.InvalidTransition,
                $"Cannot expire a ticket in status '{Status}'.");
        }

        Status = QueueTicketStatus.Expired;
        return this;
    }

    public QueueTicket AssignDentist(Guid dentistId)
    {
        DentistId = dentistId;
        return this;
    }

    private void EnsureStatus(QueueTicketStatus expected, string operation)
    {
        if (Status != expected)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Queue.InvalidTransition,
                $"Cannot perform '{operation}' on ticket with status '{Status}'. Expected '{expected}'.");
        }
    }
}
