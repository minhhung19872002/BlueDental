using System;
using System.Threading.Tasks;
using BlueDental.Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Volo.Abp;

namespace BlueDental.TreatmentManagement;

/// <summary>The slip's Bảo hành tab (P3110 REQ-B1..B7), under the slip's own route (G17).</summary>
[RemoteService]
[Authorize]
[Route("api/v1/app/patient-treatments")]
public sealed class PlanWarrantyController(IPlanWarrantyAppService service) : BlueDentalController
{
    [HttpGet("{planId:guid}/warranty-overview")]
    public Task<PlanWarrantyOverviewDto> GetOverviewAsync(Guid planId) => service.GetOverviewAsync(planId);

    /// <summary>JSON "Bảo hành dịch vụ", without Ảnh thẻ.</summary>
    [HttpPost("{planId:guid}/services/{lineId:guid}/warranty")]
    [Consumes("application/json")]
    public Task<PlanWarrantyOverviewDto> ActivateAsync(
        Guid planId, Guid lineId, [FromBody] ActivateServiceWarrantyDto input) =>
        service.ActivateAsync(planId, lineId, input);

    /// <summary>
    /// "Bảo hành dịch vụ" with the Ảnh thẻ as <c>cardPhotos</c>, each named by
    /// <c>cardPhotoTeeth</c> (0 = a line without teeth) and <c>cardPhotoSides</c>.
    /// </summary>
    [HttpPost("{planId:guid}/services/{lineId:guid}/warranty")]
    [Consumes("multipart/form-data")]
    public Task<PlanWarrantyOverviewDto> ActivateWithPhotosAsync(
        Guid planId, Guid lineId, [FromForm] ActivateServiceWarrantyDto input) =>
        service.ActivateAsync(planId, lineId, input);
}
