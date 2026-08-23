using Volo.Abp;
using Volo.Abp.Domain.Values;

namespace BlueDental.PatientManagement.Values;

/// <summary>
/// Value object for patient contact information.
/// </summary>
public class ContactInfo : ValueObject
{
    public string? PhoneNumber { get; }
    public string? Email { get; }
    public string? Address { get; }
    public string? EmergencyContactName { get; }
    public string? EmergencyContactPhone { get; }

    protected ContactInfo() { }

    public ContactInfo(
        string? phoneNumber,
        string? email,
        string? address,
        string? emergencyContactName = null,
        string? emergencyContactPhone = null)
    {
        if (string.IsNullOrWhiteSpace(phoneNumber) && string.IsNullOrWhiteSpace(email))
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.PatientManagement.InvalidContactInfo,
                "At least one of phone number or email must be provided.");
        }

        PhoneNumber = phoneNumber;
        Email = email;
        Address = address;
        EmergencyContactName = emergencyContactName;
        EmergencyContactPhone = emergencyContactPhone;
    }

    protected override IEnumerable<object> GetAtomicValues()
    {
        yield return PhoneNumber!;
        yield return Email!;
        yield return Address!;
        yield return EmergencyContactName!;
        yield return EmergencyContactPhone!;
    }
}
