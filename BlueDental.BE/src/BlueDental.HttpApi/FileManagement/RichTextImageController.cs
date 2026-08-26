using System;
using System.Threading.Tasks;
using BlueDental.Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Volo.Abp;
using Volo.Abp.Content;

namespace BlueDental.FileManagement;

/// <summary>
/// The images a rich-text body links to, for every editor in the application.
/// </summary>
[RemoteService]
[Authorize]
[Route("api/v1/app/rich-text-images")]
public sealed class RichTextImageController(IRichTextImageAppService service) : BlueDentalController
{
    /// <summary>
    /// Multipart, so the DTO is bound by hand rather than from a JSON body —
    /// the same shape the QR upload uses.
    /// </summary>
    [HttpPost]
    public Task<RichTextImageDto> UploadAsync(
        [FromForm] IFormFile file,
        [FromForm] Guid clinicBranchId) =>
        service.UploadAsync(new UploadRichTextImageDto
        {
            ClinicBranchId = clinicBranchId,
            File = new RemoteStreamContent(file.OpenReadStream(), file.FileName, file.ContentType),
        });

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetAsync(Guid id)
    {
        var content = await service.GetAsync(id);

        return File(content.GetStream(), content.ContentType ?? "application/octet-stream");
    }

    /// <summary>
    /// Where Vận hành's images used to live.
    ///
    /// Article bodies written before the store was shared carry this path
    /// inside their own HTML, so it has to keep answering. Rewriting stored
    /// markup across every article would be a migration over user content to
    /// save one route.
    /// </summary>
    [HttpGet("/api/v1/app/operations/article-images/{id:guid}")]
    public Task<IActionResult> GetLegacyAsync(Guid id) => GetAsync(id);
}
