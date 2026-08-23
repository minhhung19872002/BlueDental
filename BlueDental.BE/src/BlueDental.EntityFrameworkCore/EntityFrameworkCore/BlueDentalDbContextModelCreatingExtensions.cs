using BlueDental.Appointments;
using BlueDental.Appointments.Values;
using BlueDental.Billing;
using BlueDental.Billing.Values;
using BlueDental.Catalogs;
using BlueDental.CustomerCare;
using BlueDental.FileManagement;
using BlueDental.Inventory;
using BlueDental.Labo;
using BlueDental.Notifications;
using BlueDental.Operations;
using BlueDental.Organizations;
using BlueDental.Tools;
using BlueDental.PatientManagement;
using BlueDental.PatientManagement.Values;
using BlueDental.Finance;
using BlueDental.Promotions;
using BlueDental.Timekeeping;
using BlueDental.TreatmentManagement;
using BlueDental.Visits;
using Microsoft.EntityFrameworkCore;
using Volo.Abp;
using Volo.Abp.EntityFrameworkCore.Modeling;

namespace BlueDental.EntityFrameworkCore;

public static class BlueDentalDbContextModelCreatingExtensions
{
    public static void ConfigureBlueDental(this ModelBuilder builder)
    {
        Check.NotNull(builder, nameof(builder));

        ConfigureOrganizations(builder);
        ConfigureCatalogs(builder);
        ConfigurePatientManagement(builder);
        ConfigureAppointments(builder);
        ConfigureTreatmentManagement(builder);
        ConfigureBilling(builder);
        ConfigureInventory(builder);
        ConfigureNotifications(builder);
        ConfigureFileManagement(builder);
        ConfigureVisits(builder);
        ConfigureLabo(builder);
        ConfigureCustomerCare(builder);
        ConfigureOperations(builder);
        ConfigureTools(builder);
        ConfigureTimekeeping(builder);
        ConfigureFinance(builder);
        ConfigurePromotions(builder);
        ConfigureTaxonomyCatalog(builder);
    }

    private static void ConfigureOrganizations(ModelBuilder builder)
    {
        builder.Entity<ClinicBranch>(entity =>
        {
            entity.ToTable("bd_clinic_branches");
            entity.ConfigureByConvention();
            entity.Property(x => x.Code).HasMaxLength(50).IsRequired();
            entity.Property(x => x.Name).HasMaxLength(200).IsRequired();
            entity.Property(x => x.Address).HasMaxLength(500);
            entity.Property(x => x.PhoneNumber).HasMaxLength(50);
            entity.Property(x => x.Email).HasMaxLength(256);
            entity.Property(x => x.Status).HasConversion<short>();
            entity.HasIndex(x => x.Code).IsUnique();
        });

        builder.Entity<Department>(entity =>
        {
            entity.ToTable("bd_departments");
            entity.ConfigureByConvention();
            entity.Property(x => x.Name).HasMaxLength(200).IsRequired();
            entity.Property(x => x.Description).HasMaxLength(1000);
        });
    }

    private static void ConfigureCatalogs(ModelBuilder builder)
    {
        builder.Entity<DentalProcedure>(entity =>
        {
            entity.ToTable("bd_dental_procedures");
            entity.ConfigureByConvention();
            entity.Property(x => x.Code).HasMaxLength(50).IsRequired();
            entity.Property(x => x.Name).HasMaxLength(200).IsRequired();
            entity.Property(x => x.Description).HasMaxLength(1000);
            entity.Property(x => x.Category).HasConversion<short>();
            entity.Property(x => x.BasePrice).HasPrecision(18, 2);
            entity.HasIndex(x => x.Code).IsUnique();
        });

        builder.Entity<InsurancePlan>(entity =>
        {
            entity.ToTable("bd_insurance_plans");
            entity.ConfigureByConvention();
            entity.Property(x => x.Code).HasMaxLength(50).IsRequired();
            entity.Property(x => x.Name).HasMaxLength(200).IsRequired();
            entity.Property(x => x.ProviderName).HasMaxLength(200);
            entity.Property(x => x.CoveragePercentage).HasPrecision(5, 2);
            entity.Property(x => x.MaxAnnualBenefit).HasPrecision(18, 2);
        });

        builder.Entity<Medication>(entity =>
        {
            entity.ToTable("bd_medications");
            entity.ConfigureByConvention();
            entity.Property(x => x.Code).HasMaxLength(50).IsRequired();
            entity.Property(x => x.GenericName).HasMaxLength(200).IsRequired();
            entity.Property(x => x.BrandName).HasMaxLength(200);
            entity.Property(x => x.DosageForm).HasMaxLength(100);
            entity.Property(x => x.Strength).HasMaxLength(100);
        });

        builder.Entity<PatientSource>(entity =>
        {
            entity.ToTable("bd_patient_sources");
            entity.ConfigureByConvention();
            entity.Property(x => x.Code).HasMaxLength(50).IsRequired();
            entity.Property(x => x.Name).HasMaxLength(200).IsRequired();
            entity.Property(x => x.Description).HasMaxLength(1000);
            entity.HasIndex(x => x.Code).IsUnique();
        });

        builder.Entity<Occupation>(entity =>
        {
            entity.ToTable("bd_occupations");
            entity.ConfigureByConvention();
            entity.Property(x => x.Name).HasMaxLength(200).IsRequired();
            entity.Property(x => x.Description).HasMaxLength(1000);
        });

        builder.Entity<PaymentMethodOption>(entity =>
        {
            entity.ToTable("bd_payment_methods");
            entity.ConfigureByConvention();
            entity.Property(x => x.Code).HasMaxLength(50).IsRequired();
            entity.Property(x => x.Name).HasMaxLength(200).IsRequired();
            entity.Property(x => x.Description).HasMaxLength(1000);
            entity.HasIndex(x => x.Code).IsUnique();
        });

        builder.Entity<PatientTag>(entity =>
        {
            entity.ToTable("bd_patient_tags");
            entity.ConfigureByConvention();
            entity.Property(x => x.Name).HasMaxLength(200).IsRequired();
            entity.Property(x => x.Color).HasMaxLength(20);
            entity.Property(x => x.Description).HasMaxLength(1000);
        });

        builder.Entity<Diagnosis>(entity =>
        {
            entity.ToTable("bd_diagnoses");
            entity.ConfigureByConvention();
            entity.Property(x => x.Code).HasMaxLength(50).IsRequired();
            entity.Property(x => x.Name).HasMaxLength(200).IsRequired();
            entity.Property(x => x.Description).HasMaxLength(1000);
            entity.HasIndex(x => x.Code).IsUnique();
        });

        builder.Entity<MedicationType>(entity =>
        {
            entity.ToTable("bd_medication_types");
            entity.ConfigureByConvention();
            entity.Property(x => x.Name).HasMaxLength(200).IsRequired();
            entity.Property(x => x.Description).HasMaxLength(1000);
        });

        builder.Entity<ConsultingData>(entity =>
        {
            entity.ToTable("bd_consulting_data");
            entity.ConfigureByConvention();
            entity.Property(x => x.Name).HasMaxLength(200).IsRequired();
            entity.Property(x => x.Description).HasMaxLength(1000);
        });

        builder.Entity<MedicalHistoryType>(entity =>
        {
            entity.ToTable("bd_medical_history_types");
            entity.ConfigureByConvention();
            entity.Property(x => x.Name).HasMaxLength(200).IsRequired();
            entity.Property(x => x.Description).HasMaxLength(1000);
        });

        builder.Entity<PrescriptionTemplate>(entity =>
        {
            entity.ToTable("bd_prescription_templates");
            entity.ConfigureByConvention();
            entity.Property(x => x.Name).HasMaxLength(200).IsRequired();
            entity.Property(x => x.Content).HasMaxLength(8000);
            entity.Property(x => x.Description).HasMaxLength(1000);
        });

        builder.Entity<MedicalRecordTemplate>(entity =>
        {
            entity.ToTable("bd_medical_record_templates");
            entity.ConfigureByConvention();
            entity.Property(x => x.Name).HasMaxLength(200).IsRequired();
            entity.Property(x => x.Content).HasMaxLength(8000);
            entity.Property(x => x.Description).HasMaxLength(1000);
        });
    }

