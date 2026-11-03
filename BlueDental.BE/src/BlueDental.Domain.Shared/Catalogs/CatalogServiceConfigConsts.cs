namespace BlueDental.Catalogs;

/// <summary>
/// Limits of a service's setting tabs, shared by the domain, the DTOs and the
/// EF mapping.
/// </summary>
public static class CatalogServiceConfigConsts
{
    /// <summary>
    /// Longest "Nội dung bảo hành" body kept, in characters of HTML. Pictures in
    /// it are links to blob storage, never base64, so this is room for text.
    /// </summary>
    public const int MaxWarrantyContentLength = 20000;
}
