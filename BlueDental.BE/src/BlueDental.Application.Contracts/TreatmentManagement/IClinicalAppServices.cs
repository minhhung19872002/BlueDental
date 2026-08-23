using System;
using System.Threading.Tasks;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;

namespace BlueDental.TreatmentManagement;

/// <summary>
/// Chẩn đoán của bệnh nhân — reference: <c>/api/v1/patient-diagnoses</c>.
/// </summary>
public interface IPatientDiagnosisAppService : IApplicationService
{
    Task<PagedResultDto<PatientDiagnosisDto>> GetListAsync(GetPatientDiagnosisListInput input);
    Task<PatientDiagnosisDto> GetAsync(Guid id);
    Task<PatientDiagnosisDto> CreateAsync(CreatePatientDiagnosisDto input);
    Task<PatientDiagnosisDto> UpdateAsync(Guid id, UpdatePatientDiagnosisDto input);
    Task<PatientDiagnosisDto> MarkTreatedAsync(Guid id);
    Task<PatientDiagnosisDto> CancelAsync(Guid id);
    Task DeleteAsync(Guid id);
}

/// <summary>
/// Tư vấn dịch vụ — reference: <c>/api/v1/patient-advises</c>.
/// </summary>
public interface IPatientAdviseAppService : IApplicationService
{
    Task<PagedResultDto<PatientAdviseDto>> GetListAsync(GetPatientAdviseListInput input);
    Task<PatientAdviseSummaryDto> GetSummaryAsync(GetPatientAdviseListInput input);
    Task<PatientAdviseDto> GetAsync(Guid id);
    Task<PatientAdviseDto> CreateAsync(CreatePatientAdviseDto input);
    Task<PatientAdviseDto> UpdateAsync(Guid id, UpdatePatientAdviseDto input);
    Task<PatientAdviseDto> AcceptAsync(Guid id);
    Task<PatientAdviseDto> RejectAsync(Guid id);
    Task<PatientAdviseDto> CancelAsync(Guid id);
    Task<PatientAdviseDto> ApplyVoucherAsync(Guid id, decimal voucherDiscountAmount);
    Task DeleteAsync(Guid id);
}

/// <summary>
/// Nhóm tư vấn — reference: <c>/api/v1/advise-groups</c>.
/// </summary>
public interface IAdviseGroupAppService : IApplicationService
{
    Task<PagedResultDto<AdviseGroupDto>> GetListAsync(GetAdviseGroupListInput input);
    Task<AdviseGroupDto> GetAsync(Guid id);
    Task<AdviseGroupDto> CreateAsync(CreateAdviseGroupDto input);
    Task<AdviseGroupDto> UpdateAsync(Guid id, UpdateAdviseGroupDto input);
    Task DeleteAsync(Guid id);
}
