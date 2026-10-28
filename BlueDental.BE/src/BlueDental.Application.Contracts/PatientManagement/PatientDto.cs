using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using Volo.Abp.Application.Dtos;

namespace BlueDental.PatientManagement;

public class PatientDto : FullAuditedEntityDto<Guid>
{
    public string PatientCode { get; set; } = default!;
    public string FirstName { get; set; } = default!;
    public string LastName { get; set; } = default!;
    public string FullName { get; set; } = default!;

    /// <summary>Null when the front desk registered the patient without one.</summary>
    public DateOnly? DateOfBirth { get; set; }

    public Gender Gender { get; set; }
    [PatientPhone]
    public string? PhoneNumber { get; set; }
    public string? Email { get; set; }
    public string? NationalId { get; set; }
    public PatientStatus Status { get; set; }
    public Guid BranchId { get; set; }

    // ── The rest of the hồ sơ dialog ─────────────────────────────────────────

    public Guid? SourceTaxonomyId { get; set; }
    public Guid? SourceEntryId { get; set; }
    public Guid? OccupationEntryId { get; set; }
    public string? OccupationOther { get; set; }
    public string? InsuranceNumber { get; set; }

    /// <summary>Số nhà/ Đường — the street line, without province or ward.</summary>
    public string? Address { get; set; }

    public string? ProvinceCode { get; set; }
    public string? WardCode { get; set; }

    /// <summary>Địa chỉ cũ — the pre-2025 address as printed on the CCCD.</summary>
    public string? OldAddress { get; set; }

    /// <summary>
    /// The root reason's text — what the hồ sơ dialog's Lý do đến khám box
    /// binds. The card renders <see cref="ExaminationReasons"/> instead.
    /// </summary>
    public string? ExaminationReason { get; set; }

    /// <summary>Lý do đến khám, newest first — the dated list on the profile card.</summary>
    public List<PatientExaminationReasonDto> ExaminationReasons { get; set; } = new();

    public string? Note { get; set; }

    /// <summary>Thẻ hồ sơ — ids from the branch's PatientTag catalog.</summary>
    public List<Guid> TagIds { get; set; } = new();

    /// <summary>Tiểu sử bệnh — entry ids from the Lịch sử bệnh catalog.</summary>
    public List<Guid> DiseaseHistoryEntryIds { get; set; } = new();

    /// <summary>Người giám hộ, in the order the dialog lists them.</summary>
    public List<PatientGuardianDto> Guardians { get; set; } = new();
}

/// <summary>One dated line of "BE:Field:ReasonForVisit".</summary>
public class PatientExaminationReasonDto
{
    public Guid Id { get; set; }

    public string Content { get; set; } = default!;

    public string? Note { get; set; }

    /// <summary>True for the line the hồ sơ dialog edits.</summary>
    public bool IsRoot { get; set; }

    /// <summary>The date the card prints beside the reason.</summary>
    public DateTimeOffset RecordedAt { get; set; }
}

/// <summary>What the card's + button sends.</summary>
public class AddExaminationReasonDto
{
    [Required]
    [StringLength(PatientExaminationReasonConsts.MaxContentLength)]
    public string Content { get; set; } = default!;

    [StringLength(PatientExaminationReasonConsts.MaxNoteLength)]
    public string? Note { get; set; }
}

/// <summary>
/// One row of the patient list. Deliberately not <see cref="PatientDto"/>: the
/// table shows a money and appointment rollup that the record itself does not
/// carry, and the dialog needs fields the table never renders.
/// </summary>
public class PatientListItemDto
{
    public Guid Id { get; set; }
    public string PatientCode { get; set; } = default!;

    /// <summary>Họ và tên, in Vietnamese order.</summary>
    public string FullName { get; set; } = default!;

    public DateOnly? DateOfBirth { get; set; }
    [PatientPhone]
    public string? PhoneNumber { get; set; }

    /// <summary>Trạng thái — derived from the patient's treatment slips.</summary>
    public PatientTreatmentStatus TreatmentStatus { get; set; }

    /// <summary>Dịch vụ — distinct service names across the patient's slips.</summary>
    public List<string> ServiceNames { get; set; } = new();

