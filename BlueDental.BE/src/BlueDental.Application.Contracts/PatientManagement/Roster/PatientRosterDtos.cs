using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using Volo.Abp.Content;

namespace BlueDental.PatientManagement.Roster;

/// <summary>
/// The patient roster workbook (F-69): every patient of every branch on one
/// sheet, exported, edited offline, and imported back. Only the rows marked in
/// the Action column are read: E adds or edits a patient, D deletes one
/// (BA 2026-10-12).
/// </summary>
public class ImportPatientRosterDto
{
    [Required]
    public IRemoteStreamContent File { get; set; } = default!;

    /// <summary>True reads and validates only. Nothing is written.</summary>
    public bool DryRun { get; set; }
}

/// <summary>What the import would do, or did, with one row.</summary>
public enum PatientRosterRowAction
{
    /// <summary>A new patient: the Mã khách hàng is blank (the app numbers it) or not yet used.</summary>
    Create = 0,

    /// <summary>The Mã khách hàng is a patient of the row's branch; the file's values replace the record's.</summary>
    Update = 1,

    /// <summary>The row cannot be imported; see <see cref="PatientRosterRowDto.Errors"/>.</summary>
    Error = 2,

    /// <summary>Action D: the patient of that Mã khách hàng is deleted (soft delete).</summary>
    Delete = 3
}

/// <summary>A marked row and what happens to it.</summary>
public class PatientRosterRowDto
{
    /// <summary>Excel row number (1-based, header rows included).</summary>
    public int Row { get; set; }

    /// <summary>The code as the file has it, or the one the app will give a new patient.</summary>
    public string? PatientCode { get; set; }

    public string? FullName { get; set; }

    public PatientRosterRowAction Action { get; set; }

    public List<string> Errors { get; set; } = [];
}

public class PatientRosterResultDto
{
    public bool DryRun { get; set; }

    /// <summary>True once the data is written. Never true with an error: one bad row refuses the file.</summary>
    public bool Committed { get; set; }

    /// <summary>Data rows on the sheet, marked or not.</summary>
    public int TotalRows { get; set; }

    /// <summary>File errors plus refused rows.</summary>
    public int ErrorCount { get; set; }

    public int Created { get; set; }
    public int Updated { get; set; }
    public int Deleted { get; set; }

    /// <summary>Rows left alone because their Action cell is blank.</summary>
    public int Unmarked { get; set; }

    /// <summary>Problems with the file itself: a missing column, no marked row at all.</summary>
    public List<string> FileErrors { get; set; } = [];

    /// <summary>Every marked row, in file order.</summary>
    public List<PatientRosterRowDto> Rows { get; set; } = [];
}
