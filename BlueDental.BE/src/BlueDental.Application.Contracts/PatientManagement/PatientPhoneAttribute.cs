using System;

namespace BlueDental.PatientManagement;

/// <summary>
/// Marks a DTO string that holds a patient's (or a patient's guardian's)
/// phone. For an account holding <c>patient.hidePhone</c> the value leaves the
/// API masked — "090****567" (Cụm 11 mục 9). Staff, branch and supplier phones
/// are not marked: the permission is about patients.
/// </summary>
[AttributeUsage(AttributeTargets.Property)]
public sealed class PatientPhoneAttribute : Attribute
{
    /// <summary>The value is free text that may quote a phone (a message log); mask every phone in it.</summary>
    public bool Embedded { get; init; }
}

/// <summary>
/// A DTO whose phone is only sometimes a phone — a history row whose field
/// name says which values it holds — and so masks itself.
/// </summary>
public interface IPatientPhoneMaskable
{
    void MaskPatientPhones(Func<string?, string?> mask);
}
