using System.Collections.Generic;

namespace BlueDental.Catalogs.Import;

/// <summary>What one entry row of the file asks for, once its cells have been read and checked.</summary>
internal sealed record EntryDraft
{
    /// <summary>"Nhóm phân loại" as typed; null on the flat catalogs.</summary>
    public string? GroupName { get; init; }
    public string Name { get; init; } = string.Empty;
    public string? Code { get; init; }
    public decimal? Price { get; init; }
    public string? Content { get; init; }
    public string? Description { get; init; }
    /// <summary>Null when "Mức độ ưu tiên" was blank; the row's position fills it in.</summary>
    public int? SortOrder { get; init; }
    public string? DetailName { get; init; }
    public string? Note { get; init; }
    public string? Unit { get; init; }
    public ServiceConfigDto? ServiceConfig { get; init; }
    public MedicineDto? Medicine { get; init; }
    public List<ServiceStageDto>? Stages { get; init; }

    /// <summary>
    /// Column keys whose cell was not blank. When the row updates an existing
    /// entry, a blank cell keeps the stored value rather than clearing it.
    /// </summary>
    public IReadOnlySet<string> Given { get; init; } = new HashSet<string>();
}

/// <summary>One medicine line of a prescription template, keyed by the template's name.</summary>
internal sealed class LineDraft
{
    public string TemplateName { get; init; } = string.Empty;
    public string MedicineName { get; init; } = string.Empty;
    public int TimesPerDay { get; init; }
    public decimal AmountPerTime { get; init; }
    public int Days { get; init; }
    public PrescriptionUsage Usage { get; init; }
    public string? OtherUsage { get; init; }
}
