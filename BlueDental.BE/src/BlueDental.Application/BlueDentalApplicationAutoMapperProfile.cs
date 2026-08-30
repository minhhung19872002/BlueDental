using AutoMapper;
using BlueDental.Appointments;
using BlueDental.Billing;
using BlueDental.Catalogs;
using BlueDental.CustomerCare;
using BlueDental.FileManagement;
using BlueDental.Inventory;
using BlueDental.Labo;
using BlueDental.Notifications;
using BlueDental.Organizations;
using BlueDental.PatientManagement;
using BlueDental.TreatmentManagement;
using BlueDental.Visits;

namespace BlueDental;

public class BlueDentalApplicationAutoMapperProfile : Profile
{
    public BlueDentalApplicationAutoMapperProfile()
    {
        /* Organizations */
        CreateMap<ClinicBranch, ClinicBranchDto>();
        CreateMap<Department, DepartmentDto>();

        /* Catalogs */
        CreateMap<DentalProcedure, DentalProcedureDto>();
        CreateMap<InsurancePlan, InsurancePlanDto>();
        CreateMap<Medication, MedicationDto>();
        CreateMap<PatientSource, PatientSourceDto>();
        CreateMap<Occupation, OccupationDto>();
        // The QR bytes are served by the API, so the DTO carries the address
        // rather than the blob name. The version keeps a replaced QR from being
        // served out of the browser cache.
        CreateMap<PaymentAccount, PaymentAccountDto>()
            .ForMember(dto => dto.QrImageUrl, options => options.MapFrom(account =>
                account.QrImageBlobName == null
                    ? null
                    : $"/api/v1/app/payment-accounts/{account.Id}/qr-image?v=" +
                      (account.LastModificationTime ?? account.CreationTime).Ticks));
        CreateMap<PatientTag, PatientTagDto>();
        CreateMap<Diagnosis, DiagnosisDto>();
        CreateMap<MedicationType, MedicationTypeDto>();
        CreateMap<ConsultingData, ConsultingDataDto>();
        CreateMap<MedicalHistoryType, MedicalHistoryTypeDto>();
        CreateMap<PrescriptionTemplate, PrescriptionTemplateDto>();
        CreateMap<MedicalRecordTemplate, MedicalRecordTemplateDto>();

        // Labo catalogs
        CreateMap<Labo.LaboSupplier, Labo.LaboSupplierDto>();
        CreateMap<Labo.LaboMaterial, Labo.LaboMaterialDto>();

        /* Patient Management */
        CreateMap<Patient, PatientDto>()
            .ForMember(d => d.PhoneNumber, opt => opt.MapFrom(s => s.Contact.PhoneNumber))
            .ForMember(d => d.Email, opt => opt.MapFrom(s => s.Contact.Email));

        /* Appointments */
        CreateMap<Appointment, AppointmentDto>()
            .ForMember(d => d.SlotStart, opt => opt.MapFrom(s => s.Slot.Start))
            .ForMember(d => d.SlotEnd, opt => opt.MapFrom(s => s.Slot.End))
            .ForMember(d => d.PatientCode, opt => opt.Ignore())
            .ForMember(d => d.DentistName, opt => opt.Ignore())
            .ForMember(d => d.ProcedureName, opt => opt.Ignore());

        /* Treatment Management */
        CreateMap<TreatmentPlan, TreatmentPlanDto>()
            .ForMember(d => d.PatientName, opt => opt.Ignore())
            .ForMember(d => d.DentistName, opt => opt.Ignore());

        /* Billing */
        CreateMap<Invoice, InvoiceDto>()
            .ForMember(d => d.SubTotal, opt => opt.MapFrom(s => s.SubTotal.Amount))
            .ForMember(d => d.TaxAmount, opt => opt.MapFrom(s => s.TaxAmount.Amount))
            .ForMember(d => d.DiscountAmount, opt => opt.MapFrom(s => s.DiscountAmount.Amount))
            .ForMember(d => d.TotalAmount, opt => opt.MapFrom(s => s.TotalAmount.Amount))
            .ForMember(d => d.PaidAmount, opt => opt.MapFrom(s => s.PaidAmount.Amount))
            .ForMember(d => d.BalanceDue, opt => opt.MapFrom(s => s.BalanceDue.Amount))
            .ForMember(d => d.Currency, opt => opt.MapFrom(s => s.SubTotal.Currency))
            .ForMember(d => d.PatientName, opt => opt.Ignore());

        CreateMap<InsuranceClaim, InsuranceClaimDto>()
            .ForMember(d => d.ClaimedAmount, opt => opt.MapFrom(s => s.ClaimedAmount.Amount))
            .ForMember(d => d.ApprovedAmount, opt => opt.MapFrom(s => s.ApprovedAmount != null ? s.ApprovedAmount.Amount : (decimal?)null));

        /* Inventory */
        CreateMap<InventoryItem, InventoryItemDto>();
        // MaterialAllocation is mapped by hand in its app service: the
        // department name lives on another aggregate, and each line carries the
        // name it was issued under rather than the material's name today.

        /* Notifications */
        CreateMap<Notification, NotificationDto>();
        CreateMap<Tools.MessageTemplate, SmsTemplateDto>();
        CreateMap<ClinicConfigure, ClinicConfigureDto>();

        /* Visits */
        CreateMap<Visit, VisitDto>()
            .ForMember(d => d.PatientName, opt => opt.Ignore())
            .ForMember(d => d.PatientPhone, opt => opt.Ignore())
            .ForMember(d => d.PatientYearOfBirth, opt => opt.Ignore())
            .ForMember(d => d.DentistName, opt => opt.Ignore());

        /* Labo */
        CreateMap<LaboOrder, LaboOrderDto>()
            .ForMember(d => d.PatientName, opt => opt.Ignore());

        /* Customer Care */
        CreateMap<CareRecord, CareRecordDto>()
            .ForMember(d => d.PatientName, opt => opt.Ignore());

        /* File Management */
        CreateMap<FileAttachment, FileAttachmentDto>();
    }
}
