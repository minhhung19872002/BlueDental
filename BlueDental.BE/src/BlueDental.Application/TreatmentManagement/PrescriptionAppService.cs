using System;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;
using Volo.Abp.Domain.Repositories;

namespace BlueDental.TreatmentManagement;

[Authorize(BlueDentalPermissions.TreatmentManagement.Default)]
public class PrescriptionAppService : ApplicationService, IPrescriptionAppService
{
    private readonly IRepository<Prescription, Guid> _repository;

    public PrescriptionAppService(IRepository<Prescription, Guid> repository)
    {
        _repository = repository;
    }

    [Authorize(BlueDentalPermissions.TreatmentManagement.Prescriptions.View)]
    public async Task<PagedResultDto<PrescriptionDto>> GetListAsync(GetPrescriptionListInput input)
    {
        var query = await _repository.GetQueryableAsync();

        if (input.PatientId.HasValue)
            query = query.Where(p => p.PatientId == input.PatientId.Value);

        var total = query.Count();
        var items = query
            .OrderByDescending(p => p.CreationTime)
            .Skip(input.SkipCount)
            .Take(input.MaxResultCount)
            .Select(p => MapToDto(p))
            .ToList();

        return new PagedResultDto<PrescriptionDto>(total, items);
    }

    [Authorize(BlueDentalPermissions.TreatmentManagement.Prescriptions.View)]
    public async Task<PrescriptionDto> GetAsync(Guid id)
    {
        var p = await _repository.GetAsync(id);
        return MapToDto(p);
    }

    private static PrescriptionDto MapToDto(Prescription p) => new()
    {
        Id = p.Id,
        PatientId = p.PatientId,
        TreatmentRecordId = p.TreatmentRecordId,
        PrescribedBy = p.PrescribedBy,
        MedicationId = p.MedicationId,
        Dosage = p.Dosage,
        Frequency = p.Frequency,
        DurationDays = p.DurationDays,
        Instructions = p.Instructions,
        Status = p.Status.ToString(),
        IssuedAt = p.IssuedAt,
        ExpiresAt = p.ExpiresAt,
        CreationTime = p.CreationTime,
        LastModificationTime = p.LastModificationTime,
    };
}
