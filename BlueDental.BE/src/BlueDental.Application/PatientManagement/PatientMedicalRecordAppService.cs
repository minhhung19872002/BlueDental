using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Organizations;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp.Application.Dtos;
using Volo.Abp;
using Volo.Abp.Application.Services;
using Volo.Abp.BlobStoring;
using Volo.Abp.Content;
using Volo.Abp.Domain.Entities;
using Volo.Abp.Domain.Repositories;

namespace BlueDental.PatientManagement;

/// <summary>
/// Bệnh án — the sheets a patient's record is made of.
///
/// The reference reads them per patient
/// (<c>GET /patient-medical-record/files/{patientId}</c>) and the index adds one
/// at a time, so this is an ordinary branch-scoped collection: list, add,
/// save, remove. The sheet's printed layout lives on the client; only the
/// cells the clinic filled in are stored.
/// </summary>
[Authorize]
public class PatientMedicalRecordAppService : ApplicationService, IPatientMedicalRecordAppService
{
    private readonly IRepository<PatientMedicalRecord, Guid> _repository;
    private readonly IRepository<Patient, Guid> _patientRepository;
    private readonly BranchAccessChecker _branchAccess;
    private readonly IBlobContainer _blobContainer;

    public PatientMedicalRecordAppService(
        IRepository<PatientMedicalRecord, Guid> repository,
        IRepository<Patient, Guid> patientRepository,
        BranchAccessChecker branchAccess,
        IBlobContainer blobContainer)
    {
        _repository = repository;
        _patientRepository = patientRepository;
        _branchAccess = branchAccess;
        _blobContainer = blobContainer;
    }

    [Authorize(BlueDentalAbilityPermissions.PatientMedicalRecord.Read)]
    public async Task<PagedResultDto<PatientMedicalRecordDto>> GetListAsync(
        GetPatientMedicalRecordListInput input)
    {
        var branchFilter = await _branchAccess.ResolveFilterAsync(null);
        var query = await _repository.GetQueryableAsync();

        if (branchFilter.Count > 0)
        {
            query = query.Where(x => branchFilter.Contains(x.ClinicBranchId));
        }

        if (input.PatientId.HasValue)
        {
            query = query.Where(x => x.PatientId == input.PatientId.Value);
        }

        if (input.Form.HasValue)
        {
            query = query.Where(x => x.Form == input.Form.Value);
        }

        var totalCount = await AsyncExecuter.CountAsync(query);

        // The index is an ordered stack, so the order is part of the record —
        // CreationTime only breaks a tie between two sheets added together.
        var items = await AsyncExecuter.ToListAsync(
            query
                .OrderBy(x => x.SortOrder)
                .ThenBy(x => x.CreationTime)
                .Skip(input.SkipCount)
                .Take(input.MaxResultCount));

        return new PagedResultDto<PatientMedicalRecordDto>(totalCount, items.Select(MapToDto).ToList());
    }

    [Authorize(BlueDentalAbilityPermissions.PatientMedicalRecord.Read)]
    public async Task<PatientMedicalRecordDto> GetAsync(Guid id)
    {
        var entity = await _repository.GetAsync(id);
        await GuardBranchAccessAsync(entity);
        return MapToDto(entity);
    }

    [Authorize(BlueDentalAbilityPermissions.PatientMedicalRecord.Create)]
    public async Task<PatientMedicalRecordDto> CreateAsync(CreatePatientMedicalRecordDto input)
    {
        // A sheet belongs to the branch its patient does — the clinic never
        // picks one, so there is nothing here to spoof.
        var patient = await _patientRepository.GetAsync(input.PatientId);
        await _branchAccess.CheckAsync(patient.BranchId);

        var query = await _repository.GetQueryableAsync();
        var nextOrder = await AsyncExecuter.CountAsync(
            query.Where(x => x.PatientId == input.PatientId));

        var record = PatientMedicalRecord.Add(
            GuidGenerator.Create(),
            input.PatientId,
            patient.BranchId,
            input.Form,
            input.Title,
            nextOrder);

        await _repository.InsertAsync(record, autoSave: true);
        return MapToDto(record);
    }

    [Authorize(BlueDentalAbilityPermissions.PatientMedicalRecord.Update)]
    public async Task<PatientMedicalRecordDto> UpdateAsync(Guid id, UpdatePatientMedicalRecordDto input)
    {
        var record = await _repository.GetAsync(id);
        await GuardBranchAccessAsync(record);

        if (!string.IsNullOrWhiteSpace(input.Title))
        {
            record.Rename(input.Title);
        }

        // Only when the caller actually sent content. A rename carries just the
        // title, so filling unconditionally would erase everything on the sheet;
        // clearing it is done by sending an empty document, not by omission.
        if (input.Content is not null)
        {
            var drawnBefore = MedicalRecordDrawing.IdsIn(record.Id, record.Content);
            record.Fill(input.Content);
            DropDrawingsNoLongerLinked(record, drawnBefore);
        }

        await _repository.UpdateAsync(record, autoSave: true);
        return MapToDto(record);
    }

