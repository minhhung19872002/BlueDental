using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Appointments;
using BlueDental.Appointments.Values;
using BlueDental.Billing;
using BlueDental.Catalogs;
using BlueDental.Catalogs.Import;
using BlueDental.Data;
using BlueDental.Organizations;
using BlueDental.PatientManagement;
using BlueDental.PatientManagement.Values;
using BlueDental.Permissions;
using BlueDental.TreatmentManagement;
using BlueDental.TreatmentManagement.Values;
using ClosedXML.Excel;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp;
using Volo.Abp.Data;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Identity;
using Volo.Abp.Users;
using static BlueDental.DataMigration.DataMigrationLayout;

namespace BlueDental.DataMigration;

/// <summary>
/// Moves a clinic's old system into BlueDental — BA request 2026-10-08, run
/// once per clinic from Swagger or curl.
///
/// Like the Danh mục import, the whole file is read and every entity built in
/// memory first; only a file with no error at all is written, in one unit of
/// work. A patient code the branch already holds is skipped together with its
/// treatment rows, so a second run of the same file adds nothing.
///
/// What it writes, and what it does not:
/// <list type="bullet">
/// <item>Patients with every field of the hồ sơ dialog, a guardian when given,
/// and the old system's registration date.</item>
/// <item>One treatment slip per (patient, Kế hoạch) — else per (patient, Mã
/// phiếu), else per (patient, day) — with one công đoạn per row, dated on the
/// day it was done. A row with a unit price opens a priced service line; a
/// row without one is a visit on the slip's latest line of that service, or
/// opens a line priced 0. A file that leaves the money columns blank comes
/// out as before them: every line priced 0, no công nợ.</item>
/// <item>The optional Thanh toán sheet: completed payment receipts on the old
/// dates, spread over the lines of the slip they name. They are flagged as
/// imported, so the e-invoice request leaves them out.</item>
/// <item>The optional Lịch hẹn sheet: the old calendar, past bookings in the
/// state they ended in and future ones still to come. Flagged as imported, so
/// no change log is backfilled and no CSKH task is raised for them; no shift
/// or double-booking check, the old calendar is what it was.</item>
/// <item>No duplicate-phone, duplicate-CCCD or under-16 guardian checks: the old
/// data is what it is (BA 2026-10-08).</item>
/// </list>
/// </summary>
[Authorize(BlueDentalPermissions.SystemAdministration.DataMigration)]
public class DataMigrationAppService : BlueDentalAppService, IDataMigrationAppService
{
    private static readonly XLColor HeaderFill = XLColor.FromHtml("#EBF3FE");
    private static readonly XLColor ErrorFill = XLColor.FromHtml("#FDE2E2");
    private const int HeaderRow = 1;

    /// <summary>Imported công đoạn are stamped 09:00 clinic time, a minute apart in file order.</summary>
    private static readonly TimeSpan VisitStart = TimeSpan.FromHours(9);

    /// <summary>A Ngày tạo hồ sơ is stamped 08:00 clinic time, before that day's visits.</summary>
    private static readonly TimeSpan RecordOpened = TimeSpan.FromHours(8);

    /// <summary>An imported payment is stamped 17:00 clinic time, after that day's visits.</summary>
    private static readonly TimeSpan PaymentTaken = TimeSpan.FromHours(17);

    /// <summary>PatientPayment.Note's column length.</summary>
    private const int PaymentNoteMax = 1000;

    /// <summary>Columns written as numbers in the template; every other column is text.</summary>
    private static readonly HashSet<string> NumberColumns =
        [Col.Quantity, Col.OriginalPrice, Col.Price, Col.Amount, Col.PaidAmount];

    private static readonly string[] CatalogGroups =
        [TaxonomyGroups.CareService, TaxonomyGroups.Source, TaxonomyGroups.Occupation, TaxonomyGroups.DiseaseHistory];

    private readonly IRepository<Patient, Guid> _patientRepository;
    private readonly IMigratedHistoryWriter _historyWriter;
    private readonly IRepository<CatalogEntry, Guid> _catalogRepository;
    private readonly IRepository<Taxonomy, Guid> _taxonomyRepository;
    private readonly IRepository<PatientTag, Guid> _tagRepository;
    private readonly IRepository<StaffBranchAssignment, Guid> _assignmentRepository;
    private readonly IRepository<PaymentAccount, Guid> _accountRepository;
    private readonly IRepository<PatientPayment, Guid> _paymentRepository;
    private readonly IIdentityUserRepository _userRepository;
    private readonly BranchAccessChecker _branchAccess;
    private readonly ICurrentClinicBranchResolver _branchResolver;
    private readonly IDataFilter<ISoftDelete> _softDeleteFilter;

    public DataMigrationAppService(
        IRepository<Patient, Guid> patientRepository,
        IMigratedHistoryWriter historyWriter,
        IRepository<CatalogEntry, Guid> catalogRepository,
        IRepository<Taxonomy, Guid> taxonomyRepository,
        IRepository<PatientTag, Guid> tagRepository,
        IRepository<StaffBranchAssignment, Guid> assignmentRepository,
        IRepository<PaymentAccount, Guid> accountRepository,
        IRepository<PatientPayment, Guid> paymentRepository,
        IIdentityUserRepository userRepository,
        BranchAccessChecker branchAccess,
        ICurrentClinicBranchResolver branchResolver,
        IDataFilter<ISoftDelete> softDeleteFilter)
    {
        _patientRepository = patientRepository;
        _historyWriter = historyWriter;
        _catalogRepository = catalogRepository;
        _taxonomyRepository = taxonomyRepository;
        _tagRepository = tagRepository;
        _assignmentRepository = assignmentRepository;
        _accountRepository = accountRepository;
        _paymentRepository = paymentRepository;
        _userRepository = userRepository;
        _branchAccess = branchAccess;
        _branchResolver = branchResolver;
        _softDeleteFilter = softDeleteFilter;
    }

