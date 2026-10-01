using System;
using System.ComponentModel.DataAnnotations;
using Volo.Abp.Application.Dtos;

namespace BlueDental.EInvoicing;

/// <summary>A branch's e-invoice account. The password is never returned, only whether one is set.</summary>
public class EInvoiceConfigDto : EntityDto<Guid>
{
    public Guid ClinicBranchId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Provider { get; set; } = string.Empty;
    public string? AppId { get; set; }
    public string Username { get; set; } = string.Empty;
    public bool HasPassword { get; set; }
    public string TaxCode { get; set; } = string.Empty;
    public bool TaxByService { get; set; }
    public bool TaxByPeriod { get; set; }
    public bool IsActive { get; set; }

    /// <summary>The numbering the last invoice went out under; prefills the Hóa đơn dialog.</summary>
    public string? LastPattern { get; set; }

    public string? LastSerial { get; set; }
    public DateTime CreationTime { get; set; }
}

public class GetEInvoiceConfigListInput
{
    public Guid? ClinicBranchId { get; set; }
}

/// <summary>The fields of the original Cấu hình form — no rules there, so the server checks them.</summary>
public class CreateUpdateEInvoiceConfigDto
{
    public Guid ClinicBranchId { get; set; }

    [StringLength(200)]
    public string? Name { get; set; }

    [StringLength(100)]
    public string? AppId { get; set; }

    [StringLength(100)]
    public string? Username { get; set; }

    /// <summary>Required on create; blank on update keeps the stored one.</summary>
    [StringLength(200)]
    public string? Password { get; set; }

    [StringLength(20)]
    public string? TaxCode { get; set; }

    public bool TaxByService { get; set; }

    public bool TaxByPeriod { get; set; }

    public bool IsActive { get; set; } = true;
}
