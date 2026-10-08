using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using BlueDental.CustomerCare;
using BlueDental.Marketing;
using Volo.Abp.Application.Services;

namespace BlueDental.Reporting;

/// <summary>
/// Báo cáo Telesale - follow khách hàng (checklist 16.8). BlueDental-local: the
/// reference has no such screen. Every figure counts the tickets received in the
/// period, in the state they are in today.
/// </summary>
public class TelesaleReportDto
{
    public TelesaleBreakdownRowDto Summary { get; set; } = new();

    /// <summary>Tickets received per clinic day of the period, oldest first.</summary>
    public List<TelesaleDayPointDto> ByDay { get; set; } = [];

    /// <summary>Nguồn (the Nguồn đến group); a null id is "no source".</summary>
    public List<TelesaleBreakdownRowDto> BySource { get; set; } = [];

    /// <summary>Kênh nhập: Nhập tay / File import / Website.</summary>
    public List<TelesaleChannelRowDto> ByChannel { get; set; } = [];

    /// <summary>Khách mới / khách cũ (the phone already belonged to a patient).</summary>
    public List<TelesaleCustomerTypeRowDto> ByCustomerType { get; set; } = [];

    /// <summary>Import files uploaded in the period, newest first.</summary>
    public List<TelesaleFileRowDto> ByFile { get; set; } = [];

    /// <summary>Telesale staff; a null id is the unassigned pool.</summary>
    public List<TelesaleBreakdownRowDto> ByAssignee { get; set; } = [];
}

/// <summary>Ticket counts per status of one slice.</summary>
public class TelesaleBreakdownRowDto
{
    public Guid? Id { get; set; }
    public string? Name { get; set; }
    public int Total { get; set; }
    public int New { get; set; }
    public int InCare { get; set; }
    public int Booked { get; set; }
    public int Arrived { get; set; }
    public int NotPotential { get; set; }
    public int Overdue { get; set; }
}

public class TelesaleChannelRowDto : TelesaleBreakdownRowDto
{
    public TicketChannel Channel { get; set; }
}

public class TelesaleCustomerTypeRowDto : TelesaleBreakdownRowDto
{
    public bool IsReturningCustomer { get; set; }
}

public class TelesaleFileRowDto : TelesaleBreakdownRowDto
{
    public DateTime ImportedAt { get; set; }
    public int RowCount { get; set; }
    public int CreatedCount { get; set; }
    public int ReoccurredCount { get; set; }
}

public class TelesaleDayPointDto
{
    public DateOnly Date { get; set; }
    public int Total { get; set; }
    public int Booked { get; set; }
    public int Arrived { get; set; }
}

/// <summary>
/// Báo cáo chăm sóc khách hàng (checklist 16.11). BlueDental-local. Each care
/// type is windowed exactly like its tab on /cskh-grouping, so a row here adds
/// up to what that tab lists for the same period.
/// </summary>
public class CareReportDto
{
    public CareReportRowDto Summary { get; set; } = new();
    public List<CareTypeReportRowDto> ByType { get; set; } = [];
    public CareOutcomeCountsDto ByOutcome { get; set; } = new();

    /// <summary>Care staff; a null id is "not assigned".</summary>
    public List<CareStaffReportRowDto> ByStaff { get; set; } = [];
}

/// <summary>Care records counted per status of one slice.</summary>
public class CareReportRowDto
{
    public int Total { get; set; }

    /// <summary>Chưa chăm sóc.</summary>
    public int New { get; set; }

    /// <summary>Đã liên hệ, no result yet.</summary>
    public int Contacted { get; set; }

    public int Succeeded { get; set; }
    public int Failed { get; set; }
    public int Cancelled { get; set; }
    public int ZaloSent { get; set; }
}

public class CareTypeReportRowDto : CareReportRowDto
{
    public CareType Type { get; set; }
}

public class CareStaffReportRowDto : CareReportRowDto
{
    public Guid? StaffId { get; set; }
    public string? Name { get; set; }
}

public class CareOutcomeCountsDto
{
    public int NotRated { get; set; }
    public int Good { get; set; }
    public int Fair { get; set; }
    public int Normal { get; set; }
    public int Complaint { get; set; }
}

public interface ITelesaleReportAppService : IApplicationService
{
    Task<TelesaleReportDto> GetAsync(ClinicReportQueryDto input);
    Task<byte[]> ExportAsync(ClinicReportQueryDto input);
}

public interface ICareReportAppService : IApplicationService
{
    Task<CareReportDto> GetAsync(ClinicReportQueryDto input);
    Task<byte[]> ExportAsync(ClinicReportQueryDto input);
}
