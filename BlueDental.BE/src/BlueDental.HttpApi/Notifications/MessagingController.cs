using System.Threading.Tasks;
using BlueDental.Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Volo.Abp;
using Volo.Abp.Application.Dtos;

namespace BlueDental.Notifications;

/// <summary>
/// The "Lưu tin nhắn" dialog lists — route names mirror the reference's
/// <c>/sender-sms-templates</c> and <c>/clinic-configure</c>.
/// </summary>
[RemoteService]
[Authorize]
[Route("api/v1/app")]
public sealed class MessagingController(IMessagingAppService service) : BlueDentalController
{
    [HttpGet("sender-sms-templates")]
    public Task<PagedResultDto<SmsTemplateDto>> GetSmsTemplatesAsync(
        [FromQuery] GetSmsTemplatesInput input) =>
        service.GetSmsTemplatesAsync(input);

    [HttpGet("clinic-configure")]
    public Task<PagedResultDto<ClinicConfigureDto>> GetClinicConfiguresAsync(
        [FromQuery] GetClinicConfiguresInput input) =>
        service.GetClinicConfiguresAsync(input);
}
