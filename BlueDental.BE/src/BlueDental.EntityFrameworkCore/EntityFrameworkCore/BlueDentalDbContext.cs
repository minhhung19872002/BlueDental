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
using Microsoft.EntityFrameworkCore;
using Volo.Abp.AuditLogging.EntityFrameworkCore;
using Volo.Abp.BackgroundJobs.EntityFrameworkCore;
using Volo.Abp.Data;
using Volo.Abp.DependencyInjection;
using Volo.Abp.EntityFrameworkCore;
using Volo.Abp.FeatureManagement.EntityFrameworkCore;
using Volo.Abp.Identity;
using Volo.Abp.Identity.EntityFrameworkCore;
using Volo.Abp.OpenIddict.EntityFrameworkCore;
using Volo.Abp.PermissionManagement.EntityFrameworkCore;
using Volo.Abp.SettingManagement.EntityFrameworkCore;

namespace BlueDental.EntityFrameworkCore;

[ReplaceDbContext(typeof(IIdentityDbContext))]
[ConnectionStringName("Default")]
public class BlueDentalDbContext :
    AbpDbContext<BlueDentalDbContext>,
    IIdentityDbContext
{
    // ABP Identity
    public DbSet<IdentityUser> Users { get; set; }
    public DbSet<IdentityRole> Roles { get; set; }
    public DbSet<IdentityClaimType> ClaimTypes { get; set; }
    public DbSet<OrganizationUnit> OrganizationUnits { get; set; }
    public DbSet<IdentitySecurityLog> SecurityLogs { get; set; }
    public DbSet<IdentityLinkUser> LinkUsers { get; set; }
    public DbSet<IdentityUserDelegation> UserDelegations { get; set; }
    public DbSet<IdentitySession> Sessions { get; set; }

    // Organizations
    public DbSet<ClinicBranch> ClinicBranches { get; set; }
    public DbSet<Department> Departments { get; set; }

    // Catalogs
    public DbSet<DentalProcedure> DentalProcedures { get; set; }
    public DbSet<InsurancePlan> InsurancePlans { get; set; }
    public DbSet<Medication> Medications { get; set; }
    public DbSet<PatientSource> PatientSources { get; set; }
    public DbSet<Occupation> Occupations { get; set; }
    public DbSet<PaymentMethodOption> PaymentMethods { get; set; }
    public DbSet<PatientTag> PatientTags { get; set; }
    public DbSet<Diagnosis> Diagnoses { get; set; }
    public DbSet<MedicationType> MedicationTypes { get; set; }
    public DbSet<ConsultingData> ConsultingDataItems { get; set; }
    public DbSet<MedicalHistoryType> MedicalHistoryTypes { get; set; }
    public DbSet<PrescriptionTemplate> PrescriptionTemplates { get; set; }
    public DbSet<MedicalRecordTemplate> MedicalRecordTemplates { get; set; }

    // Patient Management
    public DbSet<Patient> Patients { get; set; }

    // Appointments
    public DbSet<Appointment> Appointments { get; set; }

    // Treatment Management
    public DbSet<TreatmentPlan> TreatmentPlans { get; set; }
    public DbSet<TreatmentRecord> TreatmentRecords { get; set; }
    public DbSet<Prescription> Prescriptions { get; set; }

    // Billing
    public DbSet<Invoice> Invoices { get; set; }
    public DbSet<InsuranceClaim> InsuranceClaims { get; set; }

    // Inventory
    public DbSet<InventoryItem> InventoryItems { get; set; }
    public DbSet<MaterialAllocation> MaterialAllocations { get; set; }

    // Notifications
    public DbSet<Notification> Notifications { get; set; }

    // File Management
    public DbSet<FileAttachment> FileAttachments { get; set; }

    // Visits (Reception)
    public DbSet<Visit> Visits { get; set; }

    // Labo
    public DbSet<LaboOrder> LaboOrders { get; set; }
    public DbSet<LaboSupplier> LaboSuppliers { get; set; }
    public DbSet<LaboBiteType> LaboBiteTypes { get; set; }
    public DbSet<LaboFinishLine> LaboFinishLines { get; set; }
    public DbSet<LaboRhythmType> LaboRhythmTypes { get; set; }
    public DbSet<LaboMaterial> LaboMaterials { get; set; }

    // Customer Care
    public DbSet<CareRecord> CareRecords { get; set; }
    public DbSet<CskhGroup> CskhGroups { get; set; }

    public BlueDentalDbContext(DbContextOptions<BlueDentalDbContext> options)
        : base(options)
    {
    }

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        builder.ConfigurePermissionManagement();
        builder.ConfigureSettingManagement();
        builder.ConfigureBackgroundJobs();
        builder.ConfigureAuditLogging();
        builder.ConfigureIdentity();
        builder.ConfigureOpenIddict();
        builder.ConfigureFeatureManagement();

        builder.ConfigureBlueDental();
    }
}
