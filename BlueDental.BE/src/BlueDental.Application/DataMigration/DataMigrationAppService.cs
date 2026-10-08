using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
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
/// <item>One treatment slip per (patient, Mã phiếu) — or per (patient, day) when
/// the old system had no slip numbers — with one line per service and one
/// công đoạn per row, dated on the day it was done.</item>
/// <item>No payments, and the lines are priced 0, so the import opens no công
/// nợ (BA: later visits are paid for separately).</item>
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

    private static readonly string[] CatalogGroups =
        [TaxonomyGroups.CareService, TaxonomyGroups.Source, TaxonomyGroups.Occupation, TaxonomyGroups.DiseaseHistory];

    private readonly IRepository<Patient, Guid> _patientRepository;
    private readonly IMigratedHistoryWriter _historyWriter;
    private readonly IRepository<CatalogEntry, Guid> _catalogRepository;
    private readonly IRepository<Taxonomy, Guid> _taxonomyRepository;
    private readonly IRepository<PatientTag, Guid> _tagRepository;
    private readonly IRepository<StaffBranchAssignment, Guid> _assignmentRepository;
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
        _userRepository = userRepository;
        _branchAccess = branchAccess;
        _branchResolver = branchResolver;
        _softDeleteFilter = softDeleteFilter;
    }

    public async Task<byte[]> GetTemplateAsync(Guid? clinicBranchId)
    {
        // Only the branch check: the file carries no branch data (R-843, R-847).
        await ResolveBranchAsync(clinicBranchId);

        using var workbook = new XLWorkbook();
        var patients = WriteTemplateSheet(workbook, Patients);
        var treatments = WriteTemplateSheet(workbook, Treatments);
        WriteGuideSheet(workbook);
        DataMigrationPickLists.Apply(patients, treatments, new PickListMessages(
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

        await _historyWriter.WriteAsync(plan.Patients, plan.Plans, plan.Stages);

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

        public void Dispose() => Workbook.Dispose();
    }

    /// <summary>A patient code already in the database, under any branch, deleted or not.</summary>
    private sealed record StoredCode(Guid BranchId, bool IsDeleted);

    /// <summary>A Điều trị row that read cleanly, with where it sits in the result.</summary>
    private sealed record TreatmentRow(int RowNumber, TreatmentDraft Draft, DataMigrationRowDto Status);

    private async Task<MigrationPlan> PlanAsync(ImportDataMigrationDto input)
    {
        var branchId = await ResolveBranchAsync(input.ClinicBranchId);
        var plan = new MigrationPlan { BranchId = branchId, Workbook = LoadWorkbook(input) };
        var result = plan.Result;

        try
        {
            var patientSheet = MapSheet(plan, 1, Patients);
            var treatmentSheet = MapSheet(plan, 2, Treatments);
            if (result.FileErrors.Count > 0)
            {
                result.ErrorCount = result.FileErrors.Count;
                return plan;
            }

            var patientRows = DataRows(patientSheet!.Value.Sheet, patientSheet.Value.Columns).ToList();
            var treatmentRows = DataRows(treatmentSheet!.Value.Sheet, treatmentSheet.Value.Columns).ToList();
            if (patientRows.Count == 0 && treatmentRows.Count == 0)
            {
                result.FileErrors.Add(L["DataMigration:Err:NoRows"]);
                result.ErrorCount = result.FileErrors.Count;
                return plan;
            }

            var lookups = await LoadLookupsAsync(branchId);
            var fileCodes = patientRows.Concat(treatmentRows)
                .Select(row => MigrationRowReader.CodeOf(
                    row.Worksheet == patientSheet.Value.Sheet ? patientSheet.Value.Columns : treatmentSheet.Value.Columns, row))
                .OfType<string>()
                .Distinct()
                .ToList();
            var stored = await LoadStoredCodesAsync(fileCodes);

            var drafts = PlanPatients(plan, patientSheet.Value.Columns, patientRows, lookups, stored);
            PlanTreatments(plan, treatmentSheet.Value.Columns, treatmentRows, lookups, stored, drafts);
            foreach (var patient in plan.Patients)
            {
                DateRecord(patient, plan.Drafts[patient], plan.FirstVisits.GetValueOrDefault(patient));
            }

            result.ErrorCount = result.FileErrors.Count
                + result.Sheets.Sum(s => s.Rows.Count(r => r.Action == DataMigrationRowAction.Error));
            result.PatientsCreated = plan.Patients.Count;
            result.TreatmentPlansCreated = plan.Plans.Count;
            result.TreatmentStagesCreated = plan.Stages.Count;
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
    /// One patient's history: slips by Mã phiếu (or by day), oldest first and
    /// numbered DT01, DT02... as the app numbers them; inside a slip one line per
    /// service, and one công đoạn per row on the day it was done. The patient's
    /// registration moves back to the first visit unless the file dates it.
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

        var slips = ordered
            .GroupBy(r => r.Draft.SlipCode != null
                ? "slip:" + ExcelCells.Key(r.Draft.SlipCode)
                : "day:" + r.Draft.TreatedOn.DayNumber)
            .ToList();

        for (var index = 0; index < slips.Count; index++)
        {
            var slipRows = slips[index].ToList();
            var first = slipRows[0];
            var title = L["DataMigration:PlanTitle"].Value;
            if (first.Draft.SlipCode != null)
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

            foreach (var lineRows in slipRows.GroupBy(r => r.Draft.Service.Id))
            {
                BuildLine(plan, patient, treatmentPlan, lineRows.ToList(), stamps);
            }

            treatmentPlan.CloseIfAllServicesDone();
            plan.Plans.Add(treatmentPlan);
        }

        plan.FirstVisits[patient] = stamps.Values.Min();
    }

    private void BuildLine(
        MigrationPlan plan,
        Patient patient,
        TreatmentPlan treatmentPlan,
        List<TreatmentRow> rows,
        Dictionary<TreatmentRow, DateTimeOffset> stamps)
    {
        var teeth = rows.SelectMany(r => r.Draft.Teeth).Distinct().ToList();
        var line = treatmentPlan.AddService(
            GuidGenerator.Create(),
            rows[0].Draft.Service.Id,
            sourceAdviseId: null,
            price: 0m,
            quantity: Math.Max(1, teeth.Count),
            DiscountType.None,
            discountValue: 0m,
            teeth.Select(tooth => new ToothSelection(tooth, selected: true)),
            originalPrice: 0m);
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
                subStaffId: draft.AssistantId);

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
            Tags = tags.OrderBy(t => t.Name).Select(t => new LookupItem(t.Id, t.Name)).ToList()
        };
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

    /// <summary>Column key → Excel column number, from the header row; null with a file error when a required column is missing.</summary>
    private (IXLWorksheet Sheet, Dictionary<string, int> Columns)? MapSheet(
        MigrationPlan plan, int position, ImportSheetLayout layout)
    {
        var result = plan.Result;
        var sheet = plan.Workbook.Worksheets
            .FirstOrDefault(s => ExcelCells.Key(s.Name) == ExcelCells.Key(layout.Name));
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

        result.Sheets.Add(new DataMigrationSheetDto { Name = sheet.Name });
        plan.SheetSources.Add(sheet);
        return (sheet, columns);
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
            // their leading zeros and Excel would reformat the dates.
            sheet.Column(i + 1).Style.NumberFormat.Format = "@";
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
        sheet.Row(row).Height = 120;

        var yes = L["Common:Yes"].Value;
        var no = L["Common:No"].Value;
        foreach (var layout in new[] { Patients, Treatments })
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
