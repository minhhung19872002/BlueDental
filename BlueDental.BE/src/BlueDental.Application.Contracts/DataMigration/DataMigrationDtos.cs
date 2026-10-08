using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using Volo.Abp.Content;

namespace BlueDental.DataMigration;

/// <summary>
/// One BlueDental_Migration workbook for one branch: the clinic's patients
/// from its old system and their treatment history. BlueDental's own feature
/// (BA request 2026-10-08), run once per clinic through the API — no screen.
/// </summary>
public class ImportDataMigrationDto
{
    [Required]
    public IRemoteStreamContent File { get; set; } = default!;

    /// <summary>The branch the data goes into; the checker narrows it to what the account may write.</summary>
    public Guid? ClinicBranchId { get; set; }

    /// <summary>True reads and validates only. Nothing is written.</summary>
    public bool DryRun { get; set; }
}

/// <summary>What the importer would do, or did, with one data row.</summary>
public enum DataMigrationRowAction
{
    /// <summary>The row is written: a new patient, or a công đoạn of a new treatment slip.</summary>
    Create = 0,

    /// <summary>
    /// The patient code is already an active patient of the branch, so the
    /// patient and every treatment row of that code are left alone — which is
    /// what makes running the same file twice safe.
    /// </summary>
    Skip = 1,

    /// <summary>The row cannot be imported; see <see cref="DataMigrationRowDto.Errors"/>.</summary>
    Error = 2
}

/// <summary>A row the importer did not simply create: skipped or refused.</summary>
public class DataMigrationRowDto
{
    /// <summary>Excel row number (1-based, header included).</summary>
    public int Row { get; set; }

    public string? PatientCode { get; set; }

    public DataMigrationRowAction Action { get; set; }

    public List<string> Errors { get; set; } = [];
}

public class DataMigrationSheetDto
{
    public string Name { get; set; } = string.Empty;

    /// <summary>Data rows read from the sheet.</summary>
    public int TotalRows { get; set; }

    /// <summary>Only the skipped and refused rows — a clean row needs no line here.</summary>
    public List<DataMigrationRowDto> Rows { get; set; } = [];
}

public class DataMigrationResultDto
{
    public bool DryRun { get; set; }

    /// <summary>True once the data is written. Never true with an error: one bad row refuses the file.</summary>
    public bool Committed { get; set; }

    /// <summary>File errors plus refused rows.</summary>
    public int ErrorCount { get; set; }

    public int PatientsCreated { get; set; }
    public int PatientsSkipped { get; set; }
    public int TreatmentPlansCreated { get; set; }
    public int TreatmentStagesCreated { get; set; }

    /// <summary>Problems with the file itself: a missing sheet or column, no data at all.</summary>
    public List<string> FileErrors { get; set; } = [];

    public List<DataMigrationSheetDto> Sheets { get; set; } = [];
}
