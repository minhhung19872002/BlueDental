using BlueDental.Appointments;
using BlueDental.Appointments.Values;
using BlueDental.Billing;
using BlueDental.Billing.Values;
using BlueDental.Catalogs;
using BlueDental.ClinicIntegration;
using BlueDental.CustomerCare;
using BlueDental.FileManagement;
using BlueDental.Inventory;
using BlueDental.Labo;
using BlueDental.Notifications;
using BlueDental.Operations;
using BlueDental.Organizations;
using BlueDental.Queue;
using BlueDental.Tools;
using BlueDental.PatientManagement;
using BlueDental.PatientManagement.Values;
using BlueDental.Finance;
using BlueDental.Promotions;
using BlueDental.Timekeeping;
using BlueDental.TreatmentManagement;
using BlueDental.EInvoicing;
using BlueDental.Zalo;

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

        ConfigureLabo(builder);
        ConfigureCustomerCare(builder);
        ConfigureOperations(builder);
        ConfigureTools(builder);
        ConfigureTimekeeping(builder);
        ConfigureFinance(builder);
        ConfigurePromotions(builder);
        ConfigurePatientRelations(builder);
        ConfigureTaxonomyCatalog(builder);
        ConfigureQueue(builder);
        ConfigureClinicIntegration(builder);
        ConfigureZalo(builder);
        ConfigureEInvoicing(builder);
        ConfigureMarketing(builder);
    }

    private static void ConfigureZalo(ModelBuilder builder)
    {
        builder.Entity<ZaloOaConnection>(entity =>
        {
            entity.ToTable("bd_zalo_oa_connections");
            entity.ConfigureByConvention();
            entity.Property(x => x.OaId).HasMaxLength(ZaloOaConnection.MaxOaIdLength).IsRequired();
            entity.Property(x => x.OaName).HasMaxLength(ZaloOaConnection.MaxNameLength).IsRequired();
            entity.Property(x => x.AvatarUrl).HasMaxLength(ZaloOaConnection.MaxUrlLength);
            entity.Property(x => x.PackageName).HasMaxLength(ZaloOaConnection.MaxNameLength);
            entity.Property(x => x.AccessTokenCipher).HasMaxLength(ZaloOaConnection.MaxCipherLength).IsRequired();
            entity.Property(x => x.RefreshTokenCipher).HasMaxLength(ZaloOaConnection.MaxCipherLength).IsRequired();
            entity.Property(x => x.Status).HasConversion<short>();
            entity.Property(x => x.LastError).HasMaxLength(ZaloOaConnection.MaxErrorLength);
            // One live OA link per branch; a soft-deleted (disconnected) one must not block a new one.
            entity.HasIndex(x => x.ClinicBranchId).IsUnique().HasFilter("\"IsDeleted\" = false");
        });
    }

    private static void ConfigureClinicIntegration(ModelBuilder builder)
    {
        builder.Entity<ClinicConnection>(entity =>
        {
            entity.ToTable("bd_clinic_connections");
            entity.ConfigureByConvention();
            entity.Property(x => x.BaseUrl).HasMaxLength(ClinicConnection.MaxBaseUrlLength).IsRequired();
            entity.Property(x => x.ApiKeyCipher).HasMaxLength(2000).IsRequired();
            entity.Property(x => x.Status).HasConversion<short>();
            entity.Property(x => x.LastError).HasMaxLength(ClinicConnection.MaxErrorLength);
            // One link per branch; a soft-deleted one must not block a new one.
            entity.HasIndex(x => x.ClinicBranchId).IsUnique().HasFilter("\"IsDeleted\" = false");
        });

        builder.Entity<ServiceCatalogSyncState>(entity =>
        {
            entity.ToTable("bd_service_catalog_sync_states");
            entity.ConfigureByConvention();
            entity.Property(x => x.Fingerprint).HasMaxLength(ServiceCatalogSyncState.FingerprintLength).IsRequired();
            entity.Property(x => x.PartnerServiceId).HasMaxLength(ServiceCatalogSyncState.MaxPartnerIdLength);
            entity.HasIndex(x => x.CatalogEntryId).IsUnique();
            entity.HasIndex(x => x.ClinicBranchId);
        });

        builder.Entity<IntegrationCallLog>(entity =>
        {
            entity.ToTable("bd_integration_call_logs");
            entity.ConfigureByConvention();
            entity.Property(x => x.Operation).HasMaxLength(IntegrationCallLog.MaxOperationLength).IsRequired();
            entity.Property(x => x.RequestPath).HasMaxLength(IntegrationCallLog.MaxPathLength).IsRequired();
            entity.Property(x => x.Error).HasMaxLength(IntegrationCallLog.MaxErrorLength);
            entity.HasIndex(x => new { x.ClinicBranchId, x.CreationTime });
        });
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
            entity.Property(x => x.ProvinceId).HasMaxLength(20);
            entity.Property(x => x.WardId).HasMaxLength(20);
            entity.Property(x => x.PhoneNumber).HasMaxLength(50);
            entity.Property(x => x.Email).HasMaxLength(256);
            entity.Property(x => x.Slogan).HasMaxLength(500);
            entity.Property(x => x.TaxCode).HasMaxLength(50);
            entity.Property(x => x.ContactPerson).HasMaxLength(200);
            entity.Property(x => x.AllowedIpRanges).HasMaxLength(2000);
            entity.Ignore(x => x.RestrictsLoginByIp);
            entity.Ignore(x => x.RestrictsUsageHours);
            entity.Ignore(x => x.UsageHoursText);
            entity.Property(x => x.Status).HasConversion<short>();
            entity.HasIndex(x => x.Code).IsUnique();
        });

        builder.Entity<Department>(entity =>
        {
            entity.ToTable("bd_departments");
            entity.ConfigureByConvention();
            entity.Property(x => x.Name).HasMaxLength(200).IsRequired();
            entity.Property(x => x.Description).HasMaxLength(1000);
            entity.HasIndex(x => new { x.BranchId, x.SortOrder });
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

        builder.Entity<PaymentAccount>(entity =>
        {
            entity.ToTable("bd_payment_accounts");
            entity.ConfigureByConvention();
            entity.Property(x => x.HolderName).HasMaxLength(200).IsRequired();
            entity.Property(x => x.PhoneNumber).HasMaxLength(30);
            entity.Property(x => x.BankName).HasMaxLength(200);
            entity.Property(x => x.AccountNumber).HasMaxLength(50);
            // Only the pointer to the QR lives here; MinIO holds the bytes.
            entity.Property(x => x.QrImageBlobName).HasMaxLength(400);
            entity.Property(x => x.QrImageFileName).HasMaxLength(260);
            entity.Property(x => x.QrImageContentType).HasMaxLength(100);
            entity.Ignore(x => x.HasQrImage);
            // The screen always asks for one branch and one tab at a time.
            entity.HasIndex(x => new { x.ClinicBranchId, x.Kind });
        });

        builder.Entity<PatientTag>(entity =>
        {
            entity.ToTable("bd_patient_tags");
            entity.ConfigureByConvention();
            entity.Property(x => x.Name).HasMaxLength(200).IsRequired();
            entity.Property(x => x.Color).HasMaxLength(20).IsRequired();
            entity.Property(x => x.Description).HasMaxLength(1000);
            entity.HasIndex(x => x.ClinicBranchId);
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
            entity.Property(x => x.OccupationOther).HasMaxLength(200);
            entity.Property(x => x.InsuranceNumber).HasMaxLength(30);
            entity.Property(x => x.ProvinceCode).HasMaxLength(20);
            entity.Property(x => x.WardCode).HasMaxLength(20);
            entity.Property(x => x.OldAddress).HasMaxLength(500);
            entity.Property(x => x.Note).HasMaxLength(1000);
            entity.PrimitiveCollection(x => x.TagIds).UsePropertyAccessMode(PropertyAccessMode.Field);
            entity.PrimitiveCollection(x => x.DiseaseHistoryEntryIds).UsePropertyAccessMode(PropertyAccessMode.Field);

            // Lý do đến khám is a dated list; the scalar of the same name is the
            // root line's text, computed, and must not become a column again.
            entity.HasMany(x => x.ExaminationReasons)
                .WithOne()
                .HasForeignKey(x => x.PatientId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.Navigation(x => x.ExaminationReasons).UsePropertyAccessMode(PropertyAccessMode.Field);
            entity.Ignore(x => x.ExaminationReason);

            entity.HasMany(x => x.Guardians)
                .WithOne()
                .HasForeignKey(x => x.PatientId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.Navigation(x => x.Guardians).UsePropertyAccessMode(PropertyAccessMode.Field);

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

        builder.Entity<PatientExaminationReason>(entity =>
        {
            entity.ToTable("bd_patient_examination_reasons");
            entity.ConfigureByConvention();
            entity.Property(x => x.Content)
                .HasMaxLength(PatientExaminationReason.MaxContentLength)
                .IsRequired();
            entity.Property(x => x.Note).HasMaxLength(PatientExaminationReason.MaxNoteLength);
            entity.HasIndex(x => new { x.PatientId, x.RecordedAt });
        });

        builder.Entity<PatientGuardian>(entity =>
        {
            entity.ToTable("bd_patient_guardians");
            entity.ConfigureByConvention();
            entity.Property(x => x.Relation).HasConversion<short>();
            entity.Property(x => x.ProofType).HasConversion<short?>();
            entity.Property(x => x.Gender).HasConversion<short?>();
            entity.Property(x => x.RelationNote).HasMaxLength(PatientGuardianConsts.MaxRelationNoteLength);
            entity.Property(x => x.ProofBlobName).HasMaxLength(PatientGuardianConsts.MaxProofBlobNameLength);
            entity.Property(x => x.ProofFileName).HasMaxLength(PatientGuardianConsts.MaxProofFileNameLength);
            entity.Property(x => x.FullName).HasMaxLength(PatientGuardianConsts.MaxFullNameLength).IsRequired();
            entity.Property(x => x.Phone).HasMaxLength(PatientGuardianConsts.MaxPhoneLength).IsRequired();
            entity.Property(x => x.NationalId).HasMaxLength(PatientGuardianConsts.MaxNationalIdLength).IsRequired();
            entity.Property(x => x.IdIssuedPlace).HasMaxLength(PatientGuardianConsts.MaxIdIssuedPlaceLength);
            entity.Property(x => x.Email).HasMaxLength(PatientGuardianConsts.MaxEmailLength);
            entity.Property(x => x.Address).HasMaxLength(PatientGuardianConsts.MaxAddressLength);
            entity.HasIndex(x => new { x.PatientId, x.SortOrder });

            // The guardian's own hồ sơ, when picked from the search box. Deleting
            // that record must not take this child's guardian with it.
            entity.HasOne<Patient>()
                .WithMany()
                .HasForeignKey(x => x.LinkedPatientId)
                .OnDelete(DeleteBehavior.SetNull);
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
            entity.Property(x => x.Outcome).HasConversion<short>();
            entity.Property(x => x.ChiefComplaint).HasMaxLength(500);
            entity.Property(x => x.Notes).HasMaxLength(2000);
            entity.Property(x => x.CancellationNote).HasMaxLength(500);
            entity.Property(x => x.Color).HasMaxLength(20);
            entity.Property(x => x.PatientName).HasMaxLength(200);
            entity.Property(x => x.PatientPhone).HasMaxLength(20);

            entity.OwnsOne(x => x.Slot, slot =>
            {
                slot.Property(s => s.Start).HasColumnName("slot_start").IsRequired();
                slot.Property(s => s.End).HasColumnName("slot_end").IsRequired();
            });

            entity.HasIndex(x => new { x.DentistId, x.Status });
            entity.HasIndex(x => new { x.PatientId, x.Status });
            entity.HasIndex(x => new { x.BranchId, x.Status });
            entity.HasIndex(x => new { x.BranchId, x.IsTemporary });
            entity.HasIndex(x => x.SeriesId);
        });

        builder.Entity<AppointmentSeries>(entity =>
        {
            entity.ToTable("bd_appointment_series");
            entity.ConfigureByConvention();
            entity.Property(x => x.Frequency).HasConversion<short>();
            entity.Property(x => x.End).HasConversion<short>();
            entity.Property(x => x.WeekDays).HasMaxLength(20).IsRequired();
            entity.HasIndex(x => new { x.BranchId, x.PatientId });
        });

        builder.Entity<AppointmentChangeLog>(entity =>
        {
            entity.ToTable("bd_appointment_change_logs");
            entity.ConfigureByConvention();
            entity.Property(x => x.Action).HasConversion<short>();
            entity.Property(x => x.Source).HasConversion<short>();
            entity.Property(x => x.StatusBefore).HasConversion<short>();
            entity.Property(x => x.StatusAfter).HasConversion<short>();
            entity.Property(x => x.ChangedFields).HasMaxLength(500);
            entity.Property(x => x.ChangesJson).IsRequired();
            entity.Property(x => x.ActorName).HasMaxLength(200);
            entity.Property(x => x.ActorUserName).HasMaxLength(256);
            entity.Property(x => x.ActorRole).HasMaxLength(100);
            entity.Property(x => x.IpAddress).HasMaxLength(64);
            entity.Property(x => x.Browser).HasMaxLength(100);
            entity.Property(x => x.OperatingSystem).HasMaxLength(100);
            entity.Property(x => x.UserAgent).HasMaxLength(512);

            entity.HasIndex(x => new { x.PatientId, x.OccurredAt });
            entity.HasIndex(x => x.AppointmentId);
            entity.HasIndex(x => new { x.BranchId, x.OccurredAt });
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
            entity.HasMany(x => x.AppliedVouchers)
                .WithOne()
                .HasForeignKey(x => x.TreatmentPlanId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.Navigation(x => x.AppliedVouchers).UsePropertyAccessMode(PropertyAccessMode.Field);
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
            entity.Property(x => x.DiagnosisText).HasMaxLength(2000);
            entity.Property(x => x.DiagnosisNote).HasMaxLength(2000);
            entity.Property(x => x.Note).HasMaxLength(1000);
            entity.Property(x => x.TreatmentType).HasConversion<short>();
            entity.HasMany(x => x.Items)
                .WithOne()
                .HasForeignKey(x => x.PrescriptionId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.Navigation(x => x.Items).UsePropertyAccessMode(PropertyAccessMode.Field);
            entity.HasMany(x => x.Diagnoses)
                .WithOne()
                .HasForeignKey(x => x.PrescriptionId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.Navigation(x => x.Diagnoses).UsePropertyAccessMode(PropertyAccessMode.Field);
            entity.HasIndex(x => new { x.PatientId, x.IssuedAt });
            entity.HasIndex(x => new { x.ClinicBranchId, x.IssuedAt });
            entity.HasIndex(x => x.Code);
        });

        builder.Entity<PrescriptionItem>(entity =>
        {
            entity.ToTable("bd_prescription_items");
            entity.ConfigureByConvention();
            entity.Property(x => x.MedicationName).HasMaxLength(300).IsRequired();
            entity.Property(x => x.Morning).HasColumnType("numeric(18,2)");
            entity.Property(x => x.Noon).HasColumnType("numeric(18,2)");
            entity.Property(x => x.Afternoon).HasColumnType("numeric(18,2)");
            entity.Property(x => x.Evening).HasColumnType("numeric(18,2)");
            entity.Property(x => x.Usage).HasConversion<int>();
            entity.Property(x => x.OtherUsage).HasMaxLength(200);
            // Số lượng is derived on the entity, never stored.
            entity.Ignore(x => x.Quantity);
            entity.Ignore(x => x.DailyAmount);
            entity.HasIndex(x => new { x.PrescriptionId, x.SortOrder });
        });

        builder.Entity<PrescriptionDiagnosis>(entity =>
        {
            entity.ToTable("bd_prescription_diagnoses");
            entity.ConfigureByConvention();
            entity.Property(x => x.PlanCode).HasMaxLength(50).IsRequired();
            entity.Property(x => x.DiagnosisName).HasMaxLength(500).IsRequired();
            entity.Property(x => x.ToothCodes).HasMaxLength(500).IsRequired();
            entity.HasIndex(x => new { x.PrescriptionId, x.SortOrder });
            entity.HasIndex(x => x.TreatmentPlanId);
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

        // Bao gia — the "BG n" tabs of Chan doan & Tu van. The lines are a JSON
        // column rather than a table of their own: they carry no keys of their
        // own and are only ever read and written whole, the same reason
        // PatientAdvise keeps its teeth that way.
        builder.Entity<PatientQuote>(entity =>
        {
            entity.ToTable("bd_patient_quotes");
            entity.ConfigureByConvention();
            entity.OwnsMany(x => x.Lines, line => line.ToJson());
            entity.Navigation(x => x.Lines).UsePropertyAccessMode(PropertyAccessMode.Field);
            entity.HasIndex(x => new { x.PatientId, x.ClinicBranchId });
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
            entity.Property(x => x.PerformerName).HasMaxLength(200);
            entity.Property(x => x.Note).HasMaxLength(1000);
            entity.HasIndex(x => x.AllocationCode).IsUnique();
            entity.HasIndex(x => new { x.DepartmentId, x.AllocationTime });
            entity.Ignore(x => x.TotalQuantity);

            entity.HasMany(x => x.Items)
                .WithOne()
                .HasForeignKey(x => x.MaterialAllocationId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.Navigation(x => x.Items).AutoInclude();
        });

        builder.Entity<MaterialAllocationItem>(entity =>
        {
            entity.ToTable("bd_material_allocation_items");
            entity.ConfigureByConvention();
            entity.Property(x => x.Name).HasMaxLength(200).IsRequired();
            entity.Property(x => x.Quantity).HasPrecision(18, 3);
            entity.Property(x => x.ConfirmedQuantity).HasPrecision(18, 3);
            entity.HasIndex(x => x.MaterialAllocationId);
            entity.HasIndex(x => x.InventoryItemId);
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

        builder.Entity<ClinicConfigure>(entity =>
        {
            entity.ToTable("bd_clinic_configures");
            entity.ConfigureByConvention();
            entity.Property(x => x.Module).HasMaxLength(50).IsRequired();
            entity.Property(x => x.Name).HasMaxLength(200).IsRequired();
            entity.HasIndex(x => new { x.BranchId, x.Module, x.IsEnabled });
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
            entity.Property(x => x.Kind).HasConversion<short>();
            entity.Property(x => x.AttachmentUrl).HasMaxLength(500);
            entity.Property(x => x.ToothShade).HasMaxLength(100);
            // A child (Làm tiếp công đoạn / Bảo hành) keeps its parent's code,
            // so only the orders without a parent hold the code uniquely.
            entity.HasIndex(x => x.OrderCode).IsUnique().HasFilter("\"ParentOrderId\" IS NULL");
            entity.HasIndex(x => new { x.BranchId, x.Status });
            entity.HasIndex(x => x.TreatmentStageId);
            entity.HasIndex(x => x.ParentOrderId);
        });

        builder.Entity<LaboSupplier>(entity =>
        {
            entity.ToTable("bd_labo_suppliers");
            entity.ConfigureByConvention();
            entity.Property(x => x.Name).HasMaxLength(200).IsRequired();
            entity.Property(x => x.Phone).HasMaxLength(50);
            entity.Property(x => x.Email).HasMaxLength(256);
            entity.Property(x => x.ContactPerson).HasMaxLength(200);
            entity.Property(x => x.TaxCode).HasMaxLength(100);
            entity.Property(x => x.Address).HasMaxLength(500);
            entity.Property(x => x.ProvinceCode).HasMaxLength(20);
            entity.Property(x => x.WardCode).HasMaxLength(20);
            entity.Property(x => x.LogoFileId).HasMaxLength(400);
            entity.Property(x => x.LogoPath).HasMaxLength(1000);
            // The list always asks for one branch at a time.
            entity.HasIndex(x => x.ClinicBranchId);
        });

        builder.Entity<Staff.StaffViolationType>(entity =>
        {
            entity.ToTable("bd_staff_violation_types");
            entity.ConfigureByConvention();
            entity.Property(x => x.Name).HasMaxLength(Staff.StaffViolationType.MaxNameLength).IsRequired();
            entity.Property(x => x.DefaultFineAmount).HasColumnType("numeric(18,2)");
            entity.HasIndex(x => x.ClinicBranchId);
        });

        builder.Entity<Staff.StaffPenalty>(entity =>
        {
            entity.ToTable("bd_staff_penalties");
            entity.ConfigureByConvention();
            entity.Property(x => x.Action).HasConversion<short>();
            entity.Property(x => x.Status).HasConversion<short>();
            entity.Property(x => x.FineAmount).HasColumnType("numeric(18,2)");
            entity.Property(x => x.Description).HasMaxLength(Staff.StaffPenalty.MaxDescriptionLength);
            entity.Property(x => x.CancelReason).HasMaxLength(Staff.StaffPenalty.MaxCancelReasonLength);
            entity.HasOne<Staff.StaffViolationType>()
                .WithMany()
                .HasForeignKey(x => x.ViolationTypeId)
                .OnDelete(DeleteBehavior.Restrict);
            // The list is always one branch, newest violation first.
            entity.HasIndex(x => new { x.ClinicBranchId, x.ViolationDate });
            entity.HasIndex(x => x.StaffId);
        });

        builder.Entity<Staff.StaffCompensation>(entity =>
        {
            entity.ToTable("bd_staff_compensations");
            entity.ConfigureByConvention();
            entity.Property(x => x.BaseSalary).HasColumnType("numeric(18,2)");
            entity.Property(x => x.Allowance).HasColumnType("numeric(18,2)");
            entity.HasIndex(x => x.StaffId).IsUnique().HasFilter("\"IsDeleted\" = false");
        });

        builder.Entity<Staff.PayrollPeriod>(entity =>
        {
            entity.ToTable("bd_payroll_periods");
            entity.ConfigureByConvention();
            entity.Property(x => x.Status).HasConversion<short>();
            entity.Property(x => x.StandardWorkDays).HasColumnType("numeric(5,2)");
            entity.Property(x => x.OvertimeRate).HasColumnType("numeric(5,2)");
            entity.Ignore(x => x.NetTotal);
            entity.HasMany(x => x.Entries).WithOne().HasForeignKey(x => x.PayrollPeriodId).OnDelete(DeleteBehavior.Cascade);
            entity.Navigation(x => x.Entries).UsePropertyAccessMode(PropertyAccessMode.Field);
            // One sheet per branch and month.
            entity.HasIndex(x => new { x.ClinicBranchId, x.Year, x.Month }).IsUnique().HasFilter("\"IsDeleted\" = false");
        });

        builder.Entity<Staff.PayrollEntry>(entity =>
        {
            entity.ToTable("bd_payroll_entries");
            entity.ConfigureByConvention();
            entity.Property(x => x.StaffName).HasMaxLength(256).IsRequired();
            foreach (var money in new[]
                     {
                         nameof(Staff.PayrollEntry.BaseSalary), nameof(Staff.PayrollEntry.Allowance),
                         nameof(Staff.PayrollEntry.CommissionAmount), nameof(Staff.PayrollEntry.PenaltyAmount),
                         nameof(Staff.PayrollEntry.Bonus), nameof(Staff.PayrollEntry.OtherDeduction),
                         nameof(Staff.PayrollEntry.SalaryByWorkDays), nameof(Staff.PayrollEntry.OvertimePay),
                         nameof(Staff.PayrollEntry.GrossSalary), nameof(Staff.PayrollEntry.NetSalary),
                     })
            {
                entity.Property<decimal>(money).HasColumnType("numeric(18,2)");
            }
            entity.Property(x => x.WorkedDays).HasColumnType("numeric(5,2)");
            entity.Property(x => x.LeaveDays).HasColumnType("numeric(5,2)");
            entity.Property(x => x.WorkDaysOverride).HasColumnType("numeric(5,2)");
            entity.Property(x => x.Note).HasMaxLength(500);
            entity.Ignore(x => x.PayableWorkDays);
            entity.HasIndex(x => new { x.PayrollPeriodId, x.StaffId }).IsUnique();
        });

        builder.Entity<Staff.OrgUnit>(entity =>
        {
            entity.ToTable("bd_org_units");
            entity.ConfigureByConvention();
            entity.Property(x => x.Code).HasMaxLength(Staff.OrgUnit.MaxCodeLength).IsRequired();
            entity.Property(x => x.Name).HasMaxLength(Staff.OrgUnit.MaxNameLength).IsRequired();
            entity.Property(x => x.Kind).HasConversion<short>();
            entity.Ignore(x => x.IsRoot);
            entity.HasOne<Staff.OrgUnit>().WithMany().HasForeignKey(x => x.ParentId).OnDelete(DeleteBehavior.Restrict);
            entity.HasIndex(x => x.ParentId);
            // Each person heads at most one unit.
            entity.HasIndex(x => x.HeadStaffId).IsUnique().HasFilter("\"IsDeleted\" = false");
            entity.HasIndex(x => x.Code).IsUnique().HasFilter("\"IsDeleted\" = false");
        });

        builder.Entity<Staff.OrgUnitMember>(entity =>
        {
            entity.ToTable("bd_org_unit_members");
            entity.ConfigureByConvention();
            entity.HasOne<Staff.OrgUnit>().WithMany().HasForeignKey(x => x.OrgUnitId).OnDelete(DeleteBehavior.Cascade);
            // One đơn vị chính per person.
            entity.HasIndex(x => x.StaffId).IsUnique();
            entity.HasIndex(x => x.OrgUnitId);
        });

        builder.Entity<Staff.OrgUnitChangeLog>(entity =>
        {
            entity.ToTable("bd_org_unit_change_logs");
            entity.ConfigureByConvention();
            entity.Property(x => x.OrgUnitName).HasMaxLength(Staff.OrgUnit.MaxNameLength).IsRequired();
            entity.Property(x => x.OrgUnitKind).HasConversion<short>();
            entity.Property(x => x.Action).HasConversion<short>();
            entity.Property(x => x.ChangesJson).IsRequired();
            entity.Property(x => x.ActorName).HasMaxLength(256);
            entity.HasIndex(x => x.OccurredAt);
            entity.HasIndex(x => x.OrgUnitId);
        });

        builder.Entity<LaboMaterial>(entity =>
        {
            entity.ToTable("bd_labo_materials");
            entity.ConfigureByConvention();
            entity.Property(x => x.Name).HasMaxLength(200).IsRequired();
            // The table is read one branch at a time, and usually one group too.
            entity.HasIndex(x => new { x.ClinicBranchId, x.TaxonomyId });
        });
    }

    private static void ConfigureMarketing(ModelBuilder builder)
    {
        builder.Entity<Marketing.Ticket>(entity =>
        {
            entity.ToTable("bd_marketing_tickets");
            entity.ConfigureByConvention();
            entity.Property(x => x.Code).HasMaxLength(Marketing.Ticket.MaxCodeLength).IsRequired();
            entity.Property(x => x.FullName).HasMaxLength(Marketing.Ticket.MaxFullNameLength).IsRequired();
            entity.Property(x => x.Phone).HasMaxLength(Marketing.Ticket.MaxPhoneLength).IsRequired();
            entity.Property(x => x.Email).HasMaxLength(Marketing.Ticket.MaxEmailLength);
            entity.Property(x => x.Note).HasMaxLength(Marketing.Ticket.MaxNoteLength);
            entity.Property(x => x.NotPotentialReason).HasMaxLength(Marketing.Ticket.MaxReasonLength);
            entity.Property(x => x.DeleteReason).HasMaxLength(Marketing.Ticket.MaxReasonLength);
            entity.Property(x => x.Status).HasConversion<short>();
            entity.Property(x => x.Channel).HasConversion<short>();
            entity.Property(x => x.LastContactResult).HasConversion<short?>();
            entity.PrimitiveCollection(x => x.TagIds).UsePropertyAccessMode(PropertyAccessMode.Field);
            // The list is one branch, newest first; the code is numbered per branch
            // (deleted tickets keep theirs, so no filter on the index).
            entity.HasIndex(x => new { x.ClinicBranchId, x.ReceivedAt });
            entity.HasIndex(x => new { x.ClinicBranchId, x.Code }).IsUnique();
            // Dedup on create, and patient-side lookups.
            entity.HasIndex(x => new { x.ClinicBranchId, x.Phone });
            entity.HasIndex(x => x.AppointmentId);
            entity.HasIndex(x => x.AssigneeId);
            // Ticket File (BA 8.4): the file list counts each file's tickets.
            entity.HasIndex(x => x.ImportFileId);
        });

        builder.Entity<Marketing.TicketActivity>(entity =>
        {
            entity.ToTable("bd_marketing_ticket_activities");
            entity.ConfigureByConvention();
            entity.Property(x => x.Kind).HasConversion<short>();
            entity.Property(x => x.ContactResult).HasConversion<short?>();
            entity.Property(x => x.FromStatus).HasConversion<short?>();
            entity.Property(x => x.ToStatus).HasConversion<short?>();
            entity.Property(x => x.Note).HasMaxLength(Marketing.Ticket.MaxNoteLength);
            entity.HasOne<Marketing.Ticket>()
                .WithMany()
                .HasForeignKey(x => x.TicketId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(x => new { x.TicketId, x.CreationTime });
        });

        builder.Entity<Marketing.TicketTag>(entity =>
        {
            entity.ToTable("bd_marketing_ticket_tags");
            entity.ConfigureByConvention();
            entity.Property(x => x.Name).HasMaxLength(Marketing.TicketTag.MaxNameLength).IsRequired();
            entity.Property(x => x.Color).HasMaxLength(Marketing.TicketTag.MaxColorLength).IsRequired();
            entity.HasIndex(x => new { x.ClinicBranchId, x.Name });
        });

        builder.Entity<Marketing.TicketImportFile>(entity =>
        {
            entity.ToTable("bd_marketing_ticket_import_files");
            entity.ConfigureByConvention();
            entity.Property(x => x.FileName).HasMaxLength(Marketing.TicketImportFile.MaxFileNameLength).IsRequired();
            entity.PrimitiveCollection(x => x.TagIds).UsePropertyAccessMode(PropertyAccessMode.Field);
            entity.PrimitiveCollection(x => x.AssigneeIds).UsePropertyAccessMode(PropertyAccessMode.Field);
            entity.HasIndex(x => new { x.ClinicBranchId, x.CreationTime });
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
            entity.Ignore(x => x.IsContacted);
            // Nhắc lịch hẹn / Đặt lịch không đến are joined to their appointment.
            entity.HasIndex(x => new { x.Type, x.AppointmentId });
            entity.HasIndex(x => new { x.BranchId, x.Status });
            entity.HasIndex(x => new { x.PatientId, x.Status });
            entity.HasIndex(x => new { x.BranchId, x.Type, x.DueAt });
            // Sau điều trị is windowed by treatment day and holds one task per
            // patient per day, so both the board and the dedupe read this.
            entity.HasIndex(x => new { x.BranchId, x.Type, x.TreatmentDate, x.PatientId });
        });

        builder.Entity<CareContactLog>(entity =>
        {
            entity.ToTable("bd_care_contact_logs");
            entity.ConfigureByConvention();
            entity.Property(x => x.Status).HasConversion<short>();
            entity.Property(x => x.Note).HasMaxLength(1000);
            entity.HasIndex(x => new { x.CareRecordId, x.CreationTime });
        });

        // Chan doan cua benh nhan
        builder.Entity<PatientDiagnosis>(entity =>
        {
            entity.ToTable("bd_patient_diagnoses");
            entity.ConfigureByConvention();
            entity.Property(x => x.Code).HasMaxLength(32).IsRequired();
            entity.Property(x => x.Note).HasMaxLength(2000);
            // The printed sheet's advice body is formatted HTML, so it is left
            // unbounded rather than squeezed into a varchar.
            entity.Property(x => x.ContentDiagnosis).HasColumnType("text");
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
            entity.Property(x => x.Type).HasConversion<short>();
            entity.HasIndex(x => new { x.PatientId, x.TakenAt });
            entity.HasIndex(x => new { x.PatientId, x.Ordering });
            entity.HasIndex(x => x.TreatmentStageId);
            entity.HasIndex(x => x.LaboOrderId);
        });

        // Phieu benh an cua benh nhan
        builder.Entity<PatientMedicalRecord>(entity =>
        {
            entity.ToTable("bd_patient_medical_records");
            entity.ConfigureByConvention();
            entity.Property(x => x.Form).HasConversion<short>();
            entity.Property(x => x.Title).HasMaxLength(300).IsRequired();
            entity.Property(x => x.Content).HasMaxLength(PatientMedicalRecord.MaxContentLength);
            entity.HasIndex(x => new { x.PatientId, x.SortOrder });
            entity.HasIndex(x => x.ClinicBranchId);
        });

        // Dong dich vu cua phieu dieu tri
        builder.Entity<TreatmentService>(entity =>
        {
            entity.ToTable("bd_treatment_services");
            entity.ConfigureByConvention();
            entity.Property(x => x.Code).HasMaxLength(32).IsRequired();
            entity.Property(x => x.Status).HasConversion<short>();
            entity.Property(x => x.DiscountType).HasConversion<short>();
            entity.Property(x => x.TaxRate).HasConversion<short?>();
            entity.Property(x => x.OriginalPrice).HasColumnType("numeric(18,2)");
            entity.Property(x => x.Price).HasColumnType("numeric(18,2)");
            entity.Property(x => x.DiscountValue).HasColumnType("numeric(18,2)");
            entity.Property(x => x.Note).HasMaxLength(1000);
            entity.OwnsMany(x => x.Teeth, t => t.ToJson());
            entity.Navigation(x => x.Teeth).UsePropertyAccessMode(PropertyAccessMode.Field);
            entity.Ignore(x => x.GrossAmount);
            entity.Ignore(x => x.DiscountAmount);
            entity.Ignore(x => x.EffectiveAmount);
            entity.Ignore(x => x.ListAmount);
            entity.Ignore(x => x.ServiceDiscountAmount);
            entity.Ignore(x => x.CountedAmount);
            entity.Ignore(x => x.IsCompleted);
            entity.HasIndex(x => new { x.TreatmentPlanId, x.Code });
            entity.HasIndex(x => new { x.TreatmentPlanId, x.SortOrder });
            entity.HasIndex(x => x.SourceAdviseId);
            entity.HasIndex(x => x.ReplacedId);
            entity.HasIndex(x => new { x.PatientId, x.Status });
        });

        // Voucher da dung tren phieu dieu tri (appliedCoupons)
        builder.Entity<TreatmentPlanVoucher>(entity =>
        {
            entity.ToTable("bd_treatment_plan_vouchers");
            entity.ConfigureByConvention();
            entity.Property(x => x.Code).HasMaxLength(64).IsRequired();
            entity.Property(x => x.Name).HasMaxLength(300).IsRequired();
            entity.Property(x => x.DiscountType).HasConversion<short>();
            entity.Property(x => x.DiscountValue).HasColumnType("numeric(18,2)");
            entity.Property(x => x.MaxDiscountAmount).HasColumnType("numeric(18,2)");
            entity.Property(x => x.DiscountAmount).HasColumnType("numeric(18,2)");
            entity.HasIndex(x => x.TreatmentPlanId);
            entity.HasIndex(x => x.VoucherId);
        });

        // Thanh toan / hoan tien cua benh nhan
        builder.Entity<PatientPayment>(entity =>
        {
            entity.ToTable("bd_patient_payments");
            entity.ConfigureByConvention();
            entity.Property(x => x.Code).HasMaxLength(32).IsRequired();
            entity.Property(x => x.Note).HasMaxLength(1000);
            entity.Property(x => x.CancelReason).HasMaxLength(PatientPayment.MaxCancelReasonLength);
            entity.Property(x => x.Kind).HasConversion<short>();
            entity.Property(x => x.Method).HasConversion<short>();
            entity.Property(x => x.SplitMode).HasConversion<short>();
            entity.Property(x => x.Status).HasConversion<short>();
            entity.Property(x => x.Amount).HasColumnType("numeric(18,2)");
            entity.Ignore(x => x.SignedAmount);
            entity.HasMany(x => x.Lines)
                .WithOne()
                .HasForeignKey(x => x.PatientPaymentId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.Navigation(x => x.Lines).UsePropertyAccessMode(PropertyAccessMode.Field);
            entity.HasIndex(x => new { x.PatientId, x.PaidAt });
            entity.HasIndex(x => x.TreatmentPlanId);
            entity.HasIndex(x => new { x.ClinicBranchId, x.PaidAt });
            entity.HasIndex(x => x.PaymentAccountId);
        });

        builder.Entity<PatientPaymentLine>(entity =>
        {
            entity.ToTable("bd_patient_payment_lines");
            entity.ConfigureByConvention();
            entity.Property(x => x.Amount).HasColumnType("numeric(18,2)");
            entity.HasIndex(x => x.TreatmentServiceId);
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
            entity.PrimitiveCollection(x => x.ContinuedToothCodes).UsePropertyAccessMode(PropertyAccessMode.Field);
            entity.Ignore(x => x.OpenTeeth);
            // "BE:Treatment:StageList" — a short, always-read-with-the-stage list,
            // so it rides in JSON like Teeth rather than earning a table.
            entity.OwnsMany(x => x.ServiceItems, t => t.ToJson());
            entity.Navigation(x => x.ServiceItems).UsePropertyAccessMode(PropertyAccessMode.Field);
            entity.HasIndex(x => new { x.TreatmentServiceId, x.SequenceNumber });
            entity.HasIndex(x => new { x.PatientId, x.Status });
            entity.HasIndex(x => new { x.ClinicBranchId, x.Status });
        });

        // Tai kham — a follow-up raised from a finished cong doan
        builder.Entity<PatientReExamination>(entity =>
        {
            entity.ToTable("bd_patient_re_examinations");
            entity.ConfigureByConvention();
            entity.Property(x => x.Code).HasMaxLength(40).IsRequired();
            entity.Property(x => x.Note).HasMaxLength(2000);
            entity.OwnsMany(x => x.Teeth, t => t.ToJson());
            entity.Navigation(x => x.Teeth).UsePropertyAccessMode(PropertyAccessMode.Field);
            entity.PrimitiveCollection(x => x.ImageUrls).UsePropertyAccessMode(PropertyAccessMode.Field);
            entity.HasIndex(x => new { x.PatientId, x.ClinicBranchId });
            entity.HasIndex(x => x.PatientStageId);
            entity.HasIndex(x => x.TreatmentServiceId);
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
            entity.Property(x => x.PayerName).HasMaxLength(200);
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
            entity.Property(x => x.ColorCode).HasMaxLength(16);
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
            entity.Property(x => x.DetailName).HasMaxLength(400);
            entity.Property(x => x.Note).HasMaxLength(2000);
            entity.Property(x => x.Unit).HasMaxLength(50);
            // The rich-text bodies and the A4 medical-record form outgrow any
            // sensible varchar, so this column is plain text.
            entity.Property(x => x.Content).HasColumnType("text");

            entity.HasOne(x => x.ServiceConfig)
                .WithOne()
                .HasForeignKey<CatalogServiceConfig>(x => x.CatalogEntryId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.Navigation(x => x.ServiceConfig).UsePropertyAccessMode(PropertyAccessMode.Field);

            entity.HasOne(x => x.Medicine)
                .WithOne()
                .HasForeignKey<CatalogMedicine>(x => x.CatalogEntryId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.Navigation(x => x.Medicine).UsePropertyAccessMode(PropertyAccessMode.Field);

            entity.HasMany(x => x.Stages)
                .WithOne()
                .HasForeignKey(x => x.CatalogEntryId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.Navigation(x => x.Stages).UsePropertyAccessMode(PropertyAccessMode.Field);

            entity.HasMany(x => x.PrescriptionLines)
                .WithOne()
                .HasForeignKey(x => x.CatalogEntryId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.Navigation(x => x.PrescriptionLines).UsePropertyAccessMode(PropertyAccessMode.Field);

            entity.Property(x => x.IsCombo).HasDefaultValue(false);
            entity.HasMany(x => x.ComboItems)
                .WithOne()
                .HasForeignKey(x => x.CatalogEntryId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.Navigation(x => x.ComboItems).UsePropertyAccessMode(PropertyAccessMode.Field);

            entity.HasIndex(x => new { x.ClinicBranchId, x.Group, x.IsActive });
            entity.HasIndex(x => new { x.TaxonomyId, x.SortOrder });
        });

        builder.Entity<CatalogServiceConfig>(entity =>
        {
            entity.ToTable("bd_catalog_service_configs");
            entity.ConfigureByConvention();
            entity.Property(x => x.TaxRate).HasConversion<short>();
            entity.Property(x => x.DiscountValue).HasColumnType("numeric(18,2)");
            entity.PrimitiveCollection(x => x.LaboSupplierIds).UsePropertyAccessMode(PropertyAccessMode.Field);
            entity.HasIndex(x => x.CatalogEntryId).IsUnique();
        });

        builder.Entity<CatalogServiceStage>(entity =>
        {
            entity.ToTable("bd_catalog_service_stages");
            entity.ConfigureByConvention();
            entity.Property(x => x.Name).HasMaxLength(400).IsRequired();
            entity.Property(x => x.Value).HasColumnType("numeric(18,2)");
            entity.Property(x => x.ValueType).HasConversion<short>();
            entity.HasIndex(x => new { x.CatalogEntryId, x.SortOrder });
        });

        builder.Entity<CatalogMedicine>(entity =>
        {
            entity.ToTable("bd_catalog_medicines");
            entity.ConfigureByConvention();
            entity.Property(x => x.ActiveIngredient).HasMaxLength(400);
            entity.Property(x => x.Usage).HasMaxLength(1000);
            entity.Property(x => x.UsageNote).HasMaxLength(1000);
            entity.Property(x => x.PrescriptionCode).HasMaxLength(100);
            entity.Property(x => x.PurchasePrice).HasColumnType("numeric(18,2)");
            entity.HasIndex(x => x.CatalogEntryId).IsUnique();
        });

        // Thanh phan combo
        builder.Entity<CatalogComboItem>(entity =>
        {
            entity.ToTable("bd_catalog_combo_items");
            entity.ConfigureByConvention();
            entity.Property(x => x.UnitPrice).HasColumnType("numeric(18,2)");
            entity.Ignore(x => x.LineTotal);
            entity.HasIndex(x => new { x.CatalogEntryId, x.SortOrder });
            // "Which combos hold this service" — the suggestion in Chọn Dịch Vụ.
            entity.HasIndex(x => x.ComponentEntryId);
        });

        builder.Entity<PrescriptionTemplateLine>(entity =>
        {
            entity.ToTable("bd_prescription_template_lines");
            entity.ConfigureByConvention();
            entity.Property(x => x.Morning).HasColumnType("numeric(18,2)");
            entity.Property(x => x.Noon).HasColumnType("numeric(18,2)");
            entity.Property(x => x.Afternoon).HasColumnType("numeric(18,2)");
            entity.Property(x => x.Evening).HasColumnType("numeric(18,2)");
            entity.Property(x => x.Usage).HasConversion<int>();
            entity.Property(x => x.OtherUsage).HasMaxLength(200);
            entity.Ignore(x => x.Quantity);
            entity.Ignore(x => x.DailyAmount);
            entity.HasIndex(x => new { x.CatalogEntryId, x.SortOrder });
        });

        // Phan cong nhan vien theo chi nhanh
        builder.Entity<StaffBranchAssignment>(entity =>
        {
            entity.ToTable("bd_staff_branch_assignments");
            entity.ConfigureByConvention();
            entity.HasIndex(x => new { x.StaffId, x.ClinicBranchId }).IsUnique();
            entity.HasIndex(x => x.ClinicBranchId);
        });

        builder.Entity<BranchManagerAssignment>(entity =>
        {
            entity.ToTable("bd_branch_manager_assignments");
            entity.ConfigureByConvention();
            entity.HasIndex(x => new { x.ManagerId, x.ClinicBranchId }).IsUnique();
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

        builder.Entity<PatientDiagnosis>(entity =>
        {
            entity.ToTable("bd_patient_diagnoses");
            entity.ConfigureByConvention();
            entity.Property(x => x.Code).HasMaxLength(32).IsRequired();
            entity.Property(x => x.Note).HasMaxLength(2000);
            // The printed sheet's advice body is formatted HTML, so it is left
            // unbounded rather than squeezed into a varchar.
            entity.Property(x => x.ContentDiagnosis).HasColumnType("text");
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
            entity.HasIndex(x => new { x.ClinicBranchId, x.Department, x.SubTab });
            entity.HasIndex(x => new { x.Department, x.SubTab });
        });

        builder.Entity<RichTextImage>(entity =>
        {
            entity.ToTable("bd_rich_text_images");
            entity.ConfigureByConvention();
            entity.Property(x => x.BlobName).HasMaxLength(400).IsRequired();
            entity.Property(x => x.FileName).HasMaxLength(300).IsRequired();
            entity.Property(x => x.ContentType).HasMaxLength(100).IsRequired();
            entity.HasIndex(x => x.ClinicBranchId);
        });

        builder.Entity<OperationArticle>(entity =>
        {
            entity.ToTable("bd_operation_articles");
            entity.ConfigureByConvention();
            entity.Property(x => x.Title).HasMaxLength(500).IsRequired();
            // Rich text with no sensible ceiling: a 10,000 char cap refused
            // any article long enough to be worth writing.
            entity.Property(x => x.Content).HasColumnType("text");
            entity.Property(x => x.Department).HasMaxLength(50).IsRequired();
            entity.Property(x => x.SubTab).HasMaxLength(50).IsRequired();
            entity.HasIndex(x => new { x.ClinicBranchId, x.Department, x.SubTab });
            entity.HasIndex(x => new { x.Department, x.SubTab, x.CategoryId });
        });
    }

    private static void ConfigureTools(ModelBuilder builder)
    {
        builder.Entity<CallConfiguration>(entity =>
        {
            entity.ToTable("bd_call_configurations");
            entity.ConfigureByConvention();
            entity.Property(x => x.Name).HasMaxLength(200).IsRequired();
            entity.Property(x => x.ApiKey).HasMaxLength(200).IsRequired();
            entity.Property(x => x.SecretKey).HasMaxLength(200).IsRequired();
            entity.Property(x => x.Provider).HasConversion<short>();
            entity.HasIndex(x => x.ClinicBranchId);
        });

        builder.Entity<CallAssignment>(entity =>
        {
            entity.ToTable("bd_call_assignments");
            entity.ConfigureByConvention();
            entity.Property(x => x.Sip).HasMaxLength(100).IsRequired();
            entity.HasIndex(x => x.StaffId);
            entity.HasIndex(x => x.CallConfigurationId);
            entity.HasIndex(x => new { x.ClinicBranchId, x.Sip });
        });

        builder.Entity<CallLog>(entity =>
        {
            entity.ToTable("bd_call_logs");
            entity.ConfigureByConvention();
            entity.Property(x => x.StaffName).HasMaxLength(200);
            entity.Property(x => x.CallCode).HasMaxLength(100).IsRequired();
            entity.Property(x => x.ExtensionCode).HasMaxLength(100);
            entity.Property(x => x.PhoneNumber).HasMaxLength(20).IsRequired();
            entity.Property(x => x.Status).HasConversion<short>();
            entity.Property(x => x.Provider).HasConversion<short>();
            entity.HasIndex(x => new { x.ClinicBranchId, x.CalledAt });
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
            entity.Property(x => x.ErrorMessage).HasMaxLength(MessageLog.MaxErrorLength);
            entity.Property(x => x.ExternalMessageId).HasMaxLength(MessageLog.MaxExternalIdLength);
            entity.Property(x => x.ExternalTemplateId).HasMaxLength(MessageLog.MaxExternalTemplateIdLength);
            entity.Property(x => x.TemplateName).HasMaxLength(MessageLog.MaxTemplateNameLength);
            entity.Property(x => x.Cost).HasPrecision(18, 2);
            entity.HasIndex(x => new { x.Channel, x.CreationTime });
            entity.HasIndex(x => x.ExternalMessageId);
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
            entity.Property(x => x.LeaveShift).HasConversion<short?>();
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
            entity.Property(x => x.PayerName).HasMaxLength(200);
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
            entity.Property(x => x.ColorCode).HasMaxLength(16);
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
            entity.Property(x => x.Prefix).HasMaxLength(20);
            entity.Property(x => x.Code).HasMaxLength(32).IsRequired();
            entity.Property(x => x.Name).HasMaxLength(200).IsRequired();
            entity.Property(x => x.Description).HasMaxLength(1000);
            entity.Property(x => x.DiscountType).HasConversion<short>();
            entity.Property(x => x.ScopeTarget).HasConversion<short>();
            entity.Property(x => x.Status).HasConversion<short>();
            entity.Property(x => x.DiscountValue).HasColumnType("numeric(18,2)");
            entity.Property(x => x.MaxDiscountAmount).HasColumnType("numeric(18,2)");
            entity.Property(x => x.MinOrderValue).HasColumnType("numeric(18,2)");
            entity.PrimitiveCollection(x => x.TargetIds)
                .UsePropertyAccessMode(PropertyAccessMode.Field)
                .HasColumnName("TargetIds");
            entity.PrimitiveCollection(x => x.CustomerTargets)
                .UsePropertyAccessMode(PropertyAccessMode.Field)
                .HasColumnName("CustomerTargets");
            entity.PrimitiveCollection(x => x.DaysOfWeek)
                .UsePropertyAccessMode(PropertyAccessMode.Field)
                .HasColumnName("DaysOfWeek");
            entity.Ignore(x => x.RemainingUses);
            entity.Ignore(x => x.IsExhausted);
            entity.HasIndex(x => x.Code).IsUnique();
            entity.HasIndex(x => new { x.IsPublished, x.Status, x.ValidFrom, x.ValidTo });
        });
    }

    /// <summary>Mối quan hệ (4.8) and Hồ sơ nhóm (4.10). BlueDental-local.</summary>
    private static void ConfigurePatientRelations(ModelBuilder builder)
    {
        builder.Entity<PatientRelationship>(entity =>
        {
            entity.ToTable("bd_patient_relationships");
            entity.ConfigureByConvention();
            entity.Property(x => x.Type).HasConversion<short>();
            entity.Property(x => x.Note).HasMaxLength(PatientRelationConsts.MaxNoteLength);
            entity.HasOne<Patient>().WithMany().HasForeignKey(x => x.PatientId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<Patient>().WithMany().HasForeignKey(x => x.RelatedPatientId).OnDelete(DeleteBehavior.Cascade);
            // One row per pair; the reverse pair is refused by the app service.
            entity.HasIndex(x => new { x.PatientId, x.RelatedPatientId }).IsUnique().HasFilter("\"IsDeleted\" = false");
            entity.HasIndex(x => x.RelatedPatientId);
        });

        builder.Entity<PatientGroup>(entity =>
        {
            entity.ToTable("bd_patient_groups");
            entity.ConfigureByConvention();
            entity.Property(x => x.Name).HasMaxLength(PatientRelationConsts.MaxGroupNameLength).IsRequired();
            entity.Property(x => x.Note).HasMaxLength(PatientRelationConsts.MaxGroupNoteLength);
            entity.Property(x => x.SharedMedicalNote).HasMaxLength(PatientRelationConsts.MaxSharedMedicalNoteLength);
            entity.Property(x => x.Kind).HasConversion<short>();
            entity.Ignore(x => x.Head);
            entity.HasMany(x => x.Members).WithOne().HasForeignKey(x => x.PatientGroupId).OnDelete(DeleteBehavior.Cascade);
            entity.Navigation(x => x.Members).UsePropertyAccessMode(PropertyAccessMode.Field);
            entity.HasIndex(x => x.ClinicBranchId);
        });

        builder.Entity<PatientGroupMember>(entity =>
        {
            entity.ToTable("bd_patient_group_members");
            entity.ConfigureByConvention();
            entity.Property(x => x.Role).HasConversion<short>();
            entity.HasOne<Patient>().WithMany().HasForeignKey(x => x.PatientId).OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(x => new { x.PatientGroupId, x.PatientId }).IsUnique();
            entity.HasIndex(x => x.PatientId);
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

    }

    private static void ConfigureQueue(ModelBuilder builder)
    {
        builder.Entity<ServiceCounter>(entity =>
        {
            entity.ToTable("bd_service_counters");
            entity.ConfigureByConvention();
            entity.Property(x => x.Name).HasMaxLength(ServiceCounter.MaxNameLength).IsRequired();
            entity.Property(x => x.NumberPrefix).HasMaxLength(ServiceCounter.MaxPrefixLength).IsRequired();
            entity.Property(x => x.StartNumber).HasDefaultValue(1);
            entity.Property(x => x.AutoResetDaily).HasDefaultValue(true);
            entity.Property(x => x.WaitWarningMinutes).HasDefaultValue(ServiceCounter.DefaultWaitWarningMinutes);
            entity.Property(x => x.MinutesPerPatient).HasDefaultValue(ServiceCounter.DefaultMinutesPerPatient);
            // A deleted counter must not block its name or prefix for a new one.
            entity.HasIndex(x => new { x.ClinicBranchId, x.Name }).IsUnique().HasFilter("\"IsDeleted\" = false");
            entity.HasIndex(x => new { x.ClinicBranchId, x.NumberPrefix }).IsUnique().HasFilter("\"IsDeleted\" = false");
            entity.HasIndex(x => x.DentistId);
        });

        builder.Entity<QueueTicket>(entity =>
        {
            entity.ToTable("bd_queue_tickets");
            entity.ConfigureByConvention();
            entity.Property(x => x.Status).HasConversion<short>();
            entity.Property(x => x.Priority).HasConversion<short>();
            entity.Property(x => x.DisplayNumber).HasMaxLength(20).IsRequired();
            entity.Property(x => x.ServiceType).HasMaxLength(100);
            entity.Property(x => x.Note).HasMaxLength(500);

            // Numbers belong to a counter's own sequence, which may restart
            // ("Đặt lại số thứ tự ngay"), so a number is not unique per day.
            entity.HasIndex(x => new { x.ClinicBranchId, x.QueueDate, x.Status });
            entity.HasIndex(x => new { x.CounterId, x.QueueDate, x.Status });
            entity.HasIndex(x => new { x.PatientId, x.QueueDate });
        });
    }

    private static void ConfigureEInvoicing(ModelBuilder builder)
    {
        builder.Entity<ElectronicInvoice>(entity =>
        {
            entity.ToTable("bd_electronic_invoices");
            entity.ConfigureByConvention();

            entity.Property(x => x.Provider).HasMaxLength(ElectronicInvoice.MaxProviderLength).IsRequired();
            entity.Property(x => x.Ikey).HasMaxLength(ElectronicInvoice.MaxIkeyLength).IsRequired();
            entity.Property(x => x.Pattern).HasMaxLength(ElectronicInvoice.MaxPatternLength).IsRequired();
            entity.Property(x => x.Serial).HasMaxLength(ElectronicInvoice.MaxSerialLength);
            entity.Property(x => x.Status).HasConversion<short>();
            entity.Property(x => x.No).HasMaxLength(ElectronicInvoice.MaxNoLength);
            entity.Property(x => x.LookupCode).HasMaxLength(ElectronicInvoice.MaxLookupCodeLength);
            entity.Property(x => x.LinkView).HasMaxLength(ElectronicInvoice.MaxLinkLength);
            entity.Property(x => x.Total).HasPrecision(18, 2);
            entity.Property(x => x.TaxAmount).HasPrecision(18, 2);
            entity.Property(x => x.Amount).HasPrecision(18, 2);
            entity.Property(x => x.CustomerName).HasMaxLength(ElectronicInvoice.MaxCustomerNameLength);
            entity.Property(x => x.LastError).HasMaxLength(ElectronicInvoice.MaxErrorLength);
            entity.Property(x => x.PaymentMethod).HasMaxLength(ElectronicInvoice.MaxPaymentMethodLength).IsRequired();

            entity.HasIndex(x => x.Ikey).IsUnique();
            entity.HasIndex(x => x.PatientPaymentId).IsUnique().HasFilter("\"IsDeleted\" = false");
            entity.HasIndex(x => x.ClinicBranchId);
            entity.HasIndex(x => x.PatientId);
            entity.HasIndex(x => x.TreatmentPlanId);
        });

        builder.Entity<EInvoiceProviderConfig>(entity =>
        {
            entity.ToTable("bd_einvoice_provider_configs");
            entity.ConfigureByConvention();
            entity.Property(x => x.Name).HasMaxLength(EInvoiceProviderConfig.MaxNameLength).IsRequired();
            entity.Property(x => x.Provider).HasMaxLength(ElectronicInvoice.MaxProviderLength).IsRequired();
            entity.Property(x => x.AppId).HasMaxLength(EInvoiceProviderConfig.MaxAppIdLength);
            entity.Property(x => x.Username).HasMaxLength(EInvoiceProviderConfig.MaxUsernameLength).IsRequired();
            entity.Property(x => x.PasswordCipher).HasMaxLength(EInvoiceProviderConfig.MaxPasswordCipherLength).IsRequired();
            entity.Property(x => x.TaxCode).HasMaxLength(EInvoiceProviderConfig.MaxTaxCodeLength).IsRequired();
            entity.Property(x => x.LastPattern).HasMaxLength(ElectronicInvoice.MaxPatternLength);
            entity.Property(x => x.LastSerial).HasMaxLength(ElectronicInvoice.MaxSerialLength);
            entity.HasIndex(x => x.ClinicBranchId);
            // One active account per branch; inactive and deleted ones may pile up.
            entity.HasIndex(x => x.ClinicBranchId, "IX_bd_einvoice_provider_configs_ClinicBranchId_Active")
                .IsUnique()
                .HasFilter("\"IsActive\" = true AND \"IsDeleted\" = false");
        });
    }
}
