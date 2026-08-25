using System;
using System.IO;
using System.Threading.Tasks;
using BlueDental.Organizations;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp;
using Volo.Abp.Application.Services;
using Volo.Abp.BlobStoring;
using Volo.Abp.Content;
using Volo.Abp.Domain.Repositories;

namespace BlueDental.Operations;

/// <summary>
/// The images an article's body links to.
///
/// The editor would otherwise embed a pasted image as a base64 data URL inside
/// the HTML it stores, which puts the bytes in the row and ships them again on
/// every list read. These go to blob storage instead and the body carries a
/// link to them.
/// </summary>
[Authorize(BlueDentalPermissions.Catalogs.Default)]
public class OperationArticleImageAppService : ApplicationService, IOperationArticleImageAppService
{
    private readonly IRepository<OperationArticleImage, Guid> _repository;
    private readonly IBlobContainer _blobContainer;
    private readonly BranchAccessChecker _branchAccess;
    private readonly ICurrentClinicBranchResolver _branchResolver;

    public OperationArticleImageAppService(
        IRepository<OperationArticleImage, Guid> repository,
        IBlobContainer blobContainer,
        BranchAccessChecker branchAccess,
        ICurrentClinicBranchResolver branchResolver)
    {
        _repository = repository;
        _blobContainer = blobContainer;
        _branchAccess = branchAccess;
        _branchResolver = branchResolver;
    }

    [Authorize(BlueDentalPermissions.Catalogs.Create)]
    public async Task<OperationArticleImageDto> UploadAsync(UploadOperationArticleImageDto input)
    {
        var clinicBranchId = await _branchAccess.ResolveWriteTargetAsync(
            input.ClinicBranchId,
            _branchResolver.GetRequiredClinicBranchId());

        var fileName = Path.GetFileName(input.File.FileName) ?? "image";

        // The size is only known once the stream has been read, and the domain
        // decides whether it is acceptable — so read it before storing.
        using var buffer = new MemoryStream();
        await input.File.GetStream().CopyToAsync(buffer);

        var id = GuidGenerator.Create();
        var blobName = $"operation-articles/{clinicBranchId}/{id}{Path.GetExtension(fileName)}";

        var entity = new OperationArticleImage(
            id,
            clinicBranchId,
            blobName,
            fileName,
            input.File.ContentType ?? string.Empty,
            buffer.Length);

        buffer.Position = 0;
        await _blobContainer.SaveAsync(blobName, buffer, overrideExisting: true);
        await _repository.InsertAsync(entity, autoSave: true);

        return new OperationArticleImageDto
        {
            Id = entity.Id,
            // Relative on purpose: the body is stored with this inside it, and a
            // host baked in would break the moment the app moved.
            Url = $"/api/v1/app/operations/article-images/{entity.Id}",
            FileName = entity.FileName,
            ContentType = entity.ContentType,
            SizeInBytes = entity.SizeInBytes,
        };
    }

    // The browser fetches this as a plain <img src>, which carries the session
    // cookie — so it is guarded like any other read rather than left open to
    // anyone holding the link.
    [Authorize(BlueDentalPermissions.Catalogs.View)]
    public async Task<IRemoteStreamContent> GetAsync(Guid id)
    {
        var entity = await _repository.FindAsync(id)
            ?? throw new BusinessException(
                BlueDentalDomainErrorCodes.Operations.ImageNotFound,
                "This image no longer exists.");

        await _branchAccess.CheckAsync(entity.ClinicBranchId);

        var stream = await _blobContainer.GetAsync(entity.BlobName);

        return new RemoteStreamContent(stream, entity.FileName, entity.ContentType);
    }
}