    private static void ConfigurePatientManagement(ModelBuilder builder)
    {
        builder.Entity<Patient>(entity =>
        {
            entity.ToTable("bd_patients");
            entity.ConfigureByConvention();
            entity.Property(x => x.PatientCode).HasMaxLength(50).IsRequired();
            entity.Property(x => x.FirstName).HasMaxLength(100).IsRequired();
            entity.Property(x => x.LastName).HasMaxLength(100).IsRequired();
            entity.Property(x => x.NationalId).HasMaxLength(50);
            entity.Property(x => x.BloodType).HasMaxLength(10);
            entity.Property(x => x.Status).HasConversion<short>();
            entity.Property(x => x.Gender).HasConversion<short>();

            entity.OwnsOne(x => x.Contact, contact =>
            {
                contact.Property(c => c.PhoneNumber).HasColumnName("phone_number").HasMaxLength(50);
                contact.Property(c => c.Email).HasColumnName("email").HasMaxLength(256);
                contact.Property(c => c.Address).HasColumnName("address").HasMaxLength(500);
                contact.Property(c => c.EmergencyContactName).HasColumnName("emergency_contact_name").HasMaxLength(200);
                contact.Property(c => c.EmergencyContactPhone).HasColumnName("emergency_contact_phone").HasMaxLength(50);
            });

            entity.HasIndex(x => x.PatientCode).IsUnique();
        });
    }

    private static void ConfigureAppointments(ModelBuilder builder)
    {
        builder.Entity<Appointment>(entity =>
        {
            entity.ToTable("bd_appointments");
            entity.ConfigureByConvention();
            entity.Property(x => x.Status).HasConversion<short>();
            entity.Property(x => x.Type).HasConversion<short>();
            entity.Property(x => x.CancellationReason).HasConversion<short>();
            entity.Property(x => x.ChiefComplaint).HasMaxLength(500);
            entity.Property(x => x.Notes).HasMaxLength(2000);
            entity.Property(x => x.CancellationNote).HasMaxLength(500);

            entity.OwnsOne(x => x.Slot, slot =>
            {
                slot.Property(s => s.Start).HasColumnName("slot_start").IsRequired();
                slot.Property(s => s.End).HasColumnName("slot_end").IsRequired();
            });

            entity.HasIndex(x => new { x.DentistId, x.Status });
            entity.HasIndex(x => new { x.PatientId, x.Status });
            entity.HasIndex(x => new { x.BranchId, x.Status });
        });
    }

