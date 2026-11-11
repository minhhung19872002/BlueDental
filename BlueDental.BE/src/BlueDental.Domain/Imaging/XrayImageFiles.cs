using System;

namespace BlueDental.Imaging;

/// <summary>
/// What an X-ray PC may send: JPEG or PNG, recognised by their first bytes —
/// the file name and the content type the agent states are not trusted.
/// DICOM is out of scope and refused like any other format.
/// </summary>
public static class XrayImageFiles
{
    /// <summary>The content type and extension the bytes are, or null when neither JPEG nor PNG.</summary>
    public static (string ContentType, string Extension)? Detect(ReadOnlySpan<byte> head)
    {
        if (head.Length >= 3 && head[0] == 0xFF && head[1] == 0xD8 && head[2] == 0xFF)
            return ("image/jpeg", ".jpg");

        if (head.Length >= 8
            && head[0] == 0x89 && head[1] == 0x50 && head[2] == 0x4E && head[3] == 0x47
            && head[4] == 0x0D && head[5] == 0x0A && head[6] == 0x1A && head[7] == 0x0A)
        {
            return ("image/png", ".png");
        }

        return null;
    }

    public static string InboxBlobName(Guid clinicBranchId, Guid itemId, string extension) =>
        $"xray-inbox/{clinicBranchId}/{itemId}{extension}";
}
