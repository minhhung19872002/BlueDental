using System;
using System.Collections.Generic;
using System.Linq;
using BlueDental.PatientManagement;
using BlueDental.PatientManagement.Values;
using Shouldly;
using Volo.Abp;
using Xunit;

namespace BlueDental.Domain.Tests.PatientManagement;

/// <summary>Người giám hộ — BA spec 2026-10-07.</summary>
public class PatientGuardianTests
{
    private static readonly DateOnly Today = new(2026, 10, 7);
    private static readonly DateTimeOffset Now = new(2026, 10, 7, 3, 0, 0, TimeSpan.Zero);

    private static Patient Child(DateOnly? dateOfBirth) => Patient.Register(
        Guid.NewGuid(), "DH260001", "Bé", "Nguyễn Văn",
        dateOfBirth, Gender.Male,
        new ContactInfo("0901234567", null, null), Guid.NewGuid());

    private static PatientGuardianData Guardian(
        bool primary = true,
        GuardianRelation relation = GuardianRelation.Mother,
        Guid? id = null,
        string fullName = "Trần Thị B",
        string? relationNote = null,
        GuardianProofType? proofType = null,
        string? proofBlobName = null) => new(
        id, null, relation, relationNote, proofType, proofBlobName, "giay.pdf",
        fullName, "0912345678", "079186000001",
        null, null, null, Gender.Female, null, null,
        SameAddressAsPatient: true, Address: "ignored", IsPrimaryContact: primary);

    private static void Set(Patient patient, params PatientGuardianData[] guardians) =>
        patient.SetGuardians(guardians, consented: true, Guid.NewGuid, Now);

    private static void ShouldFailWith(Action action, string code) =>
        Should.Throw<BusinessException>(action).Code.ShouldBe(code);

    [Theory]
    [InlineData(2017)] // 9 tuổi, the BA's example
    [InlineData(2011)] // 15 tuổi: still under 16 by year difference
    public void Under_16_without_a_guardian_is_refused(int birthYear)
    {
        var patient = Child(new DateOnly(birthYear, 12, 31));

        ShouldFailWith(() => patient.EnsureGuardianRequirement(Today),
            BlueDentalDomainErrorCodes.PatientManagement.GuardianRequired);
    }

    [Fact]
    public void Age_is_the_year_difference_so_16_this_year_needs_none_even_before_the_birthday()
    {
        var patient = Child(new DateOnly(2010, 12, 31));

        patient.RequiresGuardian(Today).ShouldBeFalse();
        patient.EnsureGuardianRequirement(Today);
    }

    [Fact]
    public void No_birth_date_needs_no_guardian()
    {
        Child(null).EnsureGuardianRequirement(Today);
    }

    [Fact]
    public void Under_16_with_a_guardian_passes()
    {
        var patient = Child(new DateOnly(2017, 3, 12));
        Set(patient, Guardian());

        patient.EnsureGuardianRequirement(Today);
        patient.Guardians.Single().ConsentedAt.ShouldBe(Now);
    }

    [Fact]
    public void At_most_three_guardians()
    {
        var patient = Child(new DateOnly(2017, 3, 12));

        ShouldFailWith(
            () => Set(patient, Guardian(), Guardian(false), Guardian(false), Guardian(false)),
            BlueDentalDomainErrorCodes.PatientManagement.TooManyGuardians);
    }

    [Theory]
    [InlineData(false, false)]
    [InlineData(true, true)]
    public void Exactly_one_primary_contact(bool first, bool second)
    {
        var patient = Child(new DateOnly(2017, 3, 12));

        ShouldFailWith(
            () => Set(patient, Guardian(first), Guardian(second)),
            BlueDentalDomainErrorCodes.PatientManagement.GuardianPrimaryContactRequired);
    }

    [Fact]
    public void The_group_must_consent()
    {
        var patient = Child(new DateOnly(2017, 3, 12));

        ShouldFailWith(
            () => patient.SetGuardians([Guardian()], consented: false, Guid.NewGuid, Now),
            BlueDentalDomainErrorCodes.PatientManagement.GuardianConsentRequired);
    }