    /// <summary>Bác sĩ — distinct dentists on those slips.</summary>
    public List<string> StaffNames { get; set; } = new();

    /// <summary>Số tiền — what every slip totals to, after discounts.</summary>
    public decimal TotalAmount { get; set; }

    /// <summary>Thực thu — payments taken, less refunds.</summary>
    public decimal TotalRevenue { get; set; }

    /// <summary>Công nợ — what is still owed.</summary>
    public decimal TotalDebt { get; set; }

    /// <summary>
    /// Set when the caller lacks "Tài chính / Kế toán › Chi phí › Xem" (BA P2010):
    /// the three money fields above then arrive as 0 and are shown masked.
    /// </summary>
    public bool MoneyHidden { get; set; }

    /// <summary>Lịch hẹn gần nhất — the next appointment still ahead.</summary>
    public DateTimeOffset? NextAppointmentAt { get; set; }

    /// <summary>Lần khám cuối — the last visit, falling back to registration.</summary>
    public DateTimeOffset? LastVisitAt { get; set; }

    public DateTime CreationTime { get; set; }
}

/// <summary>The code the "BE:Common:CreateRecord" dialog opens with, split as it renders it.</summary>
public class PatientCodeEstimateDto
{
    /// <summary>The fixed half, e.g. <c>DH26</c> — shown greyed and not editable.</summary>
    public string Prefix { get; set; } = default!;

    /// <summary>The editable half, e.g. <c>013</c>.</summary>
    public string Sequence { get; set; } = default!;

    /// <summary>Prefix and sequence joined — what would be saved as-is.</summary>
    public string Code { get; set; } = default!;
}

/// <summary>Answer to the dialog's duplicate-phone check.</summary>
public class PhoneAvailabilityDto
{
    public bool Exists { get; set; }

    /// <summary>
    /// Everyone in the branch who already holds it, Chủ số first, so the
    /// dialog can name them all. Empty for a masked account.
    /// </summary>
    public List<PhoneOwnerDto> Owners { get; set; } = [];

    /// <summary>
    /// Guardians on file with this number who have no hồ sơ yet (P2710_02):
    /// the dialog offers to make one from them. Not counted in <see cref="Exists"/>.
    /// </summary>
    public List<PhoneGuardianDto> Guardians { get; set; } = [];
}

public class PhoneOwnerDto
{
    public Guid Id { get; set; }

    public string PatientCode { get; set; } = default!;

    public string PatientName { get; set; } = default!;

    public Gender Gender { get; set; }
    public DateOnly? DateOfBirth { get; set; }

    /// <summary>Khám gần nhất — the patient list's "Lần khám cuối".</summary>
    public DateTimeOffset? LastVisitAt { get; set; }

    /// <summary>Chủ số — the first hồ sơ that held the number.</summary>
    public bool IsPhoneOwner { get; set; }

    /// <summary>
    /// Over 18, or of unknown age: may stand on the "của …" side of any
    /// relation. The relations that answer for a child accept every holder.
    /// </summary>
    public bool IsAdult { get; set; }

    /// <summary>What this holder is to <see cref="RelatedToName"/> — the "Con của Hùng" chip.</summary>
    public PatientRelationType? RelationType { get; set; }

    public string? RelatedToName { get; set; }
}

/// <summary>A guardian without a hồ sơ who answers on the number typed (P2710_02).</summary>
public class PhoneGuardianDto
{
    /// <summary>The newest declaration of the person; sent back as <see cref="RegisterPatientDto.SourceGuardianId"/>.</summary>
    public Guid GuardianId { get; set; }

    public GuardianRelation Relation { get; set; }
    public string FullName { get; set; } = default!;
    public string NationalId { get; set; } = default!;
    public DateOnly? DateOfBirth { get; set; }
    public Gender? Gender { get; set; }
    public string? Email { get; set; }
    public Guid? OccupationEntryId { get; set; }

    /// <summary>The guardian's address — the ward's when "cùng địa chỉ với khách hàng" is ticked.</summary>
    public string? Address { get; set; }
    public string? ProvinceCode { get; set; }
    public string? WardCode { get; set; }

    /// <summary>The patients they answer for, newest first.</summary>
    public List<GuardianWardDto> Wards { get; set; } = [];
}

