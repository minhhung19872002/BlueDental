using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Billing;
using BlueDental.Catalogs;
using BlueDental.CustomerCare;
using BlueDental.Exporting;
using BlueDental.Labo;
using BlueDental.Organizations;
using BlueDental.Permissions;
using BlueDental.TreatmentManagement.Values;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Identity;

namespace BlueDental.TreatmentManagement;

/// <summary>
/// Phiếu điều trị (patient-treatments) and the service lines it holds.
///
/// The reference has no separate ability subject for the slip; it sits inside the
/// consulting chain, so <c>treatmentConsultation</c> guards it.
/// </summary>
[Authorize]
public class PatientTreatmentAppService : BlueDentalAppService, IPatientTreatmentAppService
{
    private readonly IRepository<TreatmentPlan, Guid> _planRepository;
    private readonly IRepository<PatientAdvise, Guid> _adviseRepository;
    private readonly IRepository<PatientPayment, Guid> _paymentRepository;
    private readonly IRepository<TreatmentStage, Guid> _stageRepository;
    private readonly IRepository<CareRecord, Guid> _careRepository;
    private readonly IRepository<CatalogEntry, Guid> _catalogRepository;
    private readonly IRepository<LaboOrder, Guid> _laboRepository;
    private readonly IIdentityUserRepository _userRepository;
    private readonly BranchAccessChecker _branchAccess;
    private readonly PatientMoneyCalculator _money;

    public PatientTreatmentAppService(
        IRepository<TreatmentPlan, Guid> planRepository,
        IRepository<PatientAdvise, Guid> adviseRepository,
        IRepository<PatientPayment, Guid> paymentRepository,
        IRepository<TreatmentStage, Guid> stageRepository,
        IRepository<CareRecord, Guid> careRepository,
        IRepository<CatalogEntry, Guid> catalogRepository,
        IRepository<LaboOrder, Guid> laboRepository,
        IIdentityUserRepository userRepository,
        BranchAccessChecker branchAccess,
        PatientMoneyCalculator money)
    {
        _laboRepository = laboRepository;
        _planRepository = planRepository;
        _adviseRepository = adviseRepository;
        _paymentRepository = paymentRepository;
        _stageRepository = stageRepository;
        _careRepository = careRepository;
        _catalogRepository = catalogRepository;
        _userRepository = userRepository;
        _branchAccess = branchAccess;
        _money = money;
    }

    [Authorize(BlueDentalAbilityPermissions.TreatmentConsultation.Read)]
    public async Task<PagedResultDto<TreatmentPlanSlipDto>> GetListAsync(
        GetTreatmentPlanSlipListInput input)
    {
        var branchFilter = await _branchAccess.ResolveFilterAsync(input.ClinicBranchId);
        var query = await _planRepository.WithDetailsAsync(x => x.Services);

        if (branchFilter.Count > 0)
            query = query.Where(x => branchFilter.Contains(x.BranchId));
        if (input.PatientId.HasValue)
            query = query.Where(x => x.PatientId == input.PatientId.Value);
        if (input.Status.HasValue)
            query = query.Where(x => x.Status == input.Status.Value);

        var totalCount = query.Count();
        var plans = query
            .OrderByDescending(x => x.CreationTime)
            .Skip(input.SkipCount)
            .Take(input.MaxResultCount)
            .ToList();

        return new PagedResultDto<TreatmentPlanSlipDto>(totalCount, await MapManyAsync(plans));
    }

    [Authorize(BlueDentalAbilityPermissions.TreatmentConsultation.Read)]
    public async Task<TreatmentPlanSlipDto> GetAsync(Guid id)
    {
        var plan = await LoadAsync(id);
        return (await MapManyAsync([plan])).Single();
    }

