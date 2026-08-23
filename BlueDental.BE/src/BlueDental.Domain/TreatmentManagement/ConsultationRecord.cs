using System;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.TreatmentManagement;

public class ConsultationRecord : FullAuditedAggregateRoot<Guid>
{
    public Guid PatientId { get; private set; }
    public Guid ClinicBranchId { get; private set; }
    public Guid? ProcedureId { get; private set; }
    public string ServiceName { get; private set; } = default!;
    public decimal UnitPrice { get; private set; }
    public int Quantity { get; private set; }
    public decimal TotalAmount { get; private set; }
    public string? Notes { get; private set; }

    protected ConsultationRecord() { }

    public ConsultationRecord(
        Guid id,
        Guid patientId,
        Guid clinicBranchId,
        string serviceName,
        decimal unitPrice,
        int quantity = 1,
        Guid? procedureId = null,
        string? notes = null)
        : base(id)
    {
        PatientId = patientId;
        ClinicBranchId = clinicBranchId;
        ProcedureId = procedureId;
        ServiceName = serviceName;
        UnitPrice = unitPrice;
        Quantity = quantity;
        TotalAmount = unitPrice * quantity;
        Notes = notes;
    }

    public ConsultationRecord Update(string serviceName, decimal unitPrice, int quantity, string? notes)
    {
        ServiceName = serviceName;
        UnitPrice = unitPrice;
        Quantity = quantity;
        TotalAmount = unitPrice * quantity;
        Notes = notes;
        return this;
    }
}
