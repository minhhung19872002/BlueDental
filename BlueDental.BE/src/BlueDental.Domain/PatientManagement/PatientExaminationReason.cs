using System;
using Volo.Abp;
using Volo.Abp.Domain.Entities;

namespace BlueDental.PatientManagement;

/// <summary>
/// One line of "Lý do đến khám".
///
/// The reference keeps a dated list rather than a single note: the profile card
/// prints every reason the patient has arrived with, each stamped with the day
/// it was written. See docs/clone/pages/patient-detail.md.
/// </summary>
public class PatientExaminationReason : Entity<Guid>
{
    public const int MaxContentLength = PatientExaminationReasonConsts.MaxContentLength;
    public const int MaxNoteLength = PatientExaminationReasonConsts.MaxNoteLength;

    /// <summary>Set by EF from the aggregate's collection.</summary>
    public Guid PatientId { get; private set; }

    public string Content { get; private set; } = string.Empty;

    /// <summary>
    /// The reference carries a note alongside the reason but never renders one
    /// on this card, so nothing writes it yet.
    /// </summary>
    public string? Note { get; private set; }

    /// <summary>
    /// The first reason on the record. The "Chỉnh sửa hồ sơ" dialog binds this
    /// one — its Lý do đến khám box rewrites it rather than adding a line — so
    /// at most one reason per patient carries the flag.
    /// </summary>
    public bool IsRoot { get; private set; }

    /// <summary>The date the card prints beside the reason.</summary>
    public DateTimeOffset RecordedAt { get; private set; }

    protected PatientExaminationReason() { }

    internal PatientExaminationReason(
        Guid id,
        string content,
        string? note,
        bool isRoot,
        DateTimeOffset recordedAt)
        : base(id)
    {
        Content = Normalized(content);
        Note = Trimmed(note);
        IsRoot = isRoot;
        RecordedAt = recordedAt;
    }

    /// <summary>Rewrites the text in place, keeping the date it was first written.</summary>
    internal void SetContent(string content) => Content = Normalized(content);

    private static string Normalized(string content) =>
        Check.NotNullOrWhiteSpace(content, nameof(content), MaxContentLength).Trim();

    private static string? Trimmed(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
