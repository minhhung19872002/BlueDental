using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Billing;
using BlueDental.Catalogs;
using BlueDental.EInvoicing;
using BlueDental.Organizations;
using BlueDental.PatientManagement;
using BlueDental.Permissions;
using BlueDental.Staff;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;
using Volo.Abp.Domain.Entities;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Identity;

namespace BlueDental.TreatmentManagement;

/// <summary>
/// Thu tiền / hoàn tiền / giữ hộ của bệnh nhân.
///
/// Guarded by the reference's <c>payment</c> subject. The money rollup is derived
/// on every read — nothing is cached on the patient or the slip.
/// </summary>
[Authorize]
public class PatientPaymentAppService : BlueDentalAppService, IPatientPaymentAppService
{
    private readonly IRepository<PatientPayment, Guid> _repository;
    private readonly IRepository<TreatmentPlan, Guid> _planRepository;
    private readonly IIdentityUserRepository _userRepository;
    private readonly BranchAccessChecker _branchAccess;
    private readonly PatientMoneyCalculator _money;
    private readonly IPatientTreatmentAppService _treatments;
    private readonly IRepository<ElectronicInvoice, Guid> _electronicInvoices;
    private readonly IRepository<InvoiceRequest, Guid> _invoiceRequests;
    private readonly OrgChartScopeResolver _slipScope;

    public PatientPaymentAppService(
        IRepository<PatientPayment, Guid> repository,
        IRepository<TreatmentPlan, Guid> planRepository,
        IIdentityUserRepository userRepository,
        BranchAccessChecker branchAccess,
        PatientMoneyCalculator money,
        IPatientTreatmentAppService treatments,
        IRepository<ElectronicInvoice, Guid> electronicInvoices,
        IRepository<InvoiceRequest, Guid> invoiceRequests,
        OrgChartScopeResolver slipScope)
    {
        _repository = repository;
        _planRepository = planRepository;
        _userRepository = userRepository;
        _branchAccess = branchAccess;
        _money = money;
        _treatments = treatments;
        _electronicInvoices = electronicInvoices;
        _invoiceRequests = invoiceRequests;
        _slipScope = slipScope;
    }

    [Authorize(BlueDentalAbilityPermissions.Payment.Read)]
    public async Task<PagedResultDto<PatientPaymentDto>> GetListAsync(GetPatientPaymentListInput input)
    {
        var items = await QueryAsync(input);

        var totalCount = items.Count;
        var page = items
            .OrderByDescending(x => x.PaidAt)
            .Skip(input.SkipCount)
            .Take(input.MaxResultCount)
            .ToList();

        return new PagedResultDto<PatientPaymentDto>(totalCount, await MapManyAsync(page));
    }

    [Authorize(BlueDentalAbilityPermissions.Payment.Read)]
    public async Task<PatientAccountDto> GetAccountAsync(Guid patientId, Guid? clinicBranchId = null)
    {
        var payments = await QueryAsync(new GetPatientPaymentListInput
        {
            PatientId = patientId,
            ClinicBranchId = clinicBranchId
        });

        var plans = await _treatments.GetListAsync(new GetTreatmentPlanSlipListInput
        {
            PatientId = patientId,
            ClinicBranchId = clinicBranchId,
            MaxResultCount = 100
        });

        var planQuery = await _planRepository.WithDetailsAsync(x => x.Services);
        var planEntities = planQuery.Where(x => x.PatientId == patientId).ToList();

        // BA P2010: the money adds up the slips the caller sees on the Kế hoạch
        // điều trị tab — without "Chi phí › Xem" the ones they received, with it
        // their part of the org chart — the same reading as the patient list
        // (bug 41). The lists stay whole: they answer to the Thanh toán permission.
        var summary = _money.ForScope(planEntities, payments, await _slipScope.VisibleSlipsAsync());

        return new PatientAccountDto
        {
            PatientId = patientId,
            Payment = PatientTreatmentAppService.MapPayment(summary),
            HeldForPatient = _money.HeldForPatient(payments),
            Plans = plans.Items.ToList(),
            Payments = await MapManyAsync(payments.OrderByDescending(x => x.PaidAt).ToList())
        };
    }

