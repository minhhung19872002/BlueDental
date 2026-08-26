using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Billing;
using BlueDental.Catalogs;
using BlueDental.Organizations;
using BlueDental.PatientManagement;
using BlueDental.Permissions;
using BlueDental.TreatmentManagement;
using BlueDental.Visits;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Identity;

namespace BlueDental.Operations.Reports;

/// <summary>
/// The Vận hành report sub-tabs.
///
/// Each one reads tables another feature owns and returns rows shaped for one
/// screen. Nothing here writes. Everything is filtered to the branches the
/// caller may see, through <see cref="BranchAccessChecker"/> like the rest of
/// the application, and windowed by <see cref="OperationsReportPeriod"/> — the
/// reference never offers an open range, only "this day/week/month/year".
///
/// The joins are done in memory after each table is read down to its window.
/// These are per-branch, per-period slices — hundreds of rows, not millions —
/// and the alternative is six hand-written multi-table queries whose EF
/// translations are far harder to keep honest than the projections below.
/// </summary>
[Authorize(BlueDentalPermissions.Catalogs.Default)]
public class OperationsReportAppService(
    IRepository<PatientDiagnosis, Guid> diagnosisRepository,
    IRepository<PatientAdvise, Guid> adviseRepository,
    IRepository<TreatmentPlan, Guid> planRepository,
    IRepository<TreatmentStage, Guid> stageRepository,
    IRepository<PatientPayment, Guid> paymentRepository,
    IRepository<Invoice, Guid> invoiceRepository,
    IRepository<Visit, Guid> visitRepository,
    IRepository<Patient, Guid> patientRepository,
    IRepository<CatalogEntry, Guid> catalogRepository,
    IRepository<Taxonomy, Guid> taxonomyRepository,
    IRepository<ClinicBranch, Guid> branchRepository,
    IIdentityUserRepository userRepository,
    BranchAccessChecker branchAccess) : ApplicationService, IOperationsReportAppService
{
    // ── Window ──────────────────────────────────────────────────────────────

    /// <summary>
    /// Squares the caller's anchor date to the period it asked for.
    ///
    /// A week starts on Monday, which is how the reference's own stepper moves.
    /// The end is exclusive so a row stamped midnight on the following day
    /// cannot fall into two windows.
    /// </summary>
    internal static (DateTime Start, DateTime End) WindowOf(
        OperationsReportPeriod period,
        DateTime anchor)
    {
        var day = anchor.Date;

        return period switch
        {
            OperationsReportPeriod.Day => (day, day.AddDays(1)),
            OperationsReportPeriod.Week => WeekOf(day),
            OperationsReportPeriod.Month => (
                new DateTime(day.Year, day.Month, 1),
                new DateTime(day.Year, day.Month, 1).AddMonths(1)),
            OperationsReportPeriod.Year => (
                new DateTime(day.Year, 1, 1),
                new DateTime(day.Year + 1, 1, 1)),
            _ => (day, day.AddDays(1))
        };
    }

    private static (DateTime Start, DateTime End) WeekOf(DateTime day)
    {
        var offset = ((int)day.DayOfWeek + 6) % 7;
        var monday = day.AddDays(-offset);
        return (monday, monday.AddDays(7));
    }

    /// <summary>The same window, one period earlier — what a change figure compares against.</summary>
    private static (DateTime Start, DateTime End) PreviousWindowOf(
        OperationsReportPeriod period,
        DateTime anchor)
        => period switch
        {
            OperationsReportPeriod.Day => WindowOf(period, anchor.Date.AddDays(-1)),
            OperationsReportPeriod.Week => WindowOf(period, anchor.Date.AddDays(-7)),
            OperationsReportPeriod.Month => WindowOf(period, anchor.Date.AddMonths(-1)),
            _ => WindowOf(period, anchor.Date.AddYears(-1))
        };

    private static bool Within(DateTime value, (DateTime Start, DateTime End) window)
        => value >= window.Start && value < window.End;

    /// <summary>
    /// Is this branch in scope?
    ///
    /// An empty list means the account is not pinned to any branch and may see
    /// them all — the convention <see cref="BranchAccessChecker"/> sets and the
    /// rest of the application follows. Matching on <c>Contains</c> alone would
    /// read it as "no branches" and answer every report with nothing.
    /// </summary>
    private static bool InScope(IReadOnlyList<Guid> branchIds, Guid branchId)
        => branchIds.Count == 0 || branchIds.Contains(branchId);

    // ── Lookups ─────────────────────────────────────────────────────────────

    private sealed record PatientRef(string Code, string Name, DateTime CreatedAt);

    private async Task<Dictionary<Guid, PatientRef>> PatientsAsync(IReadOnlyList<Guid> branchIds)
    {
        var patients = branchIds.Count == 0
            ? await patientRepository.GetListAsync()
            : await patientRepository.GetListAsync(p => branchIds.Contains(p.BranchId));

        return patients.ToDictionary(
            p => p.Id,
            p => new PatientRef(
                p.PatientCode,
                $"{p.LastName} {p.FirstName}".Trim(),
                p.RegisteredAt.DateTime));
    }

    /// <summary>Display names for every staff account, so a row can name who acted.</summary>
    private async Task<Dictionary<Guid, string>> StaffNamesAsync()
    {
        var users = await userRepository.GetListAsync();
        return users.ToDictionary(u => u.Id, u => u.Name ?? u.UserName);
    }

    private async Task<Dictionary<Guid, string>> CatalogNamesAsync()
    {
        var entries = await catalogRepository.GetListAsync();
        return entries.ToDictionary(e => e.Id, e => e.Name);
    }

    /// <summary>Which group each catalog entry belongs to — the "Nhóm dịch vụ" column.</summary>
    private async Task<Dictionary<Guid, (string Name, Guid GroupId, string GroupName)>> CatalogGroupsAsync()
    {
        var entries = await catalogRepository.GetListAsync();
        var taxonomies = (await taxonomyRepository.GetListAsync())
            .ToDictionary(t => t.Id, t => t.Name);

        return entries.ToDictionary(
            e => e.Id,
            e => (e.Name, e.TaxonomyId, taxonomies.GetValueOrDefault(e.TaxonomyId, string.Empty)));
    }

    private async Task<List<PatientDiagnosis>> DiagnosesAsync(IReadOnlyList<Guid> branchIds)
        => (await diagnosisRepository.GetListAsync())
            .Where(d => InScope(branchIds, d.ClinicBranchId))
            .ToList();

    private async Task<List<PatientAdvise>> AdvisesAsync(IReadOnlyList<Guid> branchIds)
        => (await adviseRepository.GetListAsync())
            .Where(a => InScope(branchIds, a.ClinicBranchId))
            .ToList();

    /// <summary>
    /// Every service line in these branches.
    ///
    /// A line has no table of its own to query — it hangs off its plan — so the
    /// plans are read with their lines attached and flattened here.
    /// </summary>
    private async Task<List<TreatmentService>> ServiceLinesOfAsync(IReadOnlyList<Guid> branchIds)
    {
        var query = await planRepository.WithDetailsAsync(p => p.Services);
        var plans = query.ToList().Where(p => InScope(branchIds, p.BranchId)).ToList();

        return plans.SelectMany(p => p.Services).ToList();
    }

    private static string Join(IEnumerable<TreatmentManagement.Values.ToothSelection> teeth)
        => string.Join(", ", teeth.Select(t => t.ToothCode.ToString()).Distinct());

    private static PagedResultDto<T> Page<T>(List<T> rows, OperationsReportInput input)
    {
        var skip = Math.Max(0, input.SkipCount);
        var take = input.MaxResultCount <= 0 ? 20 : input.MaxResultCount;

        return new PagedResultDto<T>(rows.Count, rows.Skip(skip).Take(take).ToList());
    }

    private static bool Matches(string? haystack, string[] terms)
        => terms.Length == 0
           || terms.All(term => (haystack ?? string.Empty).ToLowerInvariant().Contains(term));

    private static string[] TermsOf(string? filter) => SearchTerms.From(filter).ToArray();

    // ── Báo cáo (work log) ──────────────────────────────────────────────────

    public async Task<WorkLogResultDto> GetWorkLogAsync(WorkLogInput input)
    {
        var branchIds = await branchAccess.ResolveFilterAsync(input.ClinicBranchId);
        var window = WindowOf(input.Period, input.Anchor);

        var patients = await PatientsAsync(branchIds);
        var staff = await StaffNamesAsync();
        var catalog = await CatalogNamesAsync();

        // The three steps under a patient's name come from their visit that day.
        var visits = (await visitRepository.GetListAsync())
            .Where(v => InScope(branchIds, v.BranchId))
            .GroupBy(v => (v.PatientId, v.ScheduledAt.Date))
            .ToDictionary(g => g.Key, g => g.OrderBy(v => v.ScheduledAt).First());

        var rows = new List<WorkLogRowDto>();

        WorkLogRowDto Row(
            DateTime at, Guid patientId, Guid? staffId, WorkLogAction action,
            string subject, string? note, decimal amount, string? subjectDetail = null)
        {
            var patient = patients.GetValueOrDefault(patientId);
            var day = at.Date;
            var visit = visits.GetValueOrDefault((patientId, day));

            return new WorkLogRowDto
            {
                VisitKey = $"{patientId:N}-{day:yyyyMMdd}",
                OccurredAt = at,
                VisitDate = day,
                PatientCode = patient?.Code ?? string.Empty,
                PatientName = patient?.Name ?? string.Empty,
                ArrivedAt = visit?.CheckedInAt?.DateTime,
                // The visit records no separate "in progress" stamp, so the step
                // is only known to have been reached, never when.
                StartedAt = visit is not null && visit.Status >= VisitStatus.InProgress
                    && visit.Status != VisitStatus.Cancelled
                    ? visit.CheckedInAt?.DateTime
                    : null,
                CompletedAt = visit?.CompletedAt?.DateTime,
                StaffName = staffId is null ? string.Empty : staff.GetValueOrDefault(staffId.Value, string.Empty),
                Action = action,
                Subject = subject,
                SubjectDetail = subjectDetail,
                Note = note,
                Amount = amount
            };
        }

        var diagnoses = await DiagnosesAsync(branchIds);
        rows.AddRange(diagnoses
            .Where(d => Within(d.CreationTime, window)
                        && (input.StaffId is null || d.StaffId == input.StaffId))
            .Select(d => Row(
                d.CreationTime, d.PatientId, d.StaffId, WorkLogAction.Diagnosis,
                DiagnosisSubject(d, catalog), d.Note, 0m)));

        var advises = await AdvisesAsync(branchIds);
        rows.AddRange(advises
            .Where(a => Within(a.CreationTime, window)
                        && (input.StaffId is null || a.StaffId == input.StaffId))
            .Select(a => Row(
                a.CreationTime, a.PatientId, a.StaffId, WorkLogAction.Consultation,
                catalog.GetValueOrDefault(a.ServiceId, string.Empty), a.Note, a.Price * a.Quantity)));

        var services = await ServiceLinesOfAsync(branchIds);
        rows.AddRange(services
            .Where(s => Within(s.CreationTime, window))
            .Select(s => Row(
                s.CreationTime, s.PatientId, null,
                s.Status == TreatmentServiceStatus.Cancelled
                    ? WorkLogAction.ServiceCancelled
                    : s.Status == TreatmentServiceStatus.Replaced
                        ? WorkLogAction.ServiceConverted
                        : WorkLogAction.Treatment,
                catalog.GetValueOrDefault(s.ServiceId, string.Empty), null, s.CountedAmount)));

        var serviceById = services.ToDictionary(s => s.Id);
        var stages = await stageRepository.GetListAsync();
        rows.AddRange(stages
            .Where(st => serviceById.ContainsKey(st.TreatmentServiceId)
                         && Within(st.CreationTime, window)
                         && (input.StaffId is null || st.StaffId == input.StaffId))
            .Select(st => Row(
                st.CreationTime, serviceById[st.TreatmentServiceId].PatientId, st.StaffId,
                WorkLogAction.Stage, st.Name, st.Note, 0m)));

        var payments = await paymentRepository.GetListAsync();
        var patientIds = patients.Keys.ToHashSet();
        rows.AddRange(payments
            .Where(p => patientIds.Contains(p.PatientId) && Within(p.PaidAt.DateTime, window)
                        && (input.StaffId is null || p.StaffId == input.StaffId))
            .Select(p => Row(
                p.PaidAt.DateTime, p.PatientId, p.StaffId,
                p.Amount < 0 ? WorkLogAction.Refund : WorkLogAction.Payment,
                p.Method.ToString(), p.Note, p.Amount,
                p.PaidAt.DateTime.ToString("HH:mm dd/MM"))));

        // Visits are the Tiếp nhận line of the log.
        rows.AddRange(visits.Values
            .Where(v => Within(v.ScheduledAt.DateTime, window))
            .Select(v => Row(
                v.ScheduledAt.DateTime, v.PatientId, v.DentistId, WorkLogAction.Reception,
                v.ChiefComplaint ?? string.Empty, v.Notes, 0m,
                v.ScheduledAt.DateTime.ToString("HH:mm dd/MM"))));

        if (input.Actions.Count > 0)
        {
            rows = rows.Where(r => input.Actions.Contains(r.Action)).ToList();
        }

        var terms = TermsOf(input.Filter);
        if (terms.Length > 0)
        {
            rows = rows
                .Where(r => Matches($"{r.PatientName} {r.PatientCode}", terms))
                .ToList();
        }

        // Grouped in the order the screen draws them: newest visit first, and
        // inside a visit the actions stay together.
        rows = rows
            .OrderByDescending(r => r.VisitDate)
            .ThenBy(r => r.VisitKey)
            .ThenBy(r => r.Action)
            .ThenBy(r => r.OccurredAt)
            .ToList();

        var page = Page(rows, input);
        return new WorkLogResultDto
        {
            TotalCount = page.TotalCount,
            Items = page.Items,
            // What the consulting lines agreed in this window are worth.
            PlannedSales = rows
                .Where(r => r.Action == WorkLogAction.Consultation)
                .Sum(r => r.Amount)
        };
    }

    /// <summary>A diagnosis reads "tooth - name" where it names a tooth.</summary>
    private static string DiagnosisSubject(
        PatientDiagnosis diagnosis,
        IReadOnlyDictionary<Guid, string> catalog)
    {
        var name = catalog.GetValueOrDefault(diagnosis.DiagnosisId, string.Empty);
        var teeth = Join(diagnosis.Teeth);

        return string.IsNullOrEmpty(teeth) ? name : $"{teeth} - {name}";
    }

    // ── Chẩn đoán chưa điều trị ─────────────────────────────────────────────

    public async Task<PagedResultDto<UntreatedDiagnosisRowDto>> GetUntreatedDiagnosesAsync(
        StaffScopedReportInput input)
    {
        var branchIds = await branchAccess.ResolveFilterAsync(input.ClinicBranchId);
        var window = WindowOf(input.Period, input.Anchor);

        var patients = await PatientsAsync(branchIds);
        var staff = await StaffNamesAsync();
        var catalog = await CatalogNamesAsync();

        var diagnoses = (await DiagnosesAsync(branchIds))
            .Where(d => !d.HasTreatmentService)
            .Where(d => input.StaffId is null || d.StaffId == input.StaffId)
            .ToList();

        var rows = diagnoses
            .Where(d => Within(d.CreationTime, window))
            .Select(d =>
            {
                var patient = patients.GetValueOrDefault(d.PatientId);
                return new UntreatedDiagnosisRowDto
                {
                    DiagnosedAt = d.CreationTime,
                    PatientCode = patient?.Code ?? string.Empty,
                    PatientName = patient?.Name ?? string.Empty,
                    StaffName = staff.GetValueOrDefault(d.StaffId, string.Empty),
                    Teeth = Join(d.Teeth),
                    DiagnosisName = catalog.GetValueOrDefault(d.DiagnosisId, string.Empty),
                    Note = d.Note
                };
            })
            .OrderByDescending(r => r.DiagnosedAt)
            .ToList();

        var terms = TermsOf(input.Filter);
        if (terms.Length > 0)
        {
            rows = rows
                .Where(r => Matches($"{r.PatientName} {r.PatientCode} {r.StaffName} {r.DiagnosisName}", terms))
                .ToList();
        }

        return Page(rows, input);
    }

    // ── Khách hàng phát sinh ────────────────────────────────────────────────

    public async Task<PagedResultDto<ConsultantSummaryRowDto>> GetConsultantSummaryAsync(
        StaffScopedReportInput input)
    {
        var branchIds = await branchAccess.ResolveFilterAsync(input.ClinicBranchId);
        var window = WindowOf(input.Period, input.Anchor);
        var staff = await StaffNamesAsync();

        var advises = await AdvisesAsync(branchIds);

        // "New" means the clinic had not consulted this patient before the
        // window opened — not that the consulting line itself is the first.
        var seenBefore = advises
            .Where(a => a.CreationTime < window.Start)
            .Select(a => a.PatientId)
            .ToHashSet();

        var inWindow = advises
            .Where(a => Within(a.CreationTime, window))
            .Where(a => input.StaffId is null || a.StaffId == input.StaffId)
            .ToList();

        var rows = inWindow
            .GroupBy(a => a.StaffId)
            .Select(group =>
            {
                var newOnes = group.Where(a => !seenBefore.Contains(a.PatientId)).ToList();
                var returning = group.Where(a => seenBefore.Contains(a.PatientId)).ToList();

                decimal Worth(IEnumerable<PatientAdvise> lines)
                    => lines.Sum(a => a.Price * a.Quantity);

                return new ConsultantSummaryRowDto
                {
                    StaffId = group.Key,
                    StaffName = staff.GetValueOrDefault(group.Key, string.Empty),
                    NewPatientConsultations = newOnes.Count,
                    ReturningPatientConsultations = returning.Count,
                    NewPatientRevenue = Worth(newOnes),
                    ReturningPatientRevenue = Worth(returning),
                    TotalConsultations = group.Count(),
                    TotalRevenue = Worth(group)
                };
            })
            .OrderByDescending(r => r.TotalRevenue)
            .ToList();

        var terms = TermsOf(input.Filter);
        if (terms.Length > 0)
        {
            rows = rows.Where(r => Matches(r.StaffName, terms)).ToList();
        }

        return Page(rows, input);
    }

    // ── Hóa đơn ─────────────────────────────────────────────────────────────

    public async Task<PagedResultDto<InvoiceReportRowDto>> GetInvoicesAsync(
        InvoiceReportInput input)
    {
        var branchIds = await branchAccess.ResolveFilterAsync(input.ClinicBranchId);
        var window = WindowOf(input.Period, input.Anchor);

        var patients = await PatientsAsync(branchIds);
        var branches = (await branchRepository.GetListAsync())
            .ToDictionary(b => b.Id, b => b.Name);

        var invoices = (await invoiceRepository.GetListAsync())
            .Where(i => InScope(branchIds, i.BranchId))
            .ToList();

        var rows = invoices
            .Where(i => Within(i.CreationTime, window))
            .Select(i => new InvoiceReportRowDto
            {
                CreatedAt = i.CreationTime,
                InvoiceNumber = i.InvoiceNumber,
                PatientName = patients.GetValueOrDefault(i.PatientId)?.Name ?? string.Empty,
                UnitName = branches.GetValueOrDefault(i.BranchId, string.Empty),
                // The reference shows how the invoice was settled; an unpaid one
                // has not been settled any way yet.
                PaymentMethod = i.PaidAmount.Amount > 0 ? "Tiền mặt" : string.Empty,
                IssueStatus = i.Status == InvoiceStatus.Draft ? "Chưa xuất hoá đơn" : "Đã xuất hoá đơn",
                Status = i.Status.ToString(),
                SubTotal = i.SubTotal.Amount,
                TaxAmount = i.TaxAmount.Amount,
                TotalAmount = i.TotalAmount.Amount,
                Supplier = null
            })
            .OrderByDescending(r => r.CreatedAt)
            .ToList();

        if (!string.IsNullOrWhiteSpace(input.Status))
        {
            rows = rows.Where(r => r.Status == input.Status).ToList();
        }

        var terms = TermsOf(input.Filter);
        if (terms.Length > 0)
        {
            rows = rows.Where(r => Matches($"{r.InvoiceNumber} {r.PatientName}", terms)).ToList();
        }

        return Page(rows, input);
    }

    // ── The two money screens ───────────────────────────────────────────────

    /// <summary>
    /// Every service line in the window, shaped for both money screens.
    ///
    /// Hoàn thành theo dịch vụ and Truy cập differ only in which columns they
    /// show and which figures they total, so they are read from one projection.
    /// </summary>
    private sealed record ServiceLine(ServiceLineRowDto Row, Guid? DentistId, Guid ServiceGroupId);

    private async Task<List<ServiceLineRowDto>> ServiceLinesAsync(
        IReadOnlyList<Guid> branchIds,
        (DateTime Start, DateTime End) window)
        => (await ServiceLinesWithKeysAsync(branchIds, window)).Select(l => l.Row).ToList();

    private async Task<List<ServiceLine>> ServiceLinesWithKeysAsync(
        IReadOnlyList<Guid> branchIds,
        (DateTime Start, DateTime End) window)
    {
        var patients = await PatientsAsync(branchIds);
        var staff = await StaffNamesAsync();
        var catalog = await CatalogGroupsAsync();
        var branches = (await branchRepository.GetListAsync()).ToDictionary(b => b.Id, b => b.Name);

        var services = await ServiceLinesOfAsync(branchIds);
        var advises = (await AdvisesAsync(branchIds)).ToDictionary(a => a.Id);
        var stages = await stageRepository.GetListAsync();
        var stagesByService = stages
            .GroupBy(s => s.TreatmentServiceId)
            .ToDictionary(g => g.Key, g => g.ToList());

        return services
            .Where(s => Within(s.CreationTime, window))
            .Select(s =>
            {
                var patient = patients.GetValueOrDefault(s.PatientId);
                var entry = catalog.GetValueOrDefault(s.ServiceId);
                var advise = s.SourceAdviseId is null ? null : advises.GetValueOrDefault(s.SourceAdviseId.Value);
                var serviceStages = stagesByService.GetValueOrDefault(s.Id) ?? [];
                var dentist = serviceStages.FirstOrDefault()?.StaffId;

                var row = new ServiceLineRowDto
                {
                    Id = s.Id,
                    OccurredAt = s.CreationTime,
                    PatientCode = patient?.Code ?? string.Empty,
                    PatientName = patient?.Name ?? string.Empty,
                    PatientCreatedAt = patient?.CreatedAt ?? s.CreationTime,
                    BranchName = branches.GetValueOrDefault(s.ClinicBranchId, string.Empty),
                    ServiceName = entry.Name ?? string.Empty,
                    ServiceGroupName = entry.GroupName ?? string.Empty,
                    Classification = s.IsCompleted ? SalesCategory.Completed : SalesCategory.OwnQuota,
                    SyncStatus = "Chưa đồng bộ",
                    InvoiceStatus = "Chưa xuất hoá đơn",
                    DiagnosingDentistName = advise is null
                        ? null
                        : staff.GetValueOrDefault(advise.StaffId, string.Empty),
                    SecondConsultantName = advise?.SecondStaffId is null
                        ? null
                        : staff.GetValueOrDefault(advise.SecondStaffId.Value, string.Empty),
                    ConsultantName = advise is null
                        ? null
                        : staff.GetValueOrDefault(advise.StaffId, string.Empty),
                    TreatingDentistName = dentist is null
                        ? null
                        : staff.GetValueOrDefault(dentist.Value, string.Empty),
                    Teeth = Join(s.Teeth),
                    ServiceNote = advise?.Note,
                    StageName = serviceStages.Count == 0 ? null : serviceStages[0].Name,
                    Price = s.Price,
                    Quantity = s.Quantity,
                    DiscountAmount = s.DiscountAmount,
                    DoctorAmount = s.CountedAmount,
                    TaxKind = "Sau thuế",
                    TaxPercent = null
                };

                return new ServiceLine(row, dentist, entry.GroupId);
            })
            .OrderByDescending(l => l.Row.OccurredAt)
            .ToList();
    }

    public async Task<ServiceCompletionResultDto> GetServiceCompletionAsync(
        ServiceCompletionInput input)
    {
        var branchIds = await branchAccess.ResolveFilterAsync(input.ClinicBranchId);
        var window = WindowOf(input.Period, input.Anchor);

        var lines = await ServiceLinesWithKeysAsync(branchIds, window);

        if (input.DentistId is not null)
        {
            lines = lines.Where(l => l.DentistId == input.DentistId).ToList();
        }

        if (input.ServiceGroupId is not null)
        {
            lines = lines.Where(l => l.ServiceGroupId == input.ServiceGroupId).ToList();
        }

        var rows = lines.Select(l => l.Row).ToList();

        var terms = TermsOf(input.Filter);
        if (terms.Length > 0)
        {
            rows = rows.Where(r => Matches($"{r.PatientName} {r.PatientCode} {r.ServiceName}", terms)).ToList();
        }

        var completed = rows.Where(r => r.Classification == SalesCategory.Completed).ToList();
        var ownQuota = rows.Where(r => r.Classification == SalesCategory.OwnQuota).ToList();
        var total = rows.Sum(r => r.DoctorAmount);

        // What the same window was worth one period back, so the card can say
        // which way the clinic is moving.
        var previous = await ServiceLinesAsync(branchIds, PreviousWindowOf(input.Period, input.Anchor));
        var previousTotal = previous.Sum(r => r.DoctorAmount);

        var stats = new ServiceCompletionStatsDto
        {
            ActualCollected = completed.Sum(r => r.DoctorAmount),
            TotalRevenue = total,
            RevenueChangePercent = previousTotal == 0m
                ? null
                : Math.Round((total - previousTotal) / previousTotal * 100m, 1),
            AdvanceRevenue = 0m,
            CompletedServices = completed.Sum(r => r.DoctorAmount),
            OnScheduePercent = rows.Count == 0
                ? 0m
                : Math.Round((decimal)completed.Count / rows.Count * 100m, 0),
            OwnQuotaServices = ownQuota.Sum(r => r.DoctorAmount)
        };

        var page = Page(rows, input);
        return new ServiceCompletionResultDto
        {
            TotalCount = page.TotalCount,
            Items = page.Items,
            Stats = stats
        };
    }

    public async Task<SalesAccessResultDto> GetSalesAccessAsync(SalesAccessInput input)
    {
        var branchIds = await branchAccess.ResolveFilterAsync(input.ClinicBranchId);
        var window = WindowOf(input.Period, input.Anchor);

        var all = await ServiceLinesAsync(branchIds, window);

        var stats = new SalesAccessStatsDto
        {
            TotalSales = all.Sum(r => r.DoctorAmount),
            CompletedServices = all.Where(r => r.Classification == SalesCategory.Completed)
                .Sum(r => r.DoctorAmount),
            OwnQuotaServices = all.Where(r => r.Classification == SalesCategory.OwnQuota)
                .Sum(r => r.DoctorAmount)
        };

        // The cards double as the filter: picking one narrows the list to it.
        var rows = input.Category == SalesCategory.Total
            ? all
            : all.Where(r => r.Classification == input.Category).ToList();

        var terms = TermsOf(input.Filter);
        if (terms.Length > 0)
        {
            rows = rows.Where(r => Matches($"{r.PatientName} {r.PatientCode} {r.ServiceName}", terms)).ToList();
        }

        var page = Page(rows, input);
        return new SalesAccessResultDto
        {
            TotalCount = page.TotalCount,
            Items = page.Items,
            Stats = stats
        };
    }
}
