using BlueDental.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace BlueDental.Api.Data;

public sealed class DentalDbContext(DbContextOptions<DentalDbContext> options) : DbContext(options)
{
    public DbSet<Patient> Patients => Set<Patient>();
    public DbSet<Dentist> Dentists => Set<Dentist>();
    public DbSet<Appointment> Appointments => Set<Appointment>();

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
    }
}
