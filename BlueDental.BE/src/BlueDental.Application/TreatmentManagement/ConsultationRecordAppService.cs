using System;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;
using Volo.Abp.Domain.Repositories;

namespace BlueDental.TreatmentManagement;

[Authorize(BlueDentalPermissions.Catalogs.Default)]
public class ConsultationRecordAppService(
    IRepository<ConsultationRecord, Guid> repository) : ApplicationService, IConsultationRecordAppService
{
    public async Task<PagedResultDto<ConsultationRecordDto>> GetListAsync(GetConsultationRecordListInput input)
    {
        var query = await repository.GetQueryableAsync();

        if (input.PatientId.HasValue)
            query = query.Where(c => c.PatientId == input.PatientId.Value);

        if (!string.IsNullOrWhiteSpace(input.Filter))
            query = query.Where(c => c.ServiceName.Contains(input.Filter!));

        var totalCount = query.Count();
        var items = query
            .OrderByDescending(c => c.CreationTime)
            .Skip(input.SkipCount)
            .Take(input.MaxResultCount)
            .ToList();

        var dtos = items.Select(c => new ConsultationRecordDto
        {
            Id = c.Id,
            PatientId = c.PatientId,
            ProcedureId = c.ProcedureId,
            ServiceName = c.ServiceName,
            UnitPrice = c.UnitPrice,
            Quantity = c.Quantity,
            TotalAmount = c.TotalAmount,
            Notes = c.Notes,
            CreationTime = c.CreationTime,
        }).ToList();

        return new PagedResultDto<ConsultationRecordDto>(totalCount, dtos);
    }

    public async Task<ConsultationRecordDto> CreateAsync(CreateConsultationRecordDto input)
    {
        var entity = new ConsultationRecord(
            GuidGenerator.Create(),
            input.PatientId,
            input.ServiceName,
            input.UnitPrice,
            input.Quantity,
            input.ProcedureId,
            input.Notes);

        await repository.InsertAsync(entity);

        return new ConsultationRecordDto
        {
            Id = entity.Id,
            PatientId = entity.PatientId,
            ProcedureId = entity.ProcedureId,
            ServiceName = entity.ServiceName,
            UnitPrice = entity.UnitPrice,
            Quantity = entity.Quantity,
            TotalAmount = entity.TotalAmount,
            Notes = entity.Notes,
            CreationTime = entity.CreationTime,
        };
    }

    public async Task DeleteAsync(Guid id)
    {
        await repository.DeleteAsync(id);
    }
}
