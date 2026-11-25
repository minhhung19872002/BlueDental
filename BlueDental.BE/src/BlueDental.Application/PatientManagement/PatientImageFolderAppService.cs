using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Organizations;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp;
using Volo.Abp.Application.Services;
using Volo.Abp.Domain.Repositories;

namespace BlueDental.PatientManagement;

/// <summary>
/// Thư mục of the Hình ảnh tab (F-98). A folder lives in one stage column of
/// one patient, holds pictures and nothing else, and on delete hands its
/// pictures back to the column — the tab never loses a picture to a folder.
/// </summary>
[Authorize]
public class PatientImageFolderAppService(
    IRepository<PatientImageFolder, Guid> folders,
    IRepository<PatientImage, Guid> images,
    BranchAccessChecker branchAccess) : ApplicationService, IPatientImageFolderAppService
{
    /// <summary>Folders read the way Explorer lists them: by name, as Vietnamese is sorted.</summary>
    private static readonly StringComparer NameOrder =
        StringComparer.Create(CultureInfo.GetCultureInfo("vi-VN"), CompareOptions.IgnoreCase);

    [Authorize(BlueDentalAbilityPermissions.TreatmentImage.Read)]
    public async Task<List<PatientImageFolderDto>> GetListAsync(GetPatientImageFolderListInput input)
    {
        var branchFilter = await branchAccess.ResolveFilterAsync(input.ClinicBranchId);
        var query = (await folders.GetQueryableAsync()).Where(x => x.PatientId == input.PatientId);
        if (branchFilter.Count > 0)
            query = query.Where(x => branchFilter.Contains(x.ClinicBranchId));
        if (input.Type.HasValue)
            query = query.Where(x => x.Type == input.Type.Value);

        var list = await AsyncExecuter.ToListAsync(query);
        return (await MapManyAsync(list)).OrderBy(x => x.Name, NameOrder).ToList();
    }

    [Authorize(BlueDentalAbilityPermissions.TreatmentImage.Create)]
    public async Task<PatientImageFolderDto> CreateAsync(CreatePatientImageFolderDto input)
    {
        await branchAccess.CheckAsync(input.ClinicBranchId);

        var folder = PatientImageFolder.Create(
            GuidGenerator.Create(), input.PatientId, input.ClinicBranchId, input.Type, input.Name);
        await EnsureNameFreeAsync(folder);

        await folders.InsertAsync(folder, autoSave: true);
        return (await MapManyAsync([folder])).Single();
    }

    [Authorize(BlueDentalAbilityPermissions.TreatmentImage.Update)]
    public async Task<PatientImageFolderDto> RenameAsync(Guid id, RenamePatientImageFolderDto input)
    {
        var folder = await LoadAsync(id);
        folder.Rename(input.Name);
        await EnsureNameFreeAsync(folder);

        await folders.UpdateAsync(folder, autoSave: true);
        return (await MapManyAsync([folder])).Single();
    }

    [Authorize(BlueDentalAbilityPermissions.TreatmentImage.Delete)]
    public async Task DeleteAsync(Guid id)
    {
        var folder = await LoadAsync(id);

        var filed = await images.GetListAsync(x => x.FolderId == folder.Id);
        foreach (var image in filed)
            image.FileInto(null);
        if (filed.Count > 0)
            await images.UpdateManyAsync(filed, autoSave: true);

        await folders.DeleteAsync(folder, autoSave: true);
    }

    /// <summary>Two folders of one column never share a name, whatever the case or spacing.</summary>
    private async Task EnsureNameFreeAsync(PatientImageFolder folder)
    {
        var key = PatientImageFolder.NameKey(folder.Name);
        var siblings = await folders.GetListAsync(x =>
            x.PatientId == folder.PatientId
            && x.ClinicBranchId == folder.ClinicBranchId
            && x.Type == folder.Type
            && x.Id != folder.Id);

        if (siblings.Any(x => PatientImageFolder.NameKey(x.Name) == key))
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.PatientManagement.DuplicateImageFolderName,
                "This stage already has a folder by that name.");
        }
    }

    private async Task<PatientImageFolder> LoadAsync(Guid id)
    {
        var folder = await folders.FindAsync(id)
            ?? throw new BusinessException(
                BlueDentalDomainErrorCodes.PatientManagement.PatientImageFolderNotFound,
                "Folder not found.");

        await branchAccess.CheckAsync(folder.ClinicBranchId);
        return folder;
    }

    /// <summary>
    /// Each folder with how many pictures it holds and the one its feed opens
    /// on — the newest in the column's order — as the cover.
    /// </summary>
    private async Task<List<PatientImageFolderDto>> MapManyAsync(IReadOnlyCollection<PatientImageFolder> items)
    {
        if (items.Count == 0)
            return [];

        var ids = items.Select(x => x.Id).ToList();
        var filed = await AsyncExecuter.ToListAsync(
            (await images.GetQueryableAsync())
                .Where(x => x.FolderId != null && ids.Contains(x.FolderId.Value))
                .Select(x => new { x.Id, FolderId = x.FolderId!.Value, x.Ordering, x.TakenAt }));

        var byFolder = filed
            .GroupBy(x => x.FolderId)
            .ToDictionary(
                g => g.Key,
                g => (Count: g.Count(),
                      CoverId: g.OrderByDescending(x => x.Ordering).ThenByDescending(x => x.TakenAt).First().Id));

        return items.Select(x =>
        {
            var hasPictures = byFolder.TryGetValue(x.Id, out var content);
            return new PatientImageFolderDto
            {
                Id = x.Id,
                PatientId = x.PatientId,
                ClinicBranchId = x.ClinicBranchId,
                Type = x.Type,
                Name = x.Name,
                ImageCount = hasPictures ? content.Count : 0,
                CoverUrl = hasPictures ? $"/api/v1/app/patient-images/{content.CoverId}/content" : null,
                CreationTime = x.CreationTime,
                CreatorId = x.CreatorId,
                LastModificationTime = x.LastModificationTime,
                LastModifierId = x.LastModifierId
            };
        }).ToList();
    }
}