    public async Task<byte[]> GetTemplateAsync(Guid? clinicBranchId)
    {
        // Only the branch check: the file carries no branch data (R-846, R-850).
        await ResolveBranchAsync(clinicBranchId);

        using var workbook = new XLWorkbook();
        var patients = WriteTemplateSheet(workbook, Patients);
        var treatments = WriteTemplateSheet(workbook, Treatments);
        var payments = WriteTemplateSheet(workbook, Payments);
        var appointments = WriteTemplateSheet(workbook, Bookings);
        WriteGuideSheet(workbook);
        DataMigrationPickLists.Apply(patients, treatments, payments, appointments, new PickListMessages(
            L["DataMigration:PickList:Title"].Value,
            L["DataMigration:PickList:NotInList"].Value));
        return Save(workbook);
    }

    public async Task<DataMigrationResultDto> ImportAsync(ImportDataMigrationDto input)
    {
        using var plan = await PlanAsync(input);
        plan.Result.DryRun = input.DryRun;

        if (input.DryRun || plan.Result.ErrorCount > 0)
        {
            return plan.Result;
        }

        await _historyWriter.WriteAsync(plan.Patients, plan.Plans, plan.Stages, plan.Payments, plan.Appointments);

        plan.Result.Committed = true;
        return plan.Result;
    }

    public async Task<byte[]> GetErrorFileAsync(ImportDataMigrationDto input)
    {
        using var plan = await PlanAsync(input);
        var result = plan.Result;
        var errorHeader = L["Taxonomy:Import:ErrorColumn"].Value;

        // A fresh workbook, as in the Danh mục import: the uploaded one keeps its
        // old <dimension> and readers that trust it would miss the new column.
        using var output = new XLWorkbook();
        for (var i = 0; i < result.Sheets.Count; i++)
        {
            var source = plan.SheetSources[i];
            var sheet = source.CopyTo(output, source.Name);
            var column = (sheet.Row(HeaderRow).LastCellUsed()?.Address.ColumnNumber ?? 0) + 1;

            var header = sheet.Cell(HeaderRow, column);
            header.Value = errorHeader;
            header.Style.Font.Bold = true;
            header.Style.Fill.BackgroundColor = ErrorFill;
            sheet.Column(column).Width = 60;

            foreach (var row in result.Sheets[i].Rows.Where(r => r.Errors.Count > 0))
            {
                var cell = sheet.Cell(row.Row, column);
                cell.Value = string.Join("; ", row.Errors);
                cell.Style.Fill.BackgroundColor = ErrorFill;
            }
        }

        if (result.FileErrors.Count > 0)
        {
            var sheet = output.Worksheets.Add(SafeSheetName(L["Taxonomy:Import:FileErrorSheet"].Value));
            sheet.Column(1).Width = 80;
            for (var i = 0; i < result.FileErrors.Count; i++)
            {
                sheet.Cell(i + 1, 1).Value = result.FileErrors[i];
            }
        }

        return Save(output);
    }

    // ---------------------------------------------------------------- planning

    /// <summary>Everything the pass over the file built, kept until the workbook is no longer needed.</summary>
    private sealed class MigrationPlan : IDisposable
    {
        public required Guid BranchId { get; init; }
        public required XLWorkbook Workbook { get; init; }

        /// <summary>The worksheet behind each entry of <see cref="DataMigrationResultDto.Sheets"/>.</summary>
        public List<IXLWorksheet> SheetSources { get; } = [];
        public DataMigrationResultDto Result { get; } = new();
        public List<Patient> Patients { get; } = [];
        public Dictionary<Patient, PatientDraft> Drafts { get; } = [];
        public Dictionary<Patient, DateTimeOffset> FirstVisits { get; } = [];
        public List<TreatmentPlan> Plans { get; } = [];
        public List<TreatmentStage> Stages { get; } = [];
        public List<PatientPayment> Payments { get; } = [];
        public List<Appointment> Appointments { get; } = [];

        /// <summary>Each new patient's service lines, in the order they were built, for the payments to land on.</summary>
        public Dictionary<Patient, List<LineRef>> Lines { get; } = [];

        /// <summary>Patients with a refused Điều trị row: their payments are not spread over a history that is not all there.</summary>
        public HashSet<Patient> BrokenHistories { get; } = [];

        public void Dispose() => Workbook.Dispose();
    }

    /// <summary>A built service line and what the Thanh toán sheet can name it by.</summary>
    private sealed class LineRef
    {
        public required TreatmentPlan Plan { get; init; }
        public required TreatmentService Line { get; init; }
        public required int Order { get; init; }

        /// <summary>The Mã phiếu (key) of the row that opened the line.</summary>
        public required string? FirstSlip { get; init; }

        /// <summary>Every Mã phiếu (key) with a row on the line.</summary>
        public required HashSet<string> Slips { get; init; }

        /// <summary>The Kế hoạch (key) the slip was grouped by, if any.</summary>
        public required string? PlanKey { get; init; }

        /// <summary>What the payments planned so far put on the line.</summary>
        public decimal Allocated { get; set; }

        public decimal Open => Plan.PayableAmountOf(Line) - Allocated;
    }

    /// <summary>A patient code already in the database, under any branch, deleted or not.</summary>
    private sealed record StoredCode(Guid BranchId, bool IsDeleted);

    /// <summary>A Điều trị row that read cleanly, with where it sits in the result.</summary>
    private sealed record TreatmentRow(int RowNumber, TreatmentDraft Draft, DataMigrationRowDto Status);

    /// <summary>A Thanh toán row that read cleanly.</summary>
    private sealed record PaymentRow(int RowNumber, PaymentDraft Draft, DataMigrationRowDto Status);

    /// <summary>A sheet found in the file, its entry in the result, and its column key → Excel column number.</summary>
    private sealed record MappedSheet(
        IXLWorksheet Sheet, DataMigrationSheetDto Result, Dictionary<string, int> Columns, List<IXLRow> Rows);

