using System.ComponentModel.DataAnnotations;
using System.Reflection;
using BlueDental.Permissions;
using BlueDental.TreatmentManagement;
using Microsoft.AspNetCore.Authorization;
using Shouldly;
using Xunit;

namespace BlueDental.Application.Tests.TreatmentManagement;

/// <summary>Ghi chú on Lịch sử điều trị — its own field and its own endpoint.</summary>
public class TreatmentStageRemarkContractTests
{
    [Fact]
    public void The_stage_should_expose_its_remark()
    {
        typeof(TreatmentStageDto).GetProperty("Remark").ShouldNotBeNull();
    }

    [Fact]
    public void The_full_update_should_not_carry_the_remark()
    {
        // A remark sent with every edit would be wiped by any caller that left it
        // out, so it travels on its own endpoint only.
        typeof(UpdateTreatmentStageDto).GetProperty("Remark").ShouldBeNull();
    }

    [Fact]
    public void The_remark_should_be_capped_at_1000()
    {
        typeof(UpdateTreatmentStageRemarkDto)
            .GetProperty("Remark")
            .ShouldNotBeNull()
            .GetCustomAttribute<StringLengthAttribute>()
            .ShouldNotBeNull()
            .MaximumLength.ShouldBe(TreatmentStage.RemarkMaxLength);
    }

    [Theory]
    [InlineData(typeof(CreateTreatmentStageDto))]
    [InlineData(typeof(ContinueTreatmentStageDto))]
    public void The_new_stage_forms_should_carry_a_capped_appointment_note(Type form)
    {
        // Ghi chú lịch hẹn is typed on the Thêm / Tiếp tục công đoạn form and
        // lands in the new công đoạn's Ghi chú (R-1056).
        form.GetProperty("Remark")
            .ShouldNotBeNull()
            .GetCustomAttribute<StringLengthAttribute>()
            .ShouldNotBeNull()
            .MaximumLength.ShouldBe(TreatmentStage.RemarkMaxLength);
    }

    [Fact]
    public void UpdateRemarkAsync_should_be_gated_by_the_stage_update_ability()
    {
        typeof(TreatmentStageAppService)
            .GetMethod("UpdateRemarkAsync")
            .ShouldNotBeNull()
            .GetCustomAttribute<AuthorizeAttribute>()
            .ShouldNotBeNull()
            .Policy.ShouldBe(BlueDentalAbilityPermissions.TreatmentStage.Update);
    }
}
