using System;
using System.Collections.Generic;
using BlueDental.Appointments;
using BlueDental.CustomerCare;
using Shouldly;
using Volo.Abp.Application.Dtos;
using Xunit;

namespace BlueDental.PatientManagement;

/// <summary>
/// Cụm 11 mục 9: the walk that masks every <see cref="PatientPhoneAttribute"/>
/// in a response — through paged wrappers, nested lists and the history rows
/// that only sometimes hold a phone — and leaves everything else alone.
/// </summary>
public class PatientPhoneMaskerTests
{
    [Fact]
    public void A_Paged_List_Of_Patients_Has_Patient_And_Guardian_Phones_Masked()
    {
        var page = new PagedResultDto<PatientDto>(1,
        [
            new PatientDto
            {
                PhoneNumber = "0901234567",
                Email = "a@b.vn",
                Guardians = [new PatientGuardianDto { Phone = "0911222333", FullName = "Mẹ" }],
            },
        ]);

        PatientPhoneMasker.Mask(page);

        page.Items[0].PhoneNumber.ShouldBe("090****567");
        page.Items[0].Guardians[0].Phone.ShouldBe("091****333");
        page.Items[0].Email.ShouldBe("a@b.vn");
        page.Items[0].Guardians[0].FullName.ShouldBe("Mẹ");
    }

    [Fact]
    public void Appointment_And_Care_Rows_Are_Masked()
    {
        var appointments = new List<AppointmentDto> { new() { PatientPhone = "0901234567", PatientName = "An" } };
        var care = new ListResultDto<CareRecordDto>([new CareRecordDto { PatientPhone = "0909888777" }]);

        PatientPhoneMasker.Mask(appointments);
        PatientPhoneMasker.Mask(care);

        appointments[0].PatientPhone.ShouldBe("090****567");
        appointments[0].PatientName.ShouldBe("An");
        care.Items[0].PatientPhone.ShouldBe("090****777");
    }

    [Fact]
    public void A_History_Row_Masks_Only_The_Phone_Field()
    {
        var log = new AppointmentChangeLogDto
        {
            Before = new AppointmentSnapshotDto { PatientPhone = "0901234567" },
            Diff =
            [
                new AppointmentFieldChangeDto { Field = "patientPhone", Before = "0901234567", After = "0911222333" },
                new AppointmentFieldChangeDto { Field = "note", Before = "0901234567 gọi lại", After = "x" },
            ],
        };

        PatientPhoneMasker.Mask(log);

        log.Before!.PatientPhone.ShouldBe("090****567");
        log.Diff[0].Before.ShouldBe("090****567");
        log.Diff[0].After.ShouldBe("091****333");
        log.Diff[1].Before.ShouldBe("0901234567 gọi lại");
    }

    [Fact]
    public void Staff_Phones_Are_Not_Patient_Phones()
    {
        var staff = new Staff.StaffDto { PhoneNumber = "0901234567" };

        PatientPhoneMasker.Mask(staff);

        staff.PhoneNumber.ShouldBe("0901234567");
    }

    [Fact]
    public void A_Graph_That_Points_Back_At_Itself_Is_Walked_Once()
    {
        var patient = new PatientDto { PhoneNumber = "0901234567" };
        var list = new List<object> { patient, patient };

        PatientPhoneMasker.Mask(list);

        patient.PhoneNumber.ShouldBe("090****567");
        Should.NotThrow(() => PatientPhoneMasker.Mask(new object[] { list, Guid.NewGuid(), "x" }));
    }
}
