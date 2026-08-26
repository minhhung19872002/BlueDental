using System;
using System.Threading.Tasks;
using Volo.Abp.Application.Services;
using Volo.Abp.Content;

namespace BlueDental.Operations;

public interface IOperationArticleImageAppService : IApplicationService
{
    Task<OperationArticleImageDto> UploadAsync(UploadOperationArticleImageDto input);
    Task<IRemoteStreamContent> GetAsync(Guid id);
}

public class OperationArticleImageDto
{
    public Guid Id { get; set; }

    /// <summary>Where the article's body links to this image.</summary>
    public string Url { get; set; } = string.Empty;

    public string FileName { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long SizeInBytes { get; set; }
}

public class UploadOperationArticleImageDto
{
    /// <summary>Empty lands the image in the caller's own branch.</summary>
    public Guid ClinicBranchId { get; set; }

    public IRemoteStreamContent File { get; set; } = default!;
}
