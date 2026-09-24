using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using Volo.Abp.Content;

namespace BlueDental.Catalogs;

/// <summary>
/// One Excel file for one catalog of one branch. This is BlueDental's own
/// feature — the reference has no import on Danh mục — so the shape follows the
/// dialogs rather than an observed request.
/// </summary>
public class ImportCatalogEntriesDto
{
    [Required]
    public IRemoteStreamContent File { get; set; } = default!;

    /// <summary>The branch selected in the header; the checker narrows it to what the account may write.</summary>
    public Guid? ClinicBranchId { get; set; }

    /// <summary>Taxonomy group slug of the tab the file was uploaded from.</summary>
    [Required]
    public string Group { get; set; } = string.Empty;

    /// <summary>True reads and validates only: the preview step. Nothing is written.</summary>
    public bool DryRun { get; set; }
}

/// <summary>What the importer would do, or did, with one data row.</summary>
public enum CatalogImportRowAction
{
    /// <summary>A new entry.</summary>
    Create = 0,

    /// <summary>An active entry of that name exists in that group and the file changes nothing about it; the row is left alone.</summary>
    Skip = 1,

    /// <summary>A soft-deleted entry of that name exists in that group; it is brought back and takes the file's values.</summary>
    Restore = 2,

    /// <summary>A detail row (a medicine line of a prescription template) that belongs to a row above.</summary>
    Line = 3,

    /// <summary>The row cannot be imported; see <see cref="CatalogImportRowDto.Errors"/>.</summary>
    Error = 4,

    /// <summary>
    /// An active entry of that name exists in that group and at least one other
    /// field in the file differs; the entry takes the file's values. Appended
    /// after <see cref="Error"/> so the numbers the frontend mirrors stay put.
    /// </summary>
    Update = 5
}

/// <summary>One data row of the file, as the preview table shows it.</summary>
public class CatalogImportRowDto
{
    /// <summary>Excel row number (1-based, header included) so the user can find it in the file.</summary>
    public int Row { get; set; }

    /// <summary>Cell text in the order of <see cref="CatalogImportSheetDto.Columns"/>.</summary>
    public List<string?> Values { get; set; } = [];

    public CatalogImportRowAction Action { get; set; }

    /// <summary>Localized messages; empty unless <see cref="Action"/> is Error.</summary>
    public List<string> Errors { get; set; } = [];
}

/// <summary>One sheet of the file. Every catalog has one; đơn thuốc mẫu has two.</summary>
public class CatalogImportSheetDto
{
    public string Name { get; set; } = string.Empty;

    /// <summary>The template's headers, in template order — not the file's, which may carry extra columns.</summary>
    public List<string> Columns { get; set; } = [];

    public List<CatalogImportRowDto> Rows { get; set; } = [];
}

public class CatalogImportResultDto
{
    public bool DryRun { get; set; }

    /// <summary>True only when every row passed and the rows were written.</summary>
    public bool Committed { get; set; }

    /// <summary>Problems with the file as a whole — a missing sheet or column, an unreadable workbook.</summary>
    public List<string> FileErrors { get; set; } = [];

    /// <summary>Data rows of the first sheet (the entries themselves).</summary>
    public int TotalRows { get; set; }

    public int CreateCount { get; set; }

    /// <summary>Existing rows whose other fields differ in the file.</summary>
    public int UpdateCount { get; set; }

    /// <summary>Existing rows the file changes nothing about.</summary>
    public int SkipCount { get; set; }

    public int RestoreCount { get; set; }

    /// <summary>Rows in error across every sheet, plus one per file error.</summary>
    public int ErrorCount { get; set; }

    /// <summary>Classification groups named in the file that do not exist in the branch yet; they are created on commit.</summary>
    public List<string> NewGroups { get; set; } = [];

    public List<CatalogImportSheetDto> Sheets { get; set; } = [];
}
