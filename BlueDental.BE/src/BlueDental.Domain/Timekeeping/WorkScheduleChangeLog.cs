using System;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.Timekeeping;

/// <summary>
/// One late change to a saved Lịch làm việc day (BA P0911, F-90): a shift
/// already registered for tomorrow changed or taken back. Who and when come
/// from the creation audit. Kept in the database only — no screen reads it
/// yet. Never edited, never deleted.
/// </summary>
public class WorkScheduleChangeLog : CreationAuditedEntity<Guid>
{
    public Guid ClinicBranchId { get; private set; }

    public Guid StaffId { get; private set; }

    public DateOnly WorkDate { get; private set; }

    public WorkScheduleShift FromShift { get; private set; }

    public WorkScheduleShift ToShift { get; private set; }

    protected WorkScheduleChangeLog() { }

    public WorkScheduleChangeLog(
        Guid id,
        Guid clinicBranchId,
        Guid staffId,
        DateOnly workDate,
        WorkScheduleShift fromShift,
        WorkScheduleShift toShift)
        : base(id)
    {
        ClinicBranchId = clinicBranchId;
        StaffId = staffId;
        WorkDate = workDate;
        FromShift = fromShift;
        ToShift = toShift;
    }

    /// <summary>
    /// Whether changing a saved day from <paramref name="from"/> to
    /// <paramref name="to"/> on <paramref name="workDate"/> is a late change worth
    /// a line: something was saved, it changes, and the day is no more than one
    /// day ahead of <paramref name="today"/> (BA: "ngày đăng ký - ngày hiện tại &lt;= 1").
    /// </summary>
    public static bool IsLateChange(DateOnly today, DateOnly workDate, WorkScheduleShift from, WorkScheduleShift to) =>
        from != WorkScheduleShift.None && from != to && workDate.DayNumber - today.DayNumber <= 1;
}