    /// <summary>
    /// "BE:Perm:BalanceHistory" — every movement on the patient's account, newest first.
    ///
    /// Derived rather than stored: the reference keeps no ledger the clone can
    /// read, and every movement BlueDental makes is already recorded somewhere.
    /// Receipts give Nạp / Sử dụng / Hoàn trả; the slips' own lines give the two
    /// that leave no receipt — a cancelled line hands its money back, and a
    /// converted one leaves behind whatever the new service could not absorb.
    /// "Rút dư nợ" has no BlueDental operation, so nothing emits it.
    /// </summary>
    [Authorize(BlueDentalAbilityPermissions.Payment.Read)]
    public async Task<PagedResultDto<DebtHistoryEntryDto>> GetDebtHistoryAsync(
        GetDebtHistoryInput input)
    {
        var payments = await QueryAsync(new GetPatientPaymentListInput
        {
            PatientId = input.PatientId,
            ClinicBranchId = input.ClinicBranchId
        });

        var entries = payments
            .Select(payment => new
            {
                Payment = payment,
                Type = MovementOf(payment)
            })
            .Where(x => x.Type.HasValue)
            .Select(x => new DebtEntry
            {
                Id = x.Payment.Id,
                Date = x.Payment.PaidAt,
                Type = x.Type!.Value,
                Amount = x.Payment.Amount,
                Note = x.Payment.Note,
                StaffId = x.Payment.StaffId
            })
            .ToList();

        entries.AddRange(await ClosedLineMovementsAsync(input));

        var ordered = entries.OrderByDescending(x => x.Date).ToList();
        var page = ordered.Skip(input.SkipCount).Take(input.MaxResultCount).ToList();
        await NameStaffAsync(page);

        return new PagedResultDto<DebtHistoryEntryDto>(
            ordered.Count,
            page.Select(x => x.ToDto()).ToList());
    }

    /// <summary>Which movement a receipt is, or none when it does not touch the account.</summary>
    private static DebtMovementType? MovementOf(PatientPayment payment) => payment.Kind switch
    {
        PatientPaymentKind.Prepaid => DebtMovementType.Topup,
        PatientPaymentKind.Refund => DebtMovementType.Refund,
        PatientPaymentKind.Payment when payment.Method == PaymentMethodKind.OutstandingDebt
            => DebtMovementType.Use,
        _ => null
    };

    /// <summary>
    /// The two movements no receipt records: money left on a line that was
    /// cancelled, and money the new service of a conversion could not absorb.
    /// </summary>
    private async Task<List<DebtEntry>> ClosedLineMovementsAsync(GetDebtHistoryInput input)
    {
        var branchFilter = await _branchAccess.ResolveFilterAsync(input.ClinicBranchId);
        var planQuery = await _planRepository.WithDetailsAsync(x => x.Services);
        var plans = planQuery.Where(x => x.PatientId == input.PatientId).ToList();

        if (branchFilter.Count > 0)
            plans = plans.Where(x => branchFilter.Contains(x.BranchId)).ToList();

        var receipts = await QueryAsync(new GetPatientPaymentListInput
        {
            PatientId = input.PatientId,
            ClinicBranchId = input.ClinicBranchId
        });

        var left = new List<DebtEntry>();

        foreach (var line in plans.SelectMany(plan => plan.Services))
        {
            var type = line.Status switch
            {
                TreatmentServiceStatus.Cancelled => DebtMovementType.Cancel,
                TreatmentServiceStatus.Replaced => DebtMovementType.Replace,
                _ => (DebtMovementType?)null
            };

            if (type is null)
                continue;

            // What the patient still has sitting on a line that no longer
            // charges for anything.
            var stranded = receipts
                .Where(p => p.Kind == PatientPaymentKind.Payment)
                .Sum(p => p.AmountFor(line.Id));

            if (stranded <= 0m)
                continue;

            left.Add(new DebtEntry
            {
                Id = line.Id,
                Date = line.LastModificationTime ?? line.CreationTime,
                Type = type.Value,
                Amount = stranded,
                Note = line.Note,
                StaffId = line.LastModifierId ?? line.CreatorId
            });
        }

        return left;
    }

    /// <summary>Fills in the staff names of one page, in one round trip.</summary>
    private async Task NameStaffAsync(List<DebtEntry> page)
    {
        var ids = page.Select(x => x.StaffId).Where(id => id.HasValue).Select(id => id!.Value)
            .Distinct().ToList();
        if (ids.Count == 0)
            return;

        var users = await _userRepository.GetListAsync();
        var names = users
            .Where(u => ids.Contains(u.Id))
            .ToDictionary(u => u.Id, u => u.Name ?? u.UserName);

        foreach (var entry in page)
        {
            if (entry.StaffId.HasValue && names.TryGetValue(entry.StaffId.Value, out var name))
                entry.StaffName = name;
        }
    }

    /// <summary>The entry while it is being built, before its staff has a name.</summary>
    private sealed class DebtEntry
    {
        public Guid Id { get; init; }
        public DateTimeOffset Date { get; init; }
        public DebtMovementType Type { get; init; }
        public decimal Amount { get; init; }
        public string? Note { get; init; }
        public Guid? StaffId { get; init; }
        public string? StaffName { get; set; }

        public DebtHistoryEntryDto ToDto() => new()
        {
            Id = Id,
            Date = Date,
            Type = Type,
            Amount = Amount,
            Note = Note,
            StaffName = StaffName
        };
    }

