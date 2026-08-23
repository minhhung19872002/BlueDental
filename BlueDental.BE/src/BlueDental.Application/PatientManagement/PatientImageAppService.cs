using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Organizations;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;
using Volo.Abp.BlobStoring;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Identity;

namespace BlueDental.PatientManagement;

/// <summary>
/// Hình ảnh bệnh nhân.
///
/// The image bytes go to object storage (MinIO); PostgreSQL keeps only the blob
/// name, which is why nothing here ever reads a byte array out of the database.
/// </summary>
[Authorize]
public class PatientImageAppService : ApplicationService, IPatientImageAppService
{
    private readonly IRepository<PatientImage, Guid> _repository;
    private readonly IBlobContainer _blobContainer;
    private readonly IIdentityUserRepository _userRepository;
    private readonly BranchAccessChecker _branchAccess;

    public PatientImageAppService(
        IRepository<PatientImage, Guid> repository,
        IBlobContainer blobContainer,
        IIdentityUserRepository userRepository,
        BranchAccessChecker branchAccess)
    {
        _repository = repository;
        _blobContainer = blobContainer;
        _userRepository = userRepository;
        _branchAccess = branchAccess;
    }

    [Authorize(BlueDentalAbilityPermissions.TreatmentImage.Read)]
    public async Task<PagedResultDto<PatientImageDto>> GetListAsync(GetPatientImageListInput input)
    {
        var branchFilter = await _branchAccess.ResolveFilterAsync(input.ClinicBranchId);
        var query = await _repository.GetQueryableAsync();

        if (branchFilter.Count > 0)
            query = query.Where(x => branchFilter.Contains(x.ClinicBranchId));
        if (input.PatientId.HasValue)
            query = query.Where(x => x.PatientId == input.PatientId.Value);
        if (input.TreatmentStageId.HasValue)
            query = query.Where(x => x.TreatmentStageId == input.TreatmentStageId.Value);

        var totalCount = query.Count();
        var items = query
            .OrderByDescending(x => x.TakenAt)
            .Skip(input.SkipCount)
            .Take(input.MaxResultCount)
            .ToList();

        return new PagedResultDto<PatientImageDto>(totalCount, await MapManyAsync(items));
    }

    [Authorize(BlueDentalAbilityPermissions.TreatmentImage.Create)]
    public async Task<PatientImageDto> UploadAsync(UploadPatientImageDto input)
    {
        await _branchAccess.CheckAsync(input.ClinicBranchId);

        if (input.File == null)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.PatientManagement.InvalidImageFile,
                "No file was uploaded.");
        }

        var id = GuidGenerator.Create();
        var blobName = $"patients/{input.PatientId}/{id}{Path.GetExtension(input.File.FileName)}";

        await using var stream = input.File.GetStream();
        using var buffer = new MemoryStream();
        await stream.CopyToAsync(buffer);

        // The size is only known once the stream has been read, and the domain is
        // what decides whether it is acceptable — so validate before storing.
        var image = PatientImage.Attach(
            id,
            input.PatientId,
            input.ClinicBranchId,
            blobName,
            input.File.FileName ?? "image",
            input.File.ContentType ?? string.Empty,
            buffer.Length,
            // The uploader is whoever is signed in — never a client-supplied id.
            CurrentUser.Id!.Value,
            Clock.Now,
            input.TreatmentPlanId,
            input.TreatmentStageId,
            input.Note);

        buffer.Position = 0;
        await _blobContainer.SaveAsync(blobName, buffer, overrideExisting: true);

        await _repository.InsertAsync(image, autoSave: true);
        return (await MapManyAsync([image])).Single();
    }

    [Authorize(BlueDentalAbilityPermissions.TreatmentImage.Read)]
    public async Task<Stream> GetContentAsync(Guid id)
    {
        var image = await LoadAsync(id);

        return await _blobContainer.GetAsync(image.BlobName);
    }

    [Authorize(BlueDentalAbilityPermissions.TreatmentImage.Delete)]
    public async Task DeleteAsync(Guid id)
    {
        var image = await LoadAsync(id);

        await _repository.DeleteAsync(id, autoSave: true);
        await _blobContainer.DeleteAsync(image.BlobName);
    }

    private async Task<PatientImage> LoadAsync(Guid id)
    {
        var image = await _repository.FindAsync(id)
            ?? throw new BusinessException(
                BlueDentalDomainErrorCodes.PatientManagement.PatientImageNotFound,
                "Image not found.");

        await _branchAccess.CheckAsync(image.ClinicBranchId);
        return image;
    }

    private async Task<List<PatientImageDto>> MapManyAsync(IReadOnlyCollection<PatientImage> items)
    {
        if (items.Count == 0)
        {
            return [];
        }

        var staffIds = items.Select(x => x.StaffId).Distinct().ToList();
        var users = await _userRepository.GetListByIdsAsync(staffIds);
        var staffNames = users.ToDictionary(u => u.Id, u => u.Name ?? u.UserName);

        return items.Select(x => new PatientImageDto
        {
            Id = x.Id,
            PatientId = x.PatientId,
            ClinicBranchId = x.ClinicBranchId,
            TreatmentPlanId = x.TreatmentPlanId,
            TreatmentStageId = x.TreatmentStageId,
            FileName = x.FileName,
            ContentType = x.ContentType,
            SizeBytes = x.SizeBytes,
            Note = x.Note,
            StaffId = x.StaffId,
            TakenAt = x.TakenAt,
            Url = $"/api/v1/app/patient-images/{x.Id}/content",
            StaffName = staffNames.TryGetValue(x.StaffId, out var staff) ? staff : null,
            CreationTime = x.CreationTime,
            CreatorId = x.CreatorId,
            LastModificationTime = x.LastModificationTime,
            LastModifierId = x.LastModifierId
        }).ToList();
    }
}
