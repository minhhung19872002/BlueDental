using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Content;

namespace BlueDental.Marketing;

/// <summary>One imported file of Marketing → Ticket File (BA 8.4), with how far its tickets got.</summary>
public class TicketImportFileDto : EntityDto<Guid>
{
    public Guid ClinicBranchId { get; set; }
    public string FileName { get; set; } = default!;
    public int RowCount { get; set; }
    public int CreatedCount { get; set; }
    public int ReoccurredCount { get; set; }
    public Guid? SourceTaxonomyId { get; set; }
    public Guid? SourceEntryId { get; set; }
    public List<Guid> TagIds { get; set; } = [];
    public List<string> AssigneeNames { get; set; } = [];

    /// <summary>The file's live tickets today, per status — "tình trạng xử lý theo từng file".</summary>
    public TicketStatsDto Progress { get; set; } = new();

    public Guid? CreatorId { get; set; }
    public string? CreatorName { get; set; }
    public DateTime CreationTime { get; set; }
}

public class GetTicketImportFileListInput : PagedResultRequestDto
{
    public Guid? ClinicBranchId { get; set; }

    /// <summary>Matches the file name.</summary>
    [StringLength(100)]
    public string? Filter { get; set; }
}

/// <summary>
/// Which column of the file holds each ticket field — 1-based, as Excel numbers
/// them. Họ tên and Số điện thoại are required; the rest may stay unmapped.
/// </summary>
public class TicketFileMappingDto
{
    public int? FullName { get; set; }
    public int? Phone { get; set; }
    public int? Email { get; set; }
    public int? Note { get; set; }
}

/// <summary>The first look at an upload: its header row, its size, and the mapping its headers suggest.</summary>
public class TicketFileHeadersDto
{
    /// <summary>Header cell text by column, from column 1; a blank header is "".</summary>
    public List<string> Headers { get; set; } = [];

    public int RowCount { get; set; }

    /// <summary>Columns whose header is the template's own name for the field.</summary>
    public TicketFileMappingDto Suggested { get; set; } = new();
}

public class InspectTicketFileDto
{
    [Required]
    public IRemoteStreamContent File { get; set; } = default!;
}

public class ImportTicketFileDto
{
    [Required]
    public IRemoteStreamContent File { get; set; } = default!;

    /// <summary>Defaults to the caller's current branch.</summary>
    public Guid? ClinicBranchId { get; set; }

    [Required]
    public TicketFileMappingDto Mapping { get; set; } = new();

    /// <summary>Nguồn / Kênh given to every ticket of the file.</summary>
    public Guid? SourceTaxonomyId { get; set; }

    public Guid? SourceEntryId { get; set; }

    public List<Guid> TagIds { get; set; } = [];

    /// <summary>Staff the new tickets are dealt to in turn; empty leaves them in the pool.</summary>
    public List<Guid> AssigneeIds { get; set; } = [];
}

/// <summary>What a row of the file got wrong. Nothing is written while any row has an error.</summary>
public class TicketImportRowErrorDto
{
    /// <summary>The Excel row number.</summary>
    public int Row { get; set; }

    public List<string> Errors { get; set; } = [];
}

public class TicketImportResultDto
{
    /// <summary>False when the file was refused for its errors.</summary>
    public bool Committed { get; set; }

    public int RowCount { get; set; }
    public int CreatedCount { get; set; }
    public int ReoccurredCount { get; set; }
    public List<TicketImportRowErrorDto> Errors { get; set; } = [];

    /// <summary>The new file, once committed.</summary>
    public TicketImportFileDto? File { get; set; }
}
