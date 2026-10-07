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
/// Stores the set of consulting lines, their order, their ticks and the price
/// each is quoted at — copied off the consulting line when the quote is raised,
/// so Phiếu tư vấn and every báo giá carry independent figures. The amounts
/// are worked out from those prices on every read.
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
        var page = rows
            // Newest first, as the tab strip stacks them.
            .OrderByDescending(x => x.Ordinal)
            .Skip(input.SkipCount)
            .Take(input.MaxResultCount)
            .ToList();

        var advises = await LoadAdvisesAsync(page.SelectMany(quote => quote.Lines).Select(line => line.AdviseId));
        var items = page.Select(quote => MapToDto(quote, advises)).ToList();

        return new PagedResultDto<PatientQuoteDto>(rows.Count, items);
    }

    [Authorize(BlueDentalAbilityPermissions.TreatmentConsultation.Create)]
    public async Task<PatientQuoteDto> CreateAsync(CreatePatientQuoteDto input)
    {
        var clinicBranchId = _branchResolver.GetRequiredClinicBranchId();
        var adviseIds = input.AdviseIds.Distinct().ToList();

        var advises = await GuardAdvisesAsync(adviseIds, input.PatientId, clinicBranchId);

        var quote = PatientQuote.Raise(
            GuidGenerator.Create(),
            input.PatientId,
            clinicBranchId,
            await NextOrdinalAsync(input.PatientId, clinicBranchId),
            adviseIds.Select((id, index) =>
                new PatientQuoteLine(id, true, index + 1, QuoteLinePricing.Of(advises[id]))));

        await _repository.InsertAsync(quote, autoSave: true);
        return MapToDto(quote, advises);
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
        return MapToDto(copy, await LoadAdvisesAsync(copy.Lines.Select(line => line.AdviseId)));
    }

    [Authorize(BlueDentalAbilityPermissions.TreatmentConsultation.Update)]
    public async Task<PatientQuoteDto> UpdateAsync(Guid id, UpdatePatientQuoteDto input)
    {
        var quote = await LoadAsync(id);

        var advises = await GuardAdvisesAsync(
            input.Lines.Select(line => line.AdviseId).Distinct().ToList(),
            quote.PatientId,
            quote.ClinicBranchId);

        // The body carries ticks and order only: each line keeps the price the
        // quote already holds for it, and one new to the quote starts from its
        // consulting line's.
        var held = quote.Lines.ToDictionary(line => line.AdviseId, line => line.GetPricing());
        quote.SetLines(
            input.Lines.Select(line => new PatientQuoteLine(
                line.AdviseId,
                line.IsSelected,
                line.SortOrder,
                held.GetValueOrDefault(line.AdviseId) ?? QuoteLinePricing.Of(advises[line.AdviseId]))));

        await _repository.UpdateAsync(quote, autoSave: true);
        return MapToDto(quote, advises);
    }

    [Authorize(BlueDentalAbilityPermissions.TreatmentConsultation.Update)]
    public async Task<PatientQuoteDto> RepriceLineAsync(Guid id, Guid adviseId, RepricePatientQuoteLineDto input)
    {
        var quote = await LoadAsync(id);
        var pricing = new QuoteLinePricing(input.Price, input.Quantity, input.DiscountType, input.DiscountValue);

        // "Quy định giảm giá" (Cụm 11 mục 12): measured against the service's
        // catalogue price, and only when the line's discount grows.
        var advise = (await LoadAdvisesAsync([adviseId])).GetValueOrDefault(adviseId);
        if (advise is not null)
        {
            var guard = LazyServiceProvider.LazyGetRequiredService<DiscountLimitGuard>();
            var unit = await guard.ReferencePriceAsync(advise.ServiceId, advise.OriginalPrice);
            var current = quote.Lines.FirstOrDefault(l => l.AdviseId == adviseId)?.GetPricing()
                ?? QuoteLinePricing.Of(advise);
            await guard.EnsureAsync(
                unit * pricing.Quantity,
                Math.Max(unit * pricing.Quantity - pricing.Effective, 0m),
                new DiscountLimit.Measure(
                    unit * current.Quantity,
                    Math.Max(unit * current.Quantity - current.Effective, 0m)));
        }

        quote.RepriceLine(adviseId, pricing);

        await _repository.UpdateAsync(quote, autoSave: true);
        return MapToDto(quote, await LoadAdvisesAsync(quote.Lines.Select(line => line.AdviseId)));
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
    private async Task<Dictionary<Guid, PatientAdvise>> GuardAdvisesAsync(
        List<Guid> adviseIds, Guid patientId, Guid clinicBranchId)
    {
        if (adviseIds.Count == 0)
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.InvalidAdviseTransition,
                "A quote needs at least one consulting line.");

        var query = await _adviseRepository.GetQueryableAsync();
        var owned = query
            .Where(x => x.PatientId == patientId && x.ClinicBranchId == clinicBranchId)
            .Where(x => adviseIds.Contains(x.Id))
            .ToDictionary(x => x.Id);

        var stranger = adviseIds.Except(owned.Keys).ToList();
        if (stranger.Count > 0)
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.PatientAdviseNotFound,
                $"Consulting line {stranger[0]} does not belong to this record.");

        return owned;
    }

    private async Task<Dictionary<Guid, PatientAdvise>> LoadAdvisesAsync(IEnumerable<Guid> adviseIds)
    {
        var ids = adviseIds.Distinct().ToList();
        if (ids.Count == 0) return new Dictionary<Guid, PatientAdvise>();

        var query = await _adviseRepository.GetQueryableAsync();
        return query.Where(x => ids.Contains(x.Id)).ToDictionary(x => x.Id);
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

    /// <summary>
    /// A line whose consulting row has gone is left out, as the screen drops
    /// it anyway; one without a price of its own is priced off its row.
    /// </summary>
    private static PatientQuoteDto MapToDto(PatientQuote entity, IReadOnlyDictionary<Guid, PatientAdvise> advises) => new()
    {
        Id = entity.Id,
        PatientId = entity.PatientId,
        ClinicBranchId = entity.ClinicBranchId,
        Ordinal = entity.Ordinal,
        CreationTime = entity.CreationTime,
        Lines = entity.Lines
            .Where(line => advises.ContainsKey(line.AdviseId))
            .OrderBy(line => line.SortOrder)
            .Select(line => MapLine(line, advises[line.AdviseId]))
            .ToList()
    };

    private static PatientQuoteLineReadDto MapLine(PatientQuoteLine line, PatientAdvise advise)
    {
        var pricing = line.GetPricing() ?? QuoteLinePricing.Of(advise);
        var discount = AdvisePricing.Discount(
            pricing.Gross, pricing.DiscountType, pricing.DiscountValue, advise.VoucherDiscountAmount);

        return new PatientQuoteLineReadDto
        {
            AdviseId = line.AdviseId,
            IsSelected = line.IsSelected,
            SortOrder = line.SortOrder,
            Price = pricing.Price,
            Quantity = pricing.Quantity,
            DiscountType = pricing.DiscountType,
            DiscountValue = pricing.DiscountValue,
            GrossAmount = pricing.Gross,
            DiscountAmount = discount,
            EffectiveAmount = pricing.Gross - discount
        };
    }
}
