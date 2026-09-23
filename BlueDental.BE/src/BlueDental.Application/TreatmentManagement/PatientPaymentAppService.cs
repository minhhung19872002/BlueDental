using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Billing;
using BlueDental.Organizations;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;
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
public class PatientPaymentAppService : ApplicationService, IPatientPaymentAppService
{
    private readonly IRepository<PatientPayment, Guid> _repository;
    private readonly IRepository<TreatmentPlan, Guid> _planRepository;
    private readonly IIdentityUserRepository _userRepository;
    private readonly BranchAccessChecker _branchAccess;
    private readonly PatientMoneyCalculator _money;
    private readonly IPatientTreatmentAppService _treatments;

    public PatientPaymentAppService(
        IRepository<PatientPayment, Guid> repository,
        IRepository<TreatmentPlan, Guid> planRepository,
        IIdentityUserRepository userRepository,
        BranchAccessChecker branchAccess,
        PatientMoneyCalculator money,
        IPatientTreatmentAppService treatments)
    {
        _repository = repository;
        _planRepository = planRepository;
        _userRepository = userRepository;
        _branchAccess = branchAccess;
        _money = money;
        _treatments = treatments;
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

        return new PatientAccountDto
        {
            PatientId = patientId,
            Payment = PatientTreatmentAppService.MapPayment(
                _money.ForPatient(planEntities, payments)),
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

        var lines = await AllocateAsync(input);

        var payment = PatientPayment.Record(
            GuidGenerator.Create(),
            input.PatientId,
            input.ClinicBranchId,
            input.Kind,
            input.Method,
            input.Amount,
            await GenerateCodeAsync(input.ClinicBranchId, input.Kind, input.TreatmentPlanId),
            input.StaffId,
            input.PaidAt ?? Clock.Now,
            input.TreatmentPlanId,
            input.Note,
            input.PaymentAccountId,
            input.SplitMode,
            lines,
            GuidGenerator.Create);

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
        RecordPatientPaymentDto input)
    {
        // Money held for the patient is not against any service.
        if (input.Kind == PatientPaymentKind.Prepaid || !input.TreatmentPlanId.HasValue)
        {
            return [];
        }

        var chosen = input.SplitMode == PaymentSplitMode.Manual
            ? input.Items.Select(item => item.TreatmentServiceId).Distinct().ToList()
            : input.TreatmentServiceIds.Distinct().ToList();

        if (chosen.Count == 0)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Billing.InvalidPaymentAllocation,
                "A receipt must name at least one service.");
        }

        // Money coming in may not push a line past what it still owes; money
        // going back out may not exceed what that line actually holds. Capping a
        // refund by "BE:PaymentKind:StillOwed" refused every refund on a line paid in full.
        var refunding = input.Kind == PatientPaymentKind.Refund;
        var cap = await CapByServiceAsync(input.TreatmentPlanId.Value, chosen, refunding);

        if (input.SplitMode == PaymentSplitMode.Manual)
        {
            var manual = input.Items
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
        var left = input.Amount;

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

    /// <summary>Còn nợ per line: what it is worth, less what receipts already put on it.</summary>
    /// <summary>
    /// The most each named line may take: what it still owes when money is
    /// coming in, what it has actually collected when money is going back out.
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

        return plan.Services
            .Where(line => serviceIds.Contains(line.Id))
            .ToDictionary(
                line => line.Id,
                line => refunding
                    ? Math.Max(0m, paid.GetValueOrDefault(line.Id))
                    : Math.Max(0m, line.EffectiveAmount - paid.GetValueOrDefault(line.Id)));
    }

    /// <summary>
    /// "BE:Common:Edit" on the Thanh toán row. Only the channel, the account, the
    /// date and the note move; the amount and the per-service split stay, so no
    /// rollup can drift out from under the slip.
    /// </summary>
    [Authorize(BlueDentalAbilityPermissions.Payment.Update)]
    public async Task<PatientPaymentDto> UpdateAsync(Guid id, UpdatePatientPaymentDto input)
    {
        var payment = await _repository.GetAsync(id);
        await _branchAccess.CheckAsync(payment.ClinicBranchId);

        payment.Revise(
            input.Method,
            input.PaymentAccountId,
            input.PaidAt ?? payment.PaidAt,
            input.Note);

        await _repository.UpdateAsync(payment, autoSave: true);
        return (await MapManyAsync([payment])).Single();
    }

    [Authorize(BlueDentalAbilityPermissions.Payment.Delete)]
    public async Task DeleteAsync(Guid id)
    {
        var payment = await _repository.GetAsync(id);
        await _branchAccess.CheckAsync(payment.ClinicBranchId);
        await _repository.DeleteAsync(id, autoSave: true);
    }

    private async Task<List<PatientPayment>> QueryAsync(GetPatientPaymentListInput input)
    {
        var branchFilter = await _branchAccess.ResolveFilterAsync(input.ClinicBranchId);
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

        var staffIds = items.Select(x => x.StaffId).Distinct().ToList();
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
            LastModifierId = x.LastModifierId
        }).ToList();
    }
}