    private async Task<MigrationPlan> PlanAsync(ImportDataMigrationDto input)
    {
        var branchId = await ResolveBranchAsync(input.ClinicBranchId);
        var plan = new MigrationPlan { BranchId = branchId, Workbook = LoadWorkbook(input) };
        var result = plan.Result;

        try
        {
            var patientSheet = MapSheet(plan, 1, Patients);
            var treatmentSheet = MapSheet(plan, 2, Treatments);
            // Optional, and only by name: a file made before it (F-61) has the guide third.
            var paymentSheet = MapSheet(plan, 3, Payments, optional: true);
            var appointmentSheet = MapSheet(plan, 4, Bookings, optional: true);
            if (result.FileErrors.Count > 0)
            {
                result.ErrorCount = result.FileErrors.Count;
                return plan;
            }

            var sheets = new[] { patientSheet, treatmentSheet, paymentSheet, appointmentSheet }
                .OfType<MappedSheet>()
                .ToArray();
            if (sheets.All(s => s.Rows.Count == 0))
            {
                result.FileErrors.Add(L["DataMigration:Err:NoRows"]);
                result.ErrorCount = result.FileErrors.Count;
                return plan;
            }

            var lookups = await LoadLookupsAsync(branchId);
            var fileCodes = sheets
                .SelectMany(s => s.Rows.Select(row => MigrationRowReader.CodeOf(s.Columns, row)))
                .OfType<string>()
                .Distinct()
                .ToList();
            var stored = await LoadStoredCodesAsync(fileCodes);

            var drafts = PlanPatients(plan, patientSheet!.Columns, patientSheet.Rows, lookups, stored);
            PlanTreatments(plan, treatmentSheet!.Columns, treatmentSheet.Rows, lookups, stored, drafts);
            if (paymentSheet != null)
            {
                await PlanPaymentsAsync(plan, paymentSheet, lookups, stored, drafts);
            }

            if (appointmentSheet != null)
            {
                PlanAppointments(plan, appointmentSheet, lookups, stored, drafts);
            }

            foreach (var patient in plan.Patients)
            {
                DateRecord(patient, plan.Drafts[patient], plan.FirstVisits.GetValueOrDefault(patient));
            }

            result.ErrorCount = result.FileErrors.Count
                + result.Sheets.Sum(s => s.Rows.Count(r => r.Action == DataMigrationRowAction.Error));
            result.PatientsCreated = plan.Patients.Count;
            result.TreatmentPlansCreated = plan.Plans.Count;
            result.TreatmentStagesCreated = plan.Stages.Count;
            result.PaymentsCreated = plan.Payments.Count;
            result.AppointmentsCreated = plan.Appointments.Count;
            return plan;
        }
        catch
        {
            plan.Dispose();
            throw;
        }
    }

    /// <summary>
    /// Reads the Khách hàng sheet and builds the new patients. Returns them by
    /// code (case-insensitive) for the Điều trị pass; a code whose row failed
    /// maps to null, so its treatment rows are still checked but not built.
    /// </summary>
    private Dictionary<string, Patient?> PlanPatients(
        MigrationPlan plan,
        IReadOnlyDictionary<string, int> columns,
        List<IXLRow> rows,
        DataMigrationLookups lookups,
        IReadOnlyDictionary<string, StoredCode> stored)
    {
        var sheet = plan.Result.Sheets[0];
        sheet.TotalRows = rows.Count;
        var byCode = new Dictionary<string, Patient?>(StringComparer.OrdinalIgnoreCase);
        var firstRow = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);

        foreach (var row in rows)
        {
            var number = row.RowNumber();
            var code = MigrationRowReader.CodeOf(columns, row);
            var status = new DataMigrationRowDto { Row = number, PatientCode = code };

            if (code != null && firstRow.TryGetValue(code, out var first))
            {
                Refuse(sheet, status, L["DataMigration:Err:DuplicateCode", first]);
                continue;
            }

            if (code != null)
            {
                firstRow[code] = number;
                if (stored.TryGetValue(code, out var existing))
                {
                    if (existing.BranchId == plan.BranchId && !existing.IsDeleted)
                    {
                        status.Action = DataMigrationRowAction.Skip;
                        sheet.Rows.Add(status);
                        plan.Result.PatientsSkipped++;
                    }
                    else
                    {
                        Refuse(sheet, status, L["DataMigration:Err:CodeTaken", code]);
                    }

                    continue;
                }
            }

            var (draft, errors) = MigrationRowReader.ReadPatient(L, columns, row, lookups, ClinicToday);
            var patient = draft == null ? null : Build(() => BuildPatient(plan.BranchId, draft), errors);
            if (code != null)
            {
                byCode[code] = patient;
            }

            if (errors.Count > 0)
            {
                Refuse(sheet, status, errors.ToArray());
                continue;
            }

            plan.Patients.Add(patient!);
            plan.Drafts[patient!] = draft!;
        }

