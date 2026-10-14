using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using Volo.Abp;

namespace BlueDental.PatientManagement;

/// <summary>
/// A drawing on a sheet — "Lược đồ phẫu thuật/thủ thuật" on Phiếu phẫu
/// thuật/thủ thuật, where the doctor sketches the operation.
///
/// The picture is a PNG in blob storage, never base64 inside
/// <see cref="PatientMedicalRecord.Content"/>: every list read ships the whole
/// content, and a sketch is a hundred times the size of everything typed on the
/// sheet. The content keeps only the drawing's link, under its blank.
///
/// A drawing is never changed in place. Editing one stores a new picture and the
/// sheet points at it from then on, so a link can be cached for good and the old
/// picture is dropped once the sheet that held it no longer does.
/// </summary>
public static class MedicalRecordDrawing
{
    /// <summary>A sketch of the A4 cell at twice its size is well under this.</summary>
    public const int MaxSizeInBytes = 2 * 1024 * 1024;

    public const string ContentType = "image/png";

    private static readonly byte[] PngSignature = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];

    private static readonly Regex Link = new(
        @"/patient-medical-records/(?<record>[0-9a-fA-F-]{36})/drawings/(?<drawing>[0-9a-fA-F-]{36})",
        RegexOptions.Compiled | RegexOptions.CultureInvariant);

    /// <summary>
    /// Stored under the sheet, so a drawing can only be reached through the sheet
    /// it belongs to — and through that sheet's branch check.
    /// </summary>
    public static string BlobNameOf(Guid recordId, Guid drawingId) =>
        $"patient-medical-records/{recordId:N}/drawings/{drawingId:N}.png";

    /// <summary>
    /// Only a PNG is kept, read off its own bytes rather than the type the
    /// browser claimed: the picture is served back as <c>image/png</c> to an
    /// <c>&lt;img&gt;</c>, and anything else under that name is not a picture.
    /// </summary>
    public static void EnsureValid(ReadOnlySpan<byte> bytes)
    {
        if (bytes.Length <= PngSignature.Length
            || bytes.Length > MaxSizeInBytes
            || !bytes[..PngSignature.Length].SequenceEqual(PngSignature))
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.PatientManagement.InvalidMedicalRecordDrawing,
                "A drawing must be a PNG image of at most 2MB.");
        }
    }

    /// <summary>The drawings of this sheet that its content links to.</summary>
    public static IReadOnlySet<Guid> IdsIn(Guid recordId, string? content)
    {
        if (string.IsNullOrEmpty(content)) return new HashSet<Guid>();

        return Link.Matches(content)
            .Where(match => Guid.TryParse(match.Groups["record"].Value, out var owner) && owner == recordId)
            .Select(match => Guid.TryParse(match.Groups["drawing"].Value, out var id) ? id : Guid.Empty)
            .Where(id => id != Guid.Empty)
            .ToHashSet();
    }
}
