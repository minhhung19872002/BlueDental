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
using BlueDental.Organizations;
using BlueDental.PatientManagement;
using BlueDental.PatientManagement.Values;
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
            entity.Property(x => x.Dosage).HasMaxLength(100).IsRequired();
            entity.Property(x => x.Frequency).HasMaxLength(100).IsRequired();
            entity.Property(x => x.Instructions).HasMaxLength(1000);
            entity.Property(x => x.Status).HasConversion<short>();
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
            entity.Ignore(x => x.NeedsReorder);
            entity.HasIndex(x => new { x.BranchId, x.ItemCode }).IsUnique();
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
            entity.HasIndex(x => new { x.BranchId, x.Status });
            entity.HasIndex(x => new { x.PatientId, x.Status });
        });

        builder.Entity<CskhGroup>(entity =>
        {
            entity.ToTable("bd_cskh_groups");
            entity.ConfigureByConvention();
            entity.Property(x => x.Name).HasMaxLength(200).IsRequired();
            entity.Property(x => x.Criteria).HasMaxLength(1000);
            entity.Property(x => x.Description).HasMaxLength(1000);
        });
    }
}
