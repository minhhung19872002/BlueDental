using System;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Organizations;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp;
using Volo.Abp.Authorization;
using Volo.Abp.BlobStoring;
using Volo.Abp.Content;
using Volo.Abp.Domain.Entities;
using Volo.Abp.Domain.Repositories;

namespace BlueDental.PatientManagement;

[Authorize]
public class PatientGuardianDocumentAppService : BlueDentalAppService, IPatientGuardianDocumentAppService
{
    private readonly IRepository<Patient, Guid> _patientRepository;
    private readonly IBlobContainer _blobContainer;
    private readonly ICurrentClinicBranchResolver _branchResolver;

    public PatientGuardianDocumentAppService(
        IRepository<Patient, Guid> patientRepository,
        IBlobContainer blobContainer,
        ICurrentClinicBranchResolver branchResolver)
    {
        _patientRepository = patientRepository;
        _blobContainer = blobContainer;
        _branchResolver = branchResolver;
    }

    public async Task<GuardianDocumentDto> UploadAsync(IRemoteStreamContent file)
    {
        // The popup sits on both the create and the edit dialog, so either right will do.
        if (!await AuthorizationService.IsGrantedAnyAsync(
                BlueDentalAbilityPermissions.Patient.Create,
                BlueDentalAbilityPermissions.Patient.Update))
        {
            throw new AbpAuthorizationException();
        }

        var branchId = _branchResolver.GetRequiredClinicBranchId();
        var fileName = Path.GetFileName(file.FileName ?? string.Empty);
        var contentType = PatientGuardianDocuments.ContentTypeOf(fileName) ?? throw InvalidDocument();

        // Read one byte past the cap so an oversized file is caught without buffering all of it.
        using var buffer = new MemoryStream();
        var source = file.GetStream();
        var chunk = new byte[81920];
        int read;
        while ((read = await source.ReadAsync(chunk)) > 0)
        {
            buffer.Write(chunk, 0, read);
            if (buffer.Length > PatientGuardianConsts.MaxProofFileBytes)
            {
                throw InvalidDocument();
            }
        }

        if (buffer.Length == 0
            || !PatientGuardianDocuments.HasExpectedSignature(buffer.GetBuffer().AsSpan(0, (int)Math.Min(buffer.Length, 8)), contentType))
        {
            throw InvalidDocument();
        }

        var blobName = PatientGuardianDocuments.BranchPrefix(branchId)
            + GuidGenerator.Create()
            + Path.GetExtension(fileName).ToLowerInvariant();

        buffer.Position = 0;
        await _blobContainer.SaveAsync(blobName, buffer, overrideExisting: true);

        return new GuardianDocumentDto
        {
            BlobName = blobName,
            FileName = fileName,
            ContentType = contentType,
            SizeInBytes = buffer.Length,
        };
    }

    [Authorize(BlueDentalAbilityPermissions.Patient.Read)]
    public async Task<IRemoteStreamContent> GetAsync(Guid patientId, Guid guardianId)
    {
        var patient = await _patientRepository.GetAsync(patientId);
        if (patient.BranchId != _branchResolver.GetRequiredClinicBranchId())
        {
            throw new EntityNotFoundException(typeof(Patient), patientId);
        }

        var guardian = patient.Guardians.FirstOrDefault(g => g.Id == guardianId);
        if (guardian?.ProofBlobName is null)
        {
            throw new EntityNotFoundException(typeof(PatientGuardian), guardianId);
        }

        var stream = await _blobContainer.GetAsync(guardian.ProofBlobName);
        var fileName = guardian.ProofFileName ?? Path.GetFileName(guardian.ProofBlobName);

        return new RemoteStreamContent(
            stream,
            fileName,
            PatientGuardianDocuments.ContentTypeOf(guardian.ProofBlobName) ?? "application/octet-stream");
    }

    private static BusinessException InvalidDocument() =>
        new(BlueDentalDomainErrorCodes.PatientManagement.InvalidGuardianDocument);
}
