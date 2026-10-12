using System;
using System.Linq;
using System.Threading.Tasks;
using Volo.Abp.Domain.Repositories;

namespace BlueDental.TreatmentManagement;

internal static class TreatmentPlanOpenedOn
{
    /// <summary>
    /// The clinic day a phiếu điều trị was created — the earliest Ngày điều trị
    /// any of its công đoạn or tái khám may carry (QA #32). Null without a slip.
    /// </summary>
    public static async Task<DateOnly?> OpenedOnAsync(
        this IRepository<TreatmentPlan, Guid> plans,
        Guid? treatmentId)
    {
        if (!treatmentId.HasValue)
        {
            return null;
        }

        var query = await plans.GetQueryableAsync();
        var created = query
            .Where(x => x.Id == treatmentId.Value)
            .Select(x => (DateTime?)x.CreationTime)
            .FirstOrDefault();

        return created.HasValue
            ? ClinicCalendar.DateOf(new DateTimeOffset(DateTime.SpecifyKind(created.Value, DateTimeKind.Utc)))
            : null;
    }
}
