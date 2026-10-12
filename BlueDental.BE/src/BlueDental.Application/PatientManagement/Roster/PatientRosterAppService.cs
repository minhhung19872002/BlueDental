using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Catalogs;
using BlueDental.Catalogs.Import;
using BlueDental.Data;
using BlueDental.DataMigration;
using BlueDental.Organizations;
using BlueDental.PatientManagement.Values;
using BlueDental.Permissions;
using ClosedXML.Excel;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp;
using Volo.Abp.Data;
using Volo.Abp.Domain.Repositories;
using static BlueDental.DataMigration.DataMigrationLayout;
using static BlueDental.PatientManagement.Roster.PatientRosterLayout;

namespace BlueDental.PatientManagement.Roster;

/// <summary>
/// The patient roster file (F-69, BA 2026-10-12): every patient of every
/// branch exported to one sheet, edited offline, and imported back.
///
/// <list type="bullet">
/// <item>Only rows with an Action are read: E adds a patient (blank or unused
/// Mã khách hàng — a blank one is numbered as the hồ sơ dialog numbers it) or
/// edits the one the code names; D deletes it. A blank Action leaves the row
/// alone, so a slip of the hand on an unmarked row changes nothing.</item>
/// <item>An edit writes every column: a blank cell clears the field. Ngày tạo
/// hồ sơ left blank keeps the record's date.</item>
/// <item>A patient moves to no other branch, and D refuses a record anyone has
/// worked on (appointments, slips, payments...).</item>
/// <item>As in the other imports, one bad row refuses the whole file; the
/// dry run and the error file show which rows and why.</item>
/// </list>
/// </summary>
[Authorize(BlueDentalPermissions.SystemAdministration.PatientRoster)]
public class PatientRosterAppService : BlueDentalAppService, IPatientRosterAppService
{
    private static readonly XLColor HeaderFill = XLColor.FromHtml("#EBF3FE");
    private static readonly XLColor ErrorFill = XLColor.FromHtml("#FDE2E2");
    private const int HeaderRow = 1;

    /// <summary>A record dated by the file opens at 08:00 clinic time, as in the old-system import.</summary>
    private static readonly TimeSpan RecordOpened = TimeSpan.FromHours(8);

    private static readonly string[] CatalogGroups =
        [TaxonomyGroups.Source, TaxonomyGroups.Occupation, TaxonomyGroups.DiseaseHistory];

    private readonly IRepository<Patient, Guid> _patientRepository;
    private readonly IRepository<ClinicBranch, Guid> _branchRepository;
    private readonly IRepository<CatalogEntry, Guid> _catalogRepository;
    private readonly IRepository<Taxonomy, Guid> _taxonomyRepository;
    private readonly IRepository<PatientTag, Guid> _tagRepository;
    private readonly IMigratedHistoryWriter _patientWriter;
    private readonly PatientRecordCheck _recordCheck;
    private readonly IDataFilter _dataFilter;

    public PatientRosterAppService(
        IRepository<Patient, Guid> patientRepository,
        IRepository<ClinicBranch, Guid> branchRepository,
        IRepository<CatalogEntry, Guid> catalogRepository,
        IRepository<Taxonomy, Guid> taxonomyRepository,
        IRepository<PatientTag, Guid> tagRepository,
        IMigratedHistoryWriter patientWriter,
        PatientRecordCheck recordCheck,
        IDataFilter dataFilter)
    {
        _patientRepository = patientRepository;
        _branchRepository = branchRepository;
        _catalogRepository = catalogRepository;
        _taxonomyRepository = taxonomyRepository;
        _tagRepository = tagRepository;
        _patientWriter = patientWriter;
        _recordCheck = recordCheck;
        _dataFilter = dataFilter;
    }

    // ------------------------------------------------------------------ export

