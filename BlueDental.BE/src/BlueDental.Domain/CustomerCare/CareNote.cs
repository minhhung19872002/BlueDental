using System;
using System.Collections.Generic;
using Volo.Abp;
using Volo.Abp.Domain.Entities;

namespace BlueDental.CustomerCare;

/// <summary>
/// A care note (BA P2210): "Ghi chú nội bộ" of a Hộp thư Zalo conversation and
/// "Ghi nhận chăm sóc" of the customer's Lịch sử chăm sóc are the same notes —
/// one written in either place shows in the other. So a note carries the
/// conversation it was written in, the patient record, or both: a chat note
/// of a linked conversation names its record, and a record's history reads the
/// notes of the conversations linked to it.
///
/// Any staff member caring for the customer writes, changes or deletes one.
/// Deleting only strikes it through — it stays on screen — and every step is
/// a <see cref="CareNoteRevision"/>, so who wrote, changed and deleted it, and
/// when, is never lost. Deliberately not <c>ISoftDelete</c>: ABP's filter would
/// hide a deleted note, and the BA wants it shown struck through.
/// </summary>
public class CareNote : AggregateRoot<Guid>
{
    public const int MaxContentLength = CareNoteConsts.MaxContentLength;

    private readonly List<CareNoteRevision> _revisions = [];

    public Guid ClinicBranchId { get; private set; }

    /// <summary>The Hộp thư Zalo conversation the note was written in.</summary>
    public Guid? ConversationId { get; private set; }

    public Guid? PatientId { get; private set; }

    public string Content { get; private set; } = string.Empty;

    /// <summary>"Kết quả cuộc gọi" picked with the note, when one was.</summary>
    public CareNoteOutcome? Outcome { get; private set; }

    public Guid AuthorId { get; private set; }

    public DateTime CreatedAt { get; private set; }

    public Guid? LastEditorId { get; private set; }

    public DateTime? LastEditedAt { get; private set; }

    public Guid? RemoverId { get; private set; }

    public DateTime? RemovedAt { get; private set; }

    public IReadOnlyList<CareNoteRevision> Revisions => _revisions.AsReadOnly();

    public bool IsRemoved => RemovedAt != null;

    protected CareNote() { }

    /// <summary>
    /// A note needs somewhere to belong: a conversation, a record or both. A
    /// quick tag with no text of its own keeps the text the screen gave it.
    /// </summary>
    public static CareNote Write(
        Guid id,
        Guid clinicBranchId,
        Guid? conversationId,
        Guid? patientId,
        string? content,
        CareNoteOutcome? outcome,
        Guid authorId,
        DateTime now)
    {
        if (clinicBranchId == Guid.Empty)
        {
            throw new ArgumentException("A care note belongs to a branch.", nameof(clinicBranchId));
        }

        conversationId = conversationId == Guid.Empty ? null : conversationId;
        patientId = patientId == Guid.Empty ? null : patientId;

        if (conversationId == null && patientId == null)
        {
            throw new ArgumentException("A care note belongs to a conversation or a patient record.");
        }

        var note = new CareNote
        {
            Id = id,
            ClinicBranchId = clinicBranchId,
            ConversationId = conversationId,
            PatientId = patientId,
            Content = Normalize(content),
            Outcome = outcome,
            AuthorId = authorId,
            CreatedAt = now,
        };
        note.Log(CareNoteAction.Created, null, note.Content, authorId, now);
        return note;
    }

    /// <summary>The same text again changes nothing and leaves no history line.</summary>
    public void Edit(string? content, Guid editorId, DateTime now)
    {
        EnsureLive();
        var next = Normalize(content);
        if (next == Content)
        {
            return;
        }

        Log(CareNoteAction.Edited, Content, next, editorId, now);
        Content = next;
        LastEditorId = editorId;
        LastEditedAt = now;
    }

    public void Remove(Guid removerId, DateTime now)
    {
        EnsureLive();
        RemoverId = removerId;
        RemovedAt = now;
        Log(CareNoteAction.Removed, Content, null, removerId, now);
    }

    private void EnsureLive()
    {
        if (IsRemoved)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.ZaloInbox.NoteRemoved);
        }
    }

    private void Log(CareNoteAction action, string? before, string? after, Guid actorId, DateTime at) =>
        _revisions.Add(new CareNoteRevision(Guid.NewGuid(), Id, action, before, after, actorId, at));

    private static string Normalize(string? content)
    {
        var trimmed = content?.Trim();
        if (string.IsNullOrEmpty(trimmed))
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.ZaloInbox.NoteRequired);
        }

        if (trimmed.Length > MaxContentLength)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.ZaloInbox.NoteTooLong)
                .WithData("max", MaxContentLength);
        }

        return trimmed;
    }
}

/// <summary>One line of a care note's log: the text before and after, by whom, when.</summary>
public class CareNoteRevision : Entity<Guid>
{
    public Guid NoteId { get; private set; }

    public CareNoteAction Action { get; private set; }

    public string? Before { get; private set; }

    public string? After { get; private set; }

    public Guid ActorId { get; private set; }

    public DateTime At { get; private set; }

    protected CareNoteRevision() { }

    internal CareNoteRevision(
        Guid id, Guid noteId, CareNoteAction action, string? before, string? after, Guid actorId, DateTime at)
        : base(id)
    {
        NoteId = noteId;
        Action = action;
        Before = before;
        After = after;
        ActorId = actorId;
        At = at;
    }
}
