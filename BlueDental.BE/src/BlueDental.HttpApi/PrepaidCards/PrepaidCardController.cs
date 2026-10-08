using System;
using System.Threading.Tasks;
using BlueDental.Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Volo.Abp;
using Volo.Abp.Application.Dtos;

namespace BlueDental.PrepaidCards;

/// <summary>Thẻ trả trước (function list cụm 3). BlueDental-local.</summary>
[RemoteService]
[Authorize]
[Route("api/v1/app/prepaid-cards")]
public sealed class PrepaidCardController(IPrepaidCardAppService service) : BlueDentalController
{
    [HttpGet("types")]
    public Task<ListResultDto<PrepaidCardTypeDto>> GetTypeListAsync([FromQuery] GetPrepaidCardTypeListInput input) =>
        service.GetTypeListAsync(input);

    [HttpPost("types")]
    public Task<PrepaidCardTypeDto> CreateTypeAsync([FromBody] SavePrepaidCardTypeDto input) =>
        service.CreateTypeAsync(input);

    [HttpPut("types/{id:guid}")]
    public Task<PrepaidCardTypeDto> UpdateTypeAsync(Guid id, [FromBody] SavePrepaidCardTypeDto input) =>
        service.UpdateTypeAsync(id, input);

    [HttpDelete("types/{id:guid}")]
    public Task DeleteTypeAsync(Guid id) => service.DeleteTypeAsync(id);

    [HttpGet]
    public Task<PagedResultDto<PrepaidCardDto>> GetListAsync([FromQuery] GetPrepaidCardListInput input) =>
        service.GetListAsync(input);

    [HttpGet("summary")]
    public Task<PrepaidCardSummaryDto> GetSummaryAsync([FromQuery] GetPrepaidCardListInput input) =>
        service.GetSummaryAsync(input);

    [HttpGet("usable")]
    public Task<ListResultDto<PrepaidCardDto>> GetUsableAsync([FromQuery] Guid patientId) =>
        service.GetUsableAsync(patientId);

    [HttpGet("{id:guid}")]
    public Task<PrepaidCardDetailDto> GetAsync(Guid id) => service.GetAsync(id);

    [HttpPost]
    public Task<PrepaidCardDetailDto> SellAsync([FromBody] SellPrepaidCardDto input) => service.SellAsync(input);

    [HttpPost("{id:guid}/topup")]
    public Task<PrepaidCardDetailDto> TopupAsync(Guid id, [FromBody] TopupPrepaidCardDto input) =>
        service.TopupAsync(id, input);

    [HttpPut("{id:guid}/members")]
    public Task<PrepaidCardDetailDto> SetMembersAsync(Guid id, [FromBody] SetPrepaidCardMembersDto input) =>
        service.SetMembersAsync(id, input);

    [HttpPost("{id:guid}/lock")]
    public Task<PrepaidCardDetailDto> LockAsync(Guid id) => service.LockAsync(id);

    [HttpPost("{id:guid}/unlock")]
    public Task<PrepaidCardDetailDto> UnlockAsync(Guid id) => service.UnlockAsync(id);
}
