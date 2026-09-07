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
            await GenerateCodeAsync(input.ClinicBranchId, input.Kind),
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

        var outstanding = await OutstandingByServiceAsync(input.TreatmentPlanId.Value, chosen);

        if (input.SplitMode == PaymentSplitMode.Manual)
        {
            var manual = input.Items
                .Where(item => item.Amount > 0m)
                .Select(item => (item.TreatmentServiceId, item.Amount))
                .ToList();

            foreach (var (serviceId, share) in manual)
            {
                GuardWithinOutstanding(outstanding, serviceId, share);
            }

            return manual;
        }

        var spread = new List<(Guid, decimal)>();
        var left = input.Amount;

        foreach (var serviceId in chosen)
        {
            if (left <= 0m) break;
            var take = Math.Min(left, outstanding.GetValueOrDefault(serviceId));
            if (take <= 0m) continue;

            spread.Add((serviceId, take));
            left -= take;
        }

        if (left > 0m)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Billing.InvalidPaymentAllocation,
                "Số tiền thanh toán không được vượt quá số tiền còn phải thanh toán.");
        }

        return spread;
    }

    private static void GuardWithinOutstanding(
        IReadOnlyDictionary<Guid, decimal> outstanding,
        Guid serviceId,
        decimal share)
    {
        if (share > outstanding.GetValueOrDefault(serviceId))
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Billing.InvalidPaymentAllocation,
                "Số tiền thanh toán của dịch vụ không được vượt quá số tiền còn phải thanh toán.");
        }
    }

    /// <summary>Còn nợ per line: what it is worth, less what receipts already put on it.</summary>
    private async Task<Dictionary<Guid, decimal>> OutstandingByServiceAsync(
        Guid treatmentPlanId,
        IReadOnlyCollection<Guid> serviceIds)
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
                line => Math.Max(0m, line.EffectiveAmount - paid.GetValueOrDefault(line.Id)));
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

    /// <summary>Per-branch, per-year sequence — e.g. PT26-0007 / HT26-0002.</summary>
    private async Task<string> GenerateCodeAsync(Guid clinicBranchId, PatientPaymentKind kind)
    {
        var prefix = kind switch
        {
            PatientPaymentKind.Refund => "HT",
            PatientPaymentKind.Prepaid => "GH",
            _ => "PT"
        };

        var year = Clock.Now.Year;
        var query = await _repository.GetQueryableAsync();
        var sequence = query.Count(x =>
            x.ClinicBranchId == clinicBranchId
            && x.Kind == kind
            && x.CreationTime.Year == year) + 1;

        return $"{prefix}{year % 100:D2}-{sequence:D4}";
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
