using System;
using System.IO;
using System.Security.Cryptography;
using System.Threading.Tasks;
using BlueDental.FileManagement;
using BlueDental.Organizations;
using BlueDental.PatientManagement;
using Microsoft.Extensions.Logging;
using Volo.Abp;
using Volo.Abp.Auditing;
using Volo.Abp.BlobStoring;
using Volo.Abp.Content;
using Volo.Abp.Domain.Repositories;

namespace BlueDental.Imaging;

/// <summary>
/// What BlueDental.XrayAgent on the X-ray PC calls (F-95). No staff account is
/// signed in there: the device token is the credential, and the branch of
/// everything is the device's. Not audited — the inbox item is the log of
/// every file received, and a call log would only repeat it with the token
/// header beside it. Nothing here logs a patient's name.
/// </summary>
[DisableAuditing]
public class XrayStationAppService(
    IRepository<XrayDevice, Guid> devices,
    IRepository<XrayInboxItem, Guid> inbox,
    IRepository<PatientImage, Guid> images,
    IRepository<ClinicBranch, Guid> branches,
    IBlobContainer blobContainer,
    IMalwareScanner malwareScanner,
    PatientImageWriter writer,
    XrayPatientMatcher matcher) : BlueDentalAppService, IXrayStationAppService
{
    public async Task<XrayStationDto> PingAsync(string? token)
    {
        var device = await DeviceAsync(token);
        var branch = await branches.FindAsync(device.ClinicBranchId);
        return new XrayStationDto { DeviceName = device.Name, BranchName = branch?.Name ?? string.Empty };
    }

    public async Task<XrayReceiveResultDto> ReceiveImageAsync(string? token, ReceiveXrayImageDto input)
    {
        var device = await DeviceAsync(token);
        if (input.File == null)
            throw new BusinessException(BlueDentalDomainErrorCodes.Imaging.InvalidImage);

        var bytes = await ReadLimitedAsync(input.File);
        var kind = XrayImageFiles.Detect(bytes)
            ?? throw new BusinessException(BlueDentalDomainErrorCodes.Imaging.InvalidImage);
        var sha256 = Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant();

        // Sent again after a lost answer: the first arrival stands.
        var existing = await inbox.FirstOrDefaultAsync(x => x.XrayDeviceId == device.Id && x.Sha256 == sha256);
        if (existing != null)
            return Result(existing, duplicate: true);

        await EnsureNoMalwareAsync(device, bytes);

        var now = DateTimeOffset.UtcNow;
        var fileName = Path.GetFileName(input.File.FileName ?? string.Empty);
        var itemId = GuidGenerator.Create();
        var patient = await matcher.FindByCodeAsync(device.ClinicBranchId, input.Code);
        var imageId = GuidGenerator.Create();
        var blobName = patient != null
            ? PatientImageWriter.BlobName(patient.Id, imageId, kind.Extension)
            : XrayImageFiles.InboxBlobName(device.ClinicBranchId, itemId, kind.Extension);

        await blobContainer.SaveAsync(blobName, bytes, overrideExisting: true);

        var item = XrayInboxItem.Receive(
            itemId, device, blobName, fileName, kind.ContentType, bytes.Length, sha256,
            input.Code, input.Name, input.BirthYear, input.CapturedAt, now);

        if (patient != null)
        {
            var image = PatientImage.Attach(
                imageId,
                patient.Id,
                device.ClinicBranchId,
                blobName,
                item.FileName,
                kind.ContentType,
                bytes.Length,
                staffId: null,
                takenAt: now,
                type: PatientImageType.Before,
                ordering: await writer.NextOrderingAsync(patient.Id, device.ClinicBranchId),
                xrayDeviceId: device.Id);
            await images.InsertAsync(image);
            item.MarkAutoAssigned(patient.Id, image.Id, now);
        }

        await inbox.InsertAsync(item, autoSave: true);
        Logger.LogInformation(
            "X-ray: device {DeviceId} sent {InboxItemId} ({Status}).", device.Id, item.Id, item.Status);
        return Result(item, duplicate: false);
    }

    public async Task<XrayStationPatientDto> GetPatientByCodeAsync(string? token, string code)
    {
        var device = await DeviceAsync(token);
        var patient = await matcher.FindByCodeAsync(device.ClinicBranchId, code)
            ?? throw new BusinessException(BlueDentalDomainErrorCodes.Imaging.PatientUnavailable);

        return new XrayStationPatientDto
        {
            PatientCode = patient.PatientCode,
            LastName = patient.LastName,
            FirstName = patient.FirstName,
            DateOfBirth = patient.DateOfBirth,
            Gender = patient.Gender,
        };
    }

    private static XrayReceiveResultDto Result(XrayInboxItem item, bool duplicate) => new()
    {
        InboxItemId = item.Id,
        Status = item.Status,
        Duplicate = duplicate,
    };

    private async Task<XrayDevice> DeviceAsync(string? token)
    {
        var trimmed = token?.Trim() ?? string.Empty;
        var device = trimmed.Length == XrayDevice.TokenLength
            ? await FindActiveAsync(XrayDevice.HashToken(trimmed))
            : null;
        if (device == null)
            throw new BusinessException(BlueDentalDomainErrorCodes.Imaging.DeviceNotPaired);

        if (device.Touch(DateTimeOffset.UtcNow))
            await devices.UpdateAsync(device, autoSave: true);

        return device;
    }

    private Task<XrayDevice?> FindActiveAsync(string hash) =>
        devices.FirstOrDefaultAsync(d => d.TokenHash == hash && d.RevokedAt == null);

    /// <summary>Reads at most one byte past the limit, so a huge upload is refused without being held whole.</summary>
    private static async Task<byte[]> ReadLimitedAsync(IRemoteStreamContent file)
    {
        await using var stream = file.GetStream();
        using var buffer = new MemoryStream();
        var chunk = new byte[81920];
        int read;
        while ((read = await stream.ReadAsync(chunk)) > 0)
        {
            buffer.Write(chunk, 0, read);
            if (buffer.Length > PatientImage.MaxSizeBytes)
            {
                throw new BusinessException(BlueDentalDomainErrorCodes.Imaging.ImageTooLarge)
                    .WithData("max", PatientImage.MaxSizeBytes / (1024 * 1024));
            }
        }

        if (buffer.Length == 0)
            throw new BusinessException(BlueDentalDomainErrorCodes.Imaging.InvalidImage);

        return buffer.ToArray();
    }

    /// <summary>Fails closed like chat attachments: a configured scanner that does not answer stores nothing.</summary>
    private async Task EnsureNoMalwareAsync(XrayDevice device, byte[] bytes)
    {
        var result = await malwareScanner.ScanAsync(bytes);
        switch (result.Verdict)
        {
            case MalwareScanVerdict.Infected:
                Logger.LogWarning("X-ray: file from device {DeviceId} refused, malware {Signature}.", device.Id, result.Signature);
                throw new BusinessException(BlueDentalDomainErrorCodes.Imaging.ImageInfected);
            case MalwareScanVerdict.Unavailable:
                throw new BusinessException(BlueDentalDomainErrorCodes.Imaging.MalwareScanUnavailable);
        }
    }
}
