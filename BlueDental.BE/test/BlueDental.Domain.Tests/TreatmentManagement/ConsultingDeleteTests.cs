using System;
using BlueDental.TreatmentManagement;
using BlueDental.TreatmentManagement.Values;
using Volo.Abp;
using Xunit;

namespace BlueDental.Domain.Tests.TreatmentManagement;

/// <summary>
/// "Xoá phiếu chẩn đoán" and "Xoá dịch vụ tư vấn" delete for good, as the
/// reference does (DELETE, "sẽ bị xoá khỏi danh sách"). Only work that has
/// already gone further stays: a treated slip, and a line pulled into a plan.
/// </summary>
public class ConsultingDeleteTests
{
    private static readonly ToothSelection[] Tooth = { new(36, selected: true) };

    private static PatientDiagnosis NewDiagnosis() =>
        PatientDiagnosis.Record(
            Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), "CD26-0001", Tooth);

    private static PatientAdvise NewAdvise() =>
        PatientAdvise.Offer(
            Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), null, null, Guid.NewGuid(), Guid.NewGuid(),
            "TV26-0001", originalPrice: 100_000m, price: 100_000m, quantity: 1, Tooth);

    [Fact]
    public void A_new_or_cancelled_diagnosis_can_be_deleted()
    {
        NewDiagnosis().EnsureDeletable();

        var cancelled = NewDiagnosis();
        cancelled.Cancel();
        cancelled.EnsureDeletable();
    }

    [Fact]
    public void A_treated_diagnosis_cannot_be_deleted()
    {
        var diagnosis = NewDiagnosis();
        diagnosis.MarkTreated();

        var error = Assert.Throws<BusinessException>(diagnosis.EnsureDeletable);
        Assert.Equal(BlueDentalDomainErrorCodes.TreatmentManagement.InvalidDiagnosisTransition, error.Code);
    }

    [Fact]
    public void An_advise_not_yet_in_a_plan_can_be_deleted()
    {
        NewAdvise().EnsureDeletable();

        var accepted = NewAdvise();
        accepted.Accept();
        accepted.EnsureDeletable();

        var rejected = NewAdvise();
        rejected.Reject();
        rejected.EnsureDeletable();
    }

    [Fact]
    public void An_advise_converted_into_a_plan_cannot_be_deleted()
    {
        var advise = NewAdvise();
        advise.ConvertTo(Guid.NewGuid());

        var error = Assert.Throws<BusinessException>(advise.EnsureDeletable);
        Assert.Equal(BlueDentalDomainErrorCodes.TreatmentManagement.InvalidAdviseTransition, error.Code);
    }
}
