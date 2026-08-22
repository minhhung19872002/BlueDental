using System;
using Volo.Abp.Application.Dtos;

namespace BlueDental.TreatmentManagement;

public class ConsultationRecordDto : EntityDto<Guid>
{
    public Guid PatientId { get; set; }
    public Guid? ProcedureId { get; set; }
    public string ServiceName { get; set; } = default!;
    public decimal UnitPrice { get; set; }
    public int Quantity { get; set; }
    public decimal TotalAmount { get; set; }
    public string? Notes { get; set; }
    public DateTimeOffset CreationTime { get; set; }
}

public class CreateConsultationRecordDto
{
    public Guid PatientId { get; set; }
    public Guid? ProcedureId { get; set; }
    public string ServiceName { get; set; } = default!;
    public decimal UnitPrice { get; set; }
    public int Quantity { get; set; } = 1;
    public string? Notes { get; set; }
}

public class GetConsultationRecordListInput : PagedAndSortedResultRequestDto
{
    public Guid? PatientId { get; set; }
    public string? Filter { get; set; }
}
