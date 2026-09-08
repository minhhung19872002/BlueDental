using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Organizations;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;
using Volo.Abp.Data;
using Volo.Abp.Domain.Repositories;

namespace BlueDental.TreatmentManagement;

/// <summary>
/// Báo giá — the "BG n" tabs on Chẩn đoán and Tư vấn.
///
/// Stores only the set of consulting lines, their order and their ticks; the
/// money is worked out from the lines themselves on every read, so a corrected
/// price is never stale on a quote.
///
/// Scoped by <c>X-Clinic-Branch-Id</c> the same way the consulting list is, and
/// a quote of another branch answers the same "not found" as one that never
/// existed.
/// </summary>
[Authorize(BlueDentalPermissions.TreatmentManagement.Default)]
public class PatientQuoteAppService : ApplicationService, IPatientQuoteAppService
{
    private readonly IRepository<PatientQuote, Guid> _repository;
    private readonly IRepository<PatientAdvise, Guid> _adviseRepository;
    private readonly ICurrentClinicBranchResolver _branchResolver;
    private readonly IDataFilter<ISoftDelete> _softDeleteFilter;

    public PatientQuoteAppService(
        IRepository<PatientQuote, Guid> repository,
        IRepository<PatientAdvise, Guid> adviseRepository,
        ICurrentClinicBranchResolver branchResolver,
        IDataFilter<ISoftDelete> softDeleteFilter)
    {
        _repository = repository;
        _adviseRepository = adviseRepository;
        _branchResolver = branchResolver;
        _softDeleteFilter = softDeleteFilter;
    }

    [Authorize(BlueDentalAbilityPermissions.TreatmentConsultation.Read)]
    public async Task<PagedResultDto<PatientQuoteDto>> GetListAsync(GetPatientQuoteListInput input)
    {
        var clinicBranchId = _branchResolver.GetRequiredClinicBranchId();
        var query = await _repository.GetQueryableAsync();

        query = query.Where(x => x.ClinicBranchId == clinicBranchId);
        if (input.PatientId.HasValue)
            query = query.Where(x => x.PatientId == input.PatientId.Value);

        var rows = query.ToList();
        var items = rows
            // Newest first, as the tab strip stacks them.
            .OrderByDescending(x => x.Ordinal)
            .Skip(input.SkipCount)
            .Take(input.MaxResultCount)
            .Select(MapToDto)
            .ToList();

        return new PagedResultDto<PatientQuoteDto>(rows.Count, items);
    }

    [Authorize(BlueDentalAbilityPermissions.TreatmentConsultation.Create)]
    public async Task<PatientQuoteDto> CreateAsync(CreatePatientQuoteDto input)
    {
        var clinicBranchId = _branchResolver.GetRequiredClinicBranchId();
        var adviseIds = input.AdviseIds.Distinct().ToList();

        await GuardAdvisesAsync(adviseIds, input.PatientId, clinicBranchId);

        var quote = PatientQuote.Raise(
            GuidGenerator.Create(),
            input.PatientId,
            clinicBranchId,
            await NextOrdinalAsync(input.PatientId, clinicBranchId),
            adviseIds.Select((id, index) => new PatientQuoteLine(id, true, index + 1)));

        await _repository.InsertAsync(quote, autoSave: true);
        return MapToDto(quote);
    }

    [Authorize(BlueDentalAbilityPermissions.TreatmentConsultation.Create)]
    public async Task<PatientQuoteDto> DuplicateAsync(Guid id)
    {
        var source = await LoadAsync(id);

        var copy = PatientQuote.Raise(
            GuidGenerator.Create(),
            source.PatientId,
            source.ClinicBranchId,
            await NextOrdinalAsync(source.PatientId, source.ClinicBranchId),
            source.CopyLines());

        await _repository.InsertAsync(copy, autoSave: true);
        return MapToDto(copy);
    }

    [Authorize(BlueDentalAbilityPermissions.TreatmentConsultation.Update)]
    public async Task<PatientQuoteDto> UpdateAsync(Guid id, UpdatePatientQuoteDto input)
    {
        var quote = await LoadAsync(id);

        await GuardAdvisesAsync(
            input.Lines.Select(line => line.AdviseId).Distinct().ToList(),
            quote.PatientId,
            quote.ClinicBranchId);

        quote.SetLines(
            input.Lines.Select(line => new PatientQuoteLine(line.AdviseId, line.IsSelected, line.SortOrder)));

        await _repository.UpdateAsync(quote, autoSave: true);
        return MapToDto(quote);
    }

    [Authorize(BlueDentalAbilityPermissions.TreatmentConsultation.Delete)]
    public async Task DeleteAsync(Guid id)
    {
        var quote = await LoadAsync(id);
        await _repository.DeleteAsync(quote, autoSave: true);
    }

    /// <summary>
    /// Answered the same way whether the quote is missing or belongs to another
    /// branch, so a guessed id cannot tell the two apart.
    /// </summary>
    private async Task<PatientQuote> LoadAsync(Guid id)
    {
        var clinicBranchId = _branchResolver.GetRequiredClinicBranchId();
        var quote = await _repository.FindAsync(id);

        if (quote is null || quote.ClinicBranchId != clinicBranchId)
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.PatientQuoteNotFound,
                "Quote not found.");

        return quote;
    }

    /// <summary>
    /// Every line must be a consulting line of this patient and branch — a
    /// quote must not be able to name a row from someone else's record.
    /// </summary>
    private async Task GuardAdvisesAsync(List<Guid> adviseIds, Guid patientId, Guid clinicBranchId)
    {
        if (adviseIds.Count == 0)
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.InvalidAdviseTransition,
                "A quote needs at least one consulting line.");

        var query = await _adviseRepository.GetQueryableAsync();
        var owned = query
            .Where(x => x.PatientId == patientId && x.ClinicBranchId == clinicBranchId)
            .Where(x => adviseIds.Contains(x.Id))
            .Select(x => x.Id)
            .ToList();

        var stranger = adviseIds.Except(owned).ToList();
        if (stranger.Count > 0)
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.PatientAdviseNotFound,
                $"Consulting line {stranger[0]} does not belong to this record.");
    }

    /// <summary>
    /// Numbers climb per patient and never repeat: counted with the soft-delete
    /// filter off, so dropping "BG 1" does not hand its number to the next one.
    /// </summary>
    private async Task<int> NextOrdinalAsync(Guid patientId, Guid clinicBranchId)
    {
        using (_softDeleteFilter.Disable())
        {
            var query = await _repository.GetQueryableAsync();
            var used = query.Count(x => x.PatientId == patientId && x.ClinicBranchId == clinicBranchId);
            return used + 1;
        }
    }

    private static PatientQuoteDto MapToDto(PatientQuote entity) => new()
    {
        Id = entity.Id,
        PatientId = entity.PatientId,
        ClinicBranchId = entity.ClinicBranchId,
        Ordinal = entity.Ordinal,
        CreationTime = entity.CreationTime,
        Lines = entity.Lines
            .OrderBy(line => line.SortOrder)
            .Select(line => new PatientQuoteLineDto
            {
                AdviseId = line.AdviseId,
                IsSelected = line.IsSelected,
                SortOrder = line.SortOrder
            })
            .ToList()
    };
}
