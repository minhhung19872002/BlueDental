using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Organizations;
using BlueDental.PatientManagement;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp;
using Volo.Abp.Application.Dtos;
using Volo.Abp.BlobStoring;
using Volo.Abp.Content;
using Volo.Abp.Domain.Repositories;

namespace BlueDental.Imaging;

/// <summary>
/// Ảnh chưa gán hồ sơ (F-95): the X-ray pictures whose code named no record of
/// the branch, waiting for a staff member to put each on a record — always by
/// a person's choice, the name read off the file being only a suggestion — or
/// set it aside.
/// </summary>
[Authorize]
public class XrayInboxAppService(
    IRepository<XrayInboxItem, Guid> inbox,
    IRepository<XrayDevice, Guid> devices,
    IRepository<Patient, Guid> patients,
    IRepository<PatientImage, Guid> images,
    IBlobContainer blobContainer,
    BranchAccessChecker branchAccess,
    PatientImageWriter writer,
    XrayPatientMatcher matcher) : BlueDentalAppService, IXrayInboxAppService
{
    [Authorize(BlueDentalAbilityPermissions.TreatmentImage.Read)]
    public async Task<PagedResultDto<XrayInboxItemDto>> GetListAsync(GetXrayInboxListInput input)
    {
        var query = await PendingAsync(input.ClinicBranchId);
        var total = await AsyncExecuter.CountAsync(query);
        var items = await AsyncExecuter.ToListAsync(query
            .OrderByDescending(x => x.ReceivedAt)
            .Skip(input.SkipCount)
            .Take(input.MaxResultCount));

        var deviceIds = items.Select(x => x.XrayDeviceId).Distinct().ToList();
        var names = deviceIds.Count > 0
            ? (await devices.GetListAsync(d => deviceIds.Contains(d.Id))).ToDictionary(d => d.Id, d => d.Name)
            : new Dictionary<Guid, string>();

        return new PagedResultDto<XrayInboxItemDto>(total, items.Select(x => new XrayInboxItemDto
        {
            Id = x.Id,
            ClinicBranchId = x.ClinicBranchId,
            XrayDeviceId = x.XrayDeviceId,
            XrayDeviceName = names.GetValueOrDefault(x.XrayDeviceId),
            FileName = x.FileName,
            ContentType = x.ContentType,
            SizeBytes = x.SizeBytes,
            HintCode = x.HintCode,
            HintName = x.HintName,
            HintBirthYear = x.HintBirthYear,
            CapturedAt = x.CapturedAt,
            ReceivedAt = x.ReceivedAt,
            Status = x.Status,
            Url = $"/api/v1/app/xray-inbox/{x.Id}/content",
        }).ToList());
    }

    [Authorize(BlueDentalAbilityPermissions.TreatmentImage.Read)]
    public async Task<int> GetCountAsync(Guid? clinicBranchId) =>
        await AsyncExecuter.CountAsync(await PendingAsync(clinicBranchId));

    [Authorize(BlueDentalAbilityPermissions.TreatmentImage.Read)]
    public async Task<IRemoteStreamContent> GetContentAsync(Guid id)
    {
        var item = await LoadAsync(id);
        var stream = await blobContainer.GetAsync(item.BlobName);
        return new RemoteStreamContent(stream, item.FileName, item.ContentType);
    }

    [Authorize(BlueDentalAbilityPermissions.TreatmentImage.Read)]
    public async Task<List<XrayPatientSuggestionDto>> GetSuggestionsAsync(Guid id) =>
        await matcher.SuggestAsync(await LoadAsync(id));

    [Authorize(BlueDentalAbilityPermissions.TreatmentImage.Create)]
    public async Task<Guid> AssignAsync(Guid id, AssignXrayInboxItemDto input)
    {
        var item = await LoadAsync(id);
        var patient = await patients.FindAsync(input.PatientId);
        // The picture stays in the branch of the PC that took it.
        if (patient == null || patient.BranchId != item.ClinicBranchId)
            throw new BusinessException(BlueDentalDomainErrorCodes.Imaging.PatientUnavailable);

        var now = DateTimeOffset.UtcNow;
        var staffId = CurrentUser.Id!.Value;
        var image = PatientImage.Attach(
            GuidGenerator.Create(),
            patient.Id,
            item.ClinicBranchId,
            item.BlobName,
            item.FileName,
            item.ContentType,
            item.SizeBytes,
            staffId,
            now,
            type: PatientImageType.Before,
            ordering: await writer.NextOrderingAsync(patient.Id, item.ClinicBranchId),
            xrayDeviceId: item.XrayDeviceId);

        item.Assign(patient.Id, image.Id, staffId, now);
        await images.InsertAsync(image);
        await inbox.UpdateAsync(item, autoSave: true);
        return image.Id;
    }

    /// <summary>
    /// Bỏ qua: the row stays as the log of what was received, the bytes go — a
    /// film nobody claims is not kept. The same file sent again stays set aside.
    /// </summary>
    [Authorize(BlueDentalAbilityPermissions.TreatmentImage.Delete)]
    public async Task DiscardAsync(Guid id)
    {
        var item = await LoadAsync(id);
        item.Discard(CurrentUser.Id!.Value, DateTimeOffset.UtcNow);
        await inbox.UpdateAsync(item, autoSave: true);
        await blobContainer.DeleteAsync(item.BlobName);
    }

    private async Task<IQueryable<XrayInboxItem>> PendingAsync(Guid? clinicBranchId)
    {
        var branchFilter = await branchAccess.ResolveFilterAsync(clinicBranchId);
        var query = (await inbox.GetQueryableAsync()).Where(x => x.Status == XrayInboxStatus.Pending);
        return branchFilter.Count > 0 ? query.Where(x => branchFilter.Contains(x.ClinicBranchId)) : query;
    }

    private async Task<XrayInboxItem> LoadAsync(Guid id)
    {
        var item = await inbox.FindAsync(id)
            ?? throw new BusinessException(BlueDentalDomainErrorCodes.Imaging.InboxItemNotFound);
        await branchAccess.CheckAsync(item.ClinicBranchId);
        return item;
    }
}
