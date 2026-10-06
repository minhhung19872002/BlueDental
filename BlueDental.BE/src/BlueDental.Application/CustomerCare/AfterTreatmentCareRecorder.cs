using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using BlueDental.TreatmentManagement;
using Volo.Abp.DependencyInjection;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Guids;

namespace BlueDental.CustomerCare;

/// <summary>
/// Opens the Sau điều trị task of a treatment visit. A visit is a "Tiếp tục
/// công đoạn" (owner, 2026-10-05) or a "Hoàn thành" of a công đoạn or a whole
/// service line (QA 2026-10-06 — a one-visit service is ticked done without
/// ever being continued). Every one of them lands on the patient's one task for
/// that clinic day — the first one of the day creates it, later ones only link
/// their công đoạn.
/// </summary>
public class AfterTreatmentCareRecorder : ITransientDependency
{
    private readonly IRepository<CareRecord, Guid> _repository;
    private readonly IGuidGenerator _guidGenerator;

    public AfterTreatmentCareRecorder(IRepository<CareRecord, Guid> repository, IGuidGenerator guidGenerator)
    {
        _repository = repository;
        _guidGenerator = guidGenerator;
    }

    public Task RecordVisitAsync(TreatmentStage stage, DateTimeOffset visitedAt) =>
        RecordVisitAsync(stage.PatientId, stage.ClinicBranchId, stage.StaffId, [stage.Id], visitedAt);

    public async Task RecordVisitAsync(
        Guid patientId,
        Guid branchId,
        Guid? treatingStaffId,
        IReadOnlyCollection<Guid> stageIds,
        DateTimeOffset visitedAt)
    {
        var day = ClinicCalendar.DateOf(visitedAt);

        var existing = await _repository.FirstOrDefaultAsync(r =>
            r.Type == CareType.AfterTreatment
            && r.BranchId == branchId
            && r.PatientId == patientId
            && r.TreatmentDate == day);

        if (existing != null)
        {
            foreach (var stageId in stageIds)
            {
                existing.FollowUpStage(stageId);
            }
            await _repository.UpdateAsync(existing, autoSave: true);
            return;
        }

        await _repository.InsertAsync(
            CareRecord.AfterTreatment(
                _guidGenerator.Create(),
                patientId,
                branchId,
                treatingStaffId,
                day,
                stageIds),
            autoSave: true);
    }
}
