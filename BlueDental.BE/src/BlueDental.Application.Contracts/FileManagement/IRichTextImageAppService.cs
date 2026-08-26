using System;
using System.Threading.Tasks;
using Volo.Abp.Application.Services;
using Volo.Abp.Content;

namespace BlueDental.FileManagement;

/// <summary>
/// The images a rich-text body links to, wherever that body lives.
///
/// One store for every editor in the application: an article in Vận hành, a
/// piece of consulting data or a diagnosis in Danh mục. They all write the same
/// HTML through the same editor, so they keep their pictures the same way.
/// </summary>
public interface IRichTextImageAppService : IApplicationService
{
    Task<RichTextImageDto> UploadAsync(UploadRichTextImageDto input);
    Task<IRemoteStreamContent> GetAsync(Guid id);
}

public class RichTextImageDto
{
    public Guid Id { get; set; }

    /// <summary>Where the body links to this image.</summary>
    public string Url { get; set; } = string.Empty;

    public string FileName { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long SizeInBytes { get; set; }
}

public class UploadRichTextImageDto
{
    /// <summary>Empty lands the image in the caller's own branch.</summary>
    public Guid ClinicBranchId { get; set; }

    public IRemoteStreamContent File { get; set; } = default!;
}
