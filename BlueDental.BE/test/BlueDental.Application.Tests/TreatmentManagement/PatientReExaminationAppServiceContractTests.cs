using System.Reflection;
using BlueDental.Permissions;
using BlueDental.TreatmentManagement;
using Microsoft.AspNetCore.Authorization;
using Shouldly;
using Volo.Abp.Application.Services;
using Xunit;

namespace BlueDental.Application.Tests.TreatmentManagement;

public class PatientReExaminationAppServiceContractTests
{
    private readonly Type _serviceType = typeof(PatientReExaminationAppService);
    private readonly Type _interfaceType = typeof(IPatientReExaminationAppService);

    [Fact]
    public void PatientReExaminationAppService_Should_Implement_Its_Interface()
    {
        _interfaceType.IsAssignableFrom(_serviceType).ShouldBeTrue();
    }

    [Fact]
    public void PatientReExaminationAppService_Should_Inherit_ApplicationService()
    {
        typeof(ApplicationService).IsAssignableFrom(_serviceType).ShouldBeTrue();
    }

    [Fact]
    public void PatientReExaminationAppService_Should_Require_Authorization_At_Class_Level()
    {
        _serviceType.GetCustomAttribute<AuthorizeAttribute>().ShouldNotBeNull();
    }

    [Theory]
    [InlineData("GetListAsync")]
    [InlineData("CreateAsync")]
    [InlineData("AttachImageAsync")]
    public void Every_Method_Should_Exist_On_The_Interface(string method)
    {
        _interfaceType.GetMethod(method).ShouldNotBeNull();
    }

    [Theory]
    [InlineData("GetListAsync", BlueDentalAbilityPermissions.TreatmentStage.Read)]
    [InlineData("CreateAsync", BlueDentalAbilityPermissions.TreatmentStage.Complete)]
    [InlineData("AttachImageAsync", BlueDentalAbilityPermissions.TreatmentStage.Update)]
    public void Every_Method_Should_Be_Gated_By_Its_Stage_Ability(string method, string permission)
    {
        // The reference's ability list has nothing of its own for the follow-up,
        // so it rides on the công đoạn abilities.
        _serviceType.GetMethod(method)
            .ShouldNotBeNull()
            .GetCustomAttribute<AuthorizeAttribute>()
            .ShouldNotBeNull()
            .Policy.ShouldBe(permission);
    }

    [Fact]
    public void Creating_A_Follow_Up_Should_Take_The_Source_Stage()
    {
        typeof(CreatePatientReExaminationDto).GetProperty("PatientStageId").ShouldNotBeNull();
    }

    [Fact]
    public void Creating_A_Follow_Up_Should_Take_Only_The_Teeth_Chosen()
    {
        // No "content" of its own: the candidates come off the source stage, and
        // only what the user ticked is sent.
        typeof(CreatePatientReExaminationDto).GetProperty("Teeth").ShouldNotBeNull();
        typeof(CreatePatientReExaminationDto).GetProperty("Content").ShouldBeNull();
    }

    [Fact]
    public void A_Follow_Up_Row_Should_Carry_Its_Own_Code_And_No_Status()
    {
        typeof(PatientReExaminationDto).GetProperty("Code").ShouldNotBeNull();
        typeof(PatientReExaminationDto).GetProperty("Status").ShouldBeNull();
    }
}