    [Authorize(BlueDentalAbilityPermissions.TreatmentConsultation.Create)]
    public async Task<TreatmentPlanSlipDto> OpenAsync(OpenTreatmentPlanDto input)
    {
        await _branchAccess.CheckAsync(input.ClinicBranchId);

        var advises = await GetConvertibleAdvisesAsync(input);
        if (advises.Count == 0)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.InvalidAdviseTransition,
                "A treatment slip needs at least one accepted consulting line.");
        }

        var plan = TreatmentPlan.Open(
            GuidGenerator.Create(),
            input.PatientId,
            input.DentistId,
            input.ClinicBranchId,
            await GenerateCodeAsync(input.PatientId),
            input.Title.IsNullOrWhiteSpace() ? "Kế hoạch điều trị" : input.Title!,
            input.ConsultantStaffId,
            input.DiscountType,
            input.DiscountValue);

        plan.ApplyVoucher(input.VoucherDiscountAmount);

        foreach (var advise in advises)
        {
            plan.AddService(
                GuidGenerator.Create(),
                advise.ServiceId,
                advise.Id,
                advise.Price,
                advise.Quantity,
                advise.DiscountType,
                advise.DiscountValue,
                advise.Teeth.ToList());

            advise.ConvertTo(plan.Id);
        }

        await _planRepository.InsertAsync(plan, autoSave: true);
        await _adviseRepository.UpdateManyAsync(advises, autoSave: true);

        return (await MapManyAsync([plan])).Single();
    }

    [Authorize(BlueDentalAbilityPermissions.TreatmentConsultation.Update)]
    public async Task<TreatmentPlanSlipDto> ApplyDiscountAsync(Guid id, ApplyPlanDiscountDto input)
    {
        var plan = await LoadAsync(id);
        plan.ApplyDiscount(input.DiscountType, input.DiscountValue);

        await _planRepository.UpdateAsync(plan, autoSave: true);
        return (await MapManyAsync([plan])).Single();
    }

    [Authorize(BlueDentalAbilityPermissions.TreatmentConsultation.Update)]
    public async Task<TreatmentPlanSlipDto> AddServiceAsync(Guid id, AddTreatmentServiceDto input)
    {
        var plan = await LoadAsync(id);

        var catalog = await _catalogRepository.FirstOrDefaultAsync(c => c.Id == input.ServiceId)
            ?? throw new BusinessException(
                BlueDentalDomainErrorCodes.Catalogs.CatalogEntryNotFound,
                "That service is not in the catalog.");

        var line = plan.AddService(
            GuidGenerator.Create(),
            catalog.Id,
            sourceAdviseId: null,
            input.Price,
            input.Quantity,
            input.DiscountType,
            input.DiscountValue,
            PatientDiagnosisAppService.ToToothSelections(input.Teeth));

        line.SetDetails(
            input.DiagnosisId,
            input.DentistId,
            input.Note,
            input.DiagnoserStaffId,
            input.SecondDiagnoserStaffId,
            input.ConsultantStaffId,
            input.SecondConsultantStaffId);

        if (input.Status.HasValue && input.Status.Value != TreatmentServiceStatus.Created)
        {
            line.SetInitialStatus(input.Status.Value);
        }

        plan.CloseIfAllServicesDone();
        await _planRepository.UpdateAsync(plan, autoSave: true);
        return (await MapManyAsync([plan])).Single();
    }

    [Authorize(BlueDentalAbilityPermissions.TreatmentConsultation.Update)]
    public async Task<TreatmentPlanSlipDto> CompleteServiceAsync(Guid id, Guid serviceLineId)
    {
        var plan = await LoadAsync(id);
        plan.GetService(serviceLineId).Complete();
        plan.CloseIfAllServicesDone();

        await _planRepository.UpdateAsync(plan, autoSave: true);
        return (await MapManyAsync([plan])).Single();
    }

    [Authorize(BlueDentalAbilityPermissions.TreatmentConsultation.Update)]
    public async Task<TreatmentPlanSlipDto> CancelServiceAsync(Guid id, Guid serviceLineId)
    {
        var plan = await LoadAsync(id);
        await GuardNoOpenLaboOrderAsync(serviceLineId);
        plan.GetService(serviceLineId).Cancel();
        plan.CloseIfAllServicesDone();

        await _planRepository.UpdateAsync(plan, autoSave: true);
        return (await MapManyAsync([plan])).Single();
    }

    /// <summary>
    /// "Hủy phiếu Labo": the reference (2026-09-24) issues one
    /// <c>PUT /orders/{id}/update-status {status: canceled, statusClinic: canceled}</c>
    /// per order of the line and then reloads the slip; the line's own status
    /// is untouched. Orders already received, completed, cancelled or replaced
    /// are left as they are.
    /// </summary>
    [Authorize(BlueDentalAbilityPermissions.TreatmentConsultation.Update)]
    public async Task<TreatmentPlanSlipDto> CancelServiceLaboOrdersAsync(Guid id, Guid serviceLineId)
    {
        var plan = await LoadAsync(id);
        plan.GetService(serviceLineId);

        var orders = await _laboRepository.GetListAsync(o => o.TreatmentServiceId == serviceLineId);
        var open = orders.Where(o => o.IsUnfinished).ToList();
        foreach (var order in open)
        {
            order.CancelForServiceChange();
        }

        if (open.Count > 0)
        {
            await _laboRepository.UpdateManyAsync(open, autoSave: true);
        }

        return (await MapManyAsync([plan])).Single();
    }

    /// <summary>
    /// The reference's guard on cancel and convert (2026-09-24): a line whose
    /// labo order is still with the labo answers 400
    /// "Dịch vụ có đơn labo chưa hoàn tất, không thể huỷ.".
    /// </summary>
    private async Task GuardNoOpenLaboOrderAsync(Guid serviceLineId)
    {
        var blocked = await _laboRepository.AnyAsync(o =>
            o.TreatmentServiceId == serviceLineId
            && o.Status != LaboStatus.Received
            && o.Status != LaboStatus.Completed
            && o.Status != LaboStatus.Rejected
            && o.Status != LaboStatus.Replaced);
        if (blocked)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.ServiceHasOpenLaboOrder,
                "The service line has a labo order that is not finished yet.");
        }
    }

    /// <summary>
    /// "Chuyển đổi dịch vụ" — closes the line and writes the one that takes its
    /// place, then moves the money already collected across.
    ///
    /// Measured on the reference 2026-09-22: the closed line keeps its own price
    /// and goes to status `replaced` (printed "BE:Status:Converted"), a fresh line is
    /// written for the new service, and the two point at each other through
    /// `replacedId`. What the reference does with công đoạn of the closed line
    /// could not be reproduced here — see docs/clone/unknowns.md.
    /// </summary>
    [Authorize(BlueDentalAbilityPermissions.TreatmentConsultation.Update)]
    public async Task<TreatmentPlanSlipDto> ConvertServiceAsync(
        Guid id, Guid serviceLineId, ConvertTreatmentServiceDto input)
    {
        if (string.IsNullOrWhiteSpace(input.Note))
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.InvalidPlanTransition,
                "A conversion must say why.");
        }

        var plan = await LoadAsync(id);
        var old = plan.GetService(serviceLineId);
        await GuardNoOpenLaboOrderAsync(serviceLineId);

        // The reference refuses the conversion outright on a line that is
        // finished or cancelled — its own `treatment.validation.convertNotAllowed`,
        // "Dịch vụ đã hoàn thành/huỷ không được phép chuyển đổi." (read off its
        // published bundle 2026-09-22). A line already replaced is closed the
        // same way. Checked here rather than left to the aggregate's GuardOpen
        // so the reason reaches the screen instead of a generic transition error.
        if (old.Status is TreatmentServiceStatus.Done
            or TreatmentServiceStatus.Cancelled
            or TreatmentServiceStatus.Replaced)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.ServiceConvertNotAllowed,
                $"A service line in status {old.Status} cannot be converted.");
        }

        // And a line with a finished công đoạn stays put even while its own status
        // is still open: that work was done and charged against *this* service,
        // so moving the line would strand it. Stages are their own aggregate, so
        // the question has to be asked here.
        if (await _stageRepository.AnyAsync(stage =>
                stage.TreatmentServiceId == serviceLineId
                && stage.Status == TreatmentStageStatus.Completed))
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.ServiceHasCompletedStage,
                "A service line with a completed công đoạn cannot be converted.");
        }

        var newServiceId = input.ConversionType == ServiceConversionType.Replace
            ? input.ServiceId ?? Guid.Empty
            : old.ServiceId;

        if (newServiceId == Guid.Empty)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Catalogs.CatalogEntryNotFound,
                "A replacement must name the service it converts to.");
        }

        var unitPrice = input.ConversionType == ServiceConversionType.Replace
            ? await CatalogPriceAsync(newServiceId)
            : old.Price;

        var teeth = PatientDiagnosisAppService.ToToothSelections(input.Teeth);
        var quantity = Math.Max(teeth.Count, 1);
        var gross = unitPrice * quantity;
        var charge = Math.Clamp(input.PaymentAmount ?? gross, 0m, gross);

        var line = plan.ConvertService(
            serviceLineId, GuidGenerator.Create(), newServiceId, unitPrice, quantity, charge, teeth);

        line.SetDetails(
            old.DiagnosisId,
            old.DentistId,
            input.Note,
            input.DiagnoserStaffId,
            input.SecondDiagnoserStaffId,
            input.ConsultantStaffId,
            input.SecondConsultantStaffId);

        await _planRepository.UpdateAsync(plan, autoSave: true);
        await MoveCollectedMoneyAsync(plan, old.Id, line.Id, charge, input.DifferenceHandling);

        return (await MapManyAsync([plan])).Single();
    }

    private async Task<decimal> CatalogPriceAsync(Guid serviceId)
    {
        var catalog = await _catalogRepository.FirstOrDefaultAsync(c => c.Id == serviceId)
            ?? throw new BusinessException(
                BlueDentalDomainErrorCodes.Catalogs.CatalogEntryNotFound,
                "That service is not in the catalog.");

        return catalog.Price ?? 0m;
    }

    /// <summary>
    /// Follows the money across a conversion: what was collected on the closed
    /// line moves to the new one, up to what the new one costs. Anything over
    /// is refunded or left as the patient's credit, which is the choice the
    /// dialog's "Xử lý chênh lệch" offers.
    /// </summary>
    private async Task MoveCollectedMoneyAsync(
        TreatmentPlan plan,
        Guid oldLineId,
        Guid newLineId,
        decimal charge,
        ConversionDifferenceHandling? handling)
    {
        // The receipt's own lines are what say which service was paid, and a bare
        // GetListAsync leaves them unloaded — the money would then move nowhere.
        var receiptQuery = await _paymentRepository.WithDetailsAsync(x => x.Lines);
        var receipts = receiptQuery
            .Where(p => p.TreatmentPlanId == plan.Id && p.Kind == PatientPaymentKind.Payment)
            .OrderBy(p => p.PaidAt)
            .ToList();

        var budget = charge;
        var touched = new List<PatientPayment>();

        foreach (var receipt in receipts)
        {
            if (budget <= 0m)
            {
                break;
            }

            var moved = receipt.Redirect(oldLineId, newLineId, budget, GuidGenerator.Create);
            if (moved <= 0m)
            {
                continue;
            }

            budget -= moved;
            touched.Add(receipt);
        }

        if (touched.Count > 0)
        {
            await _paymentRepository.UpdateManyAsync(touched, autoSave: true);
        }

        if (handling != ConversionDifferenceHandling.Refund)
        {
            return;
        }

        var leftOnOldLine = receipts.Sum(p => p.AmountFor(oldLineId));
        if (leftOnOldLine <= 0m)
        {
            return;
        }

        var refund = PatientPayment.Record(
            GuidGenerator.Create(),
            plan.PatientId,
            plan.BranchId,
            PatientPaymentKind.Refund,
            PaymentMethodKind.Cash,
            leftOnOldLine,
            await NextRefundCodeAsync(plan.BranchId),
            CurrentUser.Id ?? plan.DentistId,
            Clock.Now,
            plan.Id,
            "Hoàn trả chênh lệch chuyển đổi dịch vụ",
            splitMode: PaymentSplitMode.Manual,
            lines: [(oldLineId, leftOnOldLine)],
            lineIdFactory: GuidGenerator.Create);

        await _paymentRepository.InsertAsync(refund, autoSave: true);
    }

    /// <summary>Per-branch, per-year refund sequence — HT26-0002, as receipts use.</summary>
    private async Task<string> NextRefundCodeAsync(Guid clinicBranchId)
    {
        var year = Clock.Now.Year;
        var query = await _paymentRepository.GetQueryableAsync();
        var sequence = query.Count(x =>
            x.ClinicBranchId == clinicBranchId
            && x.Kind == PatientPaymentKind.Refund
            && x.CreationTime.Year == year) + 1;

        return string.Format("HT{0:D2}-{1:D4}", year % 100, sequence);
    }

    /// <summary>
    /// Drag-and-drop of a service line. Only the reading order moves, so this
    /// runs on a finished slip as well — and it deliberately leaves the slip's
    /// own status alone, unlike the calls that change a line's state.
    /// </summary>
    [Authorize(BlueDentalAbilityPermissions.TreatmentConsultation.Update)]
    public async Task<TreatmentPlanSlipDto> ReorderServiceAsync(
        Guid id, ReorderTreatmentServiceDto input)
    {
        var plan = await LoadAsync(id);
        plan.ReorderService(input.ServiceLineId, input.SortOrder);

        await _planRepository.UpdateAsync(plan, autoSave: true);
        return (await MapManyAsync([plan])).Single();
    }

    [Authorize(BlueDentalAbilityPermissions.TreatmentConsultation.Print)]
    public async Task<byte[]> ExportPdfAsync(Guid id)
    {
        var plan = await LoadAsync(id);
        var dto = (await MapManyAsync([plan])).Single();

        var rows = dto.Services
            .Select(line => new ClinicDocumentRow(
            [
                line.ServiceName ?? line.Code,
                line.Quantity.ToString(),
                $"{line.Price:N0}",
                $"{line.DiscountAmount:N0}",
                $"{line.EffectiveAmount:N0}"
            ]))
            .ToList();

        rows.Add(new ClinicDocumentRow(
            [L["BE:Field:GrandTotal"].Value, string.Empty, string.Empty, $"{dto.PlanDiscountAmount:N0}", $"{dto.TotalAmount:N0}"],
            IsTotal: true));

        var document = new ClinicDocument
        {
            ClinicName = "BlueDental",
            Title = L["BE:Perm:TreatmentRecords"].Value,
            Code = dto.Code,
            PrintedAt = Clock.Now,
            SignatureLabel = L["BE:Col:ReceivingDoctor"].Value,
            Fields =
            [
                new ClinicDocumentField(L["BE:Col:ReceivingDoctor"].Value, dto.DentistName ?? "—"),
                new ClinicDocumentField(L["BE:Field:CreatedDate"].Value, dto.CreationTime.ToString("dd/MM/yyyy")),
                new ClinicDocumentField(L["BE:Field:Progress"].Value, $"{dto.ProgressPercent}%"),
                new ClinicDocumentField(L["BE:Status:Paid"].Value, $"{dto.Payment.TotalPaid:N0} đ"),
                new ClinicDocumentField(L["BE:Field:Remaining"].Value, $"{dto.Payment.TotalDue:N0} đ")
            ],
            Headers = [L["BE:Common:Service"].Value, L["BE:Col:Quantity"].Value, L["BE:Field:UnitPrice"].Value, L["BE:Common:Discount"].Value, L["BE:Col:Total"].Value],
            Rows = rows
        };

        return document.ToBytes();
    }

    private async Task<TreatmentPlan> LoadAsync(Guid id)
    {
        var query = await _planRepository.WithDetailsAsync(x => x.Services);
        var plan = query.FirstOrDefault(x => x.Id == id)
            ?? throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.TreatmentPlanNotFound,
                "Treatment plan not found.");

        await _branchAccess.CheckAsync(plan.BranchId);
        return plan;
    }

    /// <summary>The accepted lines this slip should pull in.</summary>
    private async Task<List<PatientAdvise>> GetConvertibleAdvisesAsync(OpenTreatmentPlanDto input)
    {
        var query = await _adviseRepository.GetQueryableAsync();

        var candidates = query
            .Where(x => x.PatientId == input.PatientId)
            .Where(x => x.ClinicBranchId == input.ClinicBranchId)
            .Where(x => x.Status == PatientAdviseStatus.Accepted)
            .ToList();

        return input.AdviseIds.Count == 0
            ? candidates
            : candidates.Where(x => input.AdviseIds.Contains(x.Id)).ToList();
    }

    /// <summary>Slip numbers run per patient: DT01, DT02, ...</summary>
    private async Task<string> GenerateCodeAsync(Guid patientId)
    {
        var query = await _planRepository.GetQueryableAsync();
        var used = query.Count(x => x.PatientId == patientId) + 1;
        return $"DT{used:D2}";
    }

    private async Task<List<TreatmentPlanSlipDto>> MapManyAsync(IReadOnlyCollection<TreatmentPlan> plans)
    {
        if (plans.Count == 0)
        {
            return [];
        }

        var planIds = plans.Select(p => p.Id).ToList();
        var patientIds = plans.Select(p => p.PatientId).Distinct().ToList();

        // Lines carry the per-service share, so they travel with the receipt.
        var paymentQuery = await _paymentRepository.WithDetailsAsync(x => x.Lines);
        var payments = paymentQuery.Where(p => patientIds.Contains(p.PatientId)).ToList();

        var stageQuery = await _stageRepository.GetQueryableAsync();
        var stages = stageQuery
            .Where(s => s.TreatmentId.HasValue && planIds.Contains(s.TreatmentId.Value))
            .Select(s => new { s.Id, s.TreatmentServiceId, s.Status, s.Note, s.SequenceNumber })
            .ToList();

        // Chăm sóc sau điều trị hangs off the stages, not the service line: a care
        // record names the stages it follows up, so a line counts as cared for as
        // soon as one of its stages is on a record. The latest record wins when
        // more than one covers the same line.
        var careQuery = await _careRepository.GetQueryableAsync();
        var cares = careQuery
            .Where(c => patientIds.Contains(c.PatientId))
            .OrderByDescending(c => c.CreationTime)
            .Select(c => new { c.Status, StageIds = c.StageIds })
            .ToList();

        var careByStage = new Dictionary<Guid, CareStatus>();
        foreach (var care in cares)
        {
            foreach (var stageId in care.StageIds)
            {
                careByStage.TryAdd(stageId, care.Status);
            }
        }

        var stagesByService = stages
            .GroupBy(s => s.TreatmentServiceId)
            .ToDictionary(g => g.Key, g => g.Select(s => s.Id).ToList());

        // Đã thu of one line — its share of every receipt that named it. A
        // receipt covers several services, so the money is read off its lines,
        // not off the receipt total.
        var paidByService = payments
            .SelectMany(payment => payment.Lines.Select(line => new
            {
                line.TreatmentServiceId,
                Signed = payment.Kind == PatientPaymentKind.Refund ? -line.Amount : line.Amount
            }))
            .GroupBy(x => x.TreatmentServiceId)
            .ToDictionary(g => g.Key, g => g.Sum(x => x.Signed));

        var lines = plans.SelectMany(p => p.Services).ToList();
        var serviceIds = lines
            .Select(s => s.ServiceId)
            .Concat(lines.Select(s => s.DiagnosisId ?? Guid.Empty))
            .Where(x => x != Guid.Empty)
            .Distinct()
            .ToList();
        // **Both** navigations, or the one left out comes back null and its
        // column silently reads zero: this used to be a projection, which loaded
        // ServiceConfig implicitly, and including only Stages made every line
        // report warrantyDays 0 — no line offered Bảo hành any more (R-282).
        var catalogQuery = await _catalogRepository.WithDetailsAsync(
            c => c.Stages,
            c => c.ServiceConfig);
        var catalogRows = catalogQuery
            .Where(c => serviceIds.Contains(c.Id))
            .ToList();
        var serviceNames = catalogRows.ToDictionary(c => c.Id, c => c.Name);
        var warrantyDays = catalogRows.ToDictionary(
            c => c.Id,
            c => c.ServiceConfig?.WarrantyDays ?? 0);
        // The công đoạn form needs the step names, so the line carries the
        // service's own list rather than the form fetching the catalog again.
        var serviceSteps = catalogRows.ToDictionary(
            c => c.Id,
            c => c.Stages
                .OrderBy(step => step.SortOrder)
                .Select(step => new ServiceStepDto
                {
                    Id = step.Id,
                    Name = step.Name,
                    Value = step.Value,
                })
                .ToList());

        var staffIds = plans
            .SelectMany(p => new[] { p.DentistId, p.ConsultantStaffId ?? Guid.Empty })
            .Concat(lines.SelectMany(s => new[]
            {
                s.DentistId ?? Guid.Empty,
                s.DiagnoserStaffId ?? Guid.Empty,
                s.SecondDiagnoserStaffId ?? Guid.Empty,
                s.ConsultantStaffId ?? Guid.Empty,
                s.SecondConsultantStaffId ?? Guid.Empty
            }))
            .Where(x => x != Guid.Empty)
            .Distinct()
            .ToList();

        var users = staffIds.Count == 0 ? [] : await _userRepository.GetListByIdsAsync(staffIds);
        var staffNames = users.ToDictionary(u => u.Id, u => u.Name ?? u.UserName);

        var lineIds = lines.Select(l => l.Id).ToList();
        var laboOrders = lineIds.Count == 0
            ? []
            : await _laboRepository.GetListAsync(o =>
                o.TreatmentServiceId != null && lineIds.Contains(o.TreatmentServiceId.Value));
        var laboByService = laboOrders
            .Where(o => o.TreatmentServiceId.HasValue)
            .GroupBy(o => o.TreatmentServiceId!.Value)
            .ToDictionary(g => g.Key, g => g
                .OrderBy(o => o.CreationTime)
                .Select(o => new TreatmentServiceLaboOrderDto
                {
                    Id = o.Id,
                    OrderCode = o.OrderCode,
                    Status = o.Status,
                    Kind = o.Kind,
                    IsUnfinished = o.IsUnfinished
                })
                .ToList());

        return plans.Select(plan => new TreatmentPlanSlipDto
        {
            Id = plan.Id,
            PatientId = plan.PatientId,
            BranchId = plan.BranchId,
            DentistId = plan.DentistId,
            ConsultantStaffId = plan.ConsultantStaffId,
            Code = plan.Code,
            Title = plan.Title,
            Status = plan.Status,
            ProgressPercent = plan.ProgressPercent,
            DiscountType = plan.DiscountType,
            DiscountValue = plan.DiscountValue,
            VoucherDiscountAmount = plan.VoucherDiscountAmount,
            ServicesTotal = plan.ServicesTotal,
            PlanDiscountAmount = plan.PlanDiscountAmount,
            TotalAmount = plan.TotalAmount,
            Payment = MapPayment(_money.ForPlan(plan, payments)),
            Services = plan.Services
                // Lines never dragged all hold 0, so the slip keeps the
                // reference's default — newest first — until the clinic drags one.
                .OrderBy(s => s.SortOrder)
                .ThenByDescending(s => s.CreationTime)
                .Select(line => new TreatmentServiceDto
                {
                    Id = line.Id,
                    TreatmentPlanId = line.TreatmentPlanId,
                    ServiceId = line.ServiceId,
                    SourceAdviseId = line.SourceAdviseId,
                    Code = line.Code,
                    Price = line.Price,
                    Quantity = line.Quantity,
                    DiscountType = line.DiscountType,
                    DiscountValue = line.DiscountValue,
                    GrossAmount = line.GrossAmount,
                    DiscountAmount = line.DiscountAmount,
                    EffectiveAmount = line.EffectiveAmount,
                    Status = line.Status,
                    SortOrder = line.SortOrder,
                    ReplacedId = line.ReplacedId,
                    Teeth = PatientDiagnosisAppService.ToToothDtos(line.Teeth),
                    ServiceName = serviceNames.TryGetValue(line.ServiceId, out var name) ? name : null,
                    WarrantyDays = warrantyDays.TryGetValue(line.ServiceId, out var days) ? days : 0,
                    ServiceSteps = serviceSteps.TryGetValue(line.ServiceId, out var steps)
                        ? steps
                        : [],
                    StageCount = stages.Count(s => s.TreatmentServiceId == line.Id),
                    CompletedStageCount = stages.Count(s =>
                        s.TreatmentServiceId == line.Id && s.Status == TreatmentStageStatus.Completed),
                    StageNotes = stages
                        .Where(s => s.TreatmentServiceId == line.Id && !string.IsNullOrWhiteSpace(s.Note))
                        .OrderBy(s => s.SequenceNumber)
                        .Select(s => s.Note!)
                        .ToList(),
                    PaidAmount = PaidOn(paidByService, line.Id),
                    OutstandingAmount = Math.Max(0m, line.EffectiveAmount - PaidOn(paidByService, line.Id)),
                    AfterCareStatus = AfterCareOn(careByStage, stagesByService, line.Id),
                    LabOrders = laboByService.TryGetValue(line.Id, out var labo) ? labo : [],
                    DiagnosisId = line.DiagnosisId,
                    DiagnosisName = NameOf(serviceNames, line.DiagnosisId),
                    DentistId = line.DentistId,
                    DentistName = NameOf(staffNames, line.DentistId),
                    Note = line.Note,
                    DiagnoserStaffId = line.DiagnoserStaffId,
                    DiagnoserName = NameOf(staffNames, line.DiagnoserStaffId),
                    SecondDiagnoserStaffId = line.SecondDiagnoserStaffId,
                    SecondDiagnoserName = NameOf(staffNames, line.SecondDiagnoserStaffId),
                    ConsultantStaffId = line.ConsultantStaffId,
                    ConsultantName = NameOf(staffNames, line.ConsultantStaffId),
                    SecondConsultantStaffId = line.SecondConsultantStaffId,
                    SecondConsultantName = NameOf(staffNames, line.SecondConsultantStaffId)
                })
                .ToList(),
            DentistName = staffNames.TryGetValue(plan.DentistId, out var dentist) ? dentist : null,
            ConsultantName = plan.ConsultantStaffId.HasValue
                && staffNames.TryGetValue(plan.ConsultantStaffId.Value, out var consultant)
                    ? consultant
                    : null,
            CreationTime = plan.CreationTime,
            CreatorId = plan.CreatorId,
            LastModificationTime = plan.LastModificationTime,
            LastModifierId = plan.LastModifierId
        }).ToList();
    }

    private static string? NameOf(IReadOnlyDictionary<Guid, string> names, Guid? id) =>
        id.HasValue && names.TryGetValue(id.Value, out var name) ? name : null;

    private static decimal PaidOn(IReadOnlyDictionary<Guid, decimal> paidByService, Guid serviceLineId) =>
        paidByService.TryGetValue(serviceLineId, out var paid) ? paid : 0m;

    private static CareStatus? AfterCareOn(
        IReadOnlyDictionary<Guid, CareStatus> careByStage,
        IReadOnlyDictionary<Guid, List<Guid>> stagesByService,
        Guid serviceLineId)
    {
        if (!stagesByService.TryGetValue(serviceLineId, out var stageIds))
        {
            return null;
        }

        foreach (var stageId in stageIds)
        {
            if (careByStage.TryGetValue(stageId, out var status))
            {
                return status;
            }
        }

        return null;
    }

    internal static PaymentSummaryDto MapPayment(PaymentSummary summary) => new()
    {
        TotalPrice = summary.TotalPrice,
        TotalPaid = summary.TotalPaid,
        TotalDue = summary.TotalDue,
        Receivable = summary.Receivable,
        PaidUncompleted = summary.PaidUncompleted,
        CompletedValue = summary.CompletedValue,
        TotalRefund = summary.TotalRefund,
        Debt = summary.Debt,
        Discount = summary.Discount,
        OutstandingDebt = summary.OutstandingDebt,
        OutstandingDebtConsumed = summary.OutstandingDebtConsumed,
        Prepaid = summary.Prepaid,
        CarryOverAmount = summary.CarryOverAmount
    };
}
