using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Organizations;
using BlueDental.Permissions;
using ClosedXML.Excel;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Domain.Repositories;

namespace BlueDental.Marketing;

/// <summary>
/// Marketing → Ticket File (BA 8.4): "Quản lý ticket theo file, tình trạng xử lý
/// theo từng file import. Import theo template có sẵn hoặc template tùy chọn.
/// Chia dữ liệu cho nhóm hoặc cho nhân viên."
///
/// Like the Danh mục import, the whole file is checked first and only a file
/// with no error at all is written. A row whose phone already has an open
/// ticket is that lead coming in again, exactly as when typed in by hand.
/// </summary>
[Authorize(BlueDentalAbilityPermissions.MarketingTicket.Create)]
public class MarketingTicketFileAppService(
    IRepository<TicketImportFile, Guid> repository,
    IRepository<Ticket, Guid> ticketRepository,
    IRepository<TicketActivity, Guid> activityRepository,
    TicketReferenceChecker references,
    TicketMapper mapper,
    ICurrentClinicBranchResolver branchResolver,
    BranchAccessChecker branchAccess) : BlueDentalAppService, IMarketingTicketFileAppService
{
    private static readonly XLColor HeaderFill = XLColor.FromHtml("#EBF3FE");

    public async Task<PagedResultDto<TicketImportFileDto>> GetListAsync(GetTicketImportFileListInput input)
    {
        var branchFilter = await branchAccess.ResolveFilterAsync(input.ClinicBranchId);
        var query = await repository.GetQueryableAsync();
        if (branchFilter.Count > 0) query = query.Where(x => branchFilter.Contains(x.ClinicBranchId));
        var term = input.Filter?.Trim().ToLowerInvariant();
        if (!string.IsNullOrEmpty(term)) query = query.Where(x => x.FileName.ToLower().Contains(term));

        var totalCount = await AsyncExecuter.CountAsync(query);
        var page = await AsyncExecuter.ToListAsync(query
            .OrderByDescending(x => x.CreationTime)
            .Skip(input.SkipCount)
            .Take(input.MaxResultCount));
        return new PagedResultDto<TicketImportFileDto>(totalCount, await MapAsync(page));
    }

    public async Task<TicketImportFileDto> GetAsync(Guid id)
    {
        var file = await repository.GetAsync(id);
        await branchAccess.CheckAsync(file.ClinicBranchId);
        return (await MapAsync([file]))[0];
    }

    public Task<byte[]> GetTemplateAsync()
    {
        using var workbook = new XLWorkbook();
        var sheet = workbook.Worksheets.Add(L["Ticket:Import:Sheet"].Value);
        var columns = TemplateHeaders();
        for (var i = 0; i < columns.Count; i++)
        {
            var cell = sheet.Cell(TicketFileReader.HeaderRow, i + 1);
            cell.Value = columns[i].Required ? columns[i].Header + " *" : columns[i].Header;
            cell.Style.Font.Bold = true;
            cell.Style.Fill.BackgroundColor = HeaderFill;
            sheet.Column(i + 1).Width = 30;
        }

        sheet.SheetView.FreezeRows(TicketFileReader.HeaderRow);
        return Task.FromResult(TicketFileReader.Save(workbook));
    }

    public Task<TicketFileHeadersDto> InspectAsync(InspectTicketFileDto input)
    {
        using var workbook = TicketFileReader.Load(input.File);
        var sheet = TicketFileReader.FirstSheet(workbook);
        var headers = TicketFileReader.Headers(sheet);
        if (headers.Count == 0)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.MarketingTicket.ImportNoRows);
        }

        var byKey = new Dictionary<string, int>();
        for (var i = 0; i < headers.Count; i++)
        {
            byKey.TryAdd(TicketFileReader.HeaderKey(headers[i]), i + 1);
        }

        int? Column(string key) => byKey.TryGetValue(TicketFileReader.HeaderKey(L[key].Value), out var c) ? c : null;
        return Task.FromResult(new TicketFileHeadersDto
        {
            Headers = headers,
            RowCount = TicketFileReader.DataRows(sheet, [.. Enumerable.Range(1, headers.Count)]).Count(),
            Suggested = new TicketFileMappingDto
            {
                FullName = Column("Ticket:Import:Col:FullName"),
                Phone = Column("Ticket:Import:Col:Phone"),
                Email = Column("Ticket:Import:Col:Email"),
                Note = Column("Ticket:Import:Col:Note"),
            },
        });
    }

    public async Task<TicketImportResultDto> ImportAsync(ImportTicketFileDto input)
    {
        var branchId = await branchAccess.ResolveWriteTargetAsync(
            input.ClinicBranchId ?? Guid.Empty, branchResolver.GetRequiredClinicBranchId());
        var assignees = input.AssigneeIds.Where(x => x != Guid.Empty).Distinct().ToList();
        if (assignees.Count > 0)
        {
            await AuthorizationService.CheckAsync(BlueDentalAbilityPermissions.MarketingTicket.Transfer);
            foreach (var assigneeId in assignees)
            {
                await references.CheckAssigneeAsync(branchId, assigneeId);
            }
        }

        var processingDays = await references.ProcessingDaysAsync(branchId, input.TagIds);

        List<TicketFileRow> rows;
        using (var workbook = TicketFileReader.Load(input.File))
        {
            rows = TicketFileReader.Rows(TicketFileReader.FirstSheet(workbook), input.Mapping);
        }

        if (rows.Count == 0)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.MarketingTicket.ImportNoRows);
        }

        var (valid, errors) = Check(rows);
        var result = new TicketImportResultDto { RowCount = rows.Count, Errors = errors };
        if (errors.Count > 0)
        {
            return result;
        }

        var file = new TicketImportFile(GuidGenerator.Create(), branchId, input.File.FileName ?? L["Ticket:Import:Sheet"].Value,
            input.SourceTaxonomyId, input.SourceEntryId, input.TagIds, assignees);
        var phones = valid.Select(x => x.Phone).ToList();
        var open = await references.FindOpenByPhonesAsync(branchId, phones);
        var fresh = valid.Where(x => !open.ContainsKey(x.Phone)).ToList();
        var codes = await references.NextCodesAsync(branchId, fresh.Count);
        var patients = await references.FindPatientIdsAsync(branchId, fresh.Select(x => x.Phone).ToList());

        var tickets = new List<Ticket>();
        var activities = valid
            .Where(x => open.ContainsKey(x.Phone))
            .Select(x => open[x.Phone].Reoccur(GuidGenerator.Create(), x.Row.Note))
            .ToList();
        for (var i = 0; i < fresh.Count; i++)
        {
            var row = fresh[i].Row;
            var (ticket, created) = Ticket.Create(
                GuidGenerator.Create(), GuidGenerator.Create(), branchId, codes[i],
                new TicketDetails(row.FullName!, fresh[i].Phone, row.Email, row.Note, input.SourceTaxonomyId, input.SourceEntryId),
                TicketChannel.File, TicketDistribution.AssigneeAt(assignees, i), Clock.Now);
            ticket.FromFile(file.Id).SetTags(input.TagIds, processingDays);
            if (patients.TryGetValue(ticket.Phone, out var patientId))
            {
                ticket.LinkPatient(patientId, returningCustomer: true);
            }

            tickets.Add(ticket);
            activities.Add(created);
        }

        file.Record(rows.Count, tickets.Count, valid.Count - fresh.Count);
        await repository.InsertAsync(file);
        await ticketRepository.InsertManyAsync(tickets);
        await activityRepository.InsertManyAsync(activities, autoSave: true);

        result.Committed = true;
        result.CreatedCount = file.CreatedCount;
        result.ReoccurredCount = file.ReoccurredCount;
        result.File = (await MapAsync([file]))[0];
        return result;
    }

    /// <summary>Every row's errors, and the rows that passed with their normalized phone.</summary>
    private (List<(TicketFileRow Row, string Phone)> Valid, List<TicketImportRowErrorDto> Errors) Check(
        List<TicketFileRow> rows)
    {
        var valid = new List<(TicketFileRow, string)>();
        var errors = new List<TicketImportRowErrorDto>();
        var firstRowOfPhone = new Dictionary<string, int>();
        var email = new EmailAddressAttribute();

        foreach (var row in rows)
        {
            var messages = new List<string>();
            if (row.FullName is null) messages.Add(L["Ticket:Import:Err:NameRequired"]);
            else if (row.FullName.Length > Ticket.MaxFullNameLength) messages.Add(L["Ticket:Import:Err:NameTooLong", Ticket.MaxFullNameLength]);

            string? phone = null;
            if (row.Phone is null)
            {
                messages.Add(L["Ticket:Import:Err:PhoneRequired"]);
            }
            else
            {
                try
                {
                    phone = TicketPhone.Normalize(row.Phone);
                }
                catch (BusinessException)
                {
                    messages.Add(L["Ticket:Import:Err:PhoneInvalid", row.Phone]);
                }
            }

            if (phone is not null && !firstRowOfPhone.TryAdd(phone, row.Row))
            {
                messages.Add(L["Ticket:Import:Err:DuplicatePhone", firstRowOfPhone[phone]]);
            }

            if (row.Email is not null && (row.Email.Length > Ticket.MaxEmailLength || !email.IsValid(row.Email)))
            {
                messages.Add(L["Ticket:Import:Err:EmailInvalid", row.Email]);
            }

            if (row.Note?.Length > Ticket.MaxNoteLength) messages.Add(L["Ticket:Import:Err:NoteTooLong", Ticket.MaxNoteLength]);

            if (messages.Count > 0) errors.Add(new TicketImportRowErrorDto { Row = row.Row, Errors = messages });
            else valid.Add((row, phone!));
        }

        return (valid, errors);
    }

    private List<(string Header, bool Required)> TemplateHeaders() =>
    [
        (L["Ticket:Import:Col:FullName"].Value, true),
        (L["Ticket:Import:Col:Phone"].Value, true),
        (L["Ticket:Import:Col:Email"].Value, false),
        (L["Ticket:Import:Col:Note"].Value, false),
    ];

    /// <summary>The files with their tickets' state today, counted per status — deleted tickets left out.</summary>
    private async Task<List<TicketImportFileDto>> MapAsync(IReadOnlyCollection<TicketImportFile> files)
    {
        var ids = files.Select(f => f.Id).ToList();
        var tickets = (await ticketRepository.GetQueryableAsync()).Where(t => t.ImportFileId != null && ids.Contains(t.ImportFileId.Value));
        var byStatus = await AsyncExecuter.ToListAsync(tickets
            .GroupBy(t => new { t.ImportFileId, t.Status })
            .Select(g => new { g.Key.ImportFileId, g.Key.Status, Count = g.Count() }));
        var overdue = (await AsyncExecuter.ToListAsync(TicketListQuery.WhereOverdue(tickets, Clock.Now)
                .GroupBy(t => t.ImportFileId)
                .Select(g => new { ImportFileId = g.Key, Count = g.Count() })))
            .ToDictionary(x => x.ImportFileId!.Value, x => x.Count);
        var names = await mapper.UserNamesAsync(files.SelectMany(f => f.AssigneeIds.Cast<Guid?>().Append(f.CreatorId)));

        return files.Select(f =>
        {
            int Of(TicketStatus status) => byStatus.Where(x => x.ImportFileId == f.Id && x.Status == status).Sum(x => x.Count);
            return new TicketImportFileDto
            {
                Id = f.Id,
                ClinicBranchId = f.ClinicBranchId,
                FileName = f.FileName,
                RowCount = f.RowCount,
                CreatedCount = f.CreatedCount,
                ReoccurredCount = f.ReoccurredCount,
                SourceTaxonomyId = f.SourceTaxonomyId,
                SourceEntryId = f.SourceEntryId,
                TagIds = [.. f.TagIds],
                AssigneeNames = [.. f.AssigneeIds.Select(id => names.GetValueOrDefault(id)).OfType<string>()],
                Progress = new TicketStatsDto
                {
                    Total = byStatus.Where(x => x.ImportFileId == f.Id).Sum(x => x.Count),
                    New = Of(TicketStatus.New),
                    InCare = Of(TicketStatus.InCare),
                    Booked = Of(TicketStatus.Booked),
                    Arrived = Of(TicketStatus.Arrived),
                    NotPotential = Of(TicketStatus.NotPotential),
                    Overdue = overdue.GetValueOrDefault(f.Id),
                },
                CreatorId = f.CreatorId,
                CreatorName = f.CreatorId is { } creator ? names.GetValueOrDefault(creator) : null,
                CreationTime = f.CreationTime,
            };
        }).ToList();
    }
}
