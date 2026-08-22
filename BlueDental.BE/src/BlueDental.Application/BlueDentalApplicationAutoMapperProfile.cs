using AutoMapper;
using BlueDental.Appointments;
using BlueDental.Billing;
using BlueDental.Catalogs;
using BlueDental.CustomerCare;
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

        /* Catalogs */
        CreateMap<DentalProcedure, DentalProcedureDto>();
        CreateMap<InsurancePlan, InsurancePlanDto>();
        CreateMap<Medication, MedicationDto>();
        CreateMap<PatientSource, PatientSourceDto>();
        CreateMap<Occupation, OccupationDto>();
        CreateMap<PaymentMethodOption, PaymentMethodDto>();
        CreateMap<PatientTag, PatientTagDto>();

        /* Patient Management */
        CreateMap<Patient, PatientDto>()
            .ForMember(d => d.PhoneNumber, opt => opt.MapFrom(s => s.Contact.PhoneNumber))
            .ForMember(d => d.Email, opt => opt.MapFrom(s => s.Contact.Email));

        /* Appointments */
        CreateMap<Appointment, AppointmentDto>()
            .ForMember(d => d.SlotStart, opt => opt.MapFrom(s => s.Slot.Start))
            .ForMember(d => d.SlotEnd, opt => opt.MapFrom(s => s.Slot.End))
            .ForMember(d => d.PatientName, opt => opt.Ignore())
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

        /* Inventory */
        CreateMap<InventoryItem, InventoryItemDto>();

        /* Notifications */
        CreateMap<Notification, NotificationDto>();

        /* Visits */
        CreateMap<Visit, VisitDto>()
            .ForMember(d => d.PatientName, opt => opt.Ignore())
            .ForMember(d => d.DentistName, opt => opt.Ignore());

        /* Labo */
        CreateMap<LaboOrder, LaboOrderDto>()
            .ForMember(d => d.PatientName, opt => opt.Ignore());

        /* Customer Care */
        CreateMap<CareRecord, CareRecordDto>()
            .ForMember(d => d.PatientName, opt => opt.Ignore());
    }
}
