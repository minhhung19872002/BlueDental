using System;
using System.Linq;
using System.Threading.Tasks;
using Volo.Abp.DependencyInjection;
using Volo.Abp.Domain.Repositories;

namespace BlueDental.PatientManagement;

/// <summary>
/// What every way a picture reaches a record shares — the Hình ảnh tab's
/// upload, an X-ray PC's own send and a picture put on a record from "Ảnh chưa
/// gán hồ sơ" (F-95) — so all three land at the end of the patient's sequence
/// the same way.
/// </summary>
public class PatientImageWriter(IRepository<PatientImage, Guid> images) : ITransientDependency
{
    public static string BlobName(Guid patientId, Guid imageId, string? extension) =>
        $"patients/{patientId}/{imageId}{extension}";

    /// <summary>The position after the patient's last picture in the branch.</summary>
    public async Task<int> NextOrderingAsync(Guid patientId, Guid clinicBranchId)
    {
        var query = await images.GetQueryableAsync();
        var last = query
            .Where(x => x.PatientId == patientId && x.ClinicBranchId == clinicBranchId)
            .Select(x => (int?)x.Ordering)
            .Max();

        return (last ?? 0) + 1;
    }
}
