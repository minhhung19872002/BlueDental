using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Organizations;
using BlueDental.Permissions;
using ClosedXML.Excel;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp;
using Volo.Abp.Data;
using Volo.Abp.Domain.Repositories;
using static BlueDental.Catalogs.Import.ImportLayout;

namespace BlueDental.Catalogs.Import;

/// <summary>
/// Excel import for Danh mục — BlueDental's own feature, the reference has none.
///
/// The whole file is read and checked first; only a file with no error at all
/// is written, in one unit of work, so a clinic never ends up with half a
/// catalog loaded. The preview step is the same pass with <c>DryRun</c> set.
/// </summary>
[Authorize(BlueDentalPermissions.Catalogs.Default)]
public class CatalogImportAppService : BlueDentalAppService, ICatalogImportAppService
{
    private static readonly XLColor HeaderFill = XLColor.FromHtml("#EBF3FE");
    private static readonly XLColor ErrorFill = XLColor.FromHtml("#FDE2E2");
    private const int HeaderRow = 1;

    private readonly IRepository<CatalogEntry, Guid> _repository;
    private readonly IRepository<Taxonomy, Guid> _taxonomyRepository;
    private readonly BranchAccessChecker _branchAccess;
    private readonly ICurrentClinicBranchResolver _branchResolver;
    private readonly IDataFilter<ISoftDelete> _softDeleteFilter;

    public CatalogImportAppService(
        IRepository<CatalogEntry, Guid> repository,
        IRepository<Taxonomy, Guid> taxonomyRepository,
        BranchAccessChecker branchAccess,
        ICurrentClinicBranchResolver branchResolver,
        IDataFilter<ISoftDelete> softDeleteFilter)
    {
        _repository = repository;
        _taxonomyRepository = taxonomyRepository;
        _branchAccess = branchAccess;
        _branchResolver = branchResolver;
        _softDeleteFilter = softDeleteFilter;
    }

    [Authorize(BlueDentalPermissions.Catalogs.View)]
    public Task<byte[]> GetTemplateAsync(string group)
    {
        var layout = RequireLayout(group);

        using var workbook = new XLWorkbook();
        WriteTemplateSheet(workbook, layout.Entries);
        if (layout.Lines != null)
        {
            WriteTemplateSheet(workbook, layout.Lines);
        }

        WriteGuideSheet(workbook, layout);
        return Task.FromResult(Save(workbook));
    }

    [Authorize(BlueDentalPermissions.Catalogs.Create)]
    public async Task<CatalogImportResultDto> ImportAsync(ImportCatalogEntriesDto input)
    {
        using var plan = await PlanAsync(input);
        plan.Result.DryRun = input.DryRun;

        if (input.DryRun || plan.Result.ErrorCount > 0)
        {
            return plan.Result;
        }

        await CommitAsync(plan);
        plan.Result.Committed = true;
        return plan.Result;
    }

