using System;
using System.Collections.Generic;
using System.Linq;
using Volo.Abp;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.TreatmentManagement;

/// <summary>
/// The price a báo giá quotes one consulting line at: its own copy, so a
/// discount changed on "BG 1" moves BG 1's figures and nobody else's.
/// </summary>
public sealed record QuoteLinePricing(
    decimal Price,
    int Quantity,
    DiscountType DiscountType,
    decimal DiscountValue)
{
    public static QuoteLinePricing Of(PatientAdvise advise) =>
        new(advise.Price, advise.Quantity, advise.DiscountType, advise.DiscountValue);

    public decimal Gross => AdvisePricing.Gross(Price, Quantity);

    public void EnsureValid()
    {
        AdvisePricing.EnsurePricingValid(Price, Quantity);
        AdvisePricing.EnsureDiscountValid(Gross, DiscountType, DiscountValue);
    }
}

/// <summary>
/// One line of a báo giá: the consulting line it quotes, whether it is ticked,
/// where it sits in the quote's own order, and the price it is quoted at.
///
/// The price is copied off the consulting line when the quote is raised and is
/// the quote's own from then on: Phiếu tư vấn and every báo giá carry
/// independent figures. A line stored before quotes kept prices has none and
/// is still priced off its consulting line.
/// </summary>
public class PatientQuoteLine
{
    public Guid AdviseId { get; private set; }
    public bool IsSelected { get; private set; }
    public int SortOrder { get; private set; }
    public decimal? Price { get; private set; }
    public int? Quantity { get; private set; }
    public DiscountType? DiscountType { get; private set; }
    public decimal? DiscountValue { get; private set; }

    protected PatientQuoteLine() { }

    public PatientQuoteLine(Guid adviseId, bool isSelected, int sortOrder, QuoteLinePricing? pricing = null)
    {
        if (adviseId == Guid.Empty)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.PatientAdviseNotFound,
                "A quote line must name a consulting line.");
        }

        AdviseId = adviseId;
        IsSelected = isSelected;
        SortOrder = sortOrder;
        if (pricing is not null) SetPricing(pricing);
    }

    /// <summary>Null on a line stored before quotes kept their own prices.</summary>
    public QuoteLinePricing? GetPricing() =>
        Price is { } price && Quantity is { } quantity && DiscountType is { } type && DiscountValue is { } value
            ? new QuoteLinePricing(price, quantity, type, value)
            : null;

    internal void SetPricing(QuoteLinePricing pricing)
    {
        pricing.EnsureValid();
        Price = pricing.Price;
        Quantity = pricing.Quantity;
        DiscountType = pricing.DiscountType;
        DiscountValue = pricing.DiscountValue;
    }
}

/// <summary>
/// "BG n" — a báo giá raised off Phiếu tư vấn, as its own tab on Chẩn đoán and
/// Tư vấn.
///
/// UNKNOWN_REFERENCE_BEHAVIOR: the reference was only ever read, so what it
/// stores against a quote is not known — see docs/clone/unknowns.md. This is
/// BlueDental's own shape: the rows it quotes, their order, which are ticked
/// and the price each is quoted at. No totals are stored; they are worked out
/// from those prices each time, the same way the screen works them out.
///
/// <see cref="Ordinal"/> is per patient and only ever climbs — the count of
/// quotes ever raised for them, deleted ones included, so dropping "BG 1" never
/// renames "BG 2".
/// </summary>
public class PatientQuote : FullAuditedAggregateRoot<Guid>
{
    public Guid PatientId { get; private set; }
    public Guid ClinicBranchId { get; private set; }

    /// <summary>1-based, per patient. The tab reads "BG {Ordinal}".</summary>
    public int Ordinal { get; private set; }

    private readonly List<PatientQuoteLine> _lines = new();
    public IReadOnlyList<PatientQuoteLine> Lines => _lines;

    protected PatientQuote() { }

    public static PatientQuote Raise(
        Guid id,
        Guid patientId,
        Guid clinicBranchId,
        int ordinal,
        IEnumerable<PatientQuoteLine> lines)
    {
        if (ordinal < 1)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.InvalidAdviseTransition,
                "A quote's number starts at 1.");
        }

        var quote = new PatientQuote
        {
            Id = id,
            PatientId = patientId,
            ClinicBranchId = clinicBranchId,
            Ordinal = ordinal
        };

        quote.SetLines(lines);
        return quote;
    }

    /// <summary>
    /// Replaces the whole set: what a re-tick or a drag on the quote's table
    /// sends. Renumbered 1..N in the order given, so the stored order never has
    /// gaps or ties — the same rule the consulting list follows. Each line
    /// keeps the price it arrives with.
    /// </summary>
    public PatientQuote SetLines(IEnumerable<PatientQuoteLine> lines)
    {
        var incoming = lines.ToList();
        if (incoming.Count == 0)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.InvalidAdviseTransition,
                "A quote needs at least one consulting line.");
        }

        var duplicate = incoming
            .GroupBy(line => line.AdviseId)
            .FirstOrDefault(group => group.Count() > 1);
        if (duplicate is not null)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.InvalidAdviseTransition,
                $"Consulting line {duplicate.Key} appears twice on the same quote.");
        }

        _lines.Clear();
        _lines.AddRange(
            incoming
                .OrderBy(line => line.SortOrder)
                .Select((line, index) =>
                    new PatientQuoteLine(line.AdviseId, line.IsSelected, index + 1, line.GetPricing())));

        return this;
    }

    /// <summary>
    /// "Cập nhật phiếu dịch vụ" opened on this quote's tab: the new price and
    /// discount stay on this quote.
    /// </summary>
    public PatientQuote RepriceLine(Guid adviseId, QuoteLinePricing pricing)
    {
        var line = _lines.FirstOrDefault(item => item.AdviseId == adviseId)
            ?? throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.PatientAdviseNotFound,
                $"Consulting line {adviseId} is not on this quote.");

        line.SetPricing(pricing);
        return this;
    }

    /// <summary>The rows a copy starts from — same set, same ticks, same order, same prices.</summary>
    public IEnumerable<PatientQuoteLine> CopyLines() =>
        _lines.Select(line => new PatientQuoteLine(line.AdviseId, line.IsSelected, line.SortOrder, line.GetPricing()));
}
