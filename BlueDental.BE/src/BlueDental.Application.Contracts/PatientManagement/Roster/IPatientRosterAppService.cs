using System.Threading.Tasks;
using Volo.Abp.Application.Services;

namespace BlueDental.PatientManagement.Roster;

/// <summary>
/// Xuất / nhập danh sách bệnh nhân (F-69, BA 2026-10-12): the roster of every
/// branch as one Excel sheet, in the same format both ways. Admin only.
/// </summary>
public interface IPatientRosterAppService : IApplicationService
{
    /// <summary>Every live patient of every branch, Action column left blank.</summary>
    Task<byte[]> ExportAsync();

    /// <summary>
    /// Validates the rows marked in the Action column and, unless
    /// <see cref="ImportPatientRosterDto.DryRun"/> is set, writes them in one
    /// unit of work. A single bad row refuses the file.
    /// </summary>
    Task<PatientRosterResultDto> ImportAsync(ImportPatientRosterDto input);

    /// <summary>The uploaded file with a "Lỗi" column beside the refused rows, for fixing offline.</summary>
    Task<byte[]> GetErrorFileAsync(ImportPatientRosterDto input);
}
