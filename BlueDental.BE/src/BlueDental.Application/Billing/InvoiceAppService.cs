using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Billing.Values;
using BlueDental.Exporting;
using BlueDental.Organizations;
using BlueDental.PatientManagement;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;
using Volo.Abp.Domain.Entities;
using Volo.Abp.Domain.Repositories;

namespace BlueDental.Billing;

[Authorize]
public class InvoiceAppService : ApplicationService, IInvoiceAppService
{
    private readonly IRepository<Invoice, Guid> _repository;
    private readonly IRepository<Patient, Guid> _patientRepository;
    private readonly ICurrentClinicBranchResolver _branchResolver;

    public InvoiceAppService(
        IRepository<Invoice, Guid> repository,
        IRepository<Patient, Guid> patientRepository,
        ICurrentClinicBranchResolver branchResolver)
    {
        _repository = repository;
        _patientRepository = patientRepository;
        _branchResolver = branchResolver;
    }

    /// <summary>Workflow state as the clinic reads it.</summary>
    private static readonly Dictionary<InvoiceStatus, string> StatusLabels = new()
    {
        [InvoiceStatus.Draft] = "Nháp",
        [InvoiceStatus.Issued] = "Đã phát hành",
        [InvoiceStatus.PartiallyPaid] = "Thu một phần",
        [InvoiceStatus.Paid] = "Đã thanh toán",
        [InvoiceStatus.Overdue] = "Quá hạn",
        [InvoiceStatus.Voided] = "Đã huỷ",
        [InvoiceStatus.Refunded] = "Đã hoàn tiền"
    };

    [Authorize(BlueDentalAbilityPermissions.Payment.Read)]
    public async Task<PagedResultDto<InvoiceDto>> GetListAsync(GetInvoiceListInput input)
    {
        // The branch comes from the signed-in user, never from the request —
        // that is what closes the IDOR the audit found.
        var branchId = _branchResolver.GetRequiredClinicBranchId();
        var query = await _repository.GetQueryableAsync();
        query = query.Where(i => i.BranchId == branchId);

        if (input.PatientId.HasValue) query = query.Where(i => i.PatientId == input.PatientId.Value);
        if (input.Status.HasValue) query = query.Where(i => i.Status == input.Status.Value);

        if (!string.IsNullOrWhiteSpace(input.Filter))
        {
            var filter = input.Filter.Trim();
            query = query.Where(i => i.InvoiceNumber.Contains(filter));
        }

        var totalCount = await AsyncExecuter.CountAsync(query);

        // Newest first, and Id breaks the tie so paging stays stable.
        var items = await AsyncExecuter.ToListAsync(
            query
                .OrderByDescending(i => i.IssuedAt)
                .ThenBy(i => i.Id)
                .Skip(input.SkipCount)
                .Take(input.MaxResultCount));

        var dtos = ObjectMapper.Map<List<Invoice>, List<InvoiceDto>>(items);
        await FillPatientNamesAsync(dtos);

        return new PagedResultDto<InvoiceDto>(totalCount, dtos);
    }

    [Authorize(BlueDentalAbilityPermissions.Payment.Read)]
    public async Task<InvoiceDto> GetAsync(Guid id)
    {
        var invoice = await _repository.GetAsync(id);
        GuardBranchAccess(invoice);

        var dto = ObjectMapper.Map<Invoice, InvoiceDto>(invoice);
        await FillPatientNamesAsync([dto]);
        return dto;
    }

