using System;
using System.Threading.Tasks;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;

namespace BlueDental.CustomerCare;

/// <summary>
/// Chăm sóc khách hàng — reference: <c>/api/v1/customer-care</c> and
/// <c>/api/v1/customer-care-stats</c>.
/// </summary>
public interface ICustomerCareAppService : IApplicationService
{
    Task<PagedResultDto<CareRecordDto>> GetListAsync(GetCareRecordListInput input);
    Task<CareStatsDto> GetStatsAsync(GetCareRecordListInput input);
    Task<CareRecordDto> GetAsync(Guid id);
    Task<CareRecordDto> CreateAsync(CreateCareRecordDto input);
    Task<CareRecordDto> UpdateAsync(Guid id, UpdateCareRecordDto input);

    /// <summary>Đã liên hệ khách.</summary>
    Task<CareRecordDto> MarkContactedAsync(Guid id);

    /// <summary>Thành công, kèm đánh giá.</summary>
    Task<CareRecordDto> SucceedAsync(Guid id, SucceedCareRecordDto input);

    /// <summary>Thất bại, kèm lý do.</summary>
    Task<CareRecordDto> FailAsync(Guid id, FailCareRecordDto input);

    Task<CareRecordDto> MarkZaloSentAsync(Guid id);
    Task CancelAsync(Guid id, string reason);

    /// <summary>"Xuất Excel" on the CSKH screen — per-tab column sets.</summary>
    Task<byte[]> ExportAsync(GetCareRecordListInput input);

    /// <summary>Phân nhóm CSKH tab — the patient list with care/treatment rollups.</summary>
    Task<PagedResultDto<CareGroupingPatientDto>> GetGroupingPatientsAsync(GetCareGroupingPatientsInput input);
}
