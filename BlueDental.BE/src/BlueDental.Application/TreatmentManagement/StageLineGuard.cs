using System;
using System.Linq;
using System.Threading.Tasks;
using Volo.Abp;
using Volo.Abp.DependencyInjection;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Linq;

namespace BlueDental.TreatmentManagement;

/// <summary>
/// A service line that was converted (Chuyển đổi → "Thay thế") or cancelled is
/// closed: its công đoạn stay in LỊCH SỬ ĐIỀU TRỊ to be read, and nothing writes
/// them any more — no new or continued công đoạn, no Hoàn thành either way, no
/// edit, no picture, no Labo (BA 2026-11-10, R-1186). Xóa công đoạn stays open
/// to the admin for a row written by mistake (owner's call), so it is not guarded.
/// </summary>
public class StageLineGuard(
    IRepository<TreatmentPlan, Guid> planRepository,
    IAsyncQueryableExecuter asyncExecuter) : ITransientDependency
{
    public static bool IsClosed(TreatmentServiceStatus status) =>
        status is TreatmentServiceStatus.Replaced or TreatmentServiceStatus.Cancelled;

    /// <summary>Throws when the line is closed; an unknown line is left to the caller's own checks.</summary>
    public async Task EnsureOpenAsync(Guid treatmentServiceId)
    {
        var query = await planRepository.GetQueryableAsync();
        var status = await asyncExecuter.FirstOrDefaultAsync(query
            .SelectMany(plan => plan.Services)
            .Where(line => line.Id == treatmentServiceId)
            .Select(line => (TreatmentServiceStatus?)line.Status));

        if (status is { } known && IsClosed(known))
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.TreatmentManagement.StageLineClosed);
        }
    }
}
