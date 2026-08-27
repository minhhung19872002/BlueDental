using System;
using System.Collections.Generic;
using System.Linq;
using BlueDental.PatientManagement.Values;
using Volo.Abp;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.PatientManagement;

/// <summary>
/// Aggregate root for the Patient bounded context.
/// Encapsulates patient demographics, dental chart, and medical history.
/// </summary>
public class Patient : FullAuditedAggregateRoot<Guid>
{
    private readonly List<Guid> _tagIds = new();

    public string PatientCode { get; private set; } = default!;
    public string FirstName { get; private set; } = default!;
    public string LastName { get; private set; } = default!;
    public string FullName => $"{FirstName} {LastName}";
    public DateOnly DateOfBirth { get; private set; }
    public Gender Gender { get; private set; }
    public ContactInfo Contact { get; private set; } = default!;
    public string? NationalId { get; private set; }
    public string? BloodType { get; private set; }
    public string? MedicalAlerts { get; private set; }
    public PatientStatus Status { get; private set; }
    public Guid BranchId { get; private set; }
    public DateTimeOffset RegisteredAt { get; private set; }

    /// <summary>Thẻ hồ sơ — ids from the branch's PatientTag catalog.</summary>
    public IReadOnlyCollection<Guid> TagIds => _tagIds.AsReadOnly();

    protected Patient() { }

    /// <summary>
    /// Factory method to register a new patient.
    /// </summary>
    public static Patient Register(
        Guid id,
        string patientCode,
        string firstName,
        string lastName,
        DateOnly dateOfBirth,
        Gender gender,
        ContactInfo contact,
        Guid branchId,
        string? nationalId = null)
    {
        Check.NotNullOrWhiteSpace(patientCode, nameof(patientCode));
        Check.NotNullOrWhiteSpace(firstName, nameof(firstName));
        Check.NotNullOrWhiteSpace(lastName, nameof(lastName));

        if (dateOfBirth > DateOnly.FromDateTime(DateTime.UtcNow))
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.PatientManagement.InvalidDateOfBirth,
                "Date of birth cannot be in the future.");
        }

        return new Patient
        {
            Id = id,
            PatientCode = patientCode,
            FirstName = firstName,
            LastName = lastName,
            DateOfBirth = dateOfBirth,
            Gender = gender,
            Contact = contact,
            BranchId = branchId,
            NationalId = nationalId,
            Status = PatientStatus.Active,
            RegisteredAt = DateTimeOffset.UtcNow
        };
    }

    public Patient UpdateDemographics(
        string firstName,
        string lastName,
        DateOnly dateOfBirth,
        Gender gender)
    {
        FirstName = firstName;
        LastName = lastName;
        DateOfBirth = dateOfBirth;
        Gender = gender;
        return this;
    }

    public Patient UpdateContact(ContactInfo contact)
    {
        Contact = contact;
        return this;
    }

    public Patient UpdateMedicalInfo(string? bloodType, string? medicalAlerts)
    {
        BloodType = bloodType;
        MedicalAlerts = medicalAlerts;
        return this;
    }

    /// <summary>Replaces the tag set whole — the form edits it as one picker.</summary>
    public Patient SetTags(IEnumerable<Guid> tagIds)
    {
        _tagIds.Clear();
        _tagIds.AddRange(tagIds.Distinct());
        return this;
    }

    public Patient Deactivate()
    {
        Status = PatientStatus.Inactive;
        return this;
    }

    public Patient Transfer(Guid newBranchId)
    {
        BranchId = newBranchId;
        Status = PatientStatus.Transferred;
        return this;
    }
}
