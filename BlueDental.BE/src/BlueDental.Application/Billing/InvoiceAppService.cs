using System;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Billing.Values;
using BlueDental.Organizations;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;
using Volo.Abp.Domain.Repositories;

namespace BlueDental.Billing;

[Authorize]
public class InvoiceAppService : ApplicationService, IInvoiceAppService
{
    private readonly IRepository<Invoice, Guid> _repository;
    private readonly ICurrentClinicBranchResolver _branchResolver;

    public InvoiceAppService(
        IRepository<Invoice, Guid> repository,
        ICurrentClinicBranchResolver branchResolver)
    {
        _repository = repository;
        _branchResolver = branchResolver;
    }

    [Authorize(BlueDentalAbilityPermissions.Payment.Read)]
    public async Task<PagedResultDto<InvoiceDto>> GetListAsync(GetInvoiceListInput input)
    {
        var branchId = _branchResolver.GetRequiredClinicBranchId();
        var query = await _repository.GetQueryableAsync();
        query = query.Where(i => i.BranchId == branchId);
        if (input.PatientId.HasValue) query = query.Where(i => i.PatientId == input.PatientId.Value);
        if (input.Status.HasValue) query = query.Where(i => i.Status == input.Status.Value);

        var totalCount = query.Count();
        var items = query.Skip(input.SkipCount).Take(input.MaxResultCount).ToList();

        return new PagedResultDto<InvoiceDto>(
            totalCount,
            ObjectMapper.Map<System.Collections.Generic.List<Invoice>, System.Collections.Generic.List<InvoiceDto>>(items));
    }

    [Authorize(BlueDentalAbilityPermissions.Payment.Read)]
    public async Task<InvoiceDto> GetAsync(Guid id)
    {
        var invoice = await _repository.GetAsync(id);
        GuardBranchAccess(invoice.BranchId);
        return ObjectMapper.Map<Invoice, InvoiceDto>(invoice);
    }

    [Authorize(BlueDentalAbilityPermissions.Payment.Create)]
    public async Task<InvoiceDto> CreateAsync(CreateInvoiceDto input)
    {
        var branchId = _branchResolver.GetRequiredClinicBranchId();
        var invoiceNumber = $"INV-{Clock.Now:yyyyMMdd}-{GuidGenerator.Create().ToString("N")[..6].ToUpper()}";
        var invoice = new Invoice(
            GuidGenerator.Create(),
            invoiceNumber,
            input.PatientId,
            branchId,
            new Money(input.SubTotal, input.Currency),
            new Money(input.TaxAmount, input.Currency),
            new Money(input.DiscountAmount, input.Currency),
            input.DueAt,
            input.AppointmentId);

        await _repository.InsertAsync(invoice, autoSave: true);
        return ObjectMapper.Map<Invoice, InvoiceDto>(invoice);
    }

    [Authorize(BlueDentalAbilityPermissions.Payment.Update)]
    public async Task<InvoiceDto> IssueAsync(Guid id)
    {
        var invoice = await _repository.GetAsync(id);
        GuardBranchAccess(invoice.BranchId);
        invoice.Issue();
        await _repository.UpdateAsync(invoice, autoSave: true);
        return ObjectMapper.Map<Invoice, InvoiceDto>(invoice);
    }

    [Authorize(BlueDentalAbilityPermissions.Payment.Update)]
    public async Task<InvoiceDto> RecordPaymentAsync(Guid id, RecordPaymentDto input)
    {
        var invoice = await _repository.GetAsync(id);
        GuardBranchAccess(invoice.BranchId);
        invoice.RecordPayment(new Money(input.Amount, input.Currency), input.Method);
        await _repository.UpdateAsync(invoice, autoSave: true);
        return ObjectMapper.Map<Invoice, InvoiceDto>(invoice);
    }

    [Authorize(BlueDentalAbilityPermissions.Payment.Update)]
    public async Task<InvoiceDto> VoidAsync(Guid id, VoidInvoiceDto input)
    {
        var invoice = await _repository.GetAsync(id);
        GuardBranchAccess(invoice.BranchId);
        invoice.Void(input.Reason);
        await _repository.UpdateAsync(invoice, autoSave: true);
        return ObjectMapper.Map<Invoice, InvoiceDto>(invoice);
    }

    private void GuardBranchAccess(Guid entityBranchId)
    {
        var branchId = _branchResolver.GetRequiredClinicBranchId();
        if (entityBranchId != branchId)
            throw new BusinessException(BlueDentalDomainErrorCodes.Organizations.BranchNotAssigned);
    }
}
