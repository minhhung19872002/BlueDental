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
using Volo.Abp.Identity;

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
    private readonly IRepository<MedicalRecordSet, Guid> _setRepository;
    private readonly IIdentityUserRepository _userRepository;
    private readonly BranchAccessChecker _branchAccess;
    private readonly IBlobContainer _blobContainer;

    public PatientMedicalRecordAppService(
        IRepository<PatientMedicalRecord, Guid> repository,
        IRepository<Patient, Guid> patientRepository,
        IRepository<MedicalRecordSet, Guid> setRepository,
        IIdentityUserRepository userRepository,
        BranchAccessChecker branchAccess,
        IBlobContainer blobContainer)
    {
        _repository = repository;
        _patientRepository = patientRepository;
        _setRepository = setRepository;
        _userRepository = userRepository;
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

        if (input.RecordSetId.HasValue)
        {
            query = query.Where(x => x.RecordSetId == input.RecordSetId.Value);
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

        var dtos = items.Select(MapToDto).ToList();
        await FillCancellerNamesAsync(dtos);
        return new PagedResultDto<PatientMedicalRecordDto>(totalCount, dtos);
    }

    [Authorize(BlueDentalAbilityPermissions.PatientMedicalRecord.Read)]
    public async Task<PatientMedicalRecordDto> GetAsync(Guid id)
    {
        var entity = await _repository.GetAsync(id);
        await GuardBranchAccessAsync(entity);
        return await MapWithCancellerAsync(entity);
    }

    [Authorize(BlueDentalAbilityPermissions.PatientMedicalRecord.Read)]
    public async Task<MedicalRecordPhonesDto> GetPhonesAsync(Guid patientId)
    {
        var patient = await _patientRepository.GetAsync(patientId);
        await _branchAccess.CheckAsync(patient.BranchId);

        return new MedicalRecordPhonesDto
        {
            PatientPhone = patient.Contact?.PhoneNumber,
            GuardianPhones = patient.Guardians.ToDictionary(guardian => guardian.Id, guardian => guardian.Phone),
        };
    }

    [Authorize(BlueDentalAbilityPermissions.PatientMedicalRecord.Create)]
    public async Task<PatientMedicalRecordDto> CreateAsync(CreatePatientMedicalRecordDto input)
    {
        // A sheet belongs to the branch its patient does — the clinic never
        // picks one, so there is nothing here to spoof.
        var patient = await _patientRepository.GetAsync(input.PatientId);
        await _branchAccess.CheckAsync(patient.BranchId);

        // A sheet goes into one of the patient's own live sets — never another
        // patient's, never a cancelled one.
        var set = await _setRepository.FindAsync(input.RecordSetId, includeDetails: false);
        if (set is null || set.PatientId != patient.Id)
        {
            throw new EntityNotFoundException(typeof(MedicalRecordSet), input.RecordSetId);
        }

        set.EnsureActive();

        var query = await _repository.GetQueryableAsync();
        var nextOrder = await AsyncExecuter.CountAsync(
            query.Where(x => x.PatientId == input.PatientId));

        var record = PatientMedicalRecord.Add(
            GuidGenerator.Create(),
            input.PatientId,
            patient.BranchId,
            set.Id,
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
        await EnsureWritableAsync(record);

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

    /// <summary>
    /// "Hủy phiếu" stands where removing a sheet used to: a sheet is part of the
    /// medical record, so it is kept, marked Đã hủy, with who, when and why.
    /// </summary>
    [Authorize(BlueDentalAbilityPermissions.PatientMedicalRecord.Delete)]
    public async Task<PatientMedicalRecordDto> CancelAsync(Guid id, CancelPatientMedicalRecordDto input)
    {
        var record = await _repository.GetAsync(id);
        await GuardBranchAccessAsync(record);
        await EnsureWritableAsync(record);

        record.Cancel(input.Reason, Clock.Now, CurrentUser.Id);

        await _repository.UpdateAsync(record, autoSave: true);
        return await MapWithCancellerAsync(record);
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
        await EnsureWritableAsync(record);

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

    /// <summary>A cancelled sheet, or any sheet of a cancelled set, no longer changes.</summary>
    private async Task EnsureWritableAsync(PatientMedicalRecord record)
    {
        record.EnsureNotCancelled();
        var set = await _setRepository.GetAsync(record.RecordSetId, includeDetails: false);
        set.EnsureActive();
    }

    private async Task<PatientMedicalRecordDto> MapWithCancellerAsync(PatientMedicalRecord entity)
    {
        var dto = MapToDto(entity);
        await FillCancellerNamesAsync([dto]);
        return dto;
    }

    /// <summary>"Người hủy" — logged on the sheet by id, shown by name.</summary>
    private async Task FillCancellerNamesAsync(IReadOnlyCollection<PatientMedicalRecordDto> dtos)
    {
        var ids = dtos.Where(d => d.CancelledById.HasValue).Select(d => d.CancelledById!.Value).Distinct().ToList();
        if (ids.Count == 0) return;

        var names = (await _userRepository.GetListByIdsAsync(ids)).ToDictionary(u => u.Id, u => u.Name ?? u.UserName);
        foreach (var dto in dtos.Where(d => d.CancelledById.HasValue))
        {
            dto.CancellerName = names.GetValueOrDefault(dto.CancelledById!.Value);
        }
    }

    private static PatientMedicalRecordDto MapToDto(PatientMedicalRecord entity) => new()
    {
        Id = entity.Id,
        PatientId = entity.PatientId,
        ClinicBranchId = entity.ClinicBranchId,
        RecordSetId = entity.RecordSetId,
        Form = entity.Form,
        Title = entity.Title,
        SortOrder = entity.SortOrder,
        Content = entity.Content,
        CancelledAt = entity.CancelledAt,
        CancelledById = entity.CancelledById,
        CancelReason = entity.CancelReason,
        CreationTime = entity.CreationTime,
        CreatorId = entity.CreatorId,
        LastModificationTime = entity.LastModificationTime,
        LastModifierId = entity.LastModifierId,
    };
}
