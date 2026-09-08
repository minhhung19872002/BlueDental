using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;

namespace BlueDental.TreatmentManagement;

public class PatientQuoteLineDto
{
    public Guid AdviseId { get; set; }
    public bool IsSelected { get; set; }
    public int SortOrder { get; set; }
}

public class PatientQuoteDto
{
    public Guid Id { get; set; }
    public Guid PatientId { get; set; }
    public Guid ClinicBranchId { get; set; }

    /// <summary>1-based per patient; the tab reads "BG {Ordinal}".</summary>
    public int Ordinal { get; set; }

    public DateTime CreationTime { get; set; }
    public List<PatientQuoteLineDto> Lines { get; set; } = new();
}

/// <summary>Body of <c>POST /patient-quotes</c>: the ticked consulting lines.</summary>
public class CreatePatientQuoteDto
{
    public Guid PatientId { get; set; }
    public Guid ClinicBranchId { get; set; }

    /// <summary>In the order they should sit on the quote. All start ticked.</summary>
    public List<Guid> AdviseIds { get; set; } = new();
}

/// <summary>
/// Body of <c>PUT /patient-quotes/{id}</c>: the whole set, as a re-tick or a
/// drag on the quote's table leaves it. Sent whole rather than as a diff — the
/// set is small and the server renumbers it 1..N.
/// </summary>
public class UpdatePatientQuoteDto
{
    public List<PatientQuoteLineDto> Lines { get; set; } = new();
}

public class GetPatientQuoteListInput : PagedAndSortedResultRequestDto
{
    public Guid? PatientId { get; set; }
    public Guid? ClinicBranchId { get; set; }
}

/// <summary>
/// Báo giá — the "BG n" tabs on Chẩn đoán and Tư vấn. BlueDental's own shape;
/// what the reference stores is unobserved, see docs/clone/unknowns.md.
/// </summary>
public interface IPatientQuoteAppService : IApplicationService
{
    Task<PagedResultDto<PatientQuoteDto>> GetListAsync(GetPatientQuoteListInput input);
    Task<PatientQuoteDto> CreateAsync(CreatePatientQuoteDto input);
    /// <summary>"Sao chép báo giá" — a new quote with the same lines and ticks.</summary>
    Task<PatientQuoteDto> DuplicateAsync(Guid id);
    Task<PatientQuoteDto> UpdateAsync(Guid id, UpdatePatientQuoteDto input);
    Task DeleteAsync(Guid id);
}
