using System.Collections.Generic;
using System.Linq;

namespace BlueDental.CustomerCare;

/// <summary>The tabs of /cskh-grouping, in their order.</summary>
public static class CareBoard
{
    public static readonly IReadOnlyList<CareType> Types =
    [
        CareType.AfterTreatment,
        CareType.Birthday,
        CareType.AppointmentReminder,
        CareType.UndatedRebook,
        CareType.NoService,
        CareType.MissedAppointment,
        CareType.CancelledAppointment,
        CareType.Periodic,
        CareType.Special,
        CareType.Complaint,
    ];

    public static bool IsTab(CareType type) => Types.Contains(type);
}
