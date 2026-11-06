using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using BlueDental.PatientManagement;
using Volo.Abp.Application.Services;

namespace BlueDental.Appointments;

/// <summary>
/// The floating "Đã đến" panel: an account ticked "Bác sĩ" calls a waiting
/// patient up with "Mời lên"; an account not ticked "Bác sĩ" that may view and
/// edit Tiếp nhận seats them with "Tiếp nhận". Only today's arrivals at the
/// current branch are listed.
/// </summary>
public interface IArrivalCallAppService : IApplicationService
{
    /// <summary>
    /// Patients waiting for the caller, a doctor: their own, every doctor's
    /// for an admin. Anyone else gets none. Ones already called up stay, flagged.
    /// </summary>
    Task<List<ArrivalCallDto>> GetWaitingAsync();

    /// <summary>Patients a doctor called up and reception has not yet seated.</summary>
    Task<List<ArrivalCallDto>> GetInvitedAsync();

    Task<ArrivalCallDto> InviteAsync(Guid id);

    Task<ArrivalCallDto> AdmitAsync(Guid id);
}

public class ArrivalCallDto
{
    public Guid Id { get; set; }
    public Guid PatientId { get; set; }
    public string PatientName { get; set; } = default!;
    public int? PatientYearOfBirth { get; set; }
    public bool IsTemporary { get; set; }

    /// <summary>A "Lịch tạm"'s own phone, prefilled into "Tạo hồ sơ"; masked like every patient phone.</summary>
    [PatientPhone]
    public string? PatientPhone { get; set; }

    public Guid DentistId { get; set; }
    public string? DentistName { get; set; }

    /// <summary>The dentist's "Màu nhãn" "#RRGGBB"; null = the default colour (R-1155).</summary>
    public string? DentistLabelColor { get; set; }
    public DateTimeOffset SlotStart { get; set; }

    /// <summary>Nội dung đặt lịch, or the Ghi chú of a visit booked without one.</summary>
    public string? Content { get; set; }
    public DateTimeOffset? CheckedInAt { get; set; }
    public DateTimeOffset? InvitedAt { get; set; }

    /// <summary>"Đặt cờ" on the reception card: the row glows on the panel too.</summary>
    public bool IsFlagged { get; set; }
}