    [Authorize(BlueDentalAbilityPermissions.Payment.Create)]
    public async Task<InvoiceDto> CreateAsync(CreateInvoiceDto input)
    {
        var branchId = _branchResolver.GetRequiredClinicBranchId();

        var invoiceNumber = await GenerateInvoiceNumberAsync(branchId);
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

    /// <summary>
    /// A per-branch, per-month sequence rather than six characters of a GUID.
    ///
    /// ABP hands out sequential GUIDs, so those six characters are high-order
    /// timestamp bits: two invoices written moments apart produced the same
    /// number and the second one died on the unique index with a 500. This is
    /// the same fault, and the same fix, as the patient code in R-04.
    /// </summary>
    private async Task<string> GenerateInvoiceNumberAsync(Guid branchId)
    {
        var now = Clock.Now;
        var query = await _repository.GetQueryableAsync();

        var sequence = query.Count(i =>
            i.BranchId == branchId
            && i.CreationTime.Year == now.Year
            && i.CreationTime.Month == now.Month) + 1;

        var number = FormatInvoiceNumber(now, sequence);

        // Deleted rows and seeded ones leave gaps and repeats in that count, so
        // walk forward until the number is genuinely free.
        while (query.Any(i => i.InvoiceNumber == number))
        {
            sequence++;
            number = FormatInvoiceNumber(now, sequence);
        }

        return number;
    }

    private static string FormatInvoiceNumber(DateTime issuedOn, int sequence) =>
        $"HD-{issuedOn:yyyyMM}-{sequence:D4}";

    [Authorize(BlueDentalAbilityPermissions.Payment.Update)]
    public async Task<InvoiceDto> IssueAsync(Guid id)
    {
        var invoice = await _repository.GetAsync(id);
        GuardBranchAccess(invoice);

        invoice.Issue();
        await _repository.UpdateAsync(invoice, autoSave: true);
        return ObjectMapper.Map<Invoice, InvoiceDto>(invoice);
    }

    [Authorize(BlueDentalAbilityPermissions.Payment.Update)]
    public async Task<InvoiceDto> RecordPaymentAsync(Guid id, RecordPaymentDto input)
    {
        var invoice = await _repository.GetAsync(id);
        GuardBranchAccess(invoice);

        invoice.RecordPayment(new Money(input.Amount, input.Currency), input.Method);
        await _repository.UpdateAsync(invoice, autoSave: true);
        return ObjectMapper.Map<Invoice, InvoiceDto>(invoice);
    }

    [Authorize(BlueDentalAbilityPermissions.Payment.Update)]
    public async Task<InvoiceDto> VoidAsync(Guid id, VoidInvoiceDto input)
    {
        var invoice = await _repository.GetAsync(id);
        GuardBranchAccess(invoice);

        invoice.Void(input.Reason);
        await _repository.UpdateAsync(invoice, autoSave: true);
        return ObjectMapper.Map<Invoice, InvoiceDto>(invoice);
    }

    /// <summary>"Xuất Excel" on the Thanh toán screen.</summary>
    [Authorize(BlueDentalAbilityPermissions.Payment.Read)]
    public async Task<byte[]> ExportAsync(GetInvoiceListInput input)
    {
        var page = await GetListAsync(new GetInvoiceListInput
        {
            PatientId = input.PatientId,
            Status = input.Status,
            Filter = input.Filter,
            MaxResultCount = 1000
        });

        return ExcelSheet.Build(
            "Hoa don",
            L["Thanh toán & hoá đơn"],
            new List<ExcelColumn<InvoiceDto>>
            {
                new(L["Mã phiếu"], row => row.InvoiceNumber, 20),
                new(L["Khách hàng"], row => row.PatientName, 26),
                new(L["Ngày"], row => row.IssuedAt.DateTime, 14),
                new(L["Hạn thanh toán"], row => row.DueAt.DateTime, 16),
                new(L["Tổng tiền"], row => row.TotalAmount, 16),
                new(L["Đã thu"], row => row.PaidAmount, 16),
                new(L["Còn lại"], row => row.BalanceDue, 16),
                new(L["Trạng thái"], row => L[StatusLabels[row.Status]].Value, 18)
            },
            page.Items);
    }

    /// <summary>
    /// The invoice does not carry the patient's name, so the list resolves it in
    /// one read rather than one per row.
    /// </summary>
    private async Task FillPatientNamesAsync(IReadOnlyCollection<InvoiceDto> dtos)
    {
        if (dtos.Count == 0)
        {
            return;
        }

        var patientIds = dtos.Select(d => d.PatientId).Distinct().ToList();
        var patients = await _patientRepository.GetListAsync(p => patientIds.Contains(p.Id));
        var namesById = patients.ToDictionary(p => p.Id, p => $"{p.LastName} {p.FirstName}".Trim());

        foreach (var dto in dtos)
        {
            dto.PatientName = namesById.TryGetValue(dto.PatientId, out var name) ? name : string.Empty;
        }
    }

    private void GuardBranchAccess(Invoice entity)
    {
        var branchId = _branchResolver.GetRequiredClinicBranchId();
        if (entity.BranchId != branchId)
            throw new EntityNotFoundException(typeof(Invoice), entity.Id);
    }
}
