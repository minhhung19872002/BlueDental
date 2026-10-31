using System;
using System.Collections.Generic;
using System.Linq;
using Volo.Abp;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.TreatmentManagement;

/// <summary>
/// One dental warranty card ("Bảo hành nha khoa", P3110 REQ-B5): a finished
/// service line's own guarantee, one card per tooth — or one card with no tooth
/// for a line that treats none. Labo cards live on <c>LaboOrderTooth</c>; this
/// is the clinic's half of the warranty.
/// </summary>
public class ServiceWarrantyCard : FullAuditedAggregateRoot<Guid>
{
    /// <summary>"Khác" tops out where a Labo card does: 50 years.</summary>
    public const int MaxMonths = 600;

    public Guid BranchId { get; private set; }
    public Guid PatientId { get; private set; }
    public Guid TreatmentPlanId { get; private set; }
    public Guid TreatmentServiceId { get; private set; }

    /// <summary>FDI number; null on a line that treats no tooth.</summary>
    public int? ToothNumber { get; private set; }

    /// <summary><c>BH-{line code}-{ddMMyyyy start}-{tooth, 00 when none}</c> (owner D4, G5).</summary>
    public string Code { get; private set; } = string.Empty;

    public DateOnly StartDate { get; private set; }
    public DateOnly EndDate { get; private set; }

    /// <summary>A month chip or "Khác"; null when the card follows Danh mục's days.</summary>
    public int? DurationMonths { get; private set; }

    /// <summary>"Theo danh mục · n ngày"; null when months were picked.</summary>
    public int? DurationDays { get; private set; }

    public string? Conditions { get; private set; }
    public DateTimeOffset ActivatedAt { get; private set; }
    public Guid? ActivatedById { get; private set; }

    protected ServiceWarrantyCard() { }

    /// <summary>
    /// "Kích hoạt bảo hành (n răng)" on a finished line: every card is checked
    /// before any is written, so one bad tooth leaves the line untouched.
    /// </summary>
    /// <param name="activatedTeeth">Teeth (null = the toothless card) already carded on this line.</param>
    public static IReadOnlyList<ServiceWarrantyCard> ActivateAll(
        Func<Guid> newId,
        TreatmentService line,
        ServiceWarrantyTerms terms,
        IReadOnlyCollection<int?> activatedTeeth,
        IReadOnlyCollection<ServiceWarrantyActivation> cards,
        DateTimeOffset activatedAt,
        Guid? activatedById)
    {
        Check.NotNull(line, nameof(line));
        if (!line.IsCompleted)
            throw new BusinessException(BlueDentalDomainErrorCodes.TreatmentManagement.WarrantyLineNotDone);
        if (terms.WarrantyDays <= 0)
            throw new BusinessException(BlueDentalDomainErrorCodes.TreatmentManagement.ServiceHasNoWarranty);

        var lineTeeth = line.Teeth.Select(t => (int?)t.ToothCode).ToHashSet();
        if (lineTeeth.Count == 0) lineTeeth.Add(null);
        if (cards.Count == 0
            || cards.Select(c => c.ToothNumber).Distinct().Count() != cards.Count
            || cards.Any(c => !lineTeeth.Contains(c.ToothNumber) || activatedTeeth.Contains(c.ToothNumber)))
            throw new BusinessException(BlueDentalDomainErrorCodes.TreatmentManagement.WarrantyToothInvalid);

        foreach (var card in cards)
        {
            if (card.Months is < 1 or > MaxMonths)
                throw new BusinessException(BlueDentalDomainErrorCodes.TreatmentManagement.WarrantyDurationInvalid);
            if (terms.CompletedOn is { } done && card.StartDate < done)
                throw new BusinessException(BlueDentalDomainErrorCodes.TreatmentManagement.WarrantyStartBeforeCompletion);
        }

        return cards
            .Select(card => new ServiceWarrantyCard(newId(), line, card, terms.WarrantyDays, activatedAt, activatedById))
            .ToList();
    }

    /// <summary>The last day the card covers is past.</summary>
    public bool IsExpiredOn(DateOnly today) => EndDate < today;

    /// <summary>D4: <c>BH-DT01-03-30102026-36</c>.</summary>
    public static string CodeFor(string lineCode, DateOnly startDate, int? toothNumber)
        => $"BH-{lineCode}-{startDate:ddMMyyyy}-{toothNumber ?? 0:D2}";

    private ServiceWarrantyCard(
        Guid id, TreatmentService line, ServiceWarrantyActivation card, int warrantyDays,
        DateTimeOffset activatedAt, Guid? activatedById) : base(id)
    {
        BranchId = line.ClinicBranchId;
        PatientId = line.PatientId;
        TreatmentPlanId = line.TreatmentPlanId;
        TreatmentServiceId = line.Id;
        ToothNumber = card.ToothNumber;
        Code = CodeFor(line.Code, card.StartDate, card.ToothNumber);
        StartDate = card.StartDate;
        DurationMonths = card.Months;
        DurationDays = card.Months.HasValue ? null : warrantyDays;
        EndDate = card.Months is { } months ? card.StartDate.AddMonths(months) : card.StartDate.AddDays(warrantyDays);
        Conditions = string.IsNullOrWhiteSpace(card.Conditions) ? null : card.Conditions.Trim();
        ActivatedAt = activatedAt;
        ActivatedById = activatedById;
    }
}

/// <summary>One tooth's card on the "Bảo hành dịch vụ" popup; null months = "Theo danh mục".</summary>
public record ServiceWarrantyActivation(
    int? ToothNumber,
    DateOnly StartDate,
    int? Months = null,
    string? Conditions = null);

/// <summary>What the line's catalog and its công đoạn say about any card on it.</summary>
/// <param name="WarrantyDays">Danh mục's "Thời gian bảo hành (ngày)".</param>
/// <param name="CompletedOn">The clinic day the line was finished, when known.</param>
public record ServiceWarrantyTerms(int WarrantyDays, DateOnly? CompletedOn);
