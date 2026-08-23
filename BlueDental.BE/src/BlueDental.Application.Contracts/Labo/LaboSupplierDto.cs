using System;
using System.Threading.Tasks;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;

namespace BlueDental.Labo;

public class LaboSupplierDto : FullAuditedEntityDto<Guid>
{
    public string Name { get; set; } = default!;
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string? Address { get; set; }
    public bool IsActive { get; set; }
}

public class CreateLaboSupplierDto
{
    public string Name { get; set; } = default!;
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string? Address { get; set; }
}

public class UpdateLaboSupplierDto
{
    public string Name { get; set; } = default!;
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string? Address { get; set; }
}

public class GetLaboSupplierListInput : PagedAndSortedResultRequestDto
{
    public string? Filter { get; set; }
    public bool? IsActive { get; set; }
}

public interface ILaboSupplierAppService : IApplicationService
{
    Task<PagedResultDto<LaboSupplierDto>> GetListAsync(GetLaboSupplierListInput input);
    Task<LaboSupplierDto> GetAsync(Guid id);
    Task<LaboSupplierDto> CreateAsync(CreateLaboSupplierDto input);
    Task<LaboSupplierDto> UpdateAsync(Guid id, UpdateLaboSupplierDto input);
    Task DeleteAsync(Guid id);
}