    public async Task<byte[]> ExportAsync()
    {
        Dictionary<Guid, string> branchNames;
        using (_dataFilter.Disable<ISoftDelete>())
        {
            branchNames = (await _branchRepository.GetListAsync()).ToDictionary(b => b.Id, b => b.Name);
        }

        var catalogs = await LoadCatalogsAsync();
        List<Patient> patients;
        using (_patientRepository.DisableTracking())
        {
            patients = await AsyncExecuter.ToListAsync(await _patientRepository.WithDetailsAsync());
        }

        using var workbook = new XLWorkbook();
        var sheet = WriteHeader(workbook);
        var row = HeaderRow;
        foreach (var patient in patients
                     .OrderBy(p => branchNames.GetValueOrDefault(p.BranchId))
                     .ThenBy(p => p.PatientCode))
        {
            row++;
            var values = PatientRosterExport.Values(patient, branchNames.GetValueOrDefault(patient.BranchId), catalogs);
            for (var i = 0; i < Sheet.Columns.Count; i++)
            {
                if (values.GetValueOrDefault(Sheet.Columns[i].Key) is { } text)
                {
                    sheet.Cell(row, i + 1).Value = text;
                }
            }
        }

        sheet.Range(HeaderRow, 1, row, Sheet.Columns.Count).SetAutoFilter();
        return Save(workbook);
    }