    [Authorize(BlueDentalPermissions.Catalogs.Create)]
    public async Task<byte[]> GetErrorFileAsync(ImportCatalogEntriesDto input)
    {
        using var plan = await PlanAsync(input);
        var result = plan.Result;
        var errorHeader = L["Taxonomy:Import:ErrorColumn"].Value;

        // The rows are copied into a fresh workbook: saving the uploaded one keeps
        // its original <dimension>, and readers that trust it would not see the new column.
        using var output = new XLWorkbook();
        for (var i = 0; i < result.Sheets.Count; i++)
        {
            var sheet = plan.Workbook.Worksheet(i + 1).CopyTo(output, plan.Workbook.Worksheet(i + 1).Name);
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

    /// <summary>Everything the pass over the file found, kept until the workbook is no longer needed.</summary>
    private sealed class ImportPlan : IDisposable
    {
        public required ImportLayout Layout { get; init; }
        public required Guid BranchId { get; init; }
        public required XLWorkbook Workbook { get; init; }
        public CatalogImportResultDto Result { get; } = new();

        /// <summary>Groups named in the file but absent from the branch, in first-seen order.</summary>
        public List<string> NewGroupNames { get; } = [];

        /// <summary>Rows to create, with the group they go into (an existing id, or the key of a new group).</summary>
        public List<(EntryDraft Draft, Guid? TaxonomyId, string GroupKey, int Position)> Creates { get; } = [];

        /// <summary>
        /// Rows whose name matched an entry of the branch. Whether each one is a
        /// restore, an update or a skip is settled only after the lines sheet
        /// has been read, because a template's lines are part of the comparison.
        /// </summary>
        public List<(CatalogEntry Entry, EntryDraft Draft, CatalogImportRowDto Row)> Existing { get; } = [];

        /// <summary>Soft-deleted twins to bring back, with the file's values laid over them.</summary>
        public List<(CatalogEntry Entry, MergedEntry Merged)> Restores { get; } = [];

        /// <summary>Active twins the file changes something about.</summary>
        public List<(CatalogEntry Entry, MergedEntry Merged)> Updates { get; } = [];

        /// <summary>Medicine lines per template name key, resolved to medicine ids.</summary>
        public Dictionary<string, List<PrescriptionTemplateLineDto>> Lines { get; } = new();

        /// <summary>The container group of a flat catalog, when the branch already has one.</summary>
        public Taxonomy? FlatContainer { get; set; }

        public void Dispose() => Workbook.Dispose();
    }

    private async Task<ImportPlan> PlanAsync(ImportCatalogEntriesDto input)
    {
        var layout = RequireLayout(input.Group);
        var branchId = await _branchAccess.ResolveWriteTargetAsync(
            input.ClinicBranchId ?? Guid.Empty,
            _branchResolver.GetRequiredClinicBranchId());

        var workbook = LoadWorkbook(input);
        var plan = new ImportPlan { Layout = layout, BranchId = branchId, Workbook = workbook };
        var result = plan.Result;

        try
        {
            var entrySheet = MapSheet(plan, 1, layout.Entries);
            var lineSheet = layout.Lines == null ? null : MapSheet(plan, 2, layout.Lines);

            if (result.FileErrors.Count > 0)
            {
                result.ErrorCount = result.FileErrors.Count;
                return plan;
            }

            await PlanEntriesAsync(plan, entrySheet!.Value);
            if (lineSheet != null)
            {
                await PlanLinesAsync(plan, lineSheet.Value);
            }

            await ResolveExistingAsync(plan);

            result.ErrorCount = result.FileErrors.Count
                + result.Sheets.Sum(s => s.Rows.Count(r => r.Action == CatalogImportRowAction.Error));
            return plan;
        }
        catch
        {
            plan.Dispose();
            throw;
        }
    }

    private static XLWorkbook LoadWorkbook(ImportCatalogEntriesDto input)
    {
        try
        {
            // Copied out of the upload so the same bytes can be saved back with
            // the error column appended.
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
        ImportPlan plan, int position, ImportSheetLayout layout)
    {
        var result = plan.Result;
        if (plan.Workbook.Worksheets.Count < position)
        {
            result.FileErrors.Add(L["Taxonomy:Import:Err:MissingSheet", position, layout.Name]);
            return null;
        }

        var sheet = plan.Workbook.Worksheet(position);
        var headers = new Dictionary<string, int>();
        var lastColumn = sheet.Row(HeaderRow).LastCellUsed()?.Address.ColumnNumber ?? 0;
        for (var column = 1; column <= lastColumn; column++)
        {
            // The template marks required headers with a trailing "*"; it is
            // not part of the name.
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

        result.Sheets.Add(new CatalogImportSheetDto
        {
            Name = sheet.Name,
            Columns = layout.Columns.Select(c => c.Header).ToList()
        });

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

    private async Task PlanEntriesAsync(ImportPlan plan, (IXLWorksheet Sheet, Dictionary<string, int> Columns) mapped)
    {
        var layout = plan.Layout;
        var grouped = layout.Entries.Has(Col.Group);
        var sheetDto = plan.Result.Sheets[0];

        var taxonomies = await LoadTaxonomiesAsync(plan.BranchId, layout.Group);
        var taxonomyByName = new Dictionary<string, Taxonomy>();
        foreach (var taxonomy in taxonomies)
        {
            taxonomyByName.TryAdd(ExcelCells.Key(taxonomy.Name), taxonomy);
        }

        if (!grouped)
        {
            plan.FlatContainer = taxonomies.FirstOrDefault();
        }

        // Soft-deleted rows included: a name that matches one of them is
        // brought back rather than created twice. Children come along, so a
        // matched row can be compared field by field with the file.
        var existing = await LoadEntriesAsync(plan.BranchId, layout.Group);
        var existingByKey = new Dictionary<(string Group, string Name), CatalogEntry>();
        foreach (var entry in existing.OrderBy(e => e.IsDeleted).ThenBy(e => e.SortOrder))
        {
            var groupKey = grouped ? entry.TaxonomyId.ToString() : string.Empty;
            existingByKey.TryAdd((groupKey, ExcelCells.Key(entry.Name)), entry);
        }

        var seen = new Dictionary<(string Group, string Name), int>();
        var position = 0;

        foreach (var row in DataRows(mapped.Sheet, mapped.Columns))
        {
            position++;
            var (draft, errors) = ImportRowReader.ReadEntry(L, layout, mapped.Columns, row);
            var rowDto = new CatalogImportRowDto
            {
                Row = row.RowNumber(),
                Values = ImportRowReader.Values(layout.Entries, mapped.Columns, row),
                Errors = errors
            };
            sheetDto.Rows.Add(rowDto);

            if (errors.Count > 0)
            {
                rowDto.Action = CatalogImportRowAction.Error;
                continue;
            }

            // The group is keyed by its id when it exists and by its name when
            // the file introduces it, so two rows naming a new group meet.
            Guid? taxonomyId = null;
            var groupKey = string.Empty;
            if (grouped)
            {
                var nameKey = ExcelCells.Key(draft.GroupName);
                if (taxonomyByName.TryGetValue(nameKey, out var taxonomy))
                {
                    taxonomyId = taxonomy.Id;
                    groupKey = taxonomy.Id.ToString();
                }
                else
                {
                    groupKey = "new:" + nameKey;
                    if (!plan.NewGroupNames.Any(n => ExcelCells.Key(n) == nameKey))
                    {
                        plan.NewGroupNames.Add(draft.GroupName!);
                    }
                }
            }
            else if (plan.FlatContainer != null)
            {
                taxonomyId = plan.FlatContainer.Id;
            }

            var key = (groupKey, ExcelCells.Key(draft.Name));
            if (seen.TryGetValue(key, out var firstRow))
            {
                rowDto.Action = CatalogImportRowAction.Error;
                errors.Add(L["Taxonomy:Import:Err:DuplicateInFile", firstRow]);
                continue;
            }

            seen[key] = row.RowNumber();

            if (existingByKey.TryGetValue(key, out var match))
            {
                // Provisional: ResolveExistingAsync settles restore / update / skip.
                rowDto.Action = match.IsDeleted ? CatalogImportRowAction.Restore : CatalogImportRowAction.Skip;
                plan.Existing.Add((match, draft, rowDto));
                continue;
            }

            rowDto.Action = CatalogImportRowAction.Create;
            plan.Creates.Add((draft, taxonomyId, groupKey, position));
        }

        var result = plan.Result;
        result.TotalRows = sheetDto.Rows.Count;
        result.CreateCount = plan.Creates.Count;
        result.NewGroups = plan.NewGroupNames.ToList();

        if (result.TotalRows == 0)
        {
            result.FileErrors.Add(L["Taxonomy:Import:Err:NoRows", mapped.Sheet.Name]);
        }
    }

    private async Task PlanLinesAsync(ImportPlan plan, (IXLWorksheet Sheet, Dictionary<string, int> Columns) mapped)
    {
        var layout = plan.Layout.Lines!;
        var sheetDto = plan.Result.Sheets[1];

        // Templates the file creates, updates or restores. A template that
        // already exists takes the file's lines as its new list when the sheet
        // names it; when the sheet does not, its stored lines stay.
        var templateKeys = new HashSet<string>(plan.Result.Sheets[0].Rows
            .Where(r => r.Action != CatalogImportRowAction.Error)
            .Select(r => ExcelCells.Key(r.Values[0])));

        var medicines = await LoadMedicinesAsync(plan.BranchId);

        foreach (var row in DataRows(mapped.Sheet, mapped.Columns))
        {
            var (draft, errors) = ImportRowReader.ReadLine(L, layout, mapped.Columns, row);
            var rowDto = new CatalogImportRowDto
            {
                Row = row.RowNumber(),
                Values = ImportRowReader.Values(layout, mapped.Columns, row),
                Errors = errors
            };
            sheetDto.Rows.Add(rowDto);

            var templateKey = ExcelCells.Key(draft.TemplateName);
            if (draft.TemplateName.Length > 0 && !templateKeys.Contains(templateKey))
            {
                errors.Add(L["Taxonomy:Import:Err:TemplateNotFound", draft.TemplateName]);
            }

            Guid medicineId = default;
            if (draft.MedicineName.Length > 0
                && !medicines.TryGetValue(ExcelCells.Key(draft.MedicineName), out medicineId))
            {
                errors.Add(L["Taxonomy:Import:Err:MedicineNotFound", draft.MedicineName]);
            }

            if (errors.Count > 0)
            {
                rowDto.Action = CatalogImportRowAction.Error;
                continue;
            }

            rowDto.Action = CatalogImportRowAction.Line;
            if (!plan.Lines.TryGetValue(templateKey, out var lines))
            {
                plan.Lines[templateKey] = lines = [];
            }

            lines.Add(new PrescriptionTemplateLineDto
            {
                MedicineEntryId = medicineId,
                TimesPerDay = draft.TimesPerDay,
                AmountPerTime = draft.AmountPerTime,
                Days = draft.Days,
                Usage = draft.Usage,
                OtherUsage = draft.OtherUsage
            });
        }
    }

    /// <summary>
    /// Rows that matched an entry: a soft-deleted twin is restored, an active
    /// one is updated when the file changes any of its fields and skipped when
    /// it changes none. Updating is editing, so without the tab's edit right an
    /// update row is an error — and the whole file is refused, as with any error.
    /// </summary>
    private async Task ResolveExistingAsync(ImportPlan plan)
    {
        var canEdit = plan.Existing.Count == 0
            || await AuthorizationService.IsGrantedAsync(BlueDentalPermissions.Catalogs.Edit);

        foreach (var (entry, draft, row) in plan.Existing)
        {
            plan.Lines.TryGetValue(ExcelCells.Key(draft.Name), out var lines);
            var merged = EntryMerge.Merge(entry, draft, lines);

            if (entry.IsDeleted)
            {
                row.Action = CatalogImportRowAction.Restore;
                plan.Restores.Add((entry, merged));
            }
            else if (!EntryMerge.Differs(entry, merged))
            {
                row.Action = CatalogImportRowAction.Skip;
            }
            else if (!canEdit)
            {
                row.Action = CatalogImportRowAction.Error;
                row.Errors.Add(L["Taxonomy:Import:Err:NoUpdatePermission"]);
            }
            else
            {
                row.Action = CatalogImportRowAction.Update;
                plan.Updates.Add((entry, merged));
            }
        }

        var result = plan.Result;
        result.RestoreCount = plan.Restores.Count;
        result.UpdateCount = plan.Updates.Count;
        result.SkipCount = plan.Existing.Count(e => e.Row.Action == CatalogImportRowAction.Skip);
    }

    private async Task<List<Taxonomy>> LoadTaxonomiesAsync(Guid branchId, string group)
    {
        var query = await _taxonomyRepository.GetQueryableAsync();
        return query
            .Where(t => t.ClinicBranchId == branchId && t.Group == group)
            .OrderBy(t => t.SortOrder)
            .ThenBy(t => t.CreationTime)
            .ToList();
    }

    private async Task<List<CatalogEntry>> LoadEntriesAsync(Guid branchId, string group)
    {
        using var _ = _softDeleteFilter.Disable();
        var query = await _repository.WithDetailsAsync();
        return query
            .Where(e => e.ClinicBranchId == branchId && e.Group == group)
            .ToList();
    }

    /// <summary>Active medicines of the branch by name key; the first by priority wins a shared name.</summary>
    private async Task<Dictionary<string, Guid>> LoadMedicinesAsync(Guid branchId)
    {
        var query = await _repository.GetQueryableAsync();
        var medicines = query
            .Where(e => e.ClinicBranchId == branchId && e.Group == TaxonomyGroups.MedicationType && e.IsActive)
            .OrderBy(e => e.SortOrder)
            .ThenByDescending(e => e.CreationTime)
            .Select(e => new { e.Id, e.Name })
            .ToList();

        var byName = new Dictionary<string, Guid>();
        foreach (var medicine in medicines)
        {
            byName.TryAdd(ExcelCells.Key(medicine.Name), medicine.Id);
        }

        return byName;
    }

    // ------------------------------------------------------------------ commit

    private async Task CommitAsync(ImportPlan plan)
    {
        var group = plan.Layout.Group;
        var groupIds = new Dictionary<string, Guid>();

        var newGroups = new List<Taxonomy>();
        var names = plan.NewGroupNames.ToList();
        if (!plan.Layout.Entries.Has(Col.Group) && plan.FlatContainer == null && plan.Creates.Count > 0)
        {
            // A flat catalog keeps its entries under one container group the
            // screen never shows; the first import into an empty branch makes it.
            names.Add(L["Taxonomy:Tab:PrescriptionTemplate"].Value);
        }

        if (names.Count > 0)
        {
            var taxonomyQuery = await _taxonomyRepository.GetQueryableAsync();
            var offset = taxonomyQuery.Count(t => t.ClinicBranchId == plan.BranchId && t.Group == group);
            for (var i = 0; i < names.Count; i++)
            {
                var taxonomy = Taxonomy.Create(GuidGenerator.Create(), plan.BranchId, group, names[i], sortOrder: offset + i);
                newGroups.Add(taxonomy);
                groupIds["new:" + ExcelCells.Key(names[i])] = taxonomy.Id;
            }

            await _taxonomyRepository.InsertManyAsync(newGroups, autoSave: true);
        }

        var flatContainerId = plan.FlatContainer?.Id ?? newGroups.FirstOrDefault()?.Id;

        // A service row with no code gets one drawn, as the dialog's do.
        var takenCodes = group == TaxonomyGroups.CareService && plan.Creates.Any(c => string.IsNullOrWhiteSpace(c.Draft.Code))
            ? await GetServiceCodesAsync(plan.BranchId, plan.Creates.Select(c => c.Draft.Code))
            : null;

        var entries = new List<CatalogEntry>(plan.Creates.Count);
        foreach (var (draft, taxonomyId, groupKey, position) in plan.Creates)
        {
            var targetGroup = taxonomyId
                ?? (groupIds.TryGetValue(groupKey, out var created) ? created : flatContainerId)
                ?? throw new BusinessException(BlueDentalDomainErrorCodes.Catalogs.TaxonomyNotFound);

            var entry = CatalogEntry.Create(
                GuidGenerator.Create(),
                plan.BranchId,
                targetGroup,
                group,
                draft.Name,
                takenCodes != null && string.IsNullOrWhiteSpace(draft.Code) ? ServiceCode.Next(takenCodes) : draft.Code,
                draft.Price,
                draft.Content,
                draft.Description,
                // A blank priority takes the row's place in the file, so the
                // catalog reads in the order the clinic wrote it.
                draft.SortOrder ?? position);

            plan.Lines.TryGetValue(ExcelCells.Key(draft.Name), out var lines);
            CatalogEntryParts.Apply(entry, GuidGenerator, draft.DetailName, draft.Note, draft.Unit,
                draft.ServiceConfig, draft.Medicine, draft.Stages, lines);
            entries.Add(entry);
        }

        if (entries.Count > 0)
        {
            await _repository.InsertManyAsync(entries, autoSave: true);
        }

        if (plan.Updates.Count > 0)
        {
            foreach (var (entry, merged) in plan.Updates)
            {
                EntryMerge.Apply(entry, merged, GuidGenerator);
            }

            await _repository.UpdateManyAsync(plan.Updates.Select(u => u.Entry).ToList(), autoSave: true);
        }

        if (plan.Restores.Count > 0)
        {
            using var _ = _softDeleteFilter.Disable();
            foreach (var (entry, merged) in plan.Restores)
            {
                entry.SetDeleted(false);
                EntryMerge.Apply(entry, merged, GuidGenerator);
            }

            await _repository.UpdateManyAsync(plan.Restores.Select(r => r.Entry).ToList(), autoSave: true);
        }
    }

    /// <summary>The branch's service codes, deleted rows and the file's own codes included.</summary>
    private async Task<HashSet<string>> GetServiceCodesAsync(Guid branchId, IEnumerable<string?> fileCodes)
    {
        using var _ = _softDeleteFilter.Disable();
        var query = await _repository.GetQueryableAsync();
        var stored = query
            .Where(x => x.ClinicBranchId == branchId && x.Group == TaxonomyGroups.CareService)
            .Select(x => x.Code)
            .ToList();

        return ServiceCode.NewTakenSet(stored.Concat(fileCodes));
    }

    // ---------------------------------------------------------------- template

    private static void WriteTemplateSheet(XLWorkbook workbook, ImportSheetLayout layout)
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
        }

        sheet.SheetView.FreezeRows(HeaderRow);
    }

    private void WriteGuideSheet(XLWorkbook workbook, ImportLayout layout)
    {
        var sheet = workbook.Worksheets.Add(SafeSheetName(L["Taxonomy:Import:GuideSheet"].Value));
        string[] headers =
        [
            L["Taxonomy:Import:GuideCol:Sheet"].Value,
            L["Taxonomy:Import:GuideCol:Column"].Value,
            L["Taxonomy:Import:GuideCol:Required"].Value,
            L["Taxonomy:Import:GuideCol:Note"].Value
        ];
        double[] widths = [22, 36, 12, 90];

        for (var i = 0; i < headers.Length; i++)
        {
            var cell = sheet.Cell(HeaderRow, i + 1);
            cell.Value = headers[i];
            cell.Style.Font.Bold = true;
            cell.Style.Fill.BackgroundColor = HeaderFill;
            sheet.Column(i + 1).Width = widths[i];
        }

        var row = HeaderRow;
        sheet.Cell(++row, 1).Value = L["Taxonomy:Import:GuideIntro"].Value;
        sheet.Range(row, 1, row, headers.Length).Merge();
        sheet.Cell(row, 1).Style.Alignment.WrapText = true;

        var yes = L["Common:Yes"].Value;
        var no = L["Common:No"].Value;
        foreach (var sheetLayout in new[] { layout.Entries, layout.Lines }.Where(s => s != null))
        {
            foreach (var column in sheetLayout!.Columns)
            {
                row++;
                sheet.Cell(row, 1).Value = sheetLayout.Name;
                sheet.Cell(row, 2).Value = column.Header;
                sheet.Cell(row, 3).Value = column.Required ? yes : no;
                sheet.Cell(row, 4).Value = L[column.HintKey].Value;
            }
        }
    }

    // ------------------------------------------------------------------ helpers

    private static ImportLayout RequireLayout(string group) =>
        ImportLayout.For(group ?? string.Empty)
        ?? throw new BusinessException(BlueDentalDomainErrorCodes.Catalogs.ImportNotSupported);

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
