using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;

namespace BlueDental.Marketing;

/// <summary>Marketing → Ticket (F-55). See docs/clone/pages/marketing-ticket.md.</summary>
public interface IMarketingTicketAppService : IApplicationService
{
    Task<PagedResultDto<TicketDto>> GetListAsync(GetTicketListInput input);

    Task<TicketStatsDto> GetStatsAsync(GetTicketListInput input);

    Task<TicketDto> GetAsync(Guid id);

    Task<List<TicketActivityDto>> GetActivitiesAsync(Guid id);

    /// <summary>
    /// The branch's active staff, for Người phụ trách. Its own list rather than
    /// /staff, which needs staff.read — a marketing account seldom has it.
    /// </summary>
    Task<ListResultDto<TicketAssigneeDto>> GetAssigneesAsync(Guid? clinicBranchId);

    Task<CreateTicketResultDto> CreateAsync(CreateTicketDto input);

    Task<TicketDto> UpdateAsync(Guid id, UpdateTicketDto input);

    Task<TicketDto> RecordContactAsync(Guid id, RecordTicketContactDto input);

    /// <summary>Nhận xử lý: the caller takes a pool ticket.</summary>
    Task<TicketDto> ClaimAsync(Guid id);

    Task<TicketDto> AssignAsync(Guid id, AssignTicketDto input);

    /// <summary>Chuyển Ticket (BA 8.3): every ticket the filter matches, dealt to the chosen staff in turn.</summary>
    Task<TicketTransferResultDto> TransferAsync(TransferTicketsDto input);

    Task<TicketDto> MarkNotPotentialAsync(Guid id, TicketReasonDto input);

    Task<TicketDto> ReopenAsync(Guid id);

    Task<TicketDto> BookAppointmentAsync(Guid id, BookTicketAppointmentDto input);

    Task DeleteAsync(Guid id, TicketReasonDto input);

    Task<TicketDto> RestoreAsync(Guid id);
}

/// <summary>Marketing → Ticket File (BA 8.4).</summary>
public interface IMarketingTicketFileAppService : IApplicationService
{
    Task<PagedResultDto<TicketImportFileDto>> GetListAsync(GetTicketImportFileListInput input);

    Task<TicketImportFileDto> GetAsync(Guid id);

    /// <summary>The ready-made template: the header row the importer maps by itself.</summary>
    Task<byte[]> GetTemplateAsync();

    /// <summary>Reads the header row, so the caller can map a file of its own layout.</summary>
    Task<TicketFileHeadersDto> InspectAsync(InspectTicketFileDto input);

    /// <summary>Checks every row first; writes only a file with no error at all.</summary>
    Task<TicketImportResultDto> ImportAsync(ImportTicketFileDto input);
}

public interface IMarketingTicketTagAppService : IApplicationService
{
    Task<ListResultDto<TicketTagDto>> GetListAsync(GetTicketTagListInput input);

    Task<TicketTagDto> CreateAsync(CreateTicketTagDto input);

    Task<TicketTagDto> UpdateAsync(Guid id, UpdateTicketTagDto input);

    Task DeleteAsync(Guid id);
}
