using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using BlueDental.Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Volo.Abp;

namespace BlueDental.PatientManagement;

/// <summary>Thư mục of the Hình ảnh tab (F-98).</summary>
[RemoteService]
[Authorize]
[Route("api/v1/app/patient-image-folders")]
public sealed class PatientImageFolderController(IPatientImageFolderAppService service) : BlueDentalController
{
    [HttpGet]
    public Task<List<PatientImageFolderDto>> GetListAsync([FromQuery] GetPatientImageFolderListInput input) =>
        service.GetListAsync(input);

    [HttpPost]
    public Task<PatientImageFolderDto> CreateAsync([FromBody] CreatePatientImageFolderDto input) =>
        service.CreateAsync(input);

    [HttpPut("{id:guid}")]
    public Task<PatientImageFolderDto> RenameAsync(Guid id, [FromBody] RenamePatientImageFolderDto input) =>
        service.RenameAsync(id, input);

    /// <summary>Its pictures go back into the column; none is deleted.</summary>
    [HttpDelete("{id:guid}")]
    public Task DeleteAsync(Guid id) => service.DeleteAsync(id);
}
