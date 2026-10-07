using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using BlueDental.Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Volo.Abp;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Content;

namespace BlueDental.Marketing;

/// <summary>Marketing → Ticket.</summary>
[RemoteService]
[Authorize]
[Route("api/v1/app/marketing-tickets")]
public sealed class MarketingTicketController(IMarketingTicketAppService service) : BlueDentalController
{
    [HttpGet]
    public Task<PagedResultDto<TicketDto>> GetListAsync([FromQuery] GetTicketListInput input) =>
        service.GetListAsync(input);

    [HttpGet("stats")]
    public Task<TicketStatsDto> GetStatsAsync([FromQuery] GetTicketListInput input) =>
        service.GetStatsAsync(input);

    [HttpGet("assignees")]
    public Task<ListResultDto<TicketAssigneeDto>> GetAssigneesAsync([FromQuery] Guid? clinicBranchId) =>
        service.GetAssigneesAsync(clinicBranchId);

    [HttpGet("{id:guid}")]
    public Task<TicketDto> GetAsync(Guid id) => service.GetAsync(id);

    [HttpGet("{id:guid}/activities")]
    public Task<List<TicketActivityDto>> GetActivitiesAsync(Guid id) => service.GetActivitiesAsync(id);

    [HttpPost]
    public Task<CreateTicketResultDto> CreateAsync([FromBody] CreateTicketDto input) =>
        service.CreateAsync(input);

    [HttpPut("{id:guid}")]
    public Task<TicketDto> UpdateAsync(Guid id, [FromBody] UpdateTicketDto input) =>
        service.UpdateAsync(id, input);

    [HttpPost("{id:guid}/contacts")]
    public Task<TicketDto> RecordContactAsync(Guid id, [FromBody] RecordTicketContactDto input) =>
        service.RecordContactAsync(id, input);

    [HttpPost("{id:guid}/claim")]
    public Task<TicketDto> ClaimAsync(Guid id) => service.ClaimAsync(id);

    [HttpPost("{id:guid}/assign")]
    public Task<TicketDto> AssignAsync(Guid id, [FromBody] AssignTicketDto input) =>
        service.AssignAsync(id, input);

    /// <summary>Chuyển Ticket (BA 8.3): the list filter in the body, with the staff to deal the matches to.</summary>
    [HttpPost("transfer")]
    public Task<TicketTransferResultDto> TransferAsync([FromBody] TransferTicketsDto input) =>
        service.TransferAsync(input);

    [HttpPost("{id:guid}/not-potential")]
    public Task<TicketDto> MarkNotPotentialAsync(Guid id, [FromBody] TicketReasonDto input) =>
        service.MarkNotPotentialAsync(id, input);

    [HttpPost("{id:guid}/reopen")]
    public Task<TicketDto> ReopenAsync(Guid id) => service.ReopenAsync(id);

    [HttpPost("{id:guid}/appointments")]
    public Task<TicketDto> BookAppointmentAsync(Guid id, [FromBody] BookTicketAppointmentDto input) =>
        service.BookAppointmentAsync(id, input);

    [HttpDelete("{id:guid}")]
    public Task DeleteAsync(Guid id, [FromBody] TicketReasonDto input) => service.DeleteAsync(id, input);

    [HttpPost("{id:guid}/restore")]
    public Task<TicketDto> RestoreAsync(Guid id) => service.RestoreAsync(id);
}

/// <summary>Marketing → Ticket File (BA 8.4).</summary>
[RemoteService]
[Authorize]
[Route("api/v1/app/marketing-ticket-files")]
public sealed class MarketingTicketFileController(IMarketingTicketFileAppService service) : BlueDentalController
{
    [HttpGet]
    public Task<PagedResultDto<TicketImportFileDto>> GetListAsync([FromQuery] GetTicketImportFileListInput input) =>
        service.GetListAsync(input);

    [HttpGet("{id:guid}")]
    public Task<TicketImportFileDto> GetAsync(Guid id) => service.GetAsync(id);

    [HttpGet("template")]
    public async Task<IActionResult> GetTemplateAsync() => Excel(await service.GetTemplateAsync(), "mau-ticket");

    /// <summary>The header row of an upload, for mapping a file of the clinic's own layout.</summary>
    [HttpPost("inspect")]
    [Consumes("multipart/form-data")]
    public Task<TicketFileHeadersDto> InspectAsync([FromForm] IFormFile file) =>
        service.InspectAsync(new InspectTicketFileDto { File = Upload(file) });

    [HttpPost]
    [Consumes("multipart/form-data")]
    public Task<TicketImportResultDto> ImportAsync([FromForm] TicketFileImportForm form) =>
        service.ImportAsync(new ImportTicketFileDto
        {
            File = Upload(form.File),
            ClinicBranchId = form.ClinicBranchId,
            Mapping = new TicketFileMappingDto
            {
                FullName = form.FullNameColumn,
                Phone = form.PhoneColumn,
                Email = form.EmailColumn,
                Note = form.NoteColumn,
            },
            SourceTaxonomyId = form.SourceTaxonomyId,
            SourceEntryId = form.SourceEntryId,
            TagIds = form.TagIds,
            AssigneeIds = form.AssigneeIds,
        });

    private static RemoteStreamContent Upload(IFormFile file) =>
        new(file.OpenReadStream(), file.FileName, file.ContentType, file.Length);
}

/// <summary>The import's multipart fields; repeated <c>tagIds</c> / <c>assigneeIds</c> fields bind to the lists.</summary>
public sealed class TicketFileImportForm
{
    public IFormFile File { get; set; } = default!;
    public Guid? ClinicBranchId { get; set; }
    public int? FullNameColumn { get; set; }
    public int? PhoneColumn { get; set; }
    public int? EmailColumn { get; set; }
    public int? NoteColumn { get; set; }
    public Guid? SourceTaxonomyId { get; set; }
    public Guid? SourceEntryId { get; set; }
    public List<Guid> TagIds { get; set; } = [];
    public List<Guid> AssigneeIds { get; set; } = [];
}

/// <summary>Marketing → Thẻ ticket.</summary>
[RemoteService]
[Authorize]
[Route("api/v1/app/marketing-ticket-tags")]
public sealed class MarketingTicketTagController(IMarketingTicketTagAppService service) : BlueDentalController
{
    [HttpGet]
    public Task<ListResultDto<TicketTagDto>> GetListAsync([FromQuery] GetTicketTagListInput input) =>
        service.GetListAsync(input);

    [HttpPost]
    public Task<TicketTagDto> CreateAsync([FromBody] CreateTicketTagDto input) => service.CreateAsync(input);

    [HttpPut("{id:guid}")]
    public Task<TicketTagDto> UpdateAsync(Guid id, [FromBody] UpdateTicketTagDto input) =>
        service.UpdateAsync(id, input);

    [HttpDelete("{id:guid}")]
    public Task DeleteAsync(Guid id) => service.DeleteAsync(id);
}
