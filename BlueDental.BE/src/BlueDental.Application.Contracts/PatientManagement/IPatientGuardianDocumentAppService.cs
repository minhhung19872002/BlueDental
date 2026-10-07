using System;
using System.Threading.Tasks;
using Volo.Abp.Application.Services;
using Volo.Abp.Content;

namespace BlueDental.PatientManagement;

/// <summary>
/// "Giấy tờ chứng minh quyền giám hộ" — the scan a guardian with a "Khác"
/// relation may attach. Uploaded on its own first; the hồ sơ save then names
/// the returned blob, so a cancelled dialog never half-writes a patient.
/// </summary>
public interface IPatientGuardianDocumentAppService : IApplicationService
{
    /// <summary>JPG, PNG or PDF of at most 5 MB, stored under the caller's branch.</summary>
    Task<GuardianDocumentDto> UploadAsync(IRemoteStreamContent file);

    /// <summary>The paper attached to one guardian of a patient in the caller's branch.</summary>
    Task<IRemoteStreamContent> GetAsync(Guid patientId, Guid guardianId);
}
