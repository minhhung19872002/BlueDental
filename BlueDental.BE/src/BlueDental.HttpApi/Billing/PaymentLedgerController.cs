using System.Threading.Tasks;
using BlueDental.Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Volo.Abp;

namespace BlueDental.Billing;

[RemoteService]
[Authorize]
[Route("api/v1/app/payment-ledger")]
public sealed class PaymentLedgerController(IPaymentLedgerAppService service) : BlueDentalController
{
    [HttpGet]
    public Task<PaymentLedgerResultDto> GetListAsync([FromQuery] GetPaymentLedgerInput input) =>
        service.GetListAsync(input);

    [HttpGet("excel")]
    public async Task<IActionResult> ExportAsync([FromQuery] GetPaymentLedgerInput input) =>
        Excel(await service.ExportAsync(input), "thanh-toan");
}