    private static IXLWorksheet WriteHeader(XLWorkbook workbook)
    {
        var sheet = workbook.Worksheets.Add(Sheet.Name);
        for (var i = 0; i < Sheet.Columns.Count; i++)
        {
            var column = Sheet.Columns[i];
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

    // ------------------------------------------------------------------ import

    public async Task<PatientRosterResultDto> ImportAsync(ImportPatientRosterDto input)
    {
        using var plan = await PlanAsync(input);
        var result = plan.Result;
        result.DryRun = input.DryRun;

        if (input.DryRun || result.ErrorCount > 0)
        {
            return result;
        }

        await CommitAsync(plan);
        result.Committed = true;
        return result;
    }

    public async Task<byte[]> GetErrorFileAsync(ImportPatientRosterDto input)
    {
        using var plan = await PlanAsync(input);
        var result = plan.Result;

        // A fresh workbook, as in the other imports: the uploaded one keeps its
        // old <dimension> and readers that trust it would miss the new column.
        using var output = new XLWorkbook();
        if (plan.Sheet != null)
        {
            var sheet = plan.Sheet.CopyTo(output, plan.Sheet.Name);
            var column = (sheet.Row(HeaderRow).LastCellUsed()?.Address.ColumnNumber ?? 0) + 1;

            var header = sheet.Cell(HeaderRow, column);
            header.Value = L["Taxonomy:Import:ErrorColumn"].Value;
            header.Style.Font.Bold = true;
            header.Style.Fill.BackgroundColor = ErrorFill;
            sheet.Column(column).Width = 60;

            foreach (var row in result.Rows.Where(r => r.Errors.Count > 0))
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

    private sealed class RosterPlan : IDisposable
    {
        public required XLWorkbook Workbook { get; init; }
        public IXLWorksheet? Sheet { get; set; }
        public Dictionary<string, int> Columns { get; set; } = [];
        public PatientRosterResultDto Result { get; } = new();
        public List<RosterRow> Rows { get; } = [];

        /// <summary>Existing records the file edits or deletes, read without tracking.</summary>
        public Dictionary<Guid, Patient> Existing { get; set; } = [];

        public List<Patient> Creates { get; } = [];

        public void Dispose() => Workbook.Dispose();
    }

    private sealed class RosterRow
    {
        public required IXLRow Row { get; init; }
        public required bool Delete { get; init; }
        public required PatientRosterRowDto Status { get; init; }
        public List<string> Errors => Status.Errors;
        public ClinicBranch? Branch { get; set; }

        /// <summary>The file's code, the stored spelling of it, or the one given to a new patient.</summary>
        public string? Code { get; set; }

        public StoredPatient? Stored { get; set; }
        public PatientDraft? Draft { get; set; }

        public bool IsCreate => !Delete && Stored == null;
        public bool IsUpdate => !Delete && Stored != null;
    }

    private sealed record StoredPatient(Guid Id, string Code, Guid BranchId, bool IsDeleted);

    private async Task<RosterPlan> PlanAsync(ImportPatientRosterDto input)
    {
        var plan = new RosterPlan { Workbook = LoadWorkbook(input) };
        try
        {
            var columns = MapSheet(plan);
            if (columns == null)
            {
                return plan;
            }

            ReadRows(plan, columns);
            if (plan.Rows.Count == 0)
            {
                plan.Result.FileErrors.Add(L["PatientRoster:Err:NoMarkedRows", Sheet[Col.Action].Header]);
                Finish(plan);
                return plan;
            }

            await ResolveBranchesAsync(plan);
            await MatchCodesAsync(plan);
            await LoadExistingAsync(plan);

            var catalogs = await LoadCatalogsAsync();
            foreach (var row in plan.Rows.Where(r => !r.Delete && r.Branch != null))
            {
                ReadDraft(row, columns, catalogs, row.Stored == null ? null : plan.Existing[row.Stored.Id]);
            }

            await CheckDeletesAsync(plan);
            await CheckUniqueValuesAsync(plan);
            await AssignCodesAsync(plan);
            Build(plan);
            Finish(plan);
            return plan;
        }
        catch
        {
            plan.Dispose();
            throw;
        }
    }

    private void ReadRows(RosterPlan plan, Dictionary<string, int> columns)
    {
        var sheet = plan.Sheet!;
        var last = sheet.LastRowUsed()?.RowNumber() ?? HeaderRow;
        for (var number = HeaderRow + 1; number <= last; number++)
        {
            var row = sheet.Row(number);
            if (columns.Values.All(index => ExcelCells.Text(row.Cell(index)) == null))
            {
                continue;
            }

            plan.Result.TotalRows++;
            var action = ExcelCells.Text(row.Cell(columns[Col.Action]));
            if (action == null)
            {
                plan.Result.Unmarked++;
                continue;
            }

            var key = ExcelCells.Key(action);
            var status = new PatientRosterRowDto
            {
                Row = number,
                PatientCode = MigrationRowReader.CodeOf(columns, row),
                FullName = columns.TryGetValue(Col.FullName, out var nameColumn)
                    ? ExcelCells.Text(row.Cell(nameColumn))
                    : null,
                Action = key == DeleteAction ? PatientRosterRowAction.Delete : PatientRosterRowAction.Create
            };
            var rosterRow = new RosterRow { Row = row, Delete = key == DeleteAction, Status = status, Code = status.PatientCode };
            if (key != EditAction && key != DeleteAction)
            {
                rosterRow.Errors.Add(L["PatientRoster:Err:BadAction", Sheet[Col.Action].Header, action]);
            }

            plan.Rows.Add(rosterRow);
        }
    }

    /// <summary>Chi nhánh by name or code; the clinic adds branches by hand before importing (BA).</summary>
    private async Task ResolveBranchesAsync(RosterPlan plan)
    {
        var branches = await _branchRepository.GetListAsync();
        var index = new Dictionary<string, ClinicBranch?>();
        foreach (var branch in branches)
        {
            foreach (var key in new[] { ExcelCells.Key(branch.Name), ExcelCells.Key(branch.Code) }.Distinct())
            {
                index[key] = index.TryGetValue(key, out var other) && other != branch ? null : branch;
            }
        }

        var header = Sheet[Col.Branch].Header;
        foreach (var row in plan.Rows)
        {
            var text = ExcelCells.Text(row.Row.Cell(plan.Columns[Col.Branch]));
            if (text == null)
            {
                row.Errors.Add(L["Taxonomy:Import:Err:Required", header]);
            }
            else if (!index.TryGetValue(ExcelCells.Key(text), out var branch))
            {
                row.Errors.Add(L["PatientRoster:Err:UnknownBranch", header, text]);
            }
            else if (branch == null)
            {
                row.Errors.Add(L["PatientRoster:Err:AmbiguousBranch", text]);
            }
            else
            {
                row.Branch = branch;
            }
        }
    }

    /// <summary>
    /// Mã khách hàng decides between add and edit. The code index is unique
    /// across branches and deleted records alike, so a code held anywhere else
    /// cannot be given to a new patient either.
    /// </summary>
    private async Task MatchCodesAsync(RosterPlan plan)
    {
        var codeHeader = Sheet[Col.Code].Header;
        var firstRow = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        foreach (var row in plan.Rows.Where(r => r.Code != null))
        {
            if (!firstRow.TryAdd(row.Code!, row.Status.Row))
            {
                row.Errors.Add(L["DataMigration:Err:DuplicateCode", firstRow[row.Code!]]);
            }
        }

        var stored = await LoadStoredCodesAsync(firstRow.Keys.ToList());
        var branchNames = await BranchNamesAsync();
        foreach (var row in plan.Rows)
        {
            if (row.Code == null)
            {
                if (row.Delete)
                {
                    row.Errors.Add(L["PatientRoster:Err:DeleteNeedsCode", codeHeader]);
                }

                continue;
            }

            if (!stored.TryGetValue(row.Code, out var patient))
            {
                if (row.Delete)
                {
                    row.Errors.Add(L["PatientRoster:Err:CodeNotFound", row.Code]);
                }

                continue;
            }

            if (patient.IsDeleted)
            {
                row.Errors.Add(L["PatientRoster:Err:CodeDeleted", row.Code]);
            }
            else if (row.Branch != null && patient.BranchId != row.Branch.Id)
            {
                row.Errors.Add(L["PatientRoster:Err:CodeOtherBranch", row.Code,
                    branchNames.GetValueOrDefault(patient.BranchId) ?? string.Empty]);
            }
            else
            {
                row.Stored = patient;
                row.Code = patient.Code;
                row.Status.PatientCode = patient.Code;
                if (!row.Delete)
                {
                    row.Status.Action = PatientRosterRowAction.Update;
                }
            }
        }
    }

    private async Task LoadExistingAsync(RosterPlan plan)
    {
        var ids = plan.Rows.Where(r => r.Stored != null).Select(r => r.Stored!.Id).Distinct().ToList();
        if (ids.Count == 0)
        {
            return;
        }

        using (_patientRepository.DisableTracking())
        {
            var query = await _patientRepository.WithDetailsAsync();
            plan.Existing = (await AsyncExecuter.ToListAsync(query.Where(p => ids.Contains(p.Id))))
                .ToDictionary(p => p.Id);
        }
    }

    private void ReadDraft(RosterRow row, Dictionary<string, int> columns, PatientRosterCatalogs catalogs, Patient? existing)
    {
        var (draft, errors) = MigrationRowReader.ReadPatient(
            L, Sheet, columns, row.Row, catalogs.For(row.Branch!.Id), ClinicToday, PatientReadOptions.Roster);
        row.Errors.AddRange(errors);
        if (draft == null)
        {
            return;
        }

        CheckRetired(row, draft, existing, catalogs);
        if (draft.Guardian?.Relation == GuardianRelation.Other && PrimaryGuardian(existing)?.Relation != GuardianRelation.Other)
        {
            // "Khác" needs a written relation and a proof the sheet cannot carry.
            row.Errors.Add(L["PatientRoster:Err:OtherRelationNew", Sheet[Col.GuardianRelation].Header]);
        }

        row.Draft = draft;
    }

    /// <summary>A retired name may stay where it is, but not be handed to anyone new.</summary>
    private void CheckRetired(RosterRow row, PatientDraft draft, Patient? existing, PatientRosterCatalogs catalogs)
    {
        var held = new HashSet<Guid>();
        if (existing != null)
        {
            held.UnionWith(existing.TagIds);
            held.UnionWith(existing.DiseaseHistoryEntryIds);
            foreach (var id in new[] { existing.OccupationEntryId, existing.SourceTaxonomyId, existing.SourceEntryId })
            {
                if (id is { } value)
                {
                    held.Add(value);
                }
            }
        }

        var picked = new List<(string Key, Guid? Id)>
        {
            (Col.Source, draft.SourceId),
            (Col.Channel, draft.ChannelId),
            (Col.Occupation, draft.OccupationId)
        };
        picked.AddRange(draft.TagIds.Select(id => (Col.Tags, (Guid?)id)));
        picked.AddRange(draft.DiseaseHistoryIds.Select(id => (Col.DiseaseHistory, (Guid?)id)));

        foreach (var (key, id) in picked)
        {
            if (id is { } value && catalogs.IsRetired(value) && !held.Contains(value))
            {
                row.Errors.Add(L["DataMigration:Err:NotInCatalog", Sheet[key].Header, catalogs.Name(value) ?? string.Empty]);
            }
        }
    }

    private async Task CheckDeletesAsync(RosterPlan plan)
    {
        var deletes = plan.Rows.Where(r => r.Delete && r.Stored != null).ToList();
        var worked = await _recordCheck.WithRecordsAsync(deletes.Select(r => r.Stored!.Id).ToList());
        foreach (var row in deletes.Where(r => worked.Contains(r.Stored!.Id)))
        {
            row.Errors.Add(L["PatientRoster:Err:HasRecords", row.Code!]);
        }
    }

    private sealed record Holder(Guid Id, Guid BranchId, string Value, string Code);

    /// <summary>
    /// One live record per branch for each of ID hệ thống, Số điện thoại and
    /// CCCD — the last two the hồ sơ dialog's own refusals
    /// (<c>Patient:0021</c>, <c>Patient:0012</c>), so a file cannot do what the
    /// dialog may not.
    /// </summary>
    private async Task CheckUniqueValuesAsync(RosterPlan plan)
    {
        var query = await _patientRepository.GetQueryableAsync();

        await CheckUniqueAsync(plan, Col.LegacyId, d => d.LegacyId, values => AsyncExecuter.ToListAsync(query
            .Where(p => p.LegacyId != null && values.Contains(p.LegacyId))
            .Select(p => new Holder(p.Id, p.BranchId, p.LegacyId!, p.PatientCode))));

        await CheckUniqueAsync(plan, Col.Phone, d => d.Phone, values => AsyncExecuter.ToListAsync(query
            .Where(p => p.Contact.PhoneNumber != null && values.Contains(p.Contact.PhoneNumber))
            .Select(p => new Holder(p.Id, p.BranchId, p.Contact.PhoneNumber!, p.PatientCode))));

        await CheckUniqueAsync(plan, Col.NationalId, d => d.NationalId, values => AsyncExecuter.ToListAsync(query
            .Where(p => p.NationalId != null && values.Contains(p.NationalId))
            .Select(p => new Holder(p.Id, p.BranchId, p.NationalId!, p.PatientCode))));
    }

    /// <summary>
    /// A value repeated in the file within one branch is an error, and so is
    /// one another record of the branch holds — unless the file deletes that
    /// record or moves it to another value (the commit clears the old values
    /// before writing the new ones).
    /// </summary>
    private async Task CheckUniqueAsync(
        RosterPlan plan,
        string column,
        Func<PatientDraft, string?> pick,
        Func<List<string>, Task<List<Holder>>> loadHolders)
    {
        var rows = plan.Rows.Where(r => r.Draft != null && pick(r.Draft) != null).ToList();
        var firstRow = new Dictionary<(Guid, string), int>();
        foreach (var row in rows)
        {
            var key = (row.Branch!.Id, pick(row.Draft!)!);
            if (!firstRow.TryAdd(key, row.Status.Row))
            {
                row.Errors.Add(L["PatientRoster:Err:DuplicateInFile", Sheet[column].Header, firstRow[key]]);
            }
        }

        var values = rows.Select(r => pick(r.Draft!)!).Distinct().ToList();
        if (values.Count == 0)
        {
            return;
        }

        var holders = await loadHolders(values);
        var deleted = plan.Rows.Where(r => r.Delete && r.Stored != null).Select(r => r.Stored!.Id).ToHashSet();
        var finalValue = plan.Rows
            .Where(r => r.IsUpdate && r.Draft != null)
            .ToDictionary(r => r.Stored!.Id, r => pick(r.Draft!));

        foreach (var row in rows)
        {
            var value = pick(row.Draft!)!;
            var holder = holders.FirstOrDefault(h =>
                h.BranchId == row.Branch!.Id
                && h.Value == value
                && h.Id != row.Stored?.Id
                && !deleted.Contains(h.Id)
                && !(finalValue.TryGetValue(h.Id, out var next) && next != h.Value));
            if (holder != null)
            {
                row.Errors.Add(L["PatientRoster:Err:ValueTaken", Sheet[column].Header, value, holder.Code]);
            }
        }
    }

    /// <summary>
    /// A blank Mã khách hàng gets the hồ sơ dialog's next number — DH + year +
    /// the branch's count this year, walking past every code already used
    /// anywhere, deleted records and this file included.
    /// </summary>
    private async Task AssignCodesAsync(RosterPlan plan)
    {
        var pending = plan.Rows.Where(r => r.IsCreate && r.Code == null && r.Errors.Count == 0).ToList();
        if (pending.Count == 0)
        {
            return;
        }

        var year = Clock.Now.Year;
        var prefix = $"DH{year % 100:D2}";
        var taken = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        using (_dataFilter.Disable<ISoftDelete>())
        {
            var all = await _patientRepository.GetQueryableAsync();
            taken.UnionWith(await AsyncExecuter.ToListAsync(all
                .Where(p => p.PatientCode.StartsWith(prefix))
                .Select(p => p.PatientCode)));
        }

        taken.UnionWith(plan.Rows.Where(r => r.Code != null).Select(r => r.Code!));

        var query = await _patientRepository.GetQueryableAsync();
        foreach (var branch in pending.GroupBy(r => r.Branch!.Id))
        {
            var branchId = branch.Key;
            var sequence = await AsyncExecuter.CountAsync(query
                .Where(p => p.BranchId == branchId && p.CreationTime.Year == year)) + 1;
            foreach (var row in branch)
            {
                string code;
                while (!taken.Add(code = $"{prefix}{sequence:D4}"))
                {
                    sequence++;
                }

                row.Code = code;
                row.Status.PatientCode = code;
                sequence++;
            }
        }
    }

    /// <summary>
    /// Every row through the domain's own guards. A new patient is built for
    /// real (the commit writes it); an edit is tried on a stand-in so the
    /// tracked record is not touched before the whole file is known good.
    /// </summary>
    private void Build(RosterPlan plan)
    {
        foreach (var row in plan.Rows.Where(r => r.Draft != null && r.Errors.Count == 0))
        {
            var draft = row.Draft!;
            if (row.IsCreate)
            {
                var guardians = MergeGuardians(null, draft.Guardian);
                var patient = Build(() => NewPatient(row.Branch!.Id, row.Code!, draft, guardians), row.Errors);
                if (patient != null)
                {
                    DateRecord(patient, draft);
                    plan.Creates.Add(patient);
                }
            }
            else
            {
                var existing = plan.Existing[row.Stored!.Id];
                var guardians = MergeGuardians(existing, draft.Guardian)
                    .Select(g => g with { Id = null })
                    .ToList();
                Build(() => NewPatient(row.Branch!.Id, row.Code!, draft, guardians), row.Errors);
            }
        }
    }

    private static PatientRosterResultDto Finish(RosterPlan plan)
    {
        var result = plan.Result;
        foreach (var row in plan.Rows)
        {
            if (row.Errors.Count > 0)
            {
                row.Status.Action = PatientRosterRowAction.Error;
            }

            result.Rows.Add(row.Status);
        }

        result.Created = result.Rows.Count(r => r.Action == PatientRosterRowAction.Create);
        result.Updated = result.Rows.Count(r => r.Action == PatientRosterRowAction.Update);
        result.Deleted = result.Rows.Count(r => r.Action == PatientRosterRowAction.Delete);
        result.ErrorCount = result.FileErrors.Count + result.Rows.Count(r => r.Action == PatientRosterRowAction.Error);
        return result;
    }

    // ------------------------------------------------------------------ commit

    /// <summary>
    /// Deletes and edits first, in the request's unit of work: values of ID hệ
    /// thống that change are cleared and saved before the new ones are written,
    /// so two records trading values never meet the unique index. New patients
    /// go last, through the bulk writer of the old-system import.
    /// </summary>
    private async Task CommitAsync(RosterPlan plan)
    {
        var edits = plan.Rows.Where(r => r.Stored != null).ToList();
        if (edits.Count > 0)
        {
            var ids = edits.Select(r => r.Stored!.Id).ToList();
            var query = await _patientRepository.WithDetailsAsync();
            var tracked = (await AsyncExecuter.ToListAsync(query.Where(p => ids.Contains(p.Id))))
                .ToDictionary(p => p.Id);

            foreach (var row in edits)
            {
                var patient = tracked[row.Stored!.Id];
                if (row.Delete)
                {
                    await _patientRepository.DeleteAsync(patient);
                }
                else if (patient.LegacyId != null && patient.LegacyId != row.Draft!.LegacyId)
                {
                    patient.SetLegacyId(null);
                }
            }

            await CurrentUnitOfWork!.SaveChangesAsync();

            foreach (var row in edits.Where(r => !r.Delete))
            {
                Apply(tracked[row.Stored!.Id], row.Draft!);
            }

            await CurrentUnitOfWork.SaveChangesAsync();
        }

        await _patientWriter.WriteAsync(plan.Creates, [], []);
    }

    private void Apply(Patient patient, PatientDraft draft)
    {
        patient.UpdateDemographics(draft.FirstName, draft.LastName, draft.DateOfBirth, draft.Gender);
        patient.UpdateContact(Contact(draft));
        patient.SetNationalId(draft.NationalId);
        ApplyDetails(patient, draft);

        // The export writes the record's date; the same date back keeps its time of day.
        if (draft.RegisteredOn is { } day && day != ClinicCalendar.DateOf(patient.RegisteredAt))
        {
            SetProperty(patient, nameof(Patient.RegisteredAt), ClinicCalendar.StartOfDay(day) + RecordOpened);
        }

        patient.SetRootExaminationReason(GuidGenerator.Create(), draft.ExaminationReason, patient.RegisteredAt);
        patient.SetGuardians(MergeGuardians(patient, draft.Guardian), consented: true, GuidGenerator.Create, Clock.Now);
    }

    // ---------------------------------------------------------------- building

    private Patient NewPatient(Guid branchId, string code, PatientDraft draft, IReadOnlyList<PatientGuardianData> guardians)
    {
        var patient = Patient.Register(
            GuidGenerator.Create(),
            code,
            draft.FirstName,
            draft.LastName,
            draft.DateOfBirth,
            draft.Gender,
            Contact(draft),
            branchId,
            draft.NationalId);

        ApplyDetails(patient, draft);
        if (guardians.Count > 0)
        {
            patient.SetGuardians(guardians, consented: true, GuidGenerator.Create, Clock.Now);
        }

        return patient;
    }

    private static ContactInfo Contact(PatientDraft draft) =>
        new(draft.Phone, draft.Email, draft.Address, draft.EmergencyName, draft.EmergencyPhone);

    private static void ApplyDetails(Patient patient, PatientDraft draft)
    {
        patient.SetSource(draft.SourceId, draft.ChannelId);
        patient.SetOccupation(draft.OccupationId, draft.OccupationOther);
        patient.SetInsuranceNumber(draft.InsuranceNumber);
        patient.SetResidence(draft.ProvinceCode, draft.WardCode);
        patient.SetOldAddress(draft.OldAddress);
        patient.SetNote(draft.Note);
        patient.SetLegacyId(draft.LegacyId);
        patient.SetTags(draft.TagIds);
        patient.SetDiseaseHistory(draft.DiseaseHistoryIds);
    }

    /// <summary>A new record opens on its Ngày tạo hồ sơ, else now; the Lý do đến khám is recorded with it.</summary>
    private void DateRecord(Patient patient, PatientDraft draft)
    {
        var registered = draft.RegisteredOn is { } day
            ? ClinicCalendar.StartOfDay(day) + RecordOpened
            : patient.RegisteredAt;

        SetProperty(patient, nameof(Patient.RegisteredAt), registered);
        SetProperty(patient, "CreationTime", registered.UtcDateTime);
        patient.SetRootExaminationReason(GuidGenerator.Create(), draft.ExaminationReason, registered);
    }

    private static PatientGuardian? PrimaryGuardian(Patient? patient) =>
        patient == null
            ? null
            : patient.Guardians.FirstOrDefault(g => g.IsPrimaryContact) ?? patient.Guardians.FirstOrDefault();

    /// <summary>
    /// The sheet carries one guardian — the primary contact. Its name, phone,
    /// CCCD and relation come from the file and everything else the dialog
    /// holds stays; blank cells remove it and the next guardian becomes the
    /// primary contact.
    /// </summary>
    private static List<PatientGuardianData> MergeGuardians(Patient? patient, GuardianDraft? fromFile)
    {
        var primary = PrimaryGuardian(patient);
        var others = patient == null
            ? []
            : patient.Guardians.Where(g => g != primary).Select(g => ToData(g, primary: false)).ToList();

        if (fromFile == null)
        {
            if (others.Count > 0)
            {
                others[0] = others[0] with { IsPrimaryContact = true };
            }

            return others;
        }

        var data = primary == null
            ? new PatientGuardianData(null, null, fromFile.Relation, null, null, null, null,
                fromFile.FullName, fromFile.Phone, fromFile.NationalId, null, null, null, null, null, null,
                SameAddressAsPatient: false, Address: null, IsPrimaryContact: true)
            : ToData(primary, primary: true) with
            {
                FullName = fromFile.FullName,
                Phone = fromFile.Phone,
                NationalId = fromFile.NationalId,
                Relation = fromFile.Relation
            };

        return [data, .. others];
    }

    private static PatientGuardianData ToData(PatientGuardian guardian, bool primary) =>
        new(guardian.Id, guardian.LinkedPatientId, guardian.Relation, guardian.RelationNote, guardian.ProofType,
            guardian.ProofBlobName, guardian.ProofFileName, guardian.FullName, guardian.Phone, guardian.NationalId,
            guardian.DateOfBirth, guardian.IdIssuedOn, guardian.IdIssuedPlace, guardian.Gender, guardian.Email,
            guardian.OccupationEntryId, guardian.SameAddressAsPatient, guardian.Address, primary);

    // ------------------------------------------------------------------ lookups

    private DateOnly ClinicToday =>
        ClinicCalendar.DateOf(new DateTimeOffset(DateTime.SpecifyKind(Clock.Now, DateTimeKind.Utc)));

    private async Task<PatientRosterCatalogs> LoadCatalogsAsync()
    {
        using (_dataFilter.Disable<ISoftDelete>())
        {
            var entries = await _catalogRepository.GetListAsync(e => CatalogGroups.Contains(e.Group));
            var sources = await _taxonomyRepository.GetListAsync(t => t.Group == TaxonomyGroups.Source);
            var tags = await _tagRepository.GetListAsync();
            return new PatientRosterCatalogs(entries, sources, tags);
        }
    }

    private async Task<Dictionary<Guid, string>> BranchNamesAsync()
    {
        using (_dataFilter.Disable<ISoftDelete>())
        {
            return (await _branchRepository.GetListAsync()).ToDictionary(b => b.Id, b => b.Name);
        }
    }

    /// <summary>The file's codes as stored — every branch and deleted records too, compared without case.</summary>
    private async Task<Dictionary<string, StoredPatient>> LoadStoredCodesAsync(List<string> codes)
    {
        var stored = new Dictionary<string, StoredPatient>(StringComparer.OrdinalIgnoreCase);
        if (codes.Count == 0)
        {
            return stored;
        }

        var keys = codes.Select(c => c.ToUpperInvariant()).Distinct().ToList();
        using (_dataFilter.Disable<ISoftDelete>())
        {
            var query = await _patientRepository.GetQueryableAsync();
            var rows = await AsyncExecuter.ToListAsync(query
                .Where(p => keys.Contains(p.PatientCode.ToUpper()))
                .Select(p => new { p.Id, p.PatientCode, p.BranchId, p.IsDeleted }));

            // A live record wins over a deleted one that once had the same code in another case.
            foreach (var row in rows.OrderBy(r => r.IsDeleted))
            {
                stored.TryAdd(row.PatientCode, new StoredPatient(row.Id, row.PatientCode, row.BranchId, row.IsDeleted));
            }
        }

        return stored;
    }

    // ------------------------------------------------------------------ reading

    private static XLWorkbook LoadWorkbook(ImportPatientRosterDto input)
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
    /// Column key → Excel column number from the header row of the first
    /// sheet. Columns the roster does not know are ignored; a missing required
    /// one — or a missing Action column — refuses the file.
    /// </summary>
    private Dictionary<string, int>? MapSheet(RosterPlan plan)
    {
        var sheet = plan.Workbook.Worksheets.FirstOrDefault();
        if (sheet == null)
        {
            plan.Result.FileErrors.Add(L["Taxonomy:Import:Err:MissingSheet", 1, Sheet.Name]);
            Finish(plan);
            return null;
        }

        plan.Sheet = sheet;
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
        foreach (var column in Sheet.Columns)
        {
            var names = new[] { column.Header }.Concat(Aliases.GetValueOrDefault(column.Key) ?? []);
            var found = names.Select(name => headers.GetValueOrDefault(ExcelCells.Key(name))).FirstOrDefault(i => i > 0);
            if (found > 0)
            {
                columns[column.Key] = found;
            }
            else if (column.Required || column.Key == Col.Action)
            {
                plan.Result.FileErrors.Add(L["Taxonomy:Import:Err:MissingColumn", sheet.Name, column.Header]);
            }
        }

        if (plan.Result.FileErrors.Count > 0)
        {
            Finish(plan);
            return null;
        }

        plan.Columns = columns;
        return columns;
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

    private static void SetProperty(object entity, string name, object? value) =>
        entity.GetType().GetProperty(name)?.GetSetMethod(nonPublic: true)?.Invoke(entity, [value]);

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
