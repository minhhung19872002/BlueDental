using System;
using System.Threading.Tasks;
using Volo.Abp.Application.Services;

namespace BlueDental.DataMigration;

/// <summary>
/// One-time move of a clinic's old system into BlueDental: patients and their
/// treatment history from one Excel workbook. Payments are not carried — the
/// history lines are priced 0 so no công nợ appears (BA 2026-10-08).
/// </summary>
public interface IDataMigrationAppService : IApplicationService
{
    /// <summary>
    /// The empty workbook to fill: the two data sheets, a guide, and the
    /// branch's live catalogs (services, staff, sources...) to copy names from.
    /// </summary>
    Task<byte[]> GetTemplateAsync(Guid? clinicBranchId);

    /// <summary>
    /// Validates the whole file and, unless <see cref="ImportDataMigrationDto.DryRun"/> is
    /// set, writes it in one unit of work. A single bad row refuses the file.
    /// </summary>
    Task<DataMigrationResultDto> ImportAsync(ImportDataMigrationDto input);

    /// <summary>The uploaded file with a "Lỗi" column on both data sheets, for fixing offline.</summary>
    Task<byte[]> GetErrorFileAsync(ImportDataMigrationDto input);
}
