using System;
using System.Collections.Generic;
using System.Linq;
using Volo.Abp;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.TreatmentManagement;

/// <summary>
/// One line of a báo giá: the consulting line it quotes, whether it is ticked,
/// and where it sits in the quote's own order.
///
/// Only the advise id is kept, not a copy of its price: a quote is a view of
/// the consulting lines, and re-reading them is what keeps a corrected price
/// from being stale on the quote. What the quote owns is the *set* and the
/// *order*.
/// </summary>
public class PatientQuoteLine
{
    public Guid AdviseId { get; private set; }
    public bool IsSelected { get; private set; }
    public int SortOrder { get; private set; }

    protected PatientQuoteLine() { }

    public PatientQuoteLine(Guid adviseId, bool isSelected, int sortOrder)
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
    }
}

/// <summary>
/// "BG n" — a báo giá raised off Phiếu tư vấn, as its own tab on Chẩn đoán and
/// Tư vấn.
///
/// UNKNOWN_REFERENCE_BEHAVIOR: the reference was only ever read, so what it
/// stores against a quote is not known — see docs/clone/unknowns.md. This is
/// BlueDental's own shape, kept deliberately thin: the rows it quotes, their
/// order, and which are ticked. No totals are stored; they are worked out from
/// the consulting lines each time, the same way the screen works them out.
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
    /// gaps or ties — the same rule the consulting list follows.
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
                .Select((line, index) => new PatientQuoteLine(line.AdviseId, line.IsSelected, index + 1)));

        return this;
    }

    /// <summary>The rows a copy starts from — same set, same ticks, same order.</summary>
    public IEnumerable<PatientQuoteLine> CopyLines() =>
        _lines.Select(line => new PatientQuoteLine(line.AdviseId, line.IsSelected, line.SortOrder));
}