/// <summary>
/// "Liên kết người dùng chung SĐT" (P2710_02): a record saved on a number
/// another hồ sơ holds says who it is to one of them.
/// </summary>
public class SharedPhoneLinkInput
{
    /// <summary>"Là …" — what the record being saved is to <see cref="AnchorPatientId"/>.</summary>
    public PatientRelationType Relation { get; set; }

    /// <summary>"của …" — a hồ sơ already holding the number.</summary>
    public Guid AnchorPatientId { get; set; }
}

/// <summary>"Người dùng chung SĐT" on the record's Hồ sơ tab, and the guardians' hồ sơ codes.</summary>
public class PatientLinkedPeopleDto
{
    /// <summary>The other hồ sơ on the record's number, Chủ số first.</summary>
    public List<PhoneGroupMemberDto> SharedPhone { get; set; } = [];

    /// <summary>"Tổng dư nợ cả nhóm" — the record's own debt included.</summary>
    public decimal GroupDebt { get; set; }

    /// <summary>BA P2010: without "Chi phí › Xem" every amount arrives as 0.</summary>
    public bool MoneyHidden { get; set; }

    /// <summary>The section's +: a masked account cannot put a record on a number it is not shown.</summary>
    public bool CanAddSharedPhone { get; set; }

    /// <summary>Guardians of the record who have their own hồ sơ.</summary>
    public List<LinkedGuardianDto> Guardians { get; set; } = [];
}

public class PhoneGroupMemberDto
{
    public Guid Id { get; set; }
    public string PatientCode { get; set; } = default!;
    public string FullName { get; set; } = default!;
    public Gender Gender { get; set; }
    public DateOnly? DateOfBirth { get; set; }
    public DateTimeOffset? LastVisitAt { get; set; }
    public decimal TotalDebt { get; set; }
    public bool IsPhoneOwner { get; set; }
    public PatientRelationType? RelationType { get; set; }
    public string? RelatedToName { get; set; }
}

public class LinkedGuardianDto
{
    public Guid GuardianId { get; set; }
    public Guid PatientId { get; set; }
    public string PatientCode { get; set; } = default!;
    public DateTimeOffset? LastVisitAt { get; set; }
}

/// <summary>
/// Answer to "Quét CCCD": whether a record in the branch already holds the
/// scanned number. Deliberately yes/no only — like the duplicate refusal
/// (R-564) it never names the holder; the list the scan then narrows is
/// where a reader with Patient.Read sees the record.
/// </summary>
public class NationalIdLookupDto
{
    public bool Exists { get; set; }
}

public class RegisterPatientDto
{
    /// <summary>
    /// The Lịch tạm card the record is made from, if any — lets a phone that
    /// was shown masked (Cụm 11 mục 9) be saved as the card's real number.
    /// </summary>
    public Guid? SourceAppointmentId { get; set; }

    public string FirstName { get; set; } = default!;
    public string LastName { get; set; } = default!;

    /// <summary>Optional — the dialog does not require a birth date.</summary>
    public DateOnly? DateOfBirth { get; set; }

    public Gender Gender { get; set; }
    public string? PhoneNumber { get; set; }
    public string? Email { get; set; }
    public string? NationalId { get; set; }

    /// <summary>Null keeps the code the server suggests.</summary>
    public string? PatientCode { get; set; }

    public Guid? SourceTaxonomyId { get; set; }
    public Guid? SourceEntryId { get; set; }
    public Guid? OccupationEntryId { get; set; }
    public string? OccupationOther { get; set; }
    public string? InsuranceNumber { get; set; }
    public string? Address { get; set; }
    public string? ProvinceCode { get; set; }
    public string? WardCode { get; set; }
    public string? OldAddress { get; set; }
    public string? ExaminationReason { get; set; }
    public string? Note { get; set; }

    public List<Guid>? TagIds { get; set; }
    public List<Guid>? DiseaseHistoryEntryIds { get; set; }

    /// <summary>Người giám hộ — required (at least one) when the patient is under 16.</summary>
    public List<PatientGuardianInput>? Guardians { get; set; }

    /// <summary>The popup's single consent tick for the whole group.</summary>
    public bool GuardiansConsented { get; set; }

