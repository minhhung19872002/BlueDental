using System;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Billing.Values;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;
using Volo.Abp.Domain.Repositories;

namespace BlueDental.Billing;

[Authorize(BlueDentalPermissions.Billing.Default)]
public class InvoiceAppService : ApplicationService, IInvoiceAppService
{
    private readonly IRepository<Invoice, Guid> _repository;

    public InvoiceAppService(IRepository<Invoice, Guid> repository)
    {
        _repository = repository;
    }

    [Authorize(BlueDentalPermissions.Billing.Invoices.View)]
    public async Task<PagedResultDto<InvoiceDto>> GetListAsync(GetInvoiceListInput input)
    {
        var query = await _repository.GetQueryableAsync();
        if (input.BranchId.HasValue) query = query.Where(i => i.BranchId == input.BranchId.Value);
        if (input.PatientId.HasValue) query = query.Where(i => i.PatientId == input.PatientId.Value);
        if (input.Status.HasValue) query = query.Where(i => i.Status == input.Status.Value);

        var totalCount = query.Count();
        var items = query.Skip(input.SkipCount).Take(input.MaxResultCount).ToList();

        return new PagedResultDto<InvoiceDto>(
            totalCount,
            ObjectMapper.Map<System.Collections.Generic.List<Invoice>, System.Collections.Generic.List<InvoiceDto>>(items));
    }

    [Authorize(BlueDentalPermissions.Billing.Invoices.View)]
    public async Task<InvoiceDto> GetAsync(Guid id)
    {
        var invoice = await _repository.GetAsync(id);
        return ObjectMapper.Map<Invoice, InvoiceDto>(invoice);
    }

    [Authorize(BlueDentalPermissions.Billing.Invoices.Create)]
    public async Task<InvoiceDto> CreateAsync(CreateInvoiceDto input)
    {
        var invoiceNumber = $"INV-{Clock.Now:yyyyMMdd}-{GuidGenerator.Create().ToString("N")[..6].ToUpper()}";
        var invoice = new Invoice(
            GuidGenerator.Create(),
            invoiceNumber,
            input.PatientId,
            input.BranchId,
            new Money(input.SubTotal, input.Currency),
            new Money(input.TaxAmount, input.Currency),
            new Money(input.DiscountAmount, input.Currency),
            input.DueAt,
            input.AppointmentId);

        await _repository.InsertAsync(invoice, autoSave: true);
        return ObjectMapper.Map<Invoice, InvoiceDto>(invoice);
    }

    [Authorize(BlueDentalPermissions.Billing.Invoices.Edit)]
    public async Task<InvoiceDto> IssueAsync(Guid id)
    {
        var invoice = await _repository.GetAsync(id);
        invoice.Issue();
        await _repository.UpdateAsync(invoice, autoSave: true);
        return ObjectMapper.Map<Invoice, InvoiceDto>(invoice);
    }

    [Authorize(BlueDentalPermissions.Billing.Invoices.Process)]
    public async Task<InvoiceDto> RecordPaymentAsync(Guid id, RecordPaymentDto input)
    {
        var invoice = await _repository.GetAsync(id);
        invoice.RecordPayment(new Money(input.Amount, input.Currency), input.Method);
        await _repository.UpdateAsync(invoice, autoSave: true);
        return ObjectMapper.Map<Invoice, InvoiceDto>(invoice);
    }

    [Authorize(BlueDentalPermissions.Billing.Invoices.Void)]
    public async Task<InvoiceDto> VoidAsync(Guid id, VoidInvoiceDto input)
    {
        var invoice = await _repository.GetAsync(id);
        invoice.Void(input.Reason);
        await _repository.UpdateAsync(invoice, autoSave: true);
        return ObjectMapper.Map<Invoice, InvoiceDto>(invoice);
    }
}
