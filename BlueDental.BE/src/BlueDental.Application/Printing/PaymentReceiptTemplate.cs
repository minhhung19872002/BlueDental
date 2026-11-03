using System.IO;
using System.Threading.Tasks;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Volo.Abp;
using Volo.Abp.DependencyInjection;

namespace BlueDental.Printing;

/// <summary>The PHIẾU THU .docx, shared by the printed receipt (F-56) and the exported one (P2610).</summary>
public class PaymentReceiptTemplate(
    IOptions<PaymentReceiptOptions> options,
    IHostEnvironment environment,
    ILogger<PaymentReceiptTemplate> logger) : ITransientDependency
{
    public async Task<byte[]> LoadAsync()
    {
        var configured = options.Value.TemplatePath;
        var path = Path.IsPathRooted(configured)
            ? configured
            : Path.Combine(environment.ContentRootPath, configured);

        if (!File.Exists(path))
        {
            logger.LogError("PHIẾU THU template not found at {Path}", path);
            throw new BusinessException(BlueDentalDomainErrorCodes.PaymentReceipt.TemplateMissing);
        }

        return await File.ReadAllBytesAsync(path);
    }
}
