using System;
using System.Threading.Tasks;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;

namespace BlueDental.Catalogs;

public class PaymentMethodDto : FullAuditedEntityDto<Guid>
{
    public string Code { get; set; } = default!;
    public string Name { get; set; } = default!;
    public string? Description { get; set; }
    public bool IsActive { get; set; }
}

public class CreatePaymentMethodDto
{
    public string Code { get; set; } = default!;
    public string Name { get; set; } = default!;
    public string? Description { get; set; }
}

public class UpdatePaymentMethodDto
{
    public string Name { get; set; } = default!;
    public string? Description { get; set; }
}

public class GetPaymentMethodListInput : PagedAndSortedResultRequestDto
{
    public string? Filter { get; set; }
    public bool? IsActive { get; set; }
}

public interface IPaymentMethodAppService : IApplicationService
{
    Task<PagedResultDto<PaymentMethodDto>> GetListAsync(GetPaymentMethodListInput input);
    Task<PaymentMethodDto> GetAsync(Guid id);
    Task<PaymentMethodDto> CreateAsync(CreatePaymentMethodDto input);
    Task<PaymentMethodDto> UpdateAsync(Guid id, UpdatePaymentMethodDto input);
    Task DeleteAsync(Guid id);
}