    [Authorize(BlueDentalAbilityPermissions.PatientMedicalRecord.Delete)]
    public async Task DeleteAsync(Guid id)
    {
        var record = await _repository.GetAsync(id);
        await GuardBranchAccessAsync(record);
        await _repository.DeleteAsync(record, autoSave: true);
    }

    /// <summary>
    /// Writing on the sheet is what this guards, so it asks for the same right a
    /// save does. The picture is checked by its own bytes — see
    /// <see cref="MedicalRecordDrawing.EnsureValid"/> — and never overwrites one
    /// already stored: an edit is a new drawing.
    /// </summary>
    [Authorize(BlueDentalAbilityPermissions.PatientMedicalRecord.Update)]
    public async Task<MedicalRecordDrawingDto> UploadDrawingAsync(Guid id, UploadMedicalRecordDrawingDto input)
    {
        var record = await _repository.GetAsync(id);
        await GuardBranchAccessAsync(record);

        var bytes = input.File is null ? [] : await ReadAtMostAsync(input.File.GetStream(), MedicalRecordDrawing.MaxSizeInBytes + 1);
        MedicalRecordDrawing.EnsureValid(bytes);

        var drawingId = GuidGenerator.Create();
        await _blobContainer.SaveAsync(MedicalRecordDrawing.BlobNameOf(record.Id, drawingId), bytes);

        return new MedicalRecordDrawingDto
        {
            Id = drawingId,
            Url = $"/api/v1/app/patient-medical-records/{record.Id}/drawings/{drawingId}",
        };
    }

    // Fetched as a plain <img src> carrying the session cookie, so it is guarded
    // like any read of the sheet — a link alone opens nothing.
    [Authorize(BlueDentalAbilityPermissions.PatientMedicalRecord.Read)]
    public async Task<IRemoteStreamContent> GetDrawingAsync(Guid id, Guid drawingId)
    {
        var record = await _repository.GetAsync(id);
        await GuardBranchAccessAsync(record);

        var stream = await _blobContainer.GetOrNullAsync(MedicalRecordDrawing.BlobNameOf(record.Id, drawingId))
            ?? throw new EntityNotFoundException(typeof(PatientMedicalRecord), drawingId);

        return new RemoteStreamContent(stream, $"{drawingId}.png", MedicalRecordDrawing.ContentType);
    }

    /// <summary>
    /// A drawing the sheet stopped linking to — erased, or replaced by an edit —
    /// is patient data nobody can reach any more, so it goes. Only once the save
    /// has committed: dropping it first and then failing would lose the picture
    /// the sheet still shows.
    /// </summary>
    private void DropDrawingsNoLongerLinked(PatientMedicalRecord record, IReadOnlySet<Guid> drawnBefore)
    {
        var dropped = drawnBefore.Except(MedicalRecordDrawing.IdsIn(record.Id, record.Content)).ToList();
        if (dropped.Count == 0) return;

        var unitOfWork = UnitOfWorkManager.Current;
        if (unitOfWork is null) return;

        unitOfWork.OnCompleted(async () =>
        {
            foreach (var drawingId in dropped)
            {
                await _blobContainer.DeleteAsync(MedicalRecordDrawing.BlobNameOf(record.Id, drawingId));
            }
        });
    }

    /// <summary>Reads up to <paramref name="limit"/> bytes, so an oversized upload is never held whole.</summary>
    private static async Task<byte[]> ReadAtMostAsync(Stream stream, int limit)
    {
        using var buffer = new MemoryStream();
        var chunk = new byte[81920];
        int read;
        while (buffer.Length < limit && (read = await stream.ReadAsync(chunk.AsMemory(0, (int)Math.Min(chunk.Length, limit - buffer.Length)))) > 0)
        {
            buffer.Write(chunk, 0, read);
        }

        return buffer.ToArray();
    }

    /// <summary>
    /// A sheet the caller's branch may not see is reported as missing rather
    /// than forbidden, so the API never confirms that someone else's record
    /// exists.
    /// </summary>
    private async Task GuardBranchAccessAsync(PatientMedicalRecord record)
    {
        if (!await _branchAccess.IsAllowedAsync(record.ClinicBranchId))
        {
            throw new EntityNotFoundException(typeof(PatientMedicalRecord), record.Id);
        }
    }

    private static PatientMedicalRecordDto MapToDto(PatientMedicalRecord entity) => new()
    {
        Id = entity.Id,
        PatientId = entity.PatientId,
        ClinicBranchId = entity.ClinicBranchId,
        Form = entity.Form,
        Title = entity.Title,
        SortOrder = entity.SortOrder,
        Content = entity.Content,
        CreationTime = entity.CreationTime,
        CreatorId = entity.CreatorId,
        LastModificationTime = entity.LastModificationTime,
        LastModifierId = entity.LastModifierId,
    };
}
