using System;
using System.Text.RegularExpressions;
using Volo.Abp;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.PatientManagement;

/// <summary>
/// A "Thư mục" in one "Giai đoạn điều trị" column of a patient's Hình ảnh tab
/// (F-98). One level only — a folder holds pictures, never another folder — and
/// a picture sits in at most one, through <see cref="PatientImage.FolderId"/>.
/// Deleting a folder hands its pictures back to the column; it never takes a
/// picture with it.
/// </summary>
public class PatientImageFolder : FullAuditedAggregateRoot<Guid>
{
    /// <summary>The longest name a folder keeps; the column is this wide.</summary>
    public const int MaxNameLength = 100;

    public Guid PatientId { get; private set; }
    public Guid ClinicBranchId { get; private set; }

    /// <summary>The stage column the folder sits in.</summary>
    public PatientImageType Type { get; private set; }

    public string Name { get; private set; } = string.Empty;

    protected PatientImageFolder() { }

    public static PatientImageFolder Create(
        Guid id, Guid patientId, Guid clinicBranchId, PatientImageType type, string? name)
    {
        return new PatientImageFolder
        {
            Id = id,
            PatientId = patientId,
            ClinicBranchId = clinicBranchId,
            Type = type,
            Name = NormalizeName(name)
        };
    }

    public PatientImageFolder Rename(string? name)
    {
        Name = NormalizeName(name);
        return this;
    }

    /// <summary>
    /// Whether <paramref name="image"/> may go into this folder: the same
    /// patient, branch and stage column — a folder never shows a picture of
    /// another column.
    /// </summary>
    public bool CanHold(PatientImage image) =>
        image.PatientId == PatientId && image.ClinicBranchId == ClinicBranchId && image.Type == Type;

    /// <summary>The key two names are told apart by: case and inner runs of spaces do not count.</summary>
    public static string NameKey(string name) => NormalizeName(name).ToLowerInvariant();

    /// <summary>Trimmed, inner runs of spaces folded to one, required and no longer than the column.</summary>
    private static string NormalizeName(string? name)
    {
        var folded = Regex.Replace(name ?? string.Empty, @"\s+", " ").Trim();
        Check.NotNullOrWhiteSpace(folded, nameof(name));
        return Check.Length(folded, nameof(name), MaxNameLength)!;
    }
}
