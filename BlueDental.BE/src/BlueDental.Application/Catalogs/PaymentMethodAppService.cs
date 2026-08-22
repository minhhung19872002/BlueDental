using System;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;
using Volo.Abp.Domain.Repositories;

namespace BlueDental.Catalogs;

[Authorize(BlueDentalPermissions.Catalogs.Default)]
public class PaymentMethodAppService : ApplicationService, IPaymentMethodAppService
{
    private readonly IRepository<PaymentMethodOption, Guid> _repository;

    public PaymentMethodAppService(IRepository<PaymentMethodOption, Guid> repository)
    {
        _repository = repository;
    }

    [Authorize(BlueDentalPermissions.Catalogs.View)]
    public async Task<PagedResultDto<PaymentMethodDto>> GetListAsync(GetPaymentMethodListInput input)
    {
        var query = await _repository.GetQueryableAsync();
        if (!string.IsNullOrWhiteSpace(input.Filter))
            query = query.Where(x => x.Name.Contains(input.Filter) || x.Code.Contains(input.Filter));
        if (input.IsActive.HasValue)
            query = query.Where(x => x.IsActive == input.IsActive.Value);

        var totalCount = query.Count();
        var items = query.OrderBy(x => x.Name)
            .Skip(input.SkipCount).Take(input.MaxResultCount).ToList();

        return new PagedResultDto<PaymentMethodDto>(
            totalCount,
            ObjectMapper.Map<System.Collections.Generic.List<PaymentMethodOption>, System.Collections.Generic.List<PaymentMethodDto>>(items));
    }

    [Authorize(BlueDentalPermissions.Catalogs.View)]
    public async Task<PaymentMethodDto> GetAsync(Guid id)
    {
        var entity = await _repository.GetAsync(id);
        return ObjectMapper.Map<PaymentMethodOption, PaymentMethodDto>(entity);
    }

    [Authorize(BlueDentalPermissions.Catalogs.Create)]
    public async Task<PaymentMethodDto> CreateAsync(CreatePaymentMethodDto input)
    {
        var entity = new PaymentMethodOption(GuidGenerator.Create(), input.Code, input.Name, input.Description);
        await _repository.InsertAsync(entity, autoSave: true);
        return ObjectMapper.Map<PaymentMethodOption, PaymentMethodDto>(entity);
    }

    [Authorize(BlueDentalPermissions.Catalogs.Edit)]
    public async Task<PaymentMethodDto> UpdateAsync(Guid id, UpdatePaymentMethodDto input)
    {
        var entity = await _repository.GetAsync(id);
        entity.Update(input.Name, input.Description);
        await _repository.UpdateAsync(entity, autoSave: true);
        return ObjectMapper.Map<PaymentMethodOption, PaymentMethodDto>(entity);
    }

    [Authorize(BlueDentalPermissions.Catalogs.Delete)]
    public async Task DeleteAsync(Guid id)
    {
        await _repository.DeleteAsync(id, autoSave: true);
    }
}