        return byCode;
    }

    private void PlanTreatments(
        MigrationPlan plan,
        IReadOnlyDictionary<string, int> columns,
        List<IXLRow> rows,
        DataMigrationLookups lookups,
        IReadOnlyDictionary<string, StoredCode> stored,
        Dictionary<string, Patient?> patients)
    {
        var sheet = plan.Result.Sheets[1];
        sheet.TotalRows = rows.Count;
        var clean = new List<(Patient Patient, TreatmentRow Row)>();

        foreach (var row in rows)
        {
            var number = row.RowNumber();
            var code = MigrationRowReader.CodeOf(columns, row);
            var status = new DataMigrationRowDto { Row = number, PatientCode = code };

            if (code != null && !patients.ContainsKey(code) && stored.TryGetValue(code, out var existing)
                && existing.BranchId == plan.BranchId && !existing.IsDeleted)
            {
                // The patient is already here: its history came with it last time.
                status.Action = DataMigrationRowAction.Skip;
                sheet.Rows.Add(status);
                continue;
            }

            var (draft, errors) = MigrationRowReader.ReadTreatment(L, columns, row, lookups, ClinicToday);
            if (code != null && !patients.ContainsKey(code))
            {
                errors.Add(L["DataMigration:Err:UnknownPatient", code, Patients.Name]);
            }

            if (errors.Count > 0)
            {
                Refuse(sheet, status, errors.ToArray());
                if (code != null && patients.GetValueOrDefault(code) is { } broken)
                {
                    plan.BrokenHistories.Add(broken);
                }

                continue;
            }

            if (patients[code!] is { } patient)
            {
                clean.Add((patient, new TreatmentRow(number, draft!, status)));
            }
        }

        foreach (var group in clean.GroupBy(x => x.Patient))
        {
            BuildHistory(plan, group.Key, group.Select(x => x.Row).ToList());
        }
    }

    /// <summary>
    /// Reads the Thanh toán sheet and plans one completed receipt per row (per
    /// slip, when a Kế hoạch row spans two). Rows go oldest first, so earlier
    /// money settles a line before later money and the receipt numbers follow
    /// the dates.
    /// </summary>
    private async Task PlanPaymentsAsync(
        MigrationPlan plan,
        MappedSheet mapped,
        DataMigrationLookups lookups,
        IReadOnlyDictionary<string, StoredCode> stored,
        Dictionary<string, Patient?> patients)
    {
        var sheet = mapped.Result;
        sheet.TotalRows = mapped.Rows.Count;
        var clean = new List<(Patient Patient, PaymentRow Row)>();

        foreach (var row in mapped.Rows)
        {
            var number = row.RowNumber();
            var code = MigrationRowReader.CodeOf(mapped.Columns, row);
            var status = new DataMigrationRowDto { Row = number, PatientCode = code };

            if (code != null && !patients.ContainsKey(code) && stored.TryGetValue(code, out var existing)
                && existing.BranchId == plan.BranchId && !existing.IsDeleted)
            {
                // Its payments came in with the patient last time.
                status.Action = DataMigrationRowAction.Skip;
                sheet.Rows.Add(status);
                continue;
            }

            var (draft, errors) = MigrationRowReader.ReadPayment(L, mapped.Columns, row, lookups, ClinicToday);
            if (code != null && !patients.ContainsKey(code))
            {
                errors.Add(L["DataMigration:Err:UnknownPatient", code, Patients.Name]);
            }

            if (errors.Count > 0)
            {
                Refuse(sheet, status, errors.ToArray());
                continue;
            }

            if (draft!.Amount == 0m)
            {
                // The old system logged zero receipts; there is nothing to record.
                status.Action = DataMigrationRowAction.Skip;
                sheet.Rows.Add(status);
                continue;
            }

            if (patients[code!] is { } patient && !plan.BrokenHistories.Contains(patient))
            {
                clean.Add((patient, new PaymentRow(number, draft, status)));
            }
        }

        var ordered = clean.OrderBy(x => x.Row.Draft.PaidOn).ThenBy(x => x.Row.RowNumber).ToList();
        var sequences = await LoadPaymentSequencesAsync(plan.BranchId, ordered.Select(x => x.Row.Draft.PaidOn.Year));
        foreach (var (patient, row) in ordered)
        {
            var errors = new List<string>();
            var payments = BuildPayments(plan, patient, row.Draft, sequences, errors);
            if (errors.Count > 0)
            {
                Refuse(sheet, row.Status, errors.ToArray());
                continue;
            }

            plan.Payments.AddRange(payments);
        }

        sheet.Rows.Sort((a, b) => a.Row.CompareTo(b.Row));
    }

    /// <summary>
    /// Reads the Lịch hẹn sheet. A blank Trạng thái is Đã đến for a booking
    /// already past and Đã hẹn for one still to come; a past booking cannot be
    /// left Đã hẹn (the missed-appointment worker would turn it into Trễ hẹn
    /// at once) and a future one cannot have been kept or missed yet.
    /// </summary>
    private void PlanAppointments(
        MigrationPlan plan,
        MappedSheet mapped,
        DataMigrationLookups lookups,
        IReadOnlyDictionary<string, StoredCode> stored,
        Dictionary<string, Patient?> patients)
    {
        var sheet = mapped.Result;
        sheet.TotalRows = mapped.Rows.Count;
        var now = new DateTimeOffset(DateTime.SpecifyKind(Clock.Now, DateTimeKind.Utc));
        var cancelledText = L["DataMigration:CancelledInOldSystem"].Value;
        var statusHeader = Bookings[Col.BookedStatus].Header;

        foreach (var row in mapped.Rows)
        {
            var number = row.RowNumber();
            var code = MigrationRowReader.CodeOf(mapped.Columns, row);
            var status = new DataMigrationRowDto { Row = number, PatientCode = code };

            if (code != null && !patients.ContainsKey(code) && stored.TryGetValue(code, out var existing)
                && existing.BranchId == plan.BranchId && !existing.IsDeleted)
            {
                // Its bookings came in with the patient last time.
                status.Action = DataMigrationRowAction.Skip;
                sheet.Rows.Add(status);
                continue;
            }

            var (draft, errors) = MigrationRowReader.ReadAppointment(L, mapped.Columns, row, lookups, ClinicToday);
            if (code != null && !patients.ContainsKey(code))
            {
                errors.Add(L["DataMigration:Err:UnknownPatient", code, Patients.Name]);
            }

            var start = default(DateTimeOffset);
            var state = AppointmentStatus.Requested;
            if (draft != null)
            {
                start = ClinicCalendar.AtLocal(DateOnly.FromDateTime(draft.At), TimeOnly.FromDateTime(draft.At));
                var past = start < now;
                state = draft.Status ?? (past ? AppointmentStatus.Completed : AppointmentStatus.Requested);
                if (past && state == AppointmentStatus.Requested)
                {
                    errors.Add(L["DataMigration:Err:BookedInPast", statusHeader]);
                }
                else if (!past && state is AppointmentStatus.Completed or AppointmentStatus.NoShow)
                {
                    errors.Add(L["DataMigration:Err:ArrivedInFuture", statusHeader]);
                }
            }

            if (errors.Count > 0)
            {
                Refuse(sheet, status, errors.ToArray());
                continue;
            }

            if (patients[code!] is not { } patient)
            {
                continue;
            }

            var appointment = Build(() => Appointment.Import(
                GuidGenerator.Create(), patient.Id, draft!.DentistId, plan.BranchId,
                AppointmentSlot.Imported(start, start.AddMinutes(draft.Minutes)), state,
                draft.Note, draft.CancelNote ?? cancelledText), errors);
            if (appointment == null)
            {
                Refuse(sheet, status, errors.ToArray());
                continue;
            }

            // Booked on the day it was for, as far as the old system tells; a
            // future booking was made today.
            if (start < now)
            {
                SetCreationTime(appointment, start);
            }

            if (state == AppointmentStatus.Completed
                && (!plan.FirstVisits.TryGetValue(patient, out var first) || start < first))
            {
                plan.FirstVisits[patient] = start;
            }

            plan.Appointments.Add(appointment);
        }
    }

    // ---------------------------------------------------------------- building

    private Patient BuildPatient(Guid branchId, PatientDraft draft)
    {
        var contact = new ContactInfo(draft.Phone, draft.Email, draft.Address, draft.EmergencyName, draft.EmergencyPhone);
        var patient = Patient.Register(
            GuidGenerator.Create(),
            draft.Code,
            draft.FirstName,
            draft.LastName,
            draft.DateOfBirth,
            draft.Gender,
            contact,
            branchId,
            draft.NationalId);

        patient.SetSource(draft.SourceId, draft.ChannelId);
        patient.SetOccupation(draft.OccupationId, draft.OccupationOther);
        patient.SetInsuranceNumber(draft.InsuranceNumber);
        patient.SetOldAddress(draft.OldAddress);
        patient.SetNote(draft.Note);
        patient.SetTags(draft.TagIds);
        patient.SetDiseaseHistory(draft.DiseaseHistoryIds);

        if (draft.Guardian is { } guardian)
        {
            patient.SetGuardians(
                [
                    new PatientGuardianData(null, null, guardian.Relation, null, null, null, null,
                        guardian.FullName, guardian.Phone, guardian.NationalId, null, null, null, null, null, null,
                        SameAddressAsPatient: false, Address: null, IsPrimaryContact: true)
                ],
                consented: true,
                GuidGenerator.Create,
                Clock.Now);
        }

        return patient;
    }

    /// <summary>
    /// One patient's history: slips by Kế hoạch, else Mã phiếu, else day,
    /// oldest first and numbered DT01, DT02... as the app numbers them; inside
    /// a slip the lines of <see cref="LinesOf"/>, and one công đoạn per row on
    /// the day it was done. The patient's registration moves back to the first
    /// visit unless the file dates it.
    /// </summary>
    private void BuildHistory(MigrationPlan plan, Patient patient, List<TreatmentRow> rows)
    {
        var ordered = rows.OrderBy(r => r.Draft.TreatedOn).ThenBy(r => r.RowNumber).ToList();
        var stamps = new Dictionary<TreatmentRow, DateTimeOffset>();
        foreach (var day in ordered.GroupBy(r => r.Draft.TreatedOn))
        {
            var start = ClinicCalendar.StartOfDay(day.Key) + VisitStart;
            var minute = 0;
            foreach (var row in day)
            {
                stamps[row] = start.AddMinutes(minute++);
            }
        }

        var slips = ordered.GroupBy(r => SlipKeyOf(r.Draft)).ToList();
        var lines = new List<LineRef>();

        for (var index = 0; index < slips.Count; index++)
        {
            var slipRows = slips[index].ToList();
            var first = slipRows[0];
            var title = first.Draft.PlanKey ?? L["DataMigration:PlanTitle"].Value;
            if (first.Draft.PlanKey == null && first.Draft.SlipCode != null)
            {
                title += $" ({first.Draft.SlipCode})";
            }

            var treatmentPlan = TreatmentPlan.Open(
                GuidGenerator.Create(),
                patient.Id,
                first.Draft.DentistId,
                plan.BranchId,
                $"DT{index + 1:D2}",
                title);
            SetCreationTime(treatmentPlan, stamps[first]);

            foreach (var lineRows in LinesOf(slipRows))
            {
                var line = BuildLine(plan, patient, treatmentPlan, lineRows, stamps);
                lines.Add(new LineRef
                {
                    Plan = treatmentPlan,
                    Line = line,
                    Order = lines.Count,
                    FirstSlip = SlipOf(lineRows[0].Draft),
                    Slips = lineRows.Select(r => SlipOf(r.Draft)).OfType<string>().ToHashSet(),
                    PlanKey = first.Draft.PlanKey == null ? null : ExcelCells.Key(first.Draft.PlanKey)
                });
            }

            treatmentPlan.CloseIfAllServicesDone();
            plan.Plans.Add(treatmentPlan);
        }

        plan.Lines[patient] = lines;
        plan.FirstVisits[patient] = stamps.Values.Min();
    }

    private static string SlipKeyOf(TreatmentDraft draft) =>
        draft.PlanKey != null ? "plan:" + ExcelCells.Key(draft.PlanKey)
        : draft.SlipCode != null ? "slip:" + ExcelCells.Key(draft.SlipCode)
        : "day:" + draft.TreatedOn.DayNumber;

    private static string? SlipOf(TreatmentDraft draft) =>
        draft.SlipCode == null ? null : ExcelCells.Key(draft.SlipCode);

    /// <summary>
    /// A slip's rows, oldest first, cut into service lines: a priced row opens
    /// a line of its own; a row without a price is one more visit on the
    /// slip's latest line of that service, or opens a line priced 0 when there
    /// is none yet. Without prices this is one line per service, as before.
    /// </summary>
    private static List<List<TreatmentRow>> LinesOf(List<TreatmentRow> rows)
    {
        var lines = new List<List<TreatmentRow>>();
        var latest = new Dictionary<Guid, List<TreatmentRow>>();
        foreach (var row in rows)
        {
            if (row.Draft.IsPriced || !latest.TryGetValue(row.Draft.Service.Id, out var line))
            {
                line = [];
                lines.Add(line);
                latest[row.Draft.Service.Id] = line;
            }

            line.Add(row);
        }

        return lines;
    }

    /// <summary>
    /// A line priced as its first row says: Đơn giá × Số lượng, less what
    /// Thành tiền leaves out as a money discount. Đơn giá gốc is raised to the
    /// price when lower — the old system sold above list, the app refuses to.
    /// </summary>
    private TreatmentService BuildLine(
        MigrationPlan plan,
        Patient patient,
        TreatmentPlan treatmentPlan,
        List<TreatmentRow> rows,
        Dictionary<TreatmentRow, DateTimeOffset> stamps)
    {
        var head = rows[0].Draft;
        var teeth = rows.SelectMany(r => r.Draft.Teeth).Distinct().ToList();
        var price = head.IsPriced ? head.Price!.Value : 0m;
        var quantity = head.Quantity ?? Math.Max(1, (head.IsPriced ? head.Teeth : teeth).Count);
        var originalPrice = Math.Max(head.OriginalPrice ?? 0m, price);
        var gross = price * quantity;
        var discount = head.IsPriced && head.Amount is { } amount && amount < gross ? gross - amount : 0m;

        var line = treatmentPlan.AddService(
            GuidGenerator.Create(),
            head.Service.Id,
            sourceAdviseId: null,
            price,
            quantity,
            discount > 0m ? DiscountType.Money : DiscountType.None,
            discount,
            teeth.Select(tooth => new ToothSelection(tooth, selected: true)),
            originalPrice: head.IsPriced ? originalPrice : 0m);
        SetCreationTime(line, stamps[rows[0]]);
        line.Start();

        for (var i = 0; i < rows.Count; i++)
        {
            var draft = rows[i].Draft;
            var at = stamps[rows[i]];
            var stage = TreatmentStage.Add(
                GuidGenerator.Create(),
                patient.Id,
                plan.BranchId,
                treatmentPlan.Id,
                line.Id,
                draft.Service.Id,
                i + 1,
                draft.StageName,
                draft.DentistId,
                draft.Content,
                teeth: draft.Teeth.Select(tooth => new ToothSelection(tooth, selected: true)),
                secondStaffId: draft.AssistingDoctorId,
                subStaffId: draft.AssistantId,
                treatmentDate: draft.TreatedOn);

            if (draft.Completed)
            {
                stage.Complete();
                SetProperty(stage, nameof(TreatmentStage.CompletedAt), (DateTimeOffset?)at);
            }
            else
            {
                stage.Start();
            }

            SetProperty(stage, nameof(TreatmentStage.StartedAt), (DateTimeOffset?)at);
            SetCreationTime(stage, at);
            plan.Stages.Add(stage);
        }

        if (rows.All(r => r.Draft.Completed))
        {
            line.Complete();
        }

        return line;
    }

    /// <summary>
    /// The receipts for one Thanh toán row. The money goes first to the line
    /// its Mã phiếu opened, then to lines that slip visited, then to the rest
    /// of the slip, each line up to what it still owes. Money left over is
    /// refused: the old system would have shown it as a debt paid twice.
    /// </summary>
    private List<PatientPayment> BuildPayments(
        MigrationPlan plan,
        Patient patient,
        PaymentDraft draft,
        Dictionary<int, int> sequences,
        List<string> errors)
    {
        var slip = draft.SlipCode == null ? null : ExcelCells.Key(draft.SlipCode);
        var planKey = draft.PlanKey == null ? null : ExcelCells.Key(draft.PlanKey);
        var lines = plan.Lines.GetValueOrDefault(patient) ?? [];
        var plans = lines
            .Where(l => slip == null || l.Slips.Contains(slip))
            .Where(l => planKey == null || l.PlanKey == planKey)
            .Select(l => l.Plan)
            .ToHashSet();
        var target = string.Join(" / ", new[] { draft.SlipCode, draft.PlanKey }.OfType<string>());
        if (plans.Count == 0)
        {
            errors.Add(L["DataMigration:Err:PaymentNoPlan", target, Treatments.Name]);
            return [];
        }

        var shares = new List<(LineRef Line, decimal Amount)>();
        var left = draft.Amount;
        foreach (var line in lines
                     .Where(l => plans.Contains(l.Plan))
                     .OrderBy(l => l.FirstSlip == slip && slip != null ? 0 : slip != null && l.Slips.Contains(slip) ? 1 : 2)
                     .ThenBy(l => l.Order))
        {
            var share = Math.Min(left, line.Open);
            if (share > 0m)
            {
                shares.Add((line, share));
                left -= share;
            }

            if (left == 0m)
            {
                break;
            }
        }

        if (left > 0m)
        {
            errors.Add(L["DataMigration:Err:PaymentExceeds", MigrationRowReader.FormatMoney(draft.Amount), target,
                MigrationRowReader.FormatMoney(draft.Amount - left)]);
            return [];
        }

        var paidAt = ClinicCalendar.StartOfDay(draft.PaidOn) + PaymentTaken;
        var note = L["DataMigration:PaymentNote", target].Value;
        if (draft.Note != null)
        {
            note += " — " + draft.Note;
        }

        if (note.Length > PaymentNoteMax)
        {
            note = note[..PaymentNoteMax];
        }

        var year = draft.PaidOn.Year;
        var payments = new List<PatientPayment>();
        foreach (var group in shares.GroupBy(s => s.Line.Plan))
        {
            var sequence = sequences.GetValueOrDefault(year) + 1;
            var payment = Build(() => PatientPayment.Record(
                GuidGenerator.Create(),
                patient.Id,
                plan.BranchId,
                PatientPaymentKind.Payment,
                draft.Method,
                group.Sum(s => s.Amount),
                PatientPayment.FormatCode(PatientPaymentKind.Payment, sequence, year, group.Key.Code),
                draft.CashierId ?? CurrentUser.GetId(),
                paidAt,
                group.Key.Id,
                note,
                draft.AccountId,
                PaymentSplitMode.Manual,
                group.Select(s => (s.Line.Line.Id, s.Amount)),
                GuidGenerator.Create), errors);
            if (payment == null)
            {
                return [];
            }

            sequences[year] = sequence;
            payment.MarkImported();
            SetCreationTime(payment, paidAt);
            payments.Add(payment);
        }

        foreach (var (line, amount) in shares)
        {
            line.Allocated += amount;
        }

        return payments;
    }

    /// <summary>
    /// The old system's dates: the record opens on its Ngày tạo hồ sơ, else on
    /// the first visit, else today; the Lý do đến khám is recorded with it.
    /// </summary>
    private void DateRecord(Patient patient, PatientDraft draft, DateTimeOffset firstVisit)
    {
        var registered = draft.RegisteredOn is { } day
            ? ClinicCalendar.StartOfDay(day) + RecordOpened
            : firstVisit != default ? firstVisit : patient.RegisteredAt;

        SetProperty(patient, nameof(Patient.RegisteredAt), registered);
        SetCreationTime(patient, registered);
        patient.SetRootExaminationReason(GuidGenerator.Create(), draft.ExaminationReason, registered);
    }

    // ------------------------------------------------------------------ lookups

    private DateOnly ClinicToday =>
        ClinicCalendar.DateOf(new DateTimeOffset(DateTime.SpecifyKind(Clock.Now, DateTimeKind.Utc)));

    private async Task<Guid> ResolveBranchAsync(Guid? requested) =>
        await _branchAccess.ResolveWriteTargetAsync(
            requested ?? Guid.Empty,
            _branchResolver.GetRequiredClinicBranchId());

    private async Task<DataMigrationLookups> LoadLookupsAsync(Guid branchId)
    {
        var entries = await _catalogRepository.GetListAsync(e =>
            e.ClinicBranchId == branchId && CatalogGroups.Contains(e.Group) && e.IsActive);
        var sources = (await _taxonomyRepository.GetListAsync(t =>
                t.ClinicBranchId == branchId && t.Group == TaxonomyGroups.Source))
            .OrderBy(t => t.SortOrder)
            .ThenBy(t => t.Name)
            .ToList();
        var tags = await _tagRepository.GetListAsync(t => t.ClinicBranchId == branchId && t.IsActive);

        var staffIds = (await _assignmentRepository.GetListAsync(a => a.ClinicBranchId == branchId))
            .Select(a => a.StaffId)
            .Distinct()
            .ToList();
        // Locked accounts stay in: history names the doctors who have since left.
        var staff = staffIds.Count == 0
            ? []
            : (await _userRepository.GetListByIdsAsync(staffIds))
                .Select(u => new LookupItem(u.Id, DataMigrationLookups.StaffName(u.Surname, u.Name, u.UserName), u.UserName))
                .OrderBy(u => u.Name)
                .ToList();

        return new DataMigrationLookups
        {
            Services = DataMigrationLookups.Entries(entries.Where(e => !e.IsCombo), TaxonomyGroups.CareService),
            Staff = staff,
            Sources = sources.Select(t => new LookupItem(t.Id, t.Name)).ToList(),
            Channels = sources.ToDictionary(
                t => t.Id,
                t => DataMigrationLookups.Entries(entries.Where(e => e.TaxonomyId == t.Id), TaxonomyGroups.Source)),
            Occupations = DataMigrationLookups.Entries(entries, TaxonomyGroups.Occupation),
            DiseaseHistory = DataMigrationLookups.Entries(entries, TaxonomyGroups.DiseaseHistory),
            Tags = tags.OrderBy(t => t.Name).Select(t => new LookupItem(t.Id, t.Name)).ToList(),
            // Inactive accounts stay in: old payments went into accounts since closed.
            Accounts = (await _accountRepository.GetListAsync(a => a.ClinicBranchId == branchId))
                .Select(a => new AccountItem(a.Id, a.Kind, a.HolderName,
                    a.Kind == PaymentAccountKind.MoMo ? a.PhoneNumber : a.AccountNumber))
                .ToList()
        };
    }

    /// <summary>
    /// Payment receipts the branch already numbered, per year — the app's own
    /// counter (PatientPaymentAppService.GenerateCodeAsync), cancelled and
    /// unpaid receipts included, so the imported ones carry on after them.
    /// </summary>
    private async Task<Dictionary<int, int>> LoadPaymentSequencesAsync(Guid branchId, IEnumerable<int> years)
    {
        var wanted = years.Distinct().ToList();
        if (wanted.Count == 0)
        {
            return [];
        }

        using var cancelled = DataFilter.Disable<ISoftDelete>();
        using var pending = DataFilter.Disable<ISettleable>();
        var query = await _paymentRepository.GetQueryableAsync();
        var counts = await AsyncExecuter.ToListAsync(query
            .Where(x => x.ClinicBranchId == branchId
                && x.Kind == PatientPaymentKind.Payment
                && wanted.Contains(x.CreationTime.Year))
            .GroupBy(x => x.CreationTime.Year)
            .Select(g => new { Year = g.Key, Count = g.Count() }));
        return counts.ToDictionary(c => c.Year, c => c.Count);
    }

    /// <summary>
    /// The file's codes as the database already holds them. The code index is
    /// unique across branches and deleted rows alike, so all of them count.
    /// </summary>
    private async Task<Dictionary<string, StoredCode>> LoadStoredCodesAsync(List<string> codes)
    {
        if (codes.Count == 0)
        {
            return [];
        }

        // Compared without case, as the file's own duplicates are: "kh001" in
        // the file is the "KH001" already stored, not a second record.
        var keys = codes.Select(c => c.ToUpperInvariant()).Distinct().ToList();
        using (_softDeleteFilter.Disable())
        {
            var query = await _patientRepository.GetQueryableAsync();
            var rows = await AsyncExecuter.ToListAsync(query
                .Where(p => keys.Contains(p.PatientCode.ToUpper()))
                .Select(p => new { p.PatientCode, p.BranchId, p.IsDeleted }));

            var stored = new Dictionary<string, StoredCode>(StringComparer.OrdinalIgnoreCase);
            foreach (var row in rows)
            {
                stored.TryAdd(row.PatientCode, new StoredCode(row.BranchId, row.IsDeleted));
            }

            return stored;
        }
    }

    // ------------------------------------------------------------------ reading

    private static XLWorkbook LoadWorkbook(ImportDataMigrationDto input)
    {
        try
        {
            var buffer = new MemoryStream();
            using (var upload = input.File.GetStream())
            {
                upload.CopyTo(buffer);
            }

            buffer.Position = 0;
            return new XLWorkbook(buffer);
        }
        catch (Exception e)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Catalogs.InvalidImportFile, innerException: e);
        }
    }

    /// <summary>
    /// The layout's sheet with its column key → Excel column number, from the
    /// header row, and its data rows. A required column that is missing is a
    /// file error; a missing optional sheet is simply null.
    /// </summary>
    private MappedSheet? MapSheet(MigrationPlan plan, int position, ImportSheetLayout layout, bool optional = false)
    {
        var result = plan.Result;
        var sheet = plan.Workbook.Worksheets
            .FirstOrDefault(s => ExcelCells.Key(s.Name) == ExcelCells.Key(layout.Name));
        if (sheet == null && optional)
        {
            return null;
        }

        if (sheet == null && plan.Workbook.Worksheets.Count < position)
        {
            result.FileErrors.Add(L["Taxonomy:Import:Err:MissingSheet", position, layout.Name]);
            return null;
        }

        // By name, so a sheet moved or added in front does not shift the data; else by position.
        sheet ??= plan.Workbook.Worksheet(position);
        var headers = new Dictionary<string, int>();
        var lastColumn = sheet.Row(HeaderRow).LastCellUsed()?.Address.ColumnNumber ?? 0;
        for (var column = 1; column <= lastColumn; column++)
        {
            var key = ExcelCells.Key(ExcelCells.Text(sheet.Cell(HeaderRow, column))?.TrimEnd('*', ' '));
            if (key.Length > 0)
            {
                headers.TryAdd(key, column);
            }
        }

        var columns = new Dictionary<string, int>();
        foreach (var column in layout.Columns)
        {
            if (headers.TryGetValue(ExcelCells.Key(column.Header), out var index))
            {
                columns[column.Key] = index;
            }
            else if (column.Required)
            {
                result.FileErrors.Add(L["Taxonomy:Import:Err:MissingColumn", sheet.Name, column.Header]);
            }
        }

        var entry = new DataMigrationSheetDto { Name = sheet.Name };
        result.Sheets.Add(entry);
        plan.SheetSources.Add(sheet);
        return new MappedSheet(sheet, entry, columns, DataRows(sheet, columns).ToList());
    }

    /// <summary>Rows below the header that have something in at least one template column.</summary>
    private static IEnumerable<IXLRow> DataRows(IXLWorksheet sheet, Dictionary<string, int> columns)
    {
        var last = sheet.LastRowUsed()?.RowNumber() ?? HeaderRow;
        for (var number = HeaderRow + 1; number <= last; number++)
        {
            var row = sheet.Row(number);
            if (columns.Values.Any(index => ExcelCells.Text(row.Cell(index)) != null))
            {
                yield return row;
            }
        }
    }

    /// <summary>Runs a domain constructor; its refusal becomes a row error instead of failing the request.</summary>
    private T? Build<T>(Func<T> build, List<string> errors) where T : class
    {
        try
        {
            return build();
        }
        catch (BusinessException e) when (e.Code != null)
        {
            errors.Add(L[e.Code].Value);
        }
        catch (ArgumentException e)
        {
            errors.Add(L["DataMigration:Err:Invalid", e.ParamName ?? e.Message]);
        }

        return null;
    }

    private static void Refuse(DataMigrationSheetDto sheet, DataMigrationRowDto status, params string[] errors)
    {
        status.Action = DataMigrationRowAction.Error;
        status.Errors.AddRange(errors);
        sheet.Rows.Add(status);
    }

    /// <summary>
    /// ABP stamps CreationTime only while it is still default, so an entity
    /// given one here keeps the old system's date. Npgsql wants it in UTC.
    /// </summary>
    private static void SetCreationTime(object entity, DateTimeOffset at) =>
        SetProperty(entity, "CreationTime", at.UtcDateTime);

    private static void SetProperty(object entity, string name, object? value) =>
        entity.GetType().GetProperty(name)?.GetSetMethod(nonPublic: true)?.Invoke(entity, [value]);

    // ---------------------------------------------------------------- template

    private static IXLWorksheet WriteTemplateSheet(XLWorkbook workbook, ImportSheetLayout layout)
    {
        var sheet = workbook.Worksheets.Add(SafeSheetName(layout.Name));
        for (var i = 0; i < layout.Columns.Count; i++)
        {
            var column = layout.Columns[i];
            var cell = sheet.Cell(HeaderRow, i + 1);
            cell.Value = column.Required ? column.Header + " *" : column.Header;
            cell.Style.Font.Bold = true;
            cell.Style.Fill.BackgroundColor = HeaderFill;
            sheet.Column(i + 1).Width = column.Width;

            // Codes, phones, CCCD and dates are text: a number cell would drop
            // their leading zeros and Excel would reformat the dates. Money and
            // quantities are numbers, grouped the Vietnamese way on screen.
            sheet.Column(i + 1).Style.NumberFormat.Format = NumberColumns.Contains(column.Key) ? "#,##0" : "@";
        }

        sheet.SheetView.FreezeRows(HeaderRow);
        return sheet;
    }

    private void WriteGuideSheet(XLWorkbook workbook)
    {
        var sheet = workbook.Worksheets.Add(SafeSheetName(L["Taxonomy:Import:GuideSheet"].Value));
        string[] headers =
        [
            L["Taxonomy:Import:GuideCol:Sheet"].Value,
            L["Taxonomy:Import:GuideCol:Column"].Value,
            L["Taxonomy:Import:GuideCol:Required"].Value,
            L["Taxonomy:Import:GuideCol:Note"].Value
        ];
        double[] widths = [16, 30, 12, 100];

        for (var i = 0; i < headers.Length; i++)
        {
            var cell = sheet.Cell(HeaderRow, i + 1);
            cell.Value = headers[i];
            cell.Style.Font.Bold = true;
            cell.Style.Fill.BackgroundColor = HeaderFill;
            sheet.Column(i + 1).Width = widths[i];
        }

        var row = HeaderRow;
        sheet.Cell(++row, 1).Value = L["DataMigration:GuideIntro"].Value;
        sheet.Range(row, 1, row, headers.Length).Merge();
        sheet.Cell(row, 1).Style.Alignment.WrapText = true;
        sheet.Row(row).Height = 150;

        sheet.Cell(++row, 1).Value = L["DataMigration:GuideGrouping"].Value;
        sheet.Range(row, 1, row, headers.Length).Merge();
        sheet.Cell(row, 1).Style.Alignment.WrapText = true;
        sheet.Row(row).Height = 165;

        var yes = L["Common:Yes"].Value;
        var no = L["Common:No"].Value;
        foreach (var layout in new[] { Patients, Treatments, Payments, Bookings })
        {
            foreach (var column in layout.Columns)
            {
                row++;
                sheet.Cell(row, 1).Value = layout.Name;
                sheet.Cell(row, 2).Value = column.Header;
                sheet.Cell(row, 3).Value = column.Required ? yes : no;
                sheet.Cell(row, 4).Value = L[column.HintKey].Value;
                sheet.Cell(row, 4).Style.Alignment.WrapText = true;
            }
        }
    }

    // ------------------------------------------------------------------ helpers

    private static byte[] Save(XLWorkbook workbook)
    {
        using var stream = new MemoryStream();
        workbook.SaveAs(stream);
        return stream.ToArray();
    }

    private static string SafeSheetName(string name)
    {
        var cleaned = new string(name.Where(c => !"\\/?*[]:".Contains(c)).ToArray());
        return cleaned.Length <= 31 ? cleaned : cleaned[..31];
    }
}
