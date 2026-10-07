using System;
using Volo.Abp;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.Staff;

/// <summary>
/// A staff member's pay terms — "Lương cơ bản" and "Phụ cấp" per month — the
/// fixed part of Bảng lương (Cụm 11 mục 5; the salary fields of mục 1).
///
/// Kept apart from the staff profile on purpose: the profile is read by every
/// staff picker in the app, a salary only by those who may see Bảng lương.
/// One per staff member, whichever branch they work in.
/// </summary>
public class StaffCompensation : FullAuditedAggregateRoot<Guid>
{
    public Guid StaffId { get; private set; }

    /// <summary>Monthly base salary (VNĐ) for a full month of ngày công chuẩn.</summary>
    public decimal BaseSalary { get; private set; }

    /// <summary>Monthly allowance (VNĐ), paid whatever the days worked.</summary>
    public decimal Allowance { get; private set; }

    protected StaffCompensation() { }

    public StaffCompensation(Guid id, Guid staffId, decimal baseSalary, decimal allowance) : base(id)
    {
        StaffId = staffId;
        Set(baseSalary, allowance);
    }

    public StaffCompensation Set(decimal baseSalary, decimal allowance)
    {
        if (baseSalary < 0m || allowance < 0m)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Payroll.InvalidCompensation);
        }

        BaseSalary = baseSalary;
        Allowance = allowance;
        return this;
    }
}
