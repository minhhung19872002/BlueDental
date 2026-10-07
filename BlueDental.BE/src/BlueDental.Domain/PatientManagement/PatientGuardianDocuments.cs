using System;
using System.Collections.Generic;
using System.IO;

namespace BlueDental.PatientManagement;

/// <summary>
/// Where guardian papers live in blob storage and what they may be. The blob
/// name carries the branch, so a save can refuse a name uploaded elsewhere.
/// </summary>
public static class PatientGuardianDocuments
{
    private static readonly Dictionary<string, string> ContentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        [".jpg"] = "image/jpeg",
        [".jpeg"] = "image/jpeg",
        [".png"] = "image/png",
        [".pdf"] = "application/pdf",
    };

    public static string BranchPrefix(Guid branchId) => $"patient-guardians/{branchId}/";

    public static bool BelongsToBranch(string blobName, Guid branchId) =>
        blobName.StartsWith(BranchPrefix(branchId), StringComparison.Ordinal)
        && !blobName.Contains("..", StringComparison.Ordinal);

    /// <summary>Null when the extension is not one the form accepts.</summary>
    public static string? ContentTypeOf(string fileName) =>
        ContentTypes.TryGetValue(Path.GetExtension(fileName), out var contentType) ? contentType : null;

    /// <summary>
    /// The file's first bytes agree with its extension — a renamed .exe is not
    /// a PDF however it is called.
    /// </summary>
    public static bool HasExpectedSignature(ReadOnlySpan<byte> head, string contentType) => contentType switch
    {
        "image/jpeg" => head.Length >= 3 && head[0] == 0xFF && head[1] == 0xD8 && head[2] == 0xFF,
        "image/png" => head.Length >= 4 && head[0] == 0x89 && head[1] == 0x50 && head[2] == 0x4E && head[3] == 0x47,
        "application/pdf" => head.Length >= 4 && head[0] == 0x25 && head[1] == 0x50 && head[2] == 0x44 && head[3] == 0x46,
        _ => false
    };
}
