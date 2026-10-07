using System;
using System.Collections.Generic;
using System.Linq;
using Volo.Abp;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.Marketing;

/// <summary>
/// Marketing → Ticket File (BA 8.4): one Excel file imported into tickets. The
/// tickets it created point back at it (<see cref="Ticket.ImportFileId"/>), which
/// is how the file list shows the processing state of each file.
/// </summary>
public class TicketImportFile : CreationAuditedAggregateRoot<Guid>
{
    public const int MaxFileNameLength = 255;

    public Guid ClinicBranchId { get; private set; }

    public string FileName { get; private set; } = string.Empty;

    /// <summary>Data rows read from the file.</summary>
    public int RowCount { get; private set; }

    /// <summary>New tickets the file created.</summary>
    public int CreatedCount { get; private set; }

    /// <summary>Rows whose phone already had an open ticket: that ticket got a Phát sinh lại line instead.</summary>
    public int ReoccurredCount { get; private set; }

    public Guid? SourceTaxonomyId { get; private set; }

    public Guid? SourceEntryId { get; private set; }

    private List<Guid> _tagIds = [];

    public IReadOnlyCollection<Guid> TagIds => _tagIds.AsReadOnly();

    /// <summary>Whom the new tickets were shared out to, in turn. Empty = the pool.</summary>
    private List<Guid> _assigneeIds = [];

    public IReadOnlyCollection<Guid> AssigneeIds => _assigneeIds.AsReadOnly();

    protected TicketImportFile() { }

    public TicketImportFile(
        Guid id,
        Guid clinicBranchId,
        string fileName,
        Guid? sourceTaxonomyId,
        Guid? sourceEntryId,
        IEnumerable<Guid> tagIds,
        IEnumerable<Guid> assigneeIds)
        : base(id)
    {
        ClinicBranchId = clinicBranchId;
        FileName = Check.NotNullOrWhiteSpace(fileName, nameof(fileName)).Trim();
        if (FileName.Length > MaxFileNameLength)
        {
            FileName = FileName[..MaxFileNameLength];
        }

        SourceTaxonomyId = sourceTaxonomyId;
        SourceEntryId = sourceTaxonomyId.HasValue ? sourceEntryId : null;
        _tagIds = tagIds.Where(x => x != Guid.Empty).Distinct().ToList();
        _assigneeIds = assigneeIds.Where(x => x != Guid.Empty).Distinct().ToList();
    }

    public TicketImportFile Record(int rowCount, int createdCount, int reoccurredCount)
    {
        RowCount = rowCount;
        CreatedCount = createdCount;
        ReoccurredCount = reoccurredCount;
        return this;
    }
}

/// <summary>
/// "Chia dữ liệu cho nhóm hoặc cho nhân viên" (BA 8.3, 8.4): tickets are dealt
/// to the chosen staff in turn, so a group of n gets an even split.
/// </summary>
public static class TicketDistribution
{
    /// <summary>The assignee of the <paramref name="index"/>-th ticket; null (the pool) when nobody was chosen.</summary>
    public static Guid? AssigneeAt(IReadOnlyList<Guid> assignees, int index) =>
        assignees.Count == 0 ? null : assignees[index % assignees.Count];
}
