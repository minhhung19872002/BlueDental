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

/// <summary>
/// A quote line as read back: the set fields plus the price this quote holds
/// for it, worked out into amounts the same way a consulting line is.
/// </summary>
public class PatientQuoteLineReadDto : PatientQuoteLineDto
{
    public decimal Price { get; set; }
    public int Quantity { get; set; }
    public DiscountType DiscountType { get; set; }
    public decimal DiscountValue { get; set; }
    public decimal GrossAmount { get; set; }
    public decimal DiscountAmount { get; set; }
    public decimal EffectiveAmount { get; set; }
}

/// <summary>
/// Body of <c>PUT /patient-quotes/{id}/lines/{adviseId}</c>: "Cập nhật phiếu
/// dịch vụ" saved on a báo giá's tab. Changes that quote's figures only.
/// </summary>
public class RepricePatientQuoteLineDto
{
    public decimal Price { get; set; }
    public int Quantity { get; set; }
    public DiscountType DiscountType { get; set; }
    public decimal DiscountValue { get; set; }
}

public class PatientQuoteDto
{
    public Guid Id { get; set; }
    public Guid PatientId { get; set; }
    public Guid ClinicBranchId { get; set; }

    /// <summary>1-based per patient; the tab reads "BG {Ordinal}".</summary>
    public int Ordinal { get; set; }

    public DateTime CreationTime { get; set; }
    public List<PatientQuoteLineReadDto> Lines { get; set; } = new();
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
    /// <summary>"BE:Perm:CopyQuote" — a new quote with the same lines and ticks.</summary>
    Task<PatientQuoteDto> DuplicateAsync(Guid id);
    Task<PatientQuoteDto> UpdateAsync(Guid id, UpdatePatientQuoteDto input);
    Task<PatientQuoteDto> RepriceLineAsync(Guid id, Guid adviseId, RepricePatientQuoteLineDto input);
    Task DeleteAsync(Guid id);
}