    /// <summary>Required when another hồ sơ of the branch holds the phone (P2710_02).</summary>
    public SharedPhoneLinkInput? SharedPhoneLink { get; set; }

    /// <summary>
    /// The guardian row the form was filled from (P2710_02): the guardian
    /// becomes this hồ sơ, and every declaration of the person links to it.
    /// </summary>
    public Guid? SourceGuardianId { get; set; }
}

public class UpdatePatientDto
{
    public string FirstName { get; set; } = default!;
    public string LastName { get; set; } = default!;
    public DateOnly? DateOfBirth { get; set; }
    public Gender Gender { get; set; }
    public string? PhoneNumber { get; set; }
    public string? Email { get; set; }
    public string? NationalId { get; set; }

    /// <summary>Null keeps the current code.</summary>
    public string? PatientCode { get; set; }

    public Guid? SourceTaxonomyId { get; set; }
    public Guid? SourceEntryId { get; set; }
    public Guid? OccupationEntryId { get; set; }
    public string? OccupationOther { get; set; }
    public string? InsuranceNumber { get; set; }
    public string? Address { get; set; }
    public string? ProvinceCode { get; set; }
    public string? WardCode { get; set; }
    public string? OldAddress { get; set; }
    public string? ExaminationReason { get; set; }
    public string? Note { get; set; }

    /// <summary>Null = keep the current tags; a list replaces them whole.</summary>
    public List<Guid>? TagIds { get; set; }

    /// <summary>Null = keep the current history; a list replaces it whole.</summary>
    public List<Guid>? DiseaseHistoryEntryIds { get; set; }

    /// <summary>
    /// Null = keep the current guardians; a list replaces the group whole.
    /// Either way an under-16 record is refused while it has none.
    /// </summary>
    public List<PatientGuardianInput>? Guardians { get; set; }

    /// <summary>The popup's single consent tick; only read when <see cref="Guardians"/> is sent.</summary>
    public bool GuardiansConsented { get; set; }

    /// <summary>Required when the phone changes to one another hồ sơ holds (P2710_02).</summary>
    public SharedPhoneLinkInput? SharedPhoneLink { get; set; }
}

/// <summary>
/// The "Người giám hộ" block on the record's Hồ sơ tab: the whole group,
/// replaced without touching the rest of the hồ sơ.
/// </summary>
public class UpdatePatientGuardiansDto
{
    [Required]
    public List<PatientGuardianInput> Guardians { get; set; } = new();

    /// <summary>The popup's single consent tick for the whole group.</summary>
    public bool GuardiansConsented { get; set; }
}

/// <summary>
/// Thẻ hồ sơ, ticked from the record's picker or a Tiếp nhận card: the whole
/// set, replaced without touching the rest of the hồ sơ.
/// </summary>
public class SetPatientTagsDto
{
    [Required]
    public List<Guid> TagIds { get; set; } = new();
}

public class GetPatientListInput : PagedAndSortedResultRequestDto
{
    // No BranchId here on purpose. The branch in view travels in the
    // X-Clinic-Branch-Id header and is resolved server-side; letting the body
    // name a branch too would be an unchecked way past that scope.

    /// <summary>Tìm kiếm — matches name, patient code, phone or CCCD.</summary>
    public string? Filter { get; set; }

    /// <summary>Record lifecycle, not the treatment tabs.</summary>
    public PatientStatus? Status { get; set; }

    /// <summary>The Tất cả / Hoàn tất / Đang điều trị / Chưa phát sinh tabs.</summary>
    public PatientTreatmentFilter? TreatmentStatus { get; set; }

    /// <summary>Bác sĩ — patients with a slip run by this dentist.</summary>
    public Guid? StaffId { get; set; }

    /// <summary>Phân loại dịch vụ — a group of the Dịch vụ catalog.</summary>
    public Guid? ServiceTaxonomyId { get; set; }

    /// <summary>Phân loại theo Tag — patients carrying this Thẻ hồ sơ.</summary>
    public Guid? TagId { get; set; }

    /// <summary>Start of the Ngày/Tuần/Tháng window, on registration date.</summary>
    public DateTimeOffset? FromDate { get; set; }

    /// <summary>End of that window, inclusive.</summary>
    public DateTimeOffset? ToDate { get; set; }
}
