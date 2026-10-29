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
using BlueDental.Promotions;
using BlueDental.Staff;
using BlueDental.TreatmentManagement.Values;
using BlueDental.Values;
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
    private readonly PaymentReceiptContents _receipts;
    private readonly ReceiptSigningDesk _signing;
    private readonly IRepository<Voucher, Guid> _vouchers;
    private readonly IRepository<CatalogEntry, Guid> _catalog;

    public PatientPaymentAppService(
        IRepository<PatientPayment, Guid> repository,
        IRepository<TreatmentPlan, Guid> planRepository,
        IIdentityUserRepository userRepository,
        BranchAccessChecker branchAccess,
        PatientMoneyCalculator money,
        IPatientTreatmentAppService treatments,
        IRepository<ElectronicInvoice, Guid> electronicInvoices,
        IRepository<InvoiceRequest, Guid> invoiceRequests,
        OrgChartScopeResolver slipScope,
        PaymentReceiptContents receipts,
        ReceiptSigningDesk signing,
        IRepository<Voucher, Guid> vouchers,
        IRepository<CatalogEntry, Guid> catalog)
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
        _receipts = receipts;
        _signing = signing;
        _vouchers = vouchers;
        _catalog = catalog;
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

        var allocation = await AllocateAsync(
            new ReceiptContext(input.Kind, input.PatientId, input.TreatmentPlanId),
            AllocationRequest.Of(input));
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
            allocation.Lines,
            GuidGenerator.Create,
            // P2610 (owner 2026-10-27): a new payment is "Chưa thanh toán" and
            // moves no money until it is signed, exported and ✓ confirmed. A
            // refund or held money has no such flow and is written settled.
            input.Kind == PatientPaymentKind.Payment
                ? PatientPaymentStatus.Pending
                : PatientPaymentStatus.Completed,
            allocation.Voucher);
        payment.RequestRedInvoice(input.RedInvoiceRequested);
        if (payment.Kind == PatientPaymentKind.Payment)
        {
            payment.FreezeReceipt(await _receipts.TakeAsync(payment, CurrentUser.Id));
        }

        await _repository.InsertAsync(payment, autoSave: true);
        await _signing.SendIfFreeAsync(payment);
        return (await MapManyAsync([payment])).Single();
    }

    /// <summary>The receipt a split is for; on a revise, also which one it is and the voucher it already holds.</summary>
    private sealed record ReceiptContext(
        PatientPaymentKind Kind,
        Guid PatientId,
        Guid? TreatmentPlanId,
        Guid? ReceiptId = null,
        Guid? HeldVoucherId = null);

    /// <summary>What the dialog sent for the split, from "Tạo phiếu thanh toán" or "Chỉnh sửa".</summary>
    private sealed record AllocationRequest(
        PaymentSplitMode SplitMode,
        IReadOnlyCollection<Guid> TreatmentServiceIds,
        IReadOnlyCollection<PatientPaymentLineDto> Items,
        decimal Amount,
        IReadOnlyCollection<PaymentLineTermsDto> LineTerms,
        Guid? VoucherId)
    {
        public static AllocationRequest Of(RecordPatientPaymentDto input) =>
            new(input.SplitMode, input.TreatmentServiceIds, input.Items, input.Amount, input.LineTerms, input.VoucherId);

        public static AllocationRequest Of(UpdatePatientPaymentDto input) =>
            new(input.SplitMode, input.TreatmentServiceIds, input.Items, input.Amount, input.LineTerms, input.VoucherId);
    }

    /// <summary>
    /// Turns "these services, this much" into the receipt's lines.
    ///
    /// Chia Tiền Thủ Công is taken as typed; Chia Tiền Tự Động is spread here
    /// rather than in the browser, because only the server knows what each line
    /// still owes. Either way the shares must add up to the receipt and no line
    /// may be pushed past its own Còn nợ — the reference's
    /// <c>maxAllowedAmount</c> rule. A payment is one đợt of its slip (P2910):
    /// its TN giảm and voucher come off a line's Còn nợ before the money does,
    /// and each line keeps the VAT inside its money.
    /// </summary>
    private async Task<(List<PaymentLineDraft> Lines, PaymentVoucherUse? Voucher)> AllocateAsync(
        ReceiptContext receipt,
        AllocationRequest request)
    {
        var paying = receipt.Kind == PatientPaymentKind.Payment;
        if ((request.LineTerms.Count > 0 || request.VoucherId.HasValue)
            && (!paying || !receipt.TreatmentPlanId.HasValue))
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Billing.InvalidPaymentAllocation,
                "Only a payment against a slip takes cashier discounts or a voucher.");
        }

        // Money held for the patient is not against any service.
        if (receipt.Kind == PatientPaymentKind.Prepaid || receipt.TreatmentPlanId is not { } planId)
        {
            return ([], null);
        }

        var chosen = (request.SplitMode == PaymentSplitMode.Manual
                ? request.Items.Select(item => item.TreatmentServiceId)
                : request.TreatmentServiceIds)
            .Distinct()
            .ToList();

        if (chosen.Count == 0)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Billing.InvalidPaymentAllocation,
                "A receipt must name at least one service.");
        }

        var (plan, before) = await SettlementOfAsync(planId);

        // Money going back out may not exceed what a line actually holds. Capping a
        // refund by "BE:PaymentKind:StillOwed" refused every refund on a line paid in full.
        if (!paying)
        {
            var collected = chosen.ToDictionary(
                id => id,
                id => Math.Max(0m, before.GetValueOrDefault(id, LineSettlement.None).Cash));
            var refund = Spread(collected, chosen, request, refunding: true);
            return (chosen
                .Where(refund.ContainsKey)
                .Select(id => new PaymentLineDraft(id, refund[id]))
                .ToList(), null);
        }

        var round = new PaymentRound(plan, before, chosen, TermsOf(request.LineTerms));
        var voucher = request.VoucherId is { } voucherId
            ? await UseVoucherAsync(round, plan, receipt, voucherId)
            : null;
        return (round.Drafts(Spread(round.Caps(), chosen, request, refunding: false)), voucher);
    }

    /// <summary>
    /// Each line's money: as typed (Thủ Công), or poured over the lines in the
    /// order they were ticked (Tự Động) — never past a line's cap.
    /// </summary>
    private static Dictionary<Guid, decimal> Spread(
        IReadOnlyDictionary<Guid, decimal> cap,
        IReadOnlyCollection<Guid> chosen,
        AllocationRequest request,
        bool refunding)
    {
        if (request.SplitMode == PaymentSplitMode.Manual)
        {
            var typed = request.Items
                .Where(item => item.Amount > 0m)
                .GroupBy(item => item.TreatmentServiceId)
                .ToDictionary(group => group.Key, group => group.Sum(item => item.Amount));

            foreach (var (serviceId, share) in typed)
            {
                GuardWithinCap(cap.GetValueOrDefault(serviceId), share, refunding);
            }

            return typed;
        }

        var spread = new Dictionary<Guid, decimal>();
        var left = request.Amount;

        foreach (var serviceId in chosen)
        {
            if (left <= 0m) break;
            var take = Math.Min(left, cap.GetValueOrDefault(serviceId));
            if (take <= 0m) continue;

            spread[serviceId] = take;
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

    private static void GuardWithinCap(decimal cap, decimal share, bool refunding)
    {
        if (share <= cap)
        {
            return;
        }

        throw new BusinessException(
            refunding
                ? BlueDentalDomainErrorCodes.Billing.RefundExceedsPaid
                : BlueDentalDomainErrorCodes.Billing.PaymentExceedsOutstanding);
    }

    /// <summary>The cashier's terms by service, TN giảm in whole đồng.</summary>
    private static Dictionary<Guid, PaymentLineTerms> TermsOf(IReadOnlyCollection<PaymentLineTermsDto> terms)
    {
        if (terms.Select(term => term.TreatmentServiceId).Distinct().Count() != terms.Count)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Billing.InvalidPaymentAllocation,
                "A service is given cashier terms twice.");
        }

        return terms.ToDictionary(
            term => term.TreatmentServiceId,
            term => new PaymentLineTerms(
                string.IsNullOrWhiteSpace(term.ReceiptName) ? null : term.ReceiptName.Trim(),
                Vnd.Round(term.CashierDiscount),
                string.IsNullOrWhiteSpace(term.CashierDiscountReason) ? null : term.CashierDiscountReason.Trim()));
    }

    /// <summary>
    /// The slip, and what its receipts have done to each line: money net of
    /// refunds, relief and VAT. Only "Hoàn tất" receipts count (the
    /// <see cref="ISettleable"/> filter), so a pending receipt never blocks
    /// another and is re-checked when confirmed.
    /// </summary>
    private async Task<(TreatmentPlan Plan, Dictionary<Guid, LineSettlement> Settled)> SettlementOfAsync(
        Guid treatmentPlanId)
    {
        // WithDetails, or plan.Services comes back empty and every line reads
        // as owing nothing.
        var planQuery = await _planRepository.WithDetailsAsync(x => x.Services, x => x.AppliedVouchers);
        var plan = planQuery.Single(x => x.Id == treatmentPlanId);

        var paymentQuery = await _repository.WithDetailsAsync(x => x.Lines);
        var payments = paymentQuery.Where(payment => payment.TreatmentPlanId == treatmentPlanId).ToList();

        return (plan, LineSettlement.Of(plan, payments));
    }

    /// <summary>
    /// Holds a use of the voucher picked at payment time (P2910) under the
    /// slip's voucher rules. The patient's earlier uses are those on slips and
    /// on receipts not cancelled — unpaid ones too, since they hold theirs —
    /// but never this receipt's own.
    /// </summary>
    private async Task<PaymentVoucherUse> UseVoucherAsync(
        PaymentRound round,
        TreatmentPlan plan,
        ReceiptContext receipt,
        Guid voucherId)
    {
        var voucher = await _vouchers.FindAsync(voucherId)
            ?? throw new BusinessException(
                BlueDentalDomainErrorCodes.Promotions.VoucherNotFound,
                "The picked voucher no longer exists.");

        var self = receipt.ReceiptId ?? Guid.Empty;
        List<(Guid VoucherId, Guid? TreatmentPlanId)> onReceipts;
        // Every receipt still holding its use: pending and exported ones too,
        // but not a cancelled one — cancelling gave the use back.
        using (DataFilter.Disable<ISettleable>())
        {
            var paymentQuery = await _repository.GetQueryableAsync();
            onReceipts = paymentQuery
                .Where(payment => payment.PatientId == receipt.PatientId
                    && payment.VoucherId != null
                    && payment.Status != PatientPaymentStatus.Cancelled
                    && payment.Id != self)
                .Select(payment => new { VoucherId = payment.VoucherId!.Value, payment.TreatmentPlanId })
                .ToList()
                .Select(use => (use.VoucherId, use.TreatmentPlanId))
                .ToList();
        }

        var planQuery = await _planRepository.GetQueryableAsync();
        var onSlips = planQuery
            .Where(slip => slip.PatientId == receipt.PatientId)
            .SelectMany(slip => slip.AppliedVouchers)
            .Count(applied => applied.VoucherId == voucherId);
        var priorUses = onSlips + onReceipts.Count(use => use.VoucherId == voucherId);

        var alongsideIds = plan.AppliedVouchers.Select(applied => applied.VoucherId)
            .Concat(onReceipts.Where(use => use.TreatmentPlanId == plan.Id).Select(use => use.VoucherId))
            .Distinct()
            .ToList();
        List<Voucher> alongside = alongsideIds.Count == 0
            ? []
            : await _vouchers.GetListAsync(other => alongsideIds.Contains(other.Id));

        var held = voucherId == receipt.HeldVoucherId;
        var use = round.UseVoucher(
            voucher,
            ClinicCalendar.DateOf(Clock.Now.ToUniversalTime()),
            priorUses,
            alongside,
            await ServiceGroupsAsync(plan),
            held);
        if (!held)
        {
            await _vouchers.UpdateAsync(voucher);
        }

        return use;
    }

    /// <summary>A service voucher may name the group instead of the service (R-949).</summary>
    private async Task<Dictionary<Guid, Guid>> ServiceGroupsAsync(TreatmentPlan plan)
    {
        var serviceIds = plan.Services.Select(s => s.ServiceId).Distinct().ToList();
        using (DataFilter.Disable<ISoftDelete>())
        {
            var catalogQuery = await _catalog.GetQueryableAsync();
            return catalogQuery
                .Where(c => serviceIds.Contains(c.Id))
                .Select(c => new { c.Id, c.TaxonomyId })
                .ToList()
                .ToDictionary(c => c.Id, c => c.TaxonomyId);
        }
    }

    /// <summary>Gives back the use a receipt held; a voucher deleted since has none to take back.</summary>
    private async Task ReleaseVoucherAsync(Guid voucherId)
    {
        var voucher = await _vouchers.FindAsync(voucherId);
        if (voucher == null)
        {
            return;
        }

        voucher.Release();
        await _vouchers.UpdateAsync(voucher);
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

        var wasOnPaper = payment.IsSignedOnPaper;
        await ReviseAsync(payment, input);
        if (wasOnPaper)
        {
            // What was signed on paper no longer says the same: logged as taken back.
            await LazyServiceProvider.LazyGetRequiredService<ReceiptLogBook>()
                .PaperTakenBackAsync(payment, Clock.Now, CurrentUser.Id);
        }

        // The iPad must not keep the old figures; the cashier sends it again.
        await _signing.CloseOfPaymentAsync(payment, SigningCloseReason.Revised);

        await _repository.UpdateAsync(payment, autoSave: true);
        return (await MapManyAsync([payment])).Single();
    }

    /// <summary>
    /// "Xuất phiếu thu": once the customer has signed — on the iPad or on the
    /// printed draft (P2910_02) — the PHIẾU THU is written to PDF/A with their
    /// signature when there is one, and with the accountant's saved one under
    /// Ký điện tử; sealed, stored, and the receipt is locked as "Đã xuất phiếu
    /// thu". It still moves no money — that waits for ✓
    /// <see cref="ConfirmAsync"/>. Token điện tử is refused until phase 7.
    /// </summary>
    [Authorize(BlueDentalAbilityPermissions.Payment.Update)]
    public async Task<PatientPaymentDto> ExportAsync(Guid id, ExportPatientPaymentDto input)
    {
        using var pending = DataFilter.Disable<ISettleable>();
        var payment = await GetWithLinesAsync(id);
        await _branchAccess.CheckAsync(payment.ClinicBranchId);

        var signMode = input.SignMode!.Value;
        payment.EnsureIssuable(signMode);

        // Ký điện tử: the accountant's own saved signature, as it stands now.
        var vault = LazyServiceProvider.LazyGetRequiredService<AccountantSignatureVault>();
        AccountantSignature? signature = null;
        if (signMode == ReceiptSignMode.Electronic)
        {
            signature = (CurrentUser.Id is { } userId ? await vault.OfAsync(userId) : null)
                ?? throw new BusinessException(BlueDentalDomainErrorCodes.Billing.AccountantSignatureMissing);
        }

        var file = await LazyServiceProvider.LazyGetRequiredService<ReceiptExporter>()
            .ExportAsync(payment, signMode, signature == null ? null : vault.PngOf(signature));
        payment.Issue(Clock.Now, CurrentUser.Id, signMode, file.FileName, file.Sha256, signature?.Signer);
        // The log keeps who exported and when, who signed and when (P2910_02).
        await LazyServiceProvider.LazyGetRequiredService<ReceiptLogBook>().ExportedAsync(payment, file.CustomerSignedAt);
        // The iPad turns to "Phiếu thu đã được xuất".
        await _signing.CloseOfPaymentAsync(payment, SigningCloseReason.Issued);

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
        TreatmentPlan plan;
        Dictionary<Guid, LineSettlement> settled;
        using (DataFilter.Enable<ISettleable>())
        {
            (plan, settled) = await SettlementOfAsync(planId);
        }

        foreach (var lines in payment.Lines.GroupBy(line => line.TreatmentServiceId))
        {
            var service = plan.Services.FirstOrDefault(line => line.Id == lines.Key);
            var before = settled.GetValueOrDefault(lines.Key, LineSettlement.None);
            // TN giảm and the voucher (P2910) come off what the line still owes
            // before VAT; the money then off what is left of its Còn nợ.
            var relief = lines.Sum(line => line.Relief);
            if (relief > 0m && (service == null || relief > plan.PreTaxOutstandingOf(service, before)))
            {
                throw new BusinessException(BlueDentalDomainErrorCodes.Billing.ReliefExceedsOutstanding);
            }

            var cap = refunding
                ? Math.Max(0m, before.Cash)
                : service == null ? 0m : plan.OutstandingOf(service, before.With(0m, relief, 0m));
            GuardWithinCap(cap, lines.Sum(line => line.Amount), refunding);
        }
    }

    private async Task ReviseAsync(PatientPayment payment, UpdatePatientPaymentDto input)
    {
        // A voucher taken off or swapped gives its use back; one kept keeps it.
        var heldVoucherId = payment.VoucherId;
        if (heldVoucherId.HasValue && heldVoucherId != input.VoucherId)
        {
            await ReleaseVoucherAsync(heldVoucherId.Value);
            heldVoucherId = null;
        }

        // Checked against collected money only: the cap query runs with the
        // filter back on, so neither this receipt nor any other pending one counts.
        (List<PaymentLineDraft> Lines, PaymentVoucherUse? Voucher) allocation;
        using (DataFilter.Enable<ISettleable>())
        {
            allocation = await AllocateAsync(
                new ReceiptContext(payment.Kind, payment.PatientId, payment.TreatmentPlanId, payment.Id, heldVoucherId),
                AllocationRequest.Of(input));
        }

        payment.Revise(
            input.SplitMode,
            input.Method,
            input.Amount,
            input.PaymentAccountId,
            string.IsNullOrWhiteSpace(input.Note) ? null : input.Note.Trim(),
            allocation.Lines,
            GuidGenerator.Create,
            allocation.Voucher);
        payment.RequestRedInvoice(input.RedInvoiceRequested);
        if (payment.Kind == PatientPaymentKind.Payment)
        {
            // Còn lại counts paid receipts only, as the cap above does.
            using (DataFilter.Enable<ISettleable>())
            {
                payment.FreezeReceipt(await _receipts.TakeAsync(payment, payment.CreatorId));
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

        var content = await _receipts.ContentOfAsync(payment);
        var people = await _receipts.FullNamesAsync([
            payment.IssuedById, payment.CancelledById, payment.StaffId, payment.PaperSignedById, payment.AccountantSignerId]);
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
            IssuedByName = PaymentReceiptContents.NameOf(people, payment.IssuedById),
            ConfirmedByName = payment.IsCompleted ? PaymentReceiptContents.NameOf(people, payment.StaffId) : null,
            CancelledAt = payment.CancelledAt,
            CancelledByName = PaymentReceiptContents.NameOf(people, payment.CancelledById),
            CancelReason = payment.CancelReason,
            CancelReasonCode = payment.CancelReasonCode,
            SignMode = payment.SignMode,
            PaperSignedAt = payment.PaperSignedAt,
            PaperSignedByName = PaymentReceiptContents.NameOf(people, payment.PaperSignedById),
            AccountantSignerName = PaymentReceiptContents.NameOf(people, payment.AccountantSignerId),
            AccountantSignatureSavedAt = payment.AccountantSignatureSavedAt,
            HasFile = payment.HasReceiptFile,
            Content = PaymentReceiptContents.ToDto(content),
            CashierDiscounts = await _receipts.CashierDiscountsOfAsync(payment)
        };
    }

    /// <summary>
    /// The exported PHIẾU THU, as stored at export and checked against its
    /// SHA-256 — for "In phiếu thu" and the accountant. A cancelled receipt
    /// keeps its file.
    /// </summary>
    [Authorize(BlueDentalAbilityPermissions.Payment.Read)]
    public async Task<byte[]> GetReceiptFileAsync(Guid id)
    {
        using var pending = DataFilter.Disable<ISettleable>();
        using var cancelled = DataFilter.Disable<ISoftDelete>();
        var payment = await _repository.GetAsync(id, includeDetails: false);
        await _branchAccess.CheckAsync(payment.ClinicBranchId);

        return await LazyServiceProvider.LazyGetRequiredService<ReceiptExporter>().ReadAsync(payment);
    }

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
        if (payment.Kind == PatientPaymentKind.Payment)
        {
            await LazyServiceProvider.LazyGetRequiredService<ReceiptLogBook>().CancelledAsync(payment);
        }

        if (wasPaid)
        {
            await GuardRefundsStillCoveredAsync(payment);
        }

        // The voucher picked at payment time (P2910) gets its use back.
        if (payment.VoucherId is { } voucherId)
        {
            await ReleaseVoucherAsync(voucherId);
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
        await _signing.CloseOfPaymentAsync(payment, SigningCloseReason.ReceiptCancelled);

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
        Dictionary<Guid, LineSettlement> settled;
        using (DataFilter.Enable<ISettleable>())
        using (DataFilter.Enable<ISoftDelete>())
        {
            (_, settled) = await SettlementOfAsync(planId);
        }

        // Only money was refunded, never relief (P2910).
        if (serviceIds.Any(serviceId =>
                settled.GetValueOrDefault(serviceId, LineSettlement.None).Cash < payment.AmountFor(serviceId)))
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

        // A line written before P2910 (and every refund line) has no VAT of its
        // own: it is split out of the money at the service's rate, as before.
        var unsplitPlanIds = items
            .Where(x => x.TreatmentPlanId.HasValue && x.Lines.Any(line => line.TaxAmount == null))
            .Select(x => x.TreatmentPlanId!.Value)
            .Distinct()
            .ToList();
        var services = unsplitPlanIds.Count == 0
            ? new Dictionary<Guid, TreatmentService>()
            : (await _planRepository.WithDetailsAsync(x => x.Services))
                .Where(x => unsplitPlanIds.Contains(x.Id))
                .SelectMany(x => x.Services)
                .ToDictionary(x => x.Id);

        decimal TaxOf(PatientPaymentLine line) =>
            line.TaxAmount
            ?? (services.TryGetValue(line.TreatmentServiceId, out var service)
                ? TreatmentPlan.TaxWithin(service, line.Amount)
                : 0m);

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
                    Amount = line.Amount,
                    ReceiptName = line.ReceiptName,
                    CashierDiscount = line.CashierDiscount,
                    CashierDiscountReason = line.CashierDiscountReason,
                    VoucherShare = line.VoucherShare,
                    TaxAmount = TaxOf(line)
                })
                .ToList(),
            VoucherId = x.VoucherId,
            VoucherCode = x.VoucherCode,
            VoucherAmount = x.VoucherAmount,
            CashierDiscountTotal = x.CashierDiscountTotal,
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
