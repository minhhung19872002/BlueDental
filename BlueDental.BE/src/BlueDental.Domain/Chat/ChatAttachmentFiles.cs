using System;
using System.Collections.Generic;
using System.IO;

namespace BlueDental.Chat;

/// <summary>
/// What may be sent in Chat nội bộ and where it is kept. A file must have one
/// of these extensions and start with the bytes that go with it, so a renamed
/// program is refused whatever it is called.
/// </summary>
public static class ChatAttachmentFiles
{
    private static readonly Dictionary<string, string> ContentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        [".jpg"] = "image/jpeg",
        [".jpeg"] = "image/jpeg",
        [".png"] = "image/png",
        [".gif"] = "image/gif",
        [".webp"] = "image/webp",
        [".pdf"] = "application/pdf",
        [".docx"] = "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        [".xlsx"] = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        [".pptx"] = "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        [".doc"] = "application/msword",
        [".xls"] = "application/vnd.ms-excel",
        [".ppt"] = "application/vnd.ms-powerpoint",
        [".txt"] = "text/plain",
        [".csv"] = "text/csv",
    };

    /// <summary>The extensions the picker offers, e.g. ".jpg,.png,…".</summary>
    public static IReadOnlyCollection<string> Extensions => ContentTypes.Keys;

    /// <summary>The blob holds the sealed file only, so its name tells nothing about the file inside.</summary>
    public static string BlobName(Guid clinicBranchId, Guid conversationId, Guid attachmentId) =>
        $"chat/{clinicBranchId}/{conversationId}/{attachmentId}.enc";

    /// <summary>Null when the extension is not one chat accepts.</summary>
    public static string? ContentTypeOf(string fileName) =>
        ContentTypes.TryGetValue(Path.GetExtension(fileName), out var contentType) ? contentType : null;

    public static bool IsImage(string contentType) =>
        contentType.StartsWith("image/", StringComparison.Ordinal);

    /// <summary>The file's first bytes agree with its extension.</summary>
    public static bool HasExpectedSignature(ReadOnlySpan<byte> head, string contentType) => contentType switch
    {
        "image/jpeg" => StartsWith(head, 0xFF, 0xD8, 0xFF),
        "image/png" => StartsWith(head, 0x89, 0x50, 0x4E, 0x47),
        "image/gif" => StartsWith(head, 0x47, 0x49, 0x46, 0x38),
        "image/webp" => StartsWith(head, 0x52, 0x49, 0x46, 0x46)
            && head.Length >= 12 && head[8] == 0x57 && head[9] == 0x45 && head[10] == 0x42 && head[11] == 0x50,
        "application/pdf" => StartsWith(head, 0x25, 0x50, 0x44, 0x46),
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            or "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            or "application/vnd.openxmlformats-officedocument.presentationml.presentation"
            => StartsWith(head, 0x50, 0x4B, 0x03, 0x04),
        "application/msword" or "application/vnd.ms-excel" or "application/vnd.ms-powerpoint"
            => StartsWith(head, 0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1),
        "text/plain" or "text/csv" => head.Length > 0 && head.IndexOf((byte)0) < 0,
        _ => false,
    };

    private static bool StartsWith(ReadOnlySpan<byte> head, params byte[] signature) =>
        head.Length >= signature.Length && head[..signature.Length].SequenceEqual(signature);
}
