using System;
using System.Threading.Tasks;
using BlueDental.TreatmentManagement;
using Volo.Abp.DependencyInjection;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Guids;

namespace BlueDental.CustomerCare;

/// <summary>
/// Opens the Sau điều trị task of a treatment visit (owner, 2026-10-05): every
/// "Tiếp tục công đoạn" lands on the patient's one task for that clinic day —
/// the first one of the day creates it, later ones only link their công đoạn.
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

    public async Task RecordVisitAsync(TreatmentStage stage, DateTimeOffset visitedAt)
    {
        var day = ClinicCalendar.DateOf(visitedAt);

        var existing = await _repository.FirstOrDefaultAsync(r =>
            r.Type == CareType.AfterTreatment
            && r.BranchId == stage.ClinicBranchId
            && r.PatientId == stage.PatientId
            && r.TreatmentDate == day);

        if (existing != null)
        {
            existing.FollowUpStage(stage.Id);
            await _repository.UpdateAsync(existing, autoSave: true);
            return;
        }

        await _repository.InsertAsync(
            CareRecord.AfterTreatment(
                _guidGenerator.Create(),
                stage.PatientId,
                stage.ClinicBranchId,
                stage.StaffId,
                day,
                stage.Id),
            autoSave: true);
    }
}
