using System;
using System.ComponentModel.DataAnnotations;
using System.Threading.Tasks;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;
using Volo.Abp.Content;

namespace BlueDental.Catalogs;

public class PaymentAccountDto : FullAuditedEntityDto<Guid>
{
    public Guid ClinicBranchId { get; set; }
    public PaymentAccountKind Kind { get; set; }
    public string HolderName { get; set; } = default!;
    public string? PhoneNumber { get; set; }
    public string? BankName { get; set; }
    public string? AccountNumber { get; set; }
    public bool IsActive { get; set; }

    public bool HasQrImage { get; set; }

    /// <summary>Original file name of the QR image, shown next to the preview.</summary>
    public string? QrImageFileName { get; set; }

    /// <summary>
    /// Where the browser fetches the QR bytes from, or null when the account has
    /// none. Carries a version so a replaced QR is not served from cache.
    /// </summary>
    public string? QrImageUrl { get; set; }
}

public class CreatePaymentAccountDto
{
    public Guid ClinicBranchId { get; set; }

    public PaymentAccountKind Kind { get; set; }

    [Required]
    [StringLength(200)]
    public string HolderName { get; set; } = default!;

    /// <summary>Required for <see cref="PaymentAccountKind.MoMo"/>.</summary>
    [StringLength(30)]
    public string? PhoneNumber { get; set; }

    /// <summary>Required for <see cref="PaymentAccountKind.Bank"/>.</summary>
    [StringLength(200)]
    public string? BankName { get; set; }

    /// <summary>Required for <see cref="PaymentAccountKind.Bank"/>.</summary>
    [StringLength(50)]
    public string? AccountNumber { get; set; }
}

public class UpdatePaymentAccountDto
{
    [Required]
    [StringLength(200)]
    public string HolderName { get; set; } = default!;

    [StringLength(30)]
    public string? PhoneNumber { get; set; }

    [StringLength(200)]
    public string? BankName { get; set; }

    [StringLength(50)]
    public string? AccountNumber { get; set; }

    public bool IsActive { get; set; } = true;
}

/// <summary>
/// "Tải ảnh QR" — the QR image is uploaded against an account that already
/// exists, because the bytes need somewhere to belong.
/// </summary>
public class UploadPaymentAccountQrImageDto
{
    public IRemoteStreamContent File { get; set; } = default!;
}

public class GetPaymentAccountListInput : PagedAndSortedResultRequestDto
{
    public Guid? ClinicBranchId { get; set; }

    /// <summary>The screen shows one tab at a time, so the list is always filtered.</summary>
    public PaymentAccountKind? Kind { get; set; }

    public string? Filter { get; set; }
    public bool? IsActive { get; set; }
}

public interface IPaymentAccountAppService : IApplicationService
{
    Task<PagedResultDto<PaymentAccountDto>> GetListAsync(GetPaymentAccountListInput input);
    Task<PaymentAccountDto> GetAsync(Guid id);
    Task<PaymentAccountDto> CreateAsync(CreatePaymentAccountDto input);
    Task<PaymentAccountDto> UpdateAsync(Guid id, UpdatePaymentAccountDto input);
    Task DeleteAsync(Guid id);

    Task<PaymentAccountDto> UploadQrImageAsync(Guid id, UploadPaymentAccountQrImageDto input);
    Task<IRemoteStreamContent> GetQrImageAsync(Guid id);
    Task<PaymentAccountDto> DeleteQrImageAsync(Guid id);
}