    [Authorize(BlueDentalAbilityPermissions.Payment.Create)]
    public async Task<PatientPaymentDto> RecordAsync(RecordPatientPaymentDto input)
    {
        await _branchAccess.CheckAsync(input.ClinicBranchId);

        if (input.TreatmentPlanId.HasValue)
        {
            await GuardPlanBelongsToPatientAsync(input.TreatmentPlanId.Value, input.PatientId);
        }

        if (input.Kind == PatientPaymentKind.Refund)
        {
            await GuardRefundFitsAsync(input);
        }

        var lines = await AllocateAsync(
            input.Kind, input.TreatmentPlanId, input.SplitMode, input.TreatmentServiceIds, input.Items, input.Amount);
        var paidAt = input.PaidAt ?? Clock.Now;
        PatientPayment.EnsureNotAfterToday(paidAt, DateTimeOffset.UtcNow);

        var payment = PatientPayment.Record(
            GuidGenerator.Create(),
            input.PatientId,
            input.ClinicBranchId,
            input.Kind,
            input.Method,
            input.Amount,
            await GenerateCodeAsync(input.ClinicBranchId, input.Kind, input.TreatmentPlanId),
            input.StaffId,
            paidAt,
            input.TreatmentPlanId,
            input.Note,
            input.PaymentAccountId,
            input.SplitMode,
            lines,
            GuidGenerator.Create,
            // P2610 (owner 2026-10-27): a new payment is "Chưa thanh toán" and
            // moves no money until it is signed, exported and ✓ confirmed. A
            // refund or held money has no such flow and is written settled.
            input.Kind == PatientPaymentKind.Payment
                ? PatientPaymentStatus.Pending
                : PatientPaymentStatus.Completed);
        payment.RequestRedInvoice(input.RedInvoiceRequested);
        if (payment.Kind == PatientPaymentKind.Payment)
        {
            payment.FreezeReceipt(await TakeReceiptAsync(payment, CurrentUser.Id));
        }

        await _repository.InsertAsync(payment, autoSave: true);
        return (await MapManyAsync([payment])).Single();
    }

