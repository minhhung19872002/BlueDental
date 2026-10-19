using System;
using Volo.Abp;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.StaffNotes;

/// <summary>
/// One line of the header's "Thêm ghi chú" dialog (F-74, BlueDental-local).
///
/// A <see cref="StaffNoteScope.Shared"/> note belongs to the branch it was
/// written in and every staff member there reads it; a
/// <see cref="StaffNoteScope.Personal"/> note has no branch and only its author
/// sees it. Either way the author — ABP's <c>CreatorId</c> — is the only one who
/// may change or remove it. Deleting is soft.
/// </summary>
public class StaffNote : FullAuditedAggregateRoot<Guid>
{
    public const int MaxContentLength = StaffNoteConsts.MaxContentLength;

    public StaffNoteScope Scope { get; private set; }

    /// <summary>Set for <see cref="StaffNoteScope.Shared"/> only.</summary>
    public Guid? ClinicBranchId { get; private set; }

    public string Content { get; private set; } = default!;

    protected StaffNote() { }

    public static StaffNote CreateShared(Guid id, Guid clinicBranchId, string content)
    {
        if (clinicBranchId == Guid.Empty)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.StaffNotes.BranchRequired);
        }

        return new StaffNote
        {
            Id = id,
            Scope = StaffNoteScope.Shared,
            ClinicBranchId = clinicBranchId,
            Content = NormalizeContent(content),
        };
    }

    public static StaffNote CreatePersonal(Guid id, string content)
    {
        return new StaffNote
        {
            Id = id,
            Scope = StaffNoteScope.Personal,
            Content = NormalizeContent(content),
        };
    }

    public bool IsOwnedBy(Guid userId) => CreatorId == userId;

    /// <summary>Throws unless the given user wrote this note.</summary>
    public void EnsureOwnedBy(Guid userId)
    {
        if (!IsOwnedBy(userId))
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.StaffNotes.NotOwner);
        }
    }

    public void Edit(Guid editorId, string content)
    {
        EnsureOwnedBy(editorId);
        Content = NormalizeContent(content);
    }

    private static string NormalizeContent(string? content)
    {
        var trimmed = content?.Trim();
        if (string.IsNullOrEmpty(trimmed))
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.StaffNotes.ContentRequired);
        }

        if (trimmed.Length > MaxContentLength)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.StaffNotes.ContentTooLong)
                .WithData("max", MaxContentLength);
        }

        return trimmed;
    }
}