    private static void ConfigureTreatmentManagement(ModelBuilder builder)
    {
        builder.Entity<TreatmentPlan>(entity =>
        {
            entity.Property(x => x.Code).HasMaxLength(32);
            entity.Property(x => x.DiscountType).HasConversion<short>();
            entity.Property(x => x.DiscountValue).HasColumnType("numeric(18,2)");
            entity.Property(x => x.VoucherDiscountAmount).HasColumnType("numeric(18,2)");
            entity.HasMany(x => x.Services)
                .WithOne()
                .HasForeignKey(x => x.TreatmentPlanId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.Navigation(x => x.Services).UsePropertyAccessMode(PropertyAccessMode.Field);
            entity.Ignore(x => x.ServicesTotal);
            entity.Ignore(x => x.PlanDiscountAmount);
            entity.Ignore(x => x.TotalAmount);
            entity.Ignore(x => x.CompletedValue);
            entity.Ignore(x => x.ProgressPercent);
            entity.ToTable("bd_treatment_plans");
            entity.ConfigureByConvention();
            entity.Property(x => x.Title).HasMaxLength(300).IsRequired();
            entity.Property(x => x.Description).HasMaxLength(2000);
            entity.Property(x => x.Status).HasConversion<short>();
            entity.Property(x => x.ApprovalNotes).HasMaxLength(1000);
        });

        builder.Entity<TreatmentRecord>(entity =>
        {
            entity.ToTable("bd_treatment_records");
            entity.ConfigureByConvention();
            entity.Property(x => x.TeethTreated).HasMaxLength(500);
            entity.Property(x => x.ClinicalNotes).HasMaxLength(4000);
            entity.Property(x => x.Findings).HasMaxLength(2000);
            entity.Property(x => x.ChargedAmount).HasPrecision(18, 2);
        });

        builder.Entity<Prescription>(entity =>
        {
            entity.ToTable("bd_prescriptions");
            entity.ConfigureByConvention();
            entity.Property(x => x.Code).HasMaxLength(32).IsRequired();
            entity.Property(x => x.DiagnosisText).HasMaxLength(500);
            entity.Property(x => x.Note).HasMaxLength(1000);
            entity.Property(x => x.Status).HasConversion<short>();
            entity.HasMany(x => x.Items)
                .WithOne()
                .HasForeignKey(x => x.PrescriptionId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.Navigation(x => x.Items).UsePropertyAccessMode(PropertyAccessMode.Field);
            entity.HasIndex(x => new { x.PatientId, x.IssuedAt });
            entity.HasIndex(x => new { x.ClinicBranchId, x.Status });
            entity.HasIndex(x => x.Code);
        });

        builder.Entity<PrescriptionItem>(entity =>
        {
            entity.ToTable("bd_prescription_items");
            entity.ConfigureByConvention();
            entity.Property(x => x.MedicationName).HasMaxLength(300).IsRequired();
            entity.Property(x => x.Dosage).HasMaxLength(100);
            entity.Property(x => x.Frequency).HasMaxLength(100);
            entity.Property(x => x.Instructions).HasMaxLength(1000);
            entity.HasIndex(x => x.PrescriptionId);
        });

        builder.Entity<DiagnosticRecord>(entity =>
        {
            entity.ToTable("bd_diagnostic_records");
            entity.ConfigureByConvention();
            entity.Property(x => x.Code).HasMaxLength(50).IsRequired();
            entity.Property(x => x.TeethNumbers).HasMaxLength(200);
            entity.Property(x => x.Diagnosis).HasMaxLength(2000);
            entity.Property(x => x.Notes).HasMaxLength(2000);
            entity.HasIndex(x => x.PatientId);
            entity.HasIndex(x => x.ClinicBranchId);
        });

        builder.Entity<ConsultationRecord>(entity =>
        {
            entity.ToTable("bd_consultation_records");
            entity.ConfigureByConvention();
            entity.Property(x => x.ServiceName).HasMaxLength(300).IsRequired();
            entity.Property(x => x.UnitPrice).HasPrecision(18, 2);
            entity.Property(x => x.TotalAmount).HasPrecision(18, 2);
            entity.Property(x => x.Notes).HasMaxLength(2000);
            entity.HasIndex(x => x.PatientId);
        });
    }

    private static void ConfigureBilling(ModelBuilder builder)
    {
        builder.Entity<Invoice>(entity =>
        {
            entity.ToTable("bd_invoices");
            entity.ConfigureByConvention();
            entity.Property(x => x.InvoiceNumber).HasMaxLength(50).IsRequired();
            entity.Property(x => x.Status).HasConversion<short>();
            entity.Property(x => x.Notes).HasMaxLength(1000);

            entity.OwnsOne(x => x.SubTotal, m =>
            {
                m.Property(v => v.Amount).HasColumnName("sub_total_amount").HasPrecision(18, 2);
                m.Property(v => v.Currency).HasColumnName("currency").HasMaxLength(3);
            });
            entity.OwnsOne(x => x.TaxAmount, m =>
            {
                m.Property(v => v.Amount).HasColumnName("tax_amount").HasPrecision(18, 2);
                m.Property(v => v.Currency).HasColumnName("tax_currency").HasMaxLength(3);
            });
            entity.OwnsOne(x => x.DiscountAmount, m =>
            {
                m.Property(v => v.Amount).HasColumnName("discount_amount").HasPrecision(18, 2);
                m.Property(v => v.Currency).HasColumnName("discount_currency").HasMaxLength(3);
            });
            entity.OwnsOne(x => x.TotalAmount, m =>
            {
                m.Property(v => v.Amount).HasColumnName("total_amount").HasPrecision(18, 2);
                m.Property(v => v.Currency).HasColumnName("total_currency").HasMaxLength(3);
            });
            entity.OwnsOne(x => x.PaidAmount, m =>
            {
                m.Property(v => v.Amount).HasColumnName("paid_amount").HasPrecision(18, 2);
                m.Property(v => v.Currency).HasColumnName("paid_currency").HasMaxLength(3);
            });

            entity.Ignore(x => x.BalanceDue);
            entity.HasIndex(x => x.InvoiceNumber).IsUnique();
        });

        builder.Entity<InsuranceClaim>(entity =>
        {
            entity.ToTable("bd_insurance_claims");
            entity.ConfigureByConvention();
            entity.Property(x => x.ClaimReference).HasMaxLength(100).IsRequired();
            entity.HasIndex(x => x.BranchId);
            entity.Property(x => x.Status).HasConversion<short>();
            entity.Property(x => x.RejectionReason).HasMaxLength(500);
            entity.Property(x => x.Notes).HasMaxLength(1000);

            entity.OwnsOne(x => x.ClaimedAmount, m =>
            {
                m.Property(v => v.Amount).HasColumnName("claimed_amount").HasPrecision(18, 2);
                m.Property(v => v.Currency).HasColumnName("claim_currency").HasMaxLength(3);
            });
            entity.OwnsOne(x => x.ApprovedAmount, m =>
            {
                m.Property(v => v.Amount).HasColumnName("approved_amount").HasPrecision(18, 2);
                m.Property(v => v.Currency).HasColumnName("approved_currency").HasMaxLength(3);
            });
        });
    }

    private static void ConfigureInventory(ModelBuilder builder)
    {
        builder.Entity<InventoryItem>(entity =>
        {
            entity.ToTable("bd_inventory_items");
            entity.ConfigureByConvention();
            entity.Property(x => x.ItemCode).HasMaxLength(50).IsRequired();
            entity.Property(x => x.Name).HasMaxLength(200).IsRequired();
            entity.Property(x => x.Category).HasMaxLength(100);
            entity.Property(x => x.Unit).HasMaxLength(50);
            entity.Property(x => x.QuantityOnHand).HasPrecision(18, 3);
            entity.Property(x => x.ReorderLevel).HasPrecision(18, 3);
            entity.Property(x => x.UnitCost).HasPrecision(18, 2);
            entity.Property(x => x.SalePrice).HasPrecision(18, 2);
            entity.Property(x => x.Supplier).HasMaxLength(200);
            entity.Property(x => x.Origin).HasMaxLength(100);
            entity.Ignore(x => x.NeedsReorder);
            entity.HasIndex(x => new { x.BranchId, x.ItemCode }).IsUnique();
            entity.HasIndex(x => new { x.BranchId, x.TaxonomyId });
            entity.HasIndex(x => x.ExpiryDate);
        });

        builder.Entity<MaterialAllocation>(entity =>
        {
            entity.ToTable("bd_material_allocations");
            entity.ConfigureByConvention();
            entity.Property(x => x.AllocationCode).HasMaxLength(50).IsRequired();
            entity.Property(x => x.AllocatedQuantity).HasPrecision(18, 3);
            entity.Property(x => x.ConfirmedRemaining).HasPrecision(18, 3);
            entity.Property(x => x.PerformerName).HasMaxLength(200);
            entity.Property(x => x.Note).HasMaxLength(1000);
            entity.HasIndex(x => x.AllocationCode).IsUnique();
            entity.HasIndex(x => new { x.DepartmentId, x.AllocationTime });
        });
    }

    private static void ConfigureNotifications(ModelBuilder builder)
    {
        builder.Entity<Notification>(entity =>
        {
            entity.ToTable("bd_notifications");
            entity.ConfigureByConvention();
            entity.Property(x => x.Subject).HasMaxLength(500).IsRequired();
            entity.Property(x => x.Body).HasMaxLength(4000).IsRequired();
            entity.Property(x => x.Type).HasConversion<short>();
            entity.Property(x => x.Channel).HasConversion<short>();
            entity.Property(x => x.DeliveryStatus).HasConversion<short>();
            entity.Property(x => x.FailureReason).HasMaxLength(500);
            entity.Property(x => x.ReferenceEntityType).HasMaxLength(100);
            entity.HasIndex(x => new { x.RecipientUserId, x.DeliveryStatus });
        });
    }

    private static void ConfigureFileManagement(ModelBuilder builder)
    {
        builder.Entity<FileAttachment>(entity =>
        {
            entity.ToTable("bd_file_attachments");
            entity.ConfigureByConvention();
            entity.Property(x => x.FileName).HasMaxLength(500).IsRequired();
            entity.Property(x => x.ContentType).HasMaxLength(200).IsRequired();
            entity.Property(x => x.BlobName).HasMaxLength(500).IsRequired();
            entity.Property(x => x.Description).HasMaxLength(500);
            entity.Property(x => x.OwnerEntityType).HasMaxLength(100).IsRequired();
            entity.HasIndex(x => new { x.OwnerEntityType, x.OwnerEntityId });
        });
    }

    private static void ConfigureVisits(ModelBuilder builder)
    {
        builder.Entity<Visit>(entity =>
        {
            entity.ToTable("bd_visits");
            entity.ConfigureByConvention();
            entity.Property(x => x.Status).HasConversion<short>();
            entity.Property(x => x.ChiefComplaint).HasMaxLength(500);
            entity.Property(x => x.Notes).HasMaxLength(2000);
            entity.Property(x => x.CancellationReason).HasMaxLength(500);
            entity.HasIndex(x => new { x.BranchId, x.Status });
            entity.HasIndex(x => new { x.PatientId, x.ScheduledAt });
        });
    }

    private static void ConfigureLabo(ModelBuilder builder)
    {
        builder.Entity<LaboOrder>(entity =>
        {
            entity.ToTable("bd_labo_orders");
            entity.ConfigureByConvention();
            entity.Property(x => x.OrderCode).HasMaxLength(50).IsRequired();
            entity.Property(x => x.LabProviderName).HasMaxLength(200).IsRequired();
            entity.Property(x => x.Status).HasConversion<short>();
            entity.Property(x => x.ToothNumbers).HasMaxLength(200);
            entity.Property(x => x.WorkDescription).HasMaxLength(1000);
            entity.Property(x => x.Notes).HasMaxLength(2000);
            entity.Property(x => x.EstimatedCost).HasPrecision(18, 2);
            entity.Property(x => x.RejectionReason).HasMaxLength(500);
            entity.HasIndex(x => x.OrderCode).IsUnique();
            entity.HasIndex(x => new { x.BranchId, x.Status });
        });

        builder.Entity<LaboSupplier>(entity =>
        {
            entity.ToTable("bd_labo_suppliers");
            entity.ConfigureByConvention();
            entity.Property(x => x.Name).HasMaxLength(200).IsRequired();
            entity.Property(x => x.Phone).HasMaxLength(50);
            entity.Property(x => x.Email).HasMaxLength(256);
            entity.Property(x => x.Address).HasMaxLength(500);
        });

        builder.Entity<LaboBiteType>(entity =>
        {
            entity.ToTable("bd_labo_bite_types");
            entity.ConfigureByConvention();
            entity.Property(x => x.Name).HasMaxLength(200).IsRequired();
            entity.Property(x => x.Description).HasMaxLength(1000);
        });

        builder.Entity<LaboFinishLine>(entity =>
        {
            entity.ToTable("bd_labo_finish_lines");
            entity.ConfigureByConvention();
            entity.Property(x => x.Name).HasMaxLength(200).IsRequired();
            entity.Property(x => x.Description).HasMaxLength(1000);
        });

        builder.Entity<LaboRhythmType>(entity =>
        {
            entity.ToTable("bd_labo_rhythm_types");
            entity.ConfigureByConvention();
            entity.Property(x => x.Name).HasMaxLength(200).IsRequired();
            entity.Property(x => x.Description).HasMaxLength(1000);
        });

        builder.Entity<LaboMaterial>(entity =>
        {
            entity.ToTable("bd_labo_materials");
            entity.ConfigureByConvention();
            entity.Property(x => x.Name).HasMaxLength(200).IsRequired();
            entity.Property(x => x.Category).HasMaxLength(100);
            entity.Property(x => x.Description).HasMaxLength(1000);
        });
    }

    private static void ConfigureCustomerCare(ModelBuilder builder)
    {
        builder.Entity<CareRecord>(entity =>
        {
            entity.ToTable("bd_care_records");
            entity.ConfigureByConvention();
            entity.Property(x => x.Type).HasConversion<short>();
            entity.Property(x => x.Status).HasConversion<short>();
            entity.Property(x => x.Subject).HasMaxLength(300).IsRequired();
            entity.Property(x => x.Description).HasMaxLength(2000);
            entity.Property(x => x.Resolution).HasMaxLength(2000);
            entity.Property(x => x.Outcome).HasConversion<short>();
            entity.PrimitiveCollection(x => x.StageIds).UsePropertyAccessMode(PropertyAccessMode.Field);
            entity.Ignore(x => x.IsClosed);
            entity.HasIndex(x => new { x.BranchId, x.Status });
            entity.HasIndex(x => new { x.PatientId, x.Status });
            entity.HasIndex(x => new { x.BranchId, x.Type, x.DueAt });
        });

        // Chan doan cua benh nhan
        builder.Entity<PatientDiagnosis>(entity =>
        {
            entity.ToTable("bd_patient_diagnoses");
            entity.ConfigureByConvention();
            entity.Property(x => x.Code).HasMaxLength(32).IsRequired();
            entity.Property(x => x.Note).HasMaxLength(2000);
            entity.Property(x => x.Status).HasConversion<short>();
            entity.OwnsMany(x => x.Teeth, t => t.ToJson());
            entity.Navigation(x => x.Teeth).UsePropertyAccessMode(PropertyAccessMode.Field);
            entity.HasIndex(x => new { x.ClinicBranchId, x.Status });
            entity.HasIndex(x => new { x.PatientId, x.Status });
            entity.HasIndex(x => x.Code);
        });

        // Tu van dich vu cho benh nhan
        builder.Entity<PatientAdvise>(entity =>
        {
            entity.ToTable("bd_patient_advises");
            entity.ConfigureByConvention();
            entity.Property(x => x.Code).HasMaxLength(32).IsRequired();
            entity.Property(x => x.Note).HasMaxLength(2000);
            entity.Property(x => x.Status).HasConversion<short>();
            entity.Property(x => x.DiscountType).HasConversion<short>();
            entity.Property(x => x.OriginalPrice).HasColumnType("numeric(18,2)");
            entity.Property(x => x.Price).HasColumnType("numeric(18,2)");
            entity.Property(x => x.DiscountValue).HasColumnType("numeric(18,2)");
            entity.Property(x => x.VoucherDiscountAmount).HasColumnType("numeric(18,2)");
            entity.OwnsMany(x => x.Teeth, t => t.ToJson());
            entity.Navigation(x => x.Teeth).UsePropertyAccessMode(PropertyAccessMode.Field);
            entity.PrimitiveCollection(x => x.ImageIds).UsePropertyAccessMode(PropertyAccessMode.Field);
            entity.Ignore(x => x.GrossAmount);
            entity.Ignore(x => x.DiscountAmount);
            entity.Ignore(x => x.EffectiveAmount);
            entity.HasIndex(x => new { x.ClinicBranchId, x.Status });
            entity.HasIndex(x => new { x.PatientId, x.Status });
            entity.HasIndex(x => x.PatientDiagnosisId);
            entity.HasIndex(x => x.TreatmentPlanId);
            entity.HasIndex(x => x.Code);
        });

        // Hinh anh benh nhan
        builder.Entity<PatientImage>(entity =>
        {
            entity.ToTable("bd_patient_images");
            entity.ConfigureByConvention();
            entity.Property(x => x.BlobName).HasMaxLength(500).IsRequired();
            entity.Property(x => x.FileName).HasMaxLength(300).IsRequired();
            entity.Property(x => x.ContentType).HasMaxLength(100).IsRequired();
            entity.Property(x => x.Note).HasMaxLength(1000);
            entity.HasIndex(x => new { x.PatientId, x.TakenAt });
            entity.HasIndex(x => x.TreatmentStageId);
        });

        // Dong dich vu cua phieu dieu tri
        builder.Entity<TreatmentService>(entity =>
        {
            entity.ToTable("bd_treatment_services");
            entity.ConfigureByConvention();
            entity.Property(x => x.Code).HasMaxLength(32).IsRequired();
            entity.Property(x => x.Status).HasConversion<short>();
            entity.Property(x => x.DiscountType).HasConversion<short>();
            entity.Property(x => x.Price).HasColumnType("numeric(18,2)");
            entity.Property(x => x.DiscountValue).HasColumnType("numeric(18,2)");
            entity.OwnsMany(x => x.Teeth, t => t.ToJson());
            entity.Navigation(x => x.Teeth).UsePropertyAccessMode(PropertyAccessMode.Field);
            entity.Ignore(x => x.GrossAmount);
            entity.Ignore(x => x.DiscountAmount);
            entity.Ignore(x => x.EffectiveAmount);
            entity.Ignore(x => x.CountedAmount);
            entity.Ignore(x => x.IsCompleted);
            entity.HasIndex(x => new { x.TreatmentPlanId, x.Code });
            entity.HasIndex(x => x.SourceAdviseId);
            entity.HasIndex(x => new { x.PatientId, x.Status });
        });

        // Thanh toan / hoan tien cua benh nhan
        builder.Entity<PatientPayment>(entity =>
        {
            entity.ToTable("bd_patient_payments");
            entity.ConfigureByConvention();
            entity.Property(x => x.Code).HasMaxLength(32).IsRequired();
            entity.Property(x => x.Note).HasMaxLength(1000);
            entity.Property(x => x.Kind).HasConversion<short>();
            entity.Property(x => x.Method).HasConversion<short>();
            entity.Property(x => x.Amount).HasColumnType("numeric(18,2)");
            entity.Ignore(x => x.SignedAmount);
            entity.HasIndex(x => new { x.PatientId, x.PaidAt });
            entity.HasIndex(x => x.TreatmentPlanId);
            entity.HasIndex(x => new { x.ClinicBranchId, x.PaidAt });
        });

        // Cong doan dieu tri
        builder.Entity<TreatmentStage>(entity =>
        {
            entity.ToTable("bd_treatment_stages");
            entity.ConfigureByConvention();
            entity.Property(x => x.Name).HasMaxLength(300).IsRequired();
            entity.Property(x => x.Note).HasMaxLength(2000);
            entity.Property(x => x.Status).HasConversion<short>();
            entity.OwnsMany(x => x.Teeth, t => t.ToJson());
            entity.Navigation(x => x.Teeth).UsePropertyAccessMode(PropertyAccessMode.Field);
            entity.PrimitiveCollection(x => x.ImageUrls).UsePropertyAccessMode(PropertyAccessMode.Field);
            entity.HasIndex(x => new { x.TreatmentServiceId, x.SequenceNumber });
            entity.HasIndex(x => new { x.PatientId, x.Status });
            entity.HasIndex(x => new { x.ClinicBranchId, x.Status });
        });

        // Nhom tu van
        builder.Entity<AdviseGroup>(entity =>
        {
            entity.ToTable("bd_advise_groups");
            entity.ConfigureByConvention();
            entity.Property(x => x.Name).HasMaxLength(200).IsRequired();
            entity.Property(x => x.Description).HasMaxLength(1000);
            entity.HasIndex(x => new { x.PatientId, x.SortOrder });
        });

        // Cham cong / lich lam viec
        builder.Entity<TimeKeepingRecord>(entity =>
        {
            entity.ToTable("bd_time_keeping_records");
            entity.ConfigureByConvention();
            entity.Property(x => x.Registration).HasConversion<short>();
            entity.Property(x => x.Status).HasConversion<short>();
            entity.Property(x => x.LeaveReason).HasMaxLength(500);
            entity.Property(x => x.Note).HasMaxLength(1000);

            entity.OwnsOne(x => x.MorningShift, shift =>
            {
                shift.Property(s => s.Kind).HasColumnName("MorningKind").HasConversion<short>();
                shift.Property(s => s.PlannedStart).HasColumnName("MorningPlannedStart");
                shift.Property(s => s.PlannedEnd).HasColumnName("MorningPlannedEnd");
                shift.Property(s => s.CheckedInAt).HasColumnName("MorningCheckedInAt");
                shift.Property(s => s.CheckedOutAt).HasColumnName("MorningCheckedOutAt");
            });
            entity.Navigation(x => x.MorningShift).IsRequired();

            entity.OwnsOne(x => x.AfternoonShift, shift =>
            {
                shift.Property(s => s.Kind).HasColumnName("AfternoonKind").HasConversion<short>();
                shift.Property(s => s.PlannedStart).HasColumnName("AfternoonPlannedStart");
                shift.Property(s => s.PlannedEnd).HasColumnName("AfternoonPlannedEnd");
                shift.Property(s => s.CheckedInAt).HasColumnName("AfternoonCheckedInAt");
                shift.Property(s => s.CheckedOutAt).HasColumnName("AfternoonCheckedOutAt");
            });
            entity.Navigation(x => x.AfternoonShift).IsRequired();

            entity.Ignore(x => x.HasAnyAttendance);
            entity.Ignore(x => x.HasOpenShift);
            entity.Ignore(x => x.TotalWorkedMinutes);

            // One attendance record per staff member per day per branch.
            entity.HasIndex(x => new { x.ClinicBranchId, x.WorkDate, x.StaffId }).IsUnique();
            entity.HasIndex(x => new { x.ClinicBranchId, x.WorkDate, x.Status });
        });

        // Phieu thu / phieu chi
        builder.Entity<SalesEntry>(entity =>
        {
            entity.ToTable("bd_sales_entries");
            entity.ConfigureByConvention();
            entity.Property(x => x.Code).HasMaxLength(32).IsRequired();
            entity.Property(x => x.Type).HasConversion<short>();
            entity.Property(x => x.Channel).HasConversion<short>();
            entity.Property(x => x.ApprovalStatus).HasConversion<short>();
            entity.Property(x => x.Amount).HasColumnType("numeric(18,2)");
            entity.Property(x => x.Description).HasMaxLength(1000).IsRequired();
            entity.Property(x => x.RejectionReason).HasMaxLength(500);
            entity.Ignore(x => x.CountsTowardsCashflow);
            entity.Ignore(x => x.SignedAmount);
            entity.HasIndex(x => new { x.ClinicBranchId, x.EntryDate, x.Type });
            entity.HasIndex(x => new { x.ClinicBranchId, x.ApprovalStatus });
            entity.HasIndex(x => x.Code).IsUnique();
        });

        // Danh muc thu chi / luan chuyen
        builder.Entity<CashflowCategory>(entity =>
        {
            entity.ToTable("bd_cashflow_categories");
            entity.ConfigureByConvention();
            entity.Property(x => x.Name).HasMaxLength(200).IsRequired();
            entity.Property(x => x.Type).HasConversion<short>();
            entity.Property(x => x.Description).HasMaxLength(500);
            entity.HasIndex(x => new { x.ClinicBranchId, x.AppliesToTransfers, x.Type });
        });

        // Luan chuyen dong tien
        builder.Entity<CashflowEntry>(entity =>
        {
            entity.ToTable("bd_cashflow_entries");
            entity.ConfigureByConvention();
            entity.Property(x => x.TransactionType).HasConversion<short>();
            entity.Property(x => x.FromHolding).HasConversion<short>();
            entity.Property(x => x.ToHolding).HasConversion<short>();
            entity.Property(x => x.Amount).HasColumnType("numeric(18,2)");
            entity.Property(x => x.Note).HasMaxLength(1000);
            entity.HasIndex(x => new { x.ClinicBranchId, x.EntryDate });
            entity.HasIndex(x => new { x.ClinicBranchId, x.TransactionType });
        });

        // Voucher khuyen mai
        builder.Entity<Voucher>(entity =>
        {
            entity.ToTable("bd_vouchers");
            entity.ConfigureByConvention();
            entity.Property(x => x.Code).HasMaxLength(32).IsRequired();
            entity.Property(x => x.Name).HasMaxLength(200).IsRequired();
            entity.Property(x => x.Description).HasMaxLength(1000);
            entity.Property(x => x.DiscountType).HasConversion<short>();
            entity.Property(x => x.CustomerTarget).HasConversion<short>();
            entity.Property(x => x.Status).HasConversion<short>();
            entity.Property(x => x.DiscountValue).HasColumnType("numeric(18,2)");
            entity.Property(x => x.MaxDiscountAmount).HasColumnType("numeric(18,2)");
            entity.Property(x => x.MinOrderAmount).HasColumnType("numeric(18,2)");
            entity.Ignore(x => x.RemainingUses);
            entity.Ignore(x => x.IsExhausted);
            entity.HasIndex(x => x.Code).IsUnique();
            entity.HasIndex(x => new { x.Status, x.ValidFrom, x.ValidTo });
        });

        // Nhom danh muc
        builder.Entity<Taxonomy>(entity =>
        {
            entity.ToTable("bd_taxonomies");
            entity.ConfigureByConvention();
            entity.Property(x => x.Group).HasMaxLength(64).IsRequired();
            entity.Property(x => x.Name).HasMaxLength(200).IsRequired();
            entity.Property(x => x.Alias).HasMaxLength(200);
            entity.Property(x => x.Color).HasMaxLength(9);
            entity.Property(x => x.SubGroup).HasMaxLength(100);
            entity.Property(x => x.Description).HasMaxLength(1000);
            entity.Ignore(x => x.IsPriced);
            entity.Ignore(x => x.IsTemplated);
            entity.HasIndex(x => new { x.ClinicBranchId, x.Group, x.SortOrder });
        });

        // Muc danh muc
        builder.Entity<CatalogEntry>(entity =>
        {
            entity.ToTable("bd_catalog_entries");
            entity.ConfigureByConvention();
            entity.Property(x => x.Group).HasMaxLength(64).IsRequired();
            entity.Property(x => x.Name).HasMaxLength(300).IsRequired();
            entity.Property(x => x.Code).HasMaxLength(64);
            entity.Property(x => x.Description).HasMaxLength(2000);
            entity.Property(x => x.Price).HasColumnType("numeric(18,2)");
            entity.HasIndex(x => new { x.ClinicBranchId, x.Group, x.IsActive });
            entity.HasIndex(x => new { x.TaxonomyId, x.SortOrder });
        });

        // Phan cong nhan vien theo chi nhanh
        builder.Entity<StaffBranchAssignment>(entity =>
        {
            entity.ToTable("bd_staff_branch_assignments");
            entity.ConfigureByConvention();
            entity.HasIndex(x => new { x.StaffId, x.ClinicBranchId }).IsUnique();
            entity.HasIndex(x => x.ClinicBranchId);
        });

        // Quan tri van hanh - bai viet
        builder.Entity<OperationsArticle>(entity =>
        {
            entity.ToTable("bd_operations_articles");
            entity.ConfigureByConvention();
            entity.Property(x => x.Department).HasConversion<short>();
            entity.Property(x => x.Section).HasConversion<short>();
            entity.Property(x => x.Title).HasMaxLength(300).IsRequired();
            entity.Property(x => x.Summary).HasMaxLength(1000);
            entity.HasIndex(x => new { x.ClinicBranchId, x.Department, x.Section, x.SortOrder });
        });

        // Quan tri van hanh - cong viec
        builder.Entity<OperationsTask>(entity =>
        {
            entity.ToTable("bd_operations_tasks");
            entity.ConfigureByConvention();
            entity.Property(x => x.Department).HasConversion<short>();
            entity.Property(x => x.Status).HasConversion<short>();
            entity.Property(x => x.Title).HasMaxLength(300).IsRequired();
            entity.Property(x => x.Description).HasMaxLength(2000);
            entity.Property(x => x.CancellationReason).HasMaxLength(500);
            entity.HasIndex(x => new { x.ClinicBranchId, x.Department, x.Status });
            entity.HasIndex(x => x.DueDate);
        });

        builder.Entity<CskhGroup>(entity =>
        {
            entity.ToTable("bd_cskh_groups");
            entity.ConfigureByConvention();
            entity.Property(x => x.Name).HasMaxLength(200).IsRequired();
            entity.Property(x => x.Criteria).HasMaxLength(1000);
            entity.Property(x => x.Description).HasMaxLength(1000);
        });

        builder.Entity<PatientDiagnosis>(entity =>
        {
            entity.ToTable("bd_patient_diagnoses");
            entity.ConfigureByConvention();
            entity.Property(x => x.Code).HasMaxLength(32).IsRequired();
            entity.Property(x => x.Note).HasMaxLength(2000);
            entity.Property(x => x.Status).HasConversion<short>();
            entity.OwnsMany(x => x.Teeth, t => t.ToJson());
            entity.Navigation(x => x.Teeth).UsePropertyAccessMode(PropertyAccessMode.Field);
            entity.HasIndex(x => new { x.ClinicBranchId, x.Status });
            entity.HasIndex(x => new { x.PatientId, x.Status });
            entity.HasIndex(x => x.Code);
        });

        builder.Entity<PatientAdvise>(entity =>
        {
            entity.ToTable("bd_patient_advises");
            entity.ConfigureByConvention();
            entity.Property(x => x.Code).HasMaxLength(32).IsRequired();
            entity.Property(x => x.Note).HasMaxLength(2000);
            entity.Property(x => x.Status).HasConversion<short>();
            entity.Property(x => x.DiscountType).HasConversion<short>();
            entity.Property(x => x.OriginalPrice).HasColumnType("numeric(18,2)");
            entity.Property(x => x.Price).HasColumnType("numeric(18,2)");
            entity.Property(x => x.DiscountValue).HasColumnType("numeric(18,2)");
            entity.Property(x => x.VoucherDiscountAmount).HasColumnType("numeric(18,2)");
            entity.OwnsMany(x => x.Teeth, t => t.ToJson());
            entity.Navigation(x => x.Teeth).UsePropertyAccessMode(PropertyAccessMode.Field);
            entity.PrimitiveCollection(x => x.ImageIds).UsePropertyAccessMode(PropertyAccessMode.Field);
            entity.Ignore(x => x.GrossAmount);
            entity.Ignore(x => x.DiscountAmount);
            entity.Ignore(x => x.EffectiveAmount);
            entity.HasIndex(x => new { x.ClinicBranchId, x.Status });
            entity.HasIndex(x => new { x.PatientId, x.Status });
            entity.HasIndex(x => x.PatientDiagnosisId);
            entity.HasIndex(x => x.TreatmentPlanId);
            entity.HasIndex(x => x.Code);
        });

        builder.Entity<AdviseGroup>(entity =>
        {
            entity.ToTable("bd_advise_groups");
            entity.ConfigureByConvention();
            entity.Property(x => x.Name).HasMaxLength(200).IsRequired();
            entity.Property(x => x.Description).HasMaxLength(1000);
            entity.HasIndex(x => new { x.PatientId, x.SortOrder });
        });
    }

    private static void ConfigureOperations(ModelBuilder builder)
    {
        builder.Entity<OperationCategory>(entity =>
        {
            entity.ToTable("bd_operation_categories");
            entity.ConfigureByConvention();
            entity.Property(x => x.Name).HasMaxLength(200).IsRequired();
            entity.Property(x => x.Department).HasMaxLength(50).IsRequired();
            entity.Property(x => x.SubTab).HasMaxLength(50).IsRequired();
            entity.HasIndex(x => new { x.Department, x.SubTab });
        });

        builder.Entity<OperationArticle>(entity =>
        {
            entity.ToTable("bd_operation_articles");
            entity.ConfigureByConvention();
            entity.Property(x => x.Title).HasMaxLength(500).IsRequired();
            entity.Property(x => x.Content).HasMaxLength(10000);
            entity.Property(x => x.Department).HasMaxLength(50).IsRequired();
            entity.Property(x => x.SubTab).HasMaxLength(50).IsRequired();
            entity.HasIndex(x => new { x.Department, x.SubTab, x.CategoryId });
        });
    }

    private static void ConfigureTools(ModelBuilder builder)
    {
        builder.Entity<CallAssignment>(entity =>
        {
            entity.ToTable("bd_call_assignments");
            entity.ConfigureByConvention();
            entity.Property(x => x.PatientName).HasMaxLength(200).IsRequired();
            entity.Property(x => x.PhoneNumber).HasMaxLength(50).IsRequired();
            entity.Property(x => x.Notes).HasMaxLength(1000);
            entity.Property(x => x.Status).HasConversion<short>();
            entity.HasIndex(x => x.StaffId);
            entity.HasIndex(x => x.PatientId);
        });

        builder.Entity<CallLog>(entity =>
        {
            entity.ToTable("bd_call_logs");
            entity.ConfigureByConvention();
            entity.Property(x => x.PatientName).HasMaxLength(200).IsRequired();
            entity.Property(x => x.PhoneNumber).HasMaxLength(50).IsRequired();
            entity.Property(x => x.StaffName).HasMaxLength(200);
            entity.Property(x => x.Notes).HasMaxLength(1000);
            entity.Property(x => x.Direction).HasConversion<short>();
            entity.Property(x => x.Status).HasConversion<short>();
            entity.HasIndex(x => x.CreationTime);
        });

        builder.Entity<MessageTemplate>(entity =>
        {
            entity.ToTable("bd_message_templates");
            entity.ConfigureByConvention();
            entity.Property(x => x.Name).HasMaxLength(200).IsRequired();
            entity.Property(x => x.Content).HasMaxLength(2000).IsRequired();
            entity.Property(x => x.Channel).HasConversion<short>();
            entity.Property(x => x.Category).HasMaxLength(100);
            entity.HasIndex(x => x.Channel);
        });

        builder.Entity<MessageLog>(entity =>
        {
            entity.ToTable("bd_message_logs");
            entity.ConfigureByConvention();
            entity.Property(x => x.RecipientName).HasMaxLength(200).IsRequired();
            entity.Property(x => x.RecipientPhone).HasMaxLength(50).IsRequired();
            entity.Property(x => x.Content).HasMaxLength(2000).IsRequired();
            entity.Property(x => x.Channel).HasConversion<short>();
            entity.Property(x => x.Status).HasConversion<short>();
            entity.Property(x => x.ErrorMessage).HasMaxLength(500);
            entity.HasIndex(x => new { x.Channel, x.CreationTime });
        });
    }

    private static void ConfigureTimekeeping(ModelBuilder builder)
    {
        builder.Entity<TimeKeepingRecord>(entity =>
        {
            entity.ToTable("bd_time_keeping_records");
            entity.ConfigureByConvention();
            entity.Property(x => x.Registration).HasConversion<short>();
            entity.Property(x => x.Status).HasConversion<short>();
            entity.Property(x => x.LeaveReason).HasMaxLength(500);
            entity.Property(x => x.Note).HasMaxLength(1000);

            entity.OwnsOne(x => x.MorningShift, shift =>
            {
                shift.Property(s => s.Kind).HasColumnName("MorningKind").HasConversion<short>();
                shift.Property(s => s.PlannedStart).HasColumnName("MorningPlannedStart");
                shift.Property(s => s.PlannedEnd).HasColumnName("MorningPlannedEnd");
                shift.Property(s => s.CheckedInAt).HasColumnName("MorningCheckedInAt");
                shift.Property(s => s.CheckedOutAt).HasColumnName("MorningCheckedOutAt");
            });
            entity.Navigation(x => x.MorningShift).IsRequired();

            entity.OwnsOne(x => x.AfternoonShift, shift =>
            {
                shift.Property(s => s.Kind).HasColumnName("AfternoonKind").HasConversion<short>();
                shift.Property(s => s.PlannedStart).HasColumnName("AfternoonPlannedStart");
                shift.Property(s => s.PlannedEnd).HasColumnName("AfternoonPlannedEnd");
                shift.Property(s => s.CheckedInAt).HasColumnName("AfternoonCheckedInAt");
                shift.Property(s => s.CheckedOutAt).HasColumnName("AfternoonCheckedOutAt");
            });
            entity.Navigation(x => x.AfternoonShift).IsRequired();

            entity.Ignore(x => x.HasAnyAttendance);
            entity.Ignore(x => x.HasOpenShift);
            entity.Ignore(x => x.TotalWorkedMinutes);

            entity.HasIndex(x => new { x.ClinicBranchId, x.WorkDate, x.StaffId }).IsUnique();
            entity.HasIndex(x => new { x.ClinicBranchId, x.WorkDate, x.Status });
        });
    }

    private static void ConfigureFinance(ModelBuilder builder)
    {
        builder.Entity<SalesEntry>(entity =>
        {
            entity.ToTable("bd_sales_entries");
            entity.ConfigureByConvention();
            entity.Property(x => x.Code).HasMaxLength(32).IsRequired();
            entity.Property(x => x.Type).HasConversion<short>();
            entity.Property(x => x.Channel).HasConversion<short>();
            entity.Property(x => x.ApprovalStatus).HasConversion<short>();
            entity.Property(x => x.Amount).HasColumnType("numeric(18,2)");
            entity.Property(x => x.Description).HasMaxLength(1000).IsRequired();
            entity.Property(x => x.RejectionReason).HasMaxLength(500);
            entity.Ignore(x => x.CountsTowardsCashflow);
            entity.Ignore(x => x.SignedAmount);
            entity.HasIndex(x => new { x.ClinicBranchId, x.EntryDate, x.Type });
            entity.HasIndex(x => new { x.ClinicBranchId, x.ApprovalStatus });
            entity.HasIndex(x => x.Code).IsUnique();
        });

        builder.Entity<CashflowCategory>(entity =>
        {
            entity.ToTable("bd_cashflow_categories");
            entity.ConfigureByConvention();
            entity.Property(x => x.Name).HasMaxLength(200).IsRequired();
            entity.Property(x => x.Type).HasConversion<short>();
            entity.Property(x => x.Description).HasMaxLength(500);
            entity.HasIndex(x => new { x.ClinicBranchId, x.AppliesToTransfers, x.Type });
        });

        builder.Entity<CashflowEntry>(entity =>
        {
            entity.ToTable("bd_cashflow_entries");
            entity.ConfigureByConvention();
            entity.Property(x => x.TransactionType).HasConversion<short>();
            entity.Property(x => x.FromHolding).HasConversion<short>();
            entity.Property(x => x.ToHolding).HasConversion<short>();
            entity.Property(x => x.Amount).HasColumnType("numeric(18,2)");
            entity.Property(x => x.Note).HasMaxLength(1000);
            entity.HasIndex(x => new { x.ClinicBranchId, x.EntryDate });
            entity.HasIndex(x => new { x.ClinicBranchId, x.TransactionType });
        });
    }

    private static void ConfigurePromotions(ModelBuilder builder)
    {
        builder.Entity<Voucher>(entity =>
        {
            entity.ToTable("bd_vouchers");
            entity.ConfigureByConvention();
            entity.Property(x => x.Code).HasMaxLength(32).IsRequired();
            entity.Property(x => x.Name).HasMaxLength(200).IsRequired();
            entity.Property(x => x.Description).HasMaxLength(1000);
            entity.Property(x => x.DiscountType).HasConversion<short>();
            entity.Property(x => x.CustomerTarget).HasConversion<short>();
            entity.Property(x => x.Status).HasConversion<short>();
            entity.Property(x => x.DiscountValue).HasColumnType("numeric(18,2)");
            entity.Property(x => x.MaxDiscountAmount).HasColumnType("numeric(18,2)");
            entity.Property(x => x.MinOrderAmount).HasColumnType("numeric(18,2)");
            entity.Ignore(x => x.RemainingUses);
            entity.Ignore(x => x.IsExhausted);
            entity.HasIndex(x => x.Code).IsUnique();
            entity.HasIndex(x => new { x.Status, x.ValidFrom, x.ValidTo });
        });
    }

    private static void ConfigureTaxonomyCatalog(ModelBuilder builder)
    {
        builder.Entity<Taxonomy>(entity =>
        {
            entity.ToTable("bd_taxonomies");
            entity.ConfigureByConvention();
            entity.Property(x => x.Group).HasMaxLength(64).IsRequired();
            entity.Property(x => x.Name).HasMaxLength(200).IsRequired();
            entity.Property(x => x.Alias).HasMaxLength(200);
            entity.Property(x => x.Color).HasMaxLength(9);
            entity.Property(x => x.SubGroup).HasMaxLength(100);
            entity.Property(x => x.Description).HasMaxLength(1000);
            entity.Ignore(x => x.IsPriced);
            entity.Ignore(x => x.IsTemplated);
            entity.HasIndex(x => new { x.ClinicBranchId, x.Group, x.SortOrder });
        });

        builder.Entity<CatalogEntry>(entity =>
        {
            entity.ToTable("bd_catalog_entries");
            entity.ConfigureByConvention();
            entity.Property(x => x.Group).HasMaxLength(64).IsRequired();
            entity.Property(x => x.Name).HasMaxLength(300).IsRequired();
            entity.Property(x => x.Code).HasMaxLength(64);
            entity.Property(x => x.Description).HasMaxLength(2000);
            entity.Property(x => x.Price).HasColumnType("numeric(18,2)");
            entity.HasIndex(x => new { x.ClinicBranchId, x.Group, x.IsActive });
            entity.HasIndex(x => new { x.TaxonomyId, x.SortOrder });
        });
    }
}