    [Fact]
    public void Clearing_the_group_needs_no_consent()
    {
        var patient = Child(new DateOnly(1990, 1, 1));
        Set(patient, Guardian());

        patient.SetGuardians([], consented: false, Guid.NewGuid, Now);

        patient.Guardians.ShouldBeEmpty();
    }

    [Theory]
    [InlineData(null, GuardianProofType.PowerOfAttorney)]
    [InlineData("Bố dượng", null)]
    public void Other_relation_needs_the_relation_spelled_out_and_a_paper_type(string? note, GuardianProofType? proofType)
    {
        var patient = Child(new DateOnly(2017, 3, 12));

        ShouldFailWith(
            () => Set(patient, Guardian(relation: GuardianRelation.Other, relationNote: note, proofType: proofType)),
            BlueDentalDomainErrorCodes.PatientManagement.GuardianOtherRelationIncomplete);
    }

    [Fact]
    public void Other_relation_does_not_need_the_scan_yet()
    {
        var patient = Child(new DateOnly(2017, 3, 12));

        Set(patient, Guardian(
            relation: GuardianRelation.Other,
            relationNote: "Bố dượng",
            proofType: GuardianProofType.PowerOfAttorney));

        var guardian = patient.Guardians.Single();
        guardian.RelationNote.ShouldBe("Bố dượng");
        guardian.ProofBlobName.ShouldBeNull();
        guardian.ProofFileName.ShouldBeNull();
    }

    [Fact]
    public void A_fixed_relation_drops_the_other_only_fields()
    {
        var patient = Child(new DateOnly(2017, 3, 12));

        Set(patient, Guardian(
            relation: GuardianRelation.Father,
            relationNote: "x",
            proofType: GuardianProofType.Other,
            proofBlobName: "patient-guardians/b/f.pdf"));

        var guardian = patient.Guardians.Single();
        guardian.RelationNote.ShouldBeNull();
        guardian.ProofType.ShouldBeNull();
        guardian.ProofBlobName.ShouldBeNull();
        guardian.Address.ShouldBeNull(); // same address as the patient
    }

    [Theory]
    [InlineData("", "0912345678", "079186000001")]
    [InlineData("Trần Thị B", " ", "079186000001")]
    [InlineData("Trần Thị B", "0912345678", "")]
    public void Name_phone_and_id_are_required(string fullName, string phone, string nationalId)
    {
        var patient = Child(new DateOnly(2017, 3, 12));
        var data = Guardian() with { FullName = fullName, Phone = phone, NationalId = nationalId };

        ShouldFailWith(() => Set(patient, data),
            BlueDentalDomainErrorCodes.PatientManagement.GuardianIncomplete);
    }

    [Fact]
    public void Saving_again_rewrites_known_guardians_in_place_and_drops_the_rest()
    {
        var patient = Child(new DateOnly(2017, 3, 12));
        Set(patient, Guardian(fullName: "Mẹ"), Guardian(false, GuardianRelation.Father, fullName: "Bố"));
        var mother = patient.Guardians.First();
        var consentedAt = mother.ConsentedAt;

        patient.SetGuardians(
            [
                Guardian(false, GuardianRelation.Grandmother, fullName: "Bà"),
                Guardian(true, id: mother.Id, fullName: "Mẹ (sửa)")
            ],
            consented: true, Guid.NewGuid, Now.AddDays(1));

        var names = patient.Guardians.Select(g => g.FullName).ToList();
        names.ShouldBe(new List<string> { "Bà", "Mẹ (sửa)" });

        var kept = patient.Guardians.Single(g => g.Id == mother.Id);
        kept.ConsentedAt.ShouldBe(consentedAt);
        patient.Guardians.Single(g => g.FullName == "Bà").ConsentedAt.ShouldBe(Now.AddDays(1));
    }
}
