using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using BlueDental.PatientManagement;
using Volo.Abp.Application.Services;
using Volo.Abp.Content;

namespace BlueDental.TreatmentManagement;

/// <summary>
/// The Bảo hành tab of a slip (P3110 REQ-B1..B7): every live line's warranty
/// standing, the cards activated so far and what happened to them.
/// </summary>
public interface IPlanWarrantyAppService : IApplicationService
{
    Task<PlanWarrantyOverviewDto> GetOverviewAsync(Guid planId);

    /// <summary>"Bảo hành dịch vụ" — one dental card per tooth (REQ-B5).</summary>
    Task<PlanWarrantyOverviewDto> ActivateAsync(Guid planId, Guid lineId, ActivateServiceWarrantyDto input);
}

/// <summary>One cell of the status table: "Bảo hành nha khoa" or "Bảo hành Labo" (REQ-B3).</summary>
public enum WarrantyCellState
{
    /// <summary>"–": no warranty period / no Labo order.</summary>
    None = 0,
    NotEligible = 1,
    Pending = 2,
    Activated = 3,
}

/// <summary>The status table's chips: Sẵn sàng kích hoạt / Đã kích hoạt / Chưa đủ điều kiện.</summary>
public enum WarrantyRowGroup
{
    Ready = 1,
    Activated = 2,
    NotEligible = 3,
}

/// <summary>The chip on a history event: Labo / Nha khoa / Điều trị.</summary>
public enum WarrantyEventSource
{
    Labo = 1,
    Dental = 2,
    Treatment = 3,
}

public enum WarrantyEventKind
{
    LaboPassed = 1,
    LaboReturned = 2,
    LaboActivated = 3,
    DentalActivated = 4,
    RequestOpened = 5,
    RequestDone = 6,
}

public class PlanWarrantyOverviewDto
{
    /// <summary>"Hôm nay", the clinic's day — days left are counted from it.</summary>
    public DateOnly Today { get; set; }

    /// <summary>The number on the tab: finished lines + Labo orders passed without a return.</summary>
    public int TabCount { get; set; }

    /// <summary>The "k chờ" badge: lines with a cell waiting for activation.</summary>
    public int PendingCount { get; set; }

    public List<WarrantyServiceRowDto> Rows { get; set; } = [];
    public List<WarrantyCardRowDto> Cards { get; set; } = [];

    /// <summary>Newest first.</summary>
    public List<WarrantyEventDto> History { get; set; } = [];

    /// <summary>Yêu cầu bảo hành — warranty công đoạn still open.</summary>
    public int OpenRequests { get; set; }

    public int DoneRequests { get; set; }
}

public class WarrantyServiceRowDto
{
    public Guid LineId { get; set; }
    public string LineCode { get; set; } = string.Empty;
    public string ServiceName { get; set; } = string.Empty;

    /// <summary>Empty for a line without teeth.</summary>
    public List<int> Teeth { get; set; } = [];

    public string? DentistName { get; set; }
    public List<string> LaboOrderCodes { get; set; } = [];
    public TreatmentServiceStatus Status { get; set; }

    /// <summary>G16 — the earliest day a card may start; null until the line is finished.</summary>
    public DateOnly? CompletedOn { get; set; }

    /// <summary>"Công đoạn n · tên" while the line is still being treated.</summary>
    public int? CurrentStageNumber { get; set; }

    public string? CurrentStageName { get; set; }

    /// <summary>A Labo piece of this line passed QC: "Đã lắp" instead of "Hoàn thành".</summary>
    public bool LaboFitted { get; set; }

    /// <summary>The catalog's warranty period, "Theo danh mục".</summary>
    public int WarrantyDays { get; set; }

    public WarrantyCellState Dental { get; set; }
    public int DentalCardCount { get; set; }

    /// <summary>Teeth still without a dental card; a single null on a line without teeth.</summary>
    public List<int?> DentalPendingTeeth { get; set; } = [];

    public WarrantyCellState Labo { get; set; }
    public int LaboCardCount { get; set; }

    /// <summary>The order "Bảo hành Labo" opens on.</summary>
    public Guid? PendingLaboOrderId { get; set; }

    public WarrantyRowGroup Group { get; set; }
}

public class WarrantyCardRowDto
{
    public string Code { get; set; } = string.Empty;
    public WarrantyCardKind Kind { get; set; }
    public Guid LineId { get; set; }
    public string ServiceName { get; set; } = string.Empty;
    public int? ToothNumber { get; set; }

    /// <summary>Nha khoa: the line's dentist.</summary>
    public string? DentistName { get; set; }

    /// <summary>Labo: the order and who made it.</summary>
    public Guid? LaboOrderId { get; set; }

    public string? LaboOrderCode { get; set; }
    public string? SupplierName { get; set; }

    /// <summary>Labo: the order's material, "{nhà cung cấp} / {vật liệu}" in Dịch vụ bảo hành · Labo (REQ-F4).</summary>
    public string? MaterialName { get; set; }

    public string? ManufacturerSerial { get; set; }

    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }

    /// <summary>Null when the card follows the catalog's days (<see cref="DurationDays"/>).</summary>
    public int? DurationMonths { get; set; }

    public int? DurationDays { get; set; }
    public string? Conditions { get; set; }
    public DateTimeOffset ActivatedAt { get; set; }
    public List<WarrantyCardPhotoDto> Photos { get; set; } = [];
}

public class WarrantyCardPhotoDto
{
    public Guid Id { get; set; }
    public string Url { get; set; } = string.Empty;
    public WarrantyCardSide Side { get; set; }
}

public class WarrantyEventDto
{
    public DateTimeOffset At { get; set; }
    public WarrantyEventSource Source { get; set; }
    public WarrantyEventKind Kind { get; set; }
    public Guid LineId { get; set; }
    public string ServiceName { get; set; } = string.Empty;
    public string? LaboOrderCode { get; set; }
    public List<int> Teeth { get; set; } = [];

    /// <summary>The cards the event concerns — "Lịch sử ↓" filters on them.</summary>
    public List<string> CardCodes { get; set; } = [];

    /// <summary>The warranty công đoạn, for a Yêu cầu bảo hành event.</summary>
    public string? StageName { get; set; }

    public string? StaffName { get; set; }
}

public class ActivateServiceWarrantyDto
{
    public List<ServiceWarrantyCardInputDto> Cards { get; set; } = [];

    /// <summary>
    /// Ảnh thẻ, optional; <see cref="CardPhotoTeeth"/> (0 = the card of a line
    /// without teeth) and <see cref="CardPhotoSides"/> name each one's card and face.
    /// </summary>
    public List<IRemoteStreamContent>? CardPhotos { get; set; }

    public List<int>? CardPhotoTeeth { get; set; }
    public List<WarrantyCardSide>? CardPhotoSides { get; set; }
}

public class ServiceWarrantyCardInputDto
{
    /// <summary>Null on a line without teeth.</summary>
    public int? ToothNumber { get; set; }

    public DateOnly StartDate { get; set; }

    /// <summary>Null = "Theo danh mục".</summary>
    public int? Months { get; set; }

    public string? Conditions { get; set; }
}
