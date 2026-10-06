using System.Threading.Tasks;
using Volo.Abp.Application.Services;

namespace BlueDental.Billing;

/// <summary>
/// Tài chính → Thanh toán: every payment receipt of the signed-in user's branch.
/// Read-only — a receipt is written, revised and cancelled on its plan's tab.
/// </summary>
public interface IPaymentLedgerAppService : IApplicationService
{
    Task<PaymentLedgerResultDto> GetListAsync(GetPaymentLedgerInput input);

    /// <summary>"Xuất Excel" on the Thanh toán screen.</summary>
    Task<byte[]> ExportAsync(GetPaymentLedgerInput input);
}
