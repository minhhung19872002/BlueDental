using BlueDental.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace BlueDental.Api.Data;

public sealed class DentalDbContext(DbContextOptions<DentalDbContext> options) : DbContext(options)
{
    public DbSet<Patient> Patients => Set<Patient>();
    public DbSet<Dentist> Dentists => Set<Dentist>();
    public DbSet<Appointment> Appointments => Set<Appointment>();
    public DbSet<TreatmentRecord> TreatmentRecords => Set<TreatmentRecord>();
    public DbSet<Payment> Payments => Set<Payment>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Patient>().HasIndex(patient => patient.PhoneNumber).IsUnique();
        modelBuilder.Entity<Appointment>()
            .HasOne(appointment => appointment.Patient)
            .WithMany(patient => patient.Appointments)
            .HasForeignKey(appointment => appointment.PatientId);
        modelBuilder.Entity<Appointment>()
            .HasOne(appointment => appointment.Dentist)
            .WithMany(dentist => dentist.Appointments)
            .HasForeignKey(appointment => appointment.DentistId);
        modelBuilder.Entity<TreatmentRecord>()
            .HasOne(record => record.Patient)
            .WithMany()
            .HasForeignKey(record => record.PatientId);
        modelBuilder.Entity<TreatmentRecord>()
            .HasOne(record => record.Dentist)
            .WithMany()
            .HasForeignKey(record => record.DentistId);
        modelBuilder.Entity<TreatmentRecord>().Property(record => record.Cost).HasPrecision(12, 2);
        modelBuilder.Entity<Payment>()
            .HasOne(payment => payment.Patient)
            .WithMany()
            .HasForeignKey(payment => payment.PatientId);
        modelBuilder.Entity<Payment>().Property(payment => payment.Amount).HasPrecision(12, 2);
    }
}