    /// <summary>
    /// Turns "these services, this much" into a share per service.
    ///
    /// Chia Tiền Thủ Công is taken as typed; Chia Tiền Tự Động is spread here
    /// rather than in the browser, because only the server knows what each line
    /// still owes. Either way the shares must add up to the receipt and no line
    /// may be pushed past its own Còn nợ — the reference's
    /// <c>maxAllowedAmount</c> rule.
    /// </summary>
    private async Task<List<(Guid TreatmentServiceId, decimal Amount)>> AllocateAsync(
        PatientPaymentKind kind,
        Guid? treatmentPlanId,
        PaymentSplitMode splitMode,
        IReadOnlyCollection<Guid> treatmentServiceIds,
        IReadOnlyCollection<PatientPaymentLineDto> items,
        decimal amount)
    {
        // Money held for the patient is not against any service.
        if (kind == PatientPaymentKind.Prepaid || !treatmentPlanId.HasValue)
        {
            return [];
        }

        var chosen = splitMode == PaymentSplitMode.Manual
            ? items.Select(item => item.TreatmentServiceId).Distinct().ToList()
            : treatmentServiceIds.Distinct().ToList();

        if (chosen.Count == 0)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Billing.InvalidPaymentAllocation,
                "A receipt must name at least one service.");
        }

        // Money coming in may not push a line past what it still owes; money
        // going back out may not exceed what that line actually holds. Capping a
        // refund by "BE:PaymentKind:StillOwed" refused every refund on a line paid in full.
        var refunding = kind == PatientPaymentKind.Refund;
        var cap = await CapByServiceAsync(treatmentPlanId.Value, chosen, refunding);

        if (splitMode == PaymentSplitMode.Manual)
        {
            var manual = items
                .Where(item => item.Amount > 0m)
                .Select(item => (item.TreatmentServiceId, item.Amount))
                .ToList();

            foreach (var (serviceId, share) in manual)
            {
                GuardWithinCap(cap, serviceId, share, refunding);
            }

            return manual;
        }

        var spread = new List<(Guid, decimal)>();
        var left = amount;

        foreach (var serviceId in chosen)
        {
            if (left <= 0m) break;
            var take = Math.Min(left, cap.GetValueOrDefault(serviceId));
            if (take <= 0m) continue;

            spread.Add((serviceId, take));
            left -= take;
        }

        if (left > 0m)
        {
            throw new BusinessException(
                refunding
                    ? BlueDentalDomainErrorCodes.Billing.RefundExceedsPaid
                    : BlueDentalDomainErrorCodes.Billing.PaymentExceedsOutstanding);
        }

        return spread;
    }

    private static void GuardWithinCap(
        IReadOnlyDictionary<Guid, decimal> cap,
        Guid serviceId,
        decimal share,
        bool refunding)
    {
        if (share <= cap.GetValueOrDefault(serviceId))
        {
            return;
        }

        throw new BusinessException(
            refunding
                ? BlueDentalDomainErrorCodes.Billing.RefundExceedsPaid
                : BlueDentalDomainErrorCodes.Billing.PaymentExceedsOutstanding);
    }

    /// <summary>
    /// The most each named line may take: what it still owes when money is
    /// coming in, what it has actually collected when money is going back out.
    /// Only "Hoàn tất" receipts count (the <see cref="ISettleable"/> filter), so
    /// a pending receipt never blocks another and is re-checked when confirmed.
    /// </summary>
    private async Task<Dictionary<Guid, decimal>> CapByServiceAsync(
        Guid treatmentPlanId,
        IReadOnlyCollection<Guid> serviceIds,
        bool refunding)
    {
        // WithDetails, or plan.Services comes back empty and every line reads
        // as owing nothing.
        var planQuery = await _planRepository.WithDetailsAsync(x => x.Services);
        var plan = planQuery.Single(x => x.Id == treatmentPlanId);

        var paymentQuery = await _repository.GetQueryableAsync();
        var paid = paymentQuery
            .Where(payment => payment.TreatmentPlanId == treatmentPlanId)
            .SelectMany(payment => payment.Lines.Select(line => new
            {
                line.TreatmentServiceId,
                Signed = payment.Kind == PatientPaymentKind.Refund ? -line.Amount : line.Amount
            }))
            .ToList()
            .GroupBy(x => x.TreatmentServiceId)
            .ToDictionary(g => g.Key, g => g.Sum(x => x.Signed));

        // A line can only be collected up to what it is charged AFTER the slip
        // discount and voucher, never its own EffectiveAmount: otherwise a
        // voucher slip is paid at the pre-voucher price and Còn lại goes
        // negative (BA item 23, R-585).
        return plan.Services
            .Where(line => serviceIds.Contains(line.Id))
            .ToDictionary(
                line => line.Id,
                line => refunding
                    ? Math.Max(0m, paid.GetValueOrDefault(line.Id))
                    // VAT included: the receipt collects what the patient is asked to pay.
                    : Math.Max(0m, plan.PayableAmountOf(line) - paid.GetValueOrDefault(line.Id)));
    }

    /// <summary>
    /// "Chỉnh sửa" on a "Chưa thanh toán" row: the big create dialog again, so
    /// services, split, amount, channel, account and note can all change. A
    /// "Hoàn tất" receipt is final and the entity refuses (Billing:0096).
    /// </summary>
    [Authorize(BlueDentalAbilityPermissions.Payment.Update)]
    public async Task<PatientPaymentDto> UpdateAsync(Guid id, UpdatePatientPaymentDto input)
    {
        using var pending = DataFilter.Disable<ISettleable>();
        var payment = await GetWithLinesAsync(id);
        await _branchAccess.CheckAsync(payment.ClinicBranchId);

        await ReviseAsync(payment, input);

        await _repository.UpdateAsync(payment, autoSave: true);
        return (await MapManyAsync([payment])).Single();
    }

    /// <summary>
    /// "Xuất phiếu thu": the receipt is locked as "Đã xuất phiếu thu". It still
    /// moves no money — that waits for ✓ <see cref="ConfirmAsync"/>.
    /// </summary>
    [Authorize(BlueDentalAbilityPermissions.Payment.Update)]
    public async Task<PatientPaymentDto> IssueAsync(Guid id)
    {
        using var pending = DataFilter.Disable<ISettleable>();
        var payment = await GetWithLinesAsync(id);
        await _branchAccess.CheckAsync(payment.ClinicBranchId);

        payment.Issue(Clock.Now, CurrentUser.Id);

        await _repository.UpdateAsync(payment, autoSave: true);
        return (await MapManyAsync([payment])).Single();
    }

    /// <summary>
    /// ✓ "Xác nhận thanh toán" on an exported receipt: it becomes "Đã thanh
    /// toán", keeps the "Ngày thanh toán" picked when it was written, and is
    /// credited to the cashier confirming it. From here it counts in debt,
    /// revenue and the cash book. Its figures are frozen since the export, but
    /// other receipts may have been paid meanwhile, so each line is checked once
    /// more against what the slip still owes — after the status check, so a
    /// receipt already paid is told so rather than that its line owes nothing.
    /// </summary>
    [Authorize(BlueDentalAbilityPermissions.Payment.Update)]
    public async Task<PatientPaymentDto> ConfirmAsync(Guid id)
    {
        using var pending = DataFilter.Disable<ISettleable>();
        var payment = await GetWithLinesAsync(id);
        await _branchAccess.CheckAsync(payment.ClinicBranchId);

        payment.Confirm(CurrentUser.Id ?? payment.StaffId);
        await GuardLinesStillOwedAsync(payment);

        await _repository.UpdateAsync(payment, autoSave: true);
        return (await MapManyAsync([payment])).Single();
    }

    private async Task GuardLinesStillOwedAsync(PatientPayment payment)
    {
        if (payment.TreatmentPlanId is not { } planId || payment.Lines.Count == 0)
        {
            return;
        }

        var refunding = payment.Kind == PatientPaymentKind.Refund;
        var serviceIds = payment.Lines.Select(line => line.TreatmentServiceId).Distinct().ToList();
        Dictionary<Guid, decimal> cap;
        using (DataFilter.Enable<ISettleable>())
        {
            cap = await CapByServiceAsync(planId, serviceIds, refunding);
        }

        foreach (var serviceId in serviceIds)
        {
            GuardWithinCap(cap, serviceId, payment.AmountFor(serviceId), refunding);
        }
    }

    private async Task ReviseAsync(PatientPayment payment, UpdatePatientPaymentDto input)
    {
        // Checked against collected money only: the cap query runs with the
        // filter back on, so neither this receipt nor any other pending one counts.
        List<(Guid TreatmentServiceId, decimal Amount)> lines;
        using (DataFilter.Enable<ISettleable>())
        {
            lines = await AllocateAsync(
                payment.Kind,
                payment.TreatmentPlanId,
                input.SplitMode,
                input.TreatmentServiceIds,
                input.Items,
                input.Amount);
        }

        payment.Revise(
            input.SplitMode,
            input.Method,
            input.Amount,
            input.PaymentAccountId,
            string.IsNullOrWhiteSpace(input.Note) ? null : input.Note.Trim(),
            lines,
            GuidGenerator.Create);
        payment.RequestRedInvoice(input.RedInvoiceRequested);
        if (payment.Kind == PatientPaymentKind.Payment)
        {
            // Còn lại counts paid receipts only, as the cap above does.
            using (DataFilter.Enable<ISettleable>())
            {
                payment.FreezeReceipt(await TakeReceiptAsync(payment, payment.CreatorId));
            }
        }
    }

    /// <summary>
    /// The receipt page ("Tài chính / Phiếu thu", P2610): every status, a
    /// cancelled receipt too, so a link to it never dies. A receipt written
    /// before the content was frozen is read from today's data instead.
    /// Refunds and held money have no PHIẾU THU and are not found here.
    /// </summary>
    [Authorize(BlueDentalAbilityPermissions.Payment.Read)]
    public async Task<PaymentReceiptDto> GetReceiptAsync(Guid id)
    {
        using var pending = DataFilter.Disable<ISettleable>();
        using var cancelled = DataFilter.Disable<ISoftDelete>();
        var payment = await GetWithLinesAsync(id);
        // One soft-deleted with its slip is gone, not cancelled.
        if (payment.Kind != PatientPaymentKind.Payment
            || (payment.IsDeleted && payment.Status != PatientPaymentStatus.Cancelled))
        {
            throw new EntityNotFoundException(typeof(PatientPayment), id);
        }
        await _branchAccess.CheckAsync(payment.ClinicBranchId);

        PaymentReceiptSnapshot content;
        using (DataFilter.Enable<ISettleable>())
        using (DataFilter.Enable<ISoftDelete>())
        {
            content = payment.ReceiptSnapshot ?? await TakeReceiptAsync(payment, payment.CreatorId);
        }

        var people = await FullNamesAsync([payment.IssuedById, payment.CancelledById, payment.StaffId]);
        return new PaymentReceiptDto
        {
            Id = payment.Id,
            Code = payment.Code,
            PatientId = payment.PatientId,
            ClinicBranchId = payment.ClinicBranchId,
            TreatmentPlanId = payment.TreatmentPlanId,
            Status = payment.Status,
            CreationTime = payment.CreationTime,
            IssuedAt = payment.IssuedAt,
            IssuedByName = NameOf(people, payment.IssuedById),
            ConfirmedByName = payment.IsCompleted ? NameOf(people, payment.StaffId) : null,
            CancelledAt = payment.CancelledAt,
            CancelledByName = NameOf(people, payment.CancelledById),
            CancelReason = payment.CancelReason,
            CancelReasonCode = payment.CancelReasonCode,
            Content = new PaymentReceiptContentDto
            {
                PatientCode = content.PatientCode,
                PayerName = content.PayerName,
                PlanCode = content.PlanCode,
                PaidOn = content.PaidOn,
                Method = content.Method,
                Amount = content.Amount,
                AmountInWords = content.AmountInWords,
                SlipTotal = content.SlipTotal,
                PaidBefore = content.PaidBefore,
                Remaining = content.Remaining,
                RemainingInWords = content.RemainingInWords,
                CreatorName = content.CreatorName,
                Lines = content.Lines
                    .Select(line => new PaymentReceiptContentLineDto { Name = line.Name, Amount = line.Amount })
                    .ToList()
            }
        };
    }

    /// <summary>
    /// What the PHIẾU THU says right now: the patient, the slip, each service
    /// this receipt pays under its catalog name in slip order, and Số tiền còn
    /// lại = the slip's payable total − what it has collected ("Đã thanh toán"
    /// only, other receipts) − this receipt.
    /// </summary>
    private async Task<PaymentReceiptSnapshot> TakeReceiptAsync(PatientPayment payment, Guid? creatorId)
    {
        var planId = payment.TreatmentPlanId!.Value;
        var planQuery = await _planRepository.WithDetailsAsync(x => x.Services);
        var plan = planQuery.Single(x => x.Id == planId);

        var patient = await LazyServiceProvider.LazyGetRequiredService<IRepository<Patient, Guid>>()
            .GetAsync(payment.PatientId);

        var catalogIds = plan.Services.Select(s => s.ServiceId).Distinct().ToList();
        var catalogNames = (await LazyServiceProvider.LazyGetRequiredService<IRepository<CatalogEntry, Guid>>()
                .GetListAsync(c => catalogIds.Contains(c.Id)))
            .ToDictionary(c => c.Id, c => c.Name);

        var lines = plan.Services
            .OrderBy(s => s.SortOrder)
            .ThenByDescending(s => s.CreationTime)
            .Select(s => (Line: s, Share: payment.AmountFor(s.Id)))
            .Where(x => x.Share > 0m)
            .Select(x => new PaymentReceiptSnapshotLine(
                catalogNames.GetValueOrDefault(x.Line.ServiceId) ?? x.Line.Code, x.Share))
            .ToList();

        var paymentQuery = await _repository.GetQueryableAsync();
        var paidBefore = paymentQuery
            .Where(x => x.TreatmentPlanId == planId && x.Id != payment.Id)
            .Select(x => new { x.Kind, x.Amount })
            .ToList()
            .Sum(x => x.Kind == PatientPaymentKind.Refund ? -x.Amount : x.Amount);

        var names = await FullNamesAsync([creatorId]);
        return PaymentReceiptSnapshot.Take(
            patient.PatientCode,
            patient.FullName,
            plan.Code,
            ClinicCalendar.DateOf(payment.PaidAt),
            payment.Method,
            payment.Amount,
            plan.PayableAmount,
            paidBefore,
            NameOf(names, creatorId) ?? CurrentUser.UserName ?? string.Empty,
            lines);
    }

    /// <summary>Staff as the printed sheets name them: họ + tên, else the login.</summary>
    private async Task<Dictionary<Guid, string>> FullNamesAsync(IEnumerable<Guid?> userIds)
    {
        var ids = userIds.OfType<Guid>().Distinct().ToList();
        if (ids.Count == 0)
        {
            return new Dictionary<Guid, string>();
        }

        var users = await _userRepository.GetListByIdsAsync(ids);
        return users.ToDictionary(
            u => u.Id,
            u =>
            {
                var fullName = string.Join(" ", new[] { u.Surname, u.Name }.Where(x => !string.IsNullOrWhiteSpace(x)));
                return string.IsNullOrWhiteSpace(fullName) ? u.UserName : fullName;
            });
    }

    private static string? NameOf(Dictionary<Guid, string> names, Guid? userId) =>
        userId is { } id && names.TryGetValue(id, out var name) ? name : null;

    /// <summary>A bare GetAsync leaves the lines unloaded, and a revise would then orphan them.</summary>
    private async Task<PatientPayment> GetWithLinesAsync(Guid id)
    {
        var query = await _repository.WithDetailsAsync(x => x.Lines);
        return query.FirstOrDefault(x => x.Id == id)
            ?? throw new EntityNotFoundException(typeof(PatientPayment), id);
    }

    /// <summary>
    /// "Hủy phiếu": the receipt becomes "Phiếu bị hủy" and is soft-deleted, so
    /// nothing counts it any more and the debt comes back — a paid one raises
    /// Còn lại again. It keeps its reason, who and when, and the Thanh toán tab
    /// still lists it (bug list item 28, P2610).
    /// </summary>
    [Authorize(BlueDentalAbilityPermissions.Payment.Delete)]
    public async Task CancelAsync(Guid id, CancelPatientPaymentDto input)
    {
        // An unpaid receipt is hidden by the filter; a paid one is not. A
        // cancelled one is soft-deleted too, and is found so that a second
        // cancel says "already cancelled"; one gone with its slip stays gone.
        using var pending = DataFilter.Disable<ISettleable>();
        using var cancelled = DataFilter.Disable<ISoftDelete>();
        var payment = await GetWithLinesAsync(id);
        if (payment.IsDeleted && payment.Status != PatientPaymentStatus.Cancelled)
        {
            throw new EntityNotFoundException(typeof(PatientPayment), id);
        }
        await _branchAccess.CheckAsync(payment.ClinicBranchId);
        var wasPaid = payment.IsCompleted && payment.Kind == PatientPaymentKind.Payment;
        payment.Cancel(input.ReasonCode, input.Reason, Clock.Now, CurrentUser.Id);
        if (wasPaid)
        {
            await GuardRefundsStillCoveredAsync(payment);
        }

        // A signed e-invoice puts the money on a tax document: the receipt
        // stays. A draft only lives at the provider and goes with the receipt.
        var invoice = await _electronicInvoices.FirstOrDefaultAsync(x => x.PatientPaymentId == id);
        if (invoice != null)
        {
            invoice.EnsureReceiptRemovable();
            await _electronicInvoices.DeleteAsync(invoice);
        }

        await CancelOpenInvoiceRequestsAsync(id, input.Reason);

        // Saved before the delete: ABP reloads a soft-deleted entity, which
        // would drop the reason otherwise.
        await _repository.UpdateAsync(payment, autoSave: true);
        await _repository.DeleteAsync(payment, autoSave: true);
    }

    /// <summary>
    /// A refund is final once written, so a paid receipt whose money was paid
    /// back cannot go: each of its lines must still have collected at least
    /// this receipt's share once it is taken away. The cancel is not saved yet,
    /// so the query still counts it.
    /// </summary>
    private async Task GuardRefundsStillCoveredAsync(PatientPayment payment)
    {
        if (payment.TreatmentPlanId is not { } planId || payment.Lines.Count == 0)
        {
            return;
        }

        var serviceIds = payment.Lines.Select(line => line.TreatmentServiceId).Distinct().ToList();
        Dictionary<Guid, decimal> netPaid;
        using (DataFilter.Enable<ISettleable>())
        using (DataFilter.Enable<ISoftDelete>())
        {
            netPaid = await CapByServiceAsync(planId, serviceIds, refunding: true);
        }

        if (serviceIds.Any(serviceId => netPaid.GetValueOrDefault(serviceId) < payment.AmountFor(serviceId)))
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Billing.PaymentCancelBelowRefunded);
        }
    }

    /// <summary>
    /// A "Yêu cầu xuất HĐ" still waiting on the accountant dies with its receipt
    /// (R-915); an issued one stays as history.
    /// </summary>
    private async Task CancelOpenInvoiceRequestsAsync(Guid paymentId, string paymentReason)
    {
        var open = await _invoiceRequests.GetListAsync(x => x.PatientPaymentId == paymentId
            && (x.Status == InvoiceRequestStatus.Pending
                || x.Status == InvoiceRequestStatus.Processing
                || x.Status == InvoiceRequestStatus.NeedsInfo));
        var reason = L["Patient:InvoiceRequest:ReceiptCancelledReason", paymentReason].Value;
        foreach (var request in open)
        {
            request.Cancel(reason);
        }

        await _invoiceRequests.UpdateManyAsync(open, autoSave: true);
    }

    private async Task<List<PatientPayment>> QueryAsync(GetPatientPaymentListInput input)
    {
        var branchFilter = await _branchAccess.ResolveFilterAsync(input.ClinicBranchId);
        using var cancelled = input.IncludeCancelled ? DataFilter.Disable<ISoftDelete>() : null;
        using var pending = input.IncludePending ? DataFilter.Disable<ISettleable>() : null;
        var query = await _repository.WithDetailsAsync(x => x.Lines);

        if (branchFilter.Count > 0)
            query = query.Where(x => branchFilter.Contains(x.ClinicBranchId));
        if (input.PatientId.HasValue)
            query = query.Where(x => x.PatientId == input.PatientId.Value);
        if (input.TreatmentPlanId.HasValue)
            query = query.Where(x => x.TreatmentPlanId == input.TreatmentPlanId.Value);
        if (input.Kind.HasValue)
            query = query.Where(x => x.Kind == input.Kind.Value);
        if (input.FromDate.HasValue)
            query = query.Where(x => x.PaidAt >= input.FromDate.Value);
        if (input.ToDate.HasValue)
            query = query.Where(x => x.PaidAt <= input.ToDate.Value);

        return query.ToList();
    }

    private async Task GuardPlanBelongsToPatientAsync(Guid planId, Guid patientId)
    {
        var query = await _planRepository.GetQueryableAsync();
        var plan = query.FirstOrDefault(x => x.Id == planId)
            ?? throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.TreatmentPlanNotFound,
                "Treatment plan not found.");

        if (plan.PatientId != patientId)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Billing.InvalidInvoiceTransition,
                "That slip belongs to another patient.");
        }
    }

    /// <summary>A refund can never give back more than the slip has taken in.</summary>
    private async Task GuardRefundFitsAsync(RecordPatientPaymentDto input)
    {
        var existing = await QueryAsync(new GetPatientPaymentListInput
        {
            PatientId = input.PatientId,
            TreatmentPlanId = input.TreatmentPlanId
        });

        var net = existing.Sum(x => x.SignedAmount);
        if (input.Amount > net)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Billing.InsufficientPaymentAmount,
                $"Only {net:N0} đ has been collected on this slip; a larger refund is refused.");
        }
    }

    /// <summary>
    /// Per-branch, per-year, per-kind sequence, plus the slip's code for a
    /// payment — see <see cref="PatientPayment.FormatCode"/>.
    /// </summary>
    private async Task<string> GenerateCodeAsync(Guid clinicBranchId, PatientPaymentKind kind, Guid? treatmentPlanId)
    {
        var year = Clock.Now.Year;
        // A cancelled receipt keeps its number: the next one must not reuse it.
        using var cancelled = DataFilter.Disable<ISoftDelete>();
        // Nor may a receipt still waiting for its money.
        using var pending = DataFilter.Disable<ISettleable>();
        var query = await _repository.GetQueryableAsync();
        var sequence = query.Count(x =>
            x.ClinicBranchId == clinicBranchId
            && x.Kind == kind
            && x.CreationTime.Year == year) + 1;

        string? planCode = null;
        if (treatmentPlanId.HasValue)
        {
            var plans = await _planRepository.GetQueryableAsync();
            planCode = plans
                .Where(x => x.Id == treatmentPlanId.Value)
                .Select(x => x.Code)
                .FirstOrDefault();
        }

        return PatientPayment.FormatCode(kind, sequence, year, planCode);
    }

    private async Task<List<PatientPaymentDto>> MapManyAsync(IReadOnlyCollection<PatientPayment> items)
    {
        if (items.Count == 0)
        {
            return [];
        }

        var staffIds = items.Select(x => x.StaffId)
            .Concat(items.Select(x => x.CancelledById).OfType<Guid>())
            .Distinct()
            .ToList();
        var users = await _userRepository.GetListByIdsAsync(staffIds);
        var staffNames = users.ToDictionary(u => u.Id, u => u.Name ?? u.UserName);

        var planIds = items.Where(x => x.TreatmentPlanId.HasValue)
            .Select(x => x.TreatmentPlanId!.Value)
            .Distinct()
            .ToList();

        var planQuery = await _planRepository.GetQueryableAsync();
        var planCodes = planIds.Count == 0
            ? new Dictionary<Guid, string>()
            : planQuery.Where(x => planIds.Contains(x.Id)).ToDictionary(x => x.Id, x => x.Code);

        return items.Select(x => new PatientPaymentDto
        {
            Id = x.Id,
            PatientId = x.PatientId,
            ClinicBranchId = x.ClinicBranchId,
            TreatmentPlanId = x.TreatmentPlanId,
            SplitMode = x.SplitMode,
            Lines = x.Lines
                .Select(line => new PatientPaymentLineDto
                {
                    TreatmentServiceId = line.TreatmentServiceId,
                    Amount = line.Amount
                })
                .ToList(),
            Kind = x.Kind,
            Method = x.Method,
            Amount = x.Amount,
            Code = x.Code,
            PaidAt = x.PaidAt,
            StaffId = x.StaffId,
            Note = x.Note,
            PaymentAccountId = x.PaymentAccountId,
            StaffName = staffNames.TryGetValue(x.StaffId, out var staff) ? staff : null,
            TreatmentPlanCode = x.TreatmentPlanId.HasValue
                && planCodes.TryGetValue(x.TreatmentPlanId.Value, out var code)
                    ? code
                    : null,
            CreationTime = x.CreationTime,
            CreatorId = x.CreatorId,
            LastModificationTime = x.LastModificationTime,
            LastModifierId = x.LastModifierId,
            IsDeleted = x.IsDeleted,
            DeleterId = x.DeleterId,
            DeletionTime = x.DeletionTime,
            CancelReason = x.CancelReason,
            CancelReasonCode = x.CancelReasonCode,
            CancelledAt = x.CancelledAt,
            IssuedAt = x.IssuedAt,
            Status = x.Status,
            RedInvoiceRequested = x.RedInvoiceRequested,
            CancelledByName = x.CancelledById is { } canceller && staffNames.TryGetValue(canceller, out var name)
                ? name
                : null
        }).ToList();
    }
}
