using System;
using Volo.Abp;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.Marketing;

/// <summary>
/// Thẻ ticket — a label a branch puts on its leads, optionally with
/// Thời gian xử lý: the days a ticket wearing it has to be booked in.
/// </summary>
public class TicketTag : FullAuditedAggregateRoot<Guid>
{
    public const int MaxNameLength = 100;
    public const int MaxColorLength = 20;
    public const int MaxProcessingDaysLimit = 365;

    public Guid ClinicBranchId { get; private set; }

    public string Name { get; private set; } = string.Empty;

    /// <summary>#RRGGBB.</summary>
    public string Color { get; private set; } = string.Empty;

    public int? MaxProcessingDays { get; private set; }

    protected TicketTag() { }

    public TicketTag(Guid id, Guid clinicBranchId, string name, string color, int? maxProcessingDays)
        : base(id)
    {
        ClinicBranchId = clinicBranchId;
        Update(name, color, maxProcessingDays);
    }

    public TicketTag Update(string name, string color, int? maxProcessingDays)
    {
        Name = Check.NotNullOrWhiteSpace(name, nameof(name), MaxNameLength).Trim();
        Color = Check.NotNullOrWhiteSpace(color, nameof(color), MaxColorLength).Trim();
        if (maxProcessingDays is < 1 or > MaxProcessingDaysLimit)
        {
            throw new ArgumentOutOfRangeException(nameof(maxProcessingDays));
        }

        MaxProcessingDays = maxProcessingDays;
        return this;
    }
}
