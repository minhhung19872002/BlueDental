using System;
using System.Threading.Tasks;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;

namespace BlueDental.PatientManagement;

public interface IPatientAppService : IApplicationService
{
    Task<PagedResultDto<PatientListItemDto>> GetListAsync(GetPatientListInput input);
    Task<PatientDto> GetAsync(Guid id);
    Task<PatientDto> RegisterAsync(RegisterPatientDto input);
    Task<PatientDto> UpdateAsync(Guid id, UpdatePatientDto input);
    Task DeactivateAsync(Guid id);

    /// <summary>The + beside "BE:Field:ReasonForVisit" — appends one dated line.</summary>
    Task<PatientDto> AddExaminationReasonAsync(Guid id, AddExaminationReasonDto input);

    /// <summary>The code the "BE:Common:CreateRecord" dialog opens with.</summary>
    Task<PatientCodeEstimateDto> GetCodeEstimateAsync();

    /// <summary>Duplicate-phone check behind the dialog's Điện thoại field.</summary>
    Task<PhoneAvailabilityDto> CheckPhoneAsync(string phone, Guid? excludeId = null);

    /// <summary>"BE:Common:ExportFile" on the patient list — the filtered list as .xlsx.</summary>
    Task<byte[]> ExportAsync(GetPatientListInput input);
}
