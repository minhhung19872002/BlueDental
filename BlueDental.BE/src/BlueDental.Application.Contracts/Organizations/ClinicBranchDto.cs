using System;
using System.ComponentModel.DataAnnotations;
using Volo.Abp.Application.Dtos;

namespace BlueDental.Organizations;

public class ClinicBranchDto : FullAuditedEntityDto<Guid>
{
    public string Code { get; set; } = default!;
    public string Name { get; set; } = default!;
    public string? Address { get; set; }
    public string? ProvinceId { get; set; }
    public string? WardId { get; set; }
    public string? PhoneNumber { get; set; }
    public string? Email { get; set; }
    public BranchStatus Status { get; set; }
}

public class CreateClinicBranchDto
{
    [Required(ErrorMessage = "Vui lòng nhập mã chi nhánh.")]
    public string Code { get; set; } = default!;

    [Required(ErrorMessage = "Vui lòng nhập tên chi nhánh.")]
    [StringLength(200, ErrorMessage = "Tên chi nhánh tối đa 200 ký tự.")]
    public string Name { get; set; } = default!;

    [StringLength(500, ErrorMessage = "Địa chỉ tối đa 500 ký tự.")]
    public string? Address { get; set; }

    [StringLength(20)]
    public string? ProvinceId { get; set; }

    [StringLength(20)]
    public string? WardId { get; set; }

    [Phone(ErrorMessage = "Số điện thoại không hợp lệ.")]
    [StringLength(20, ErrorMessage = "Số điện thoại tối đa 20 ký tự.")]
    public string? PhoneNumber { get; set; }

    [EmailAddress(ErrorMessage = "Email không hợp lệ.")]
    [StringLength(100, ErrorMessage = "Email tối đa 100 ký tự.")]
    public string? Email { get; set; }
}

public class UpdateClinicBranchDto
{
    [Required(ErrorMessage = "Vui lòng nhập tên chi nhánh.")]
    [StringLength(200, ErrorMessage = "Tên chi nhánh tối đa 200 ký tự.")]
    public string Name { get; set; } = default!;

    [StringLength(500, ErrorMessage = "Địa chỉ tối đa 500 ký tự.")]
    public string? Address { get; set; }

    [StringLength(20)]
    public string? ProvinceId { get; set; }

    [StringLength(20)]
    public string? WardId { get; set; }

    [Phone(ErrorMessage = "Số điện thoại không hợp lệ.")]
    [StringLength(20, ErrorMessage = "Số điện thoại tối đa 20 ký tự.")]
    public string? PhoneNumber { get; set; }

    [EmailAddress(ErrorMessage = "Email không hợp lệ.")]
    [StringLength(100, ErrorMessage = "Email tối đa 100 ký tự.")]
    public string? Email { get; set; }
}

public class GetClinicBranchListInput : PagedAndSortedResultRequestDto
{
    public string? Filter { get; set; }
    public BranchStatus? Status { get; set; }
}
