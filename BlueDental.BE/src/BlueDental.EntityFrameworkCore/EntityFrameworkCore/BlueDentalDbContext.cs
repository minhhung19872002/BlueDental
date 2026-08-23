using BlueDental.Appointments;
using BlueDental.Billing;
using BlueDental.Catalogs;
using BlueDental.CustomerCare;
using BlueDental.FileManagement;
using BlueDental.Inventory;
using BlueDental.Labo;
using BlueDental.Notifications;
using BlueDental.Operations;
using BlueDental.Organizations;
using BlueDental.PatientManagement;
using BlueDental.Finance;
using BlueDental.Promotions;
using BlueDental.Timekeeping;
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
    public DbSet<StaffBranchAssignment> StaffBranchAssignments { get; set; }

    // Catalogs
    public DbSet<DentalProcedure> DentalProcedures { get; set; }
    public DbSet<InsurancePlan> InsurancePlans { get; set; }
    public DbSet<Medication> Medications { get; set; }
    public DbSet<Taxonomy> Taxonomies { get; set; }
    public DbSet<CatalogEntry> CatalogEntries { get; set; }

    // Patient Management
    public DbSet<Patient> Patients { get; set; }

    // Appointments
    public DbSet<Appointment> Appointments { get; set; }

    // Treatment Management
    public DbSet<TreatmentPlan> TreatmentPlans { get; set; }
    public DbSet<TreatmentRecord> TreatmentRecords { get; set; }
    public DbSet<Prescription> Prescriptions { get; set; }
    public DbSet<PrescriptionItem> PrescriptionItems { get; set; }
    public DbSet<PatientDiagnosis> PatientDiagnoses { get; set; }
    public DbSet<TreatmentStage> TreatmentStages { get; set; }
    public DbSet<TreatmentService> TreatmentServices { get; set; }
    public DbSet<PatientPayment> PatientPayments { get; set; }
    public DbSet<PatientAdvise> PatientAdvises { get; set; }
    public DbSet<AdviseGroup> AdviseGroups { get; set; }

    // Timekeeping
    public DbSet<TimeKeepingRecord> TimeKeepingRecords { get; set; }

    // Finance (thu chi, luan chuyen dong tien)
    public DbSet<SalesEntry> SalesEntries { get; set; }
    public DbSet<CashflowCategory> CashflowCategories { get; set; }
    public DbSet<CashflowEntry> CashflowEntries { get; set; }

    // Promotions
    public DbSet<Voucher> Vouchers { get; set; }

    // Quan tri van hanh
    public DbSet<OperationsArticle> OperationsArticles { get; set; }
    public DbSet<OperationsTask> OperationsTasks { get; set; }

    // Billing
    public DbSet<Invoice> Invoices { get; set; }
    public DbSet<InsuranceClaim> InsuranceClaims { get; set; }

    // Inventory
    public DbSet<InventoryItem> InventoryItems { get; set; }

    // Notifications
    public DbSet<Notification> Notifications { get; set; }

    // File Management
    public DbSet<FileAttachment> FileAttachments { get; set; }

    // Visits (Reception)
    public DbSet<Visit> Visits { get; set; }

    // Labo
    public DbSet<LaboOrder> LaboOrders { get; set; }

    // Customer Care
    public DbSet<CareRecord> CareRecords { get; set; }

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
