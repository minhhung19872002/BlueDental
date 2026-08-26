using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Appointments;
using BlueDental.Appointments.Values;
using BlueDental.Billing;
using BlueDental.Billing.Values;
using BlueDental.Organizations;
using BlueDental.PatientManagement;
using BlueDental.PatientManagement.Values;
using Microsoft.Extensions.Configuration;
using Volo.Abp.Data;
using Volo.Abp.DependencyInjection;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Guids;
using Volo.Abp.Identity;

namespace BlueDental.Data;

/// <summary>
/// Fills the demo database with a clinic's worth of diary and billing.
///
/// The calendar, the reception board and the billing screen are all read models
/// over the same two tables, and a handful of rows scattered across future years
/// makes every one of them look broken. This lays down a dense, believable four
/// weeks around today: a working diary per dentist, and an invoice behind each
/// visit that actually finished.
///
/// Everything here is synthetic. It runs in Development only, is deterministic
/// (a fixed RNG seed), and is skipped once the window already has appointments,
/// so a re-run does not pile duplicates on top.
/// </summary>
public class BlueDentalDemoSeedContributor(
    IRepository<Appointment, Guid> appointmentRepository,
    IRepository<Invoice, Guid> invoiceRepository,
    IRepository<Patient, Guid> patientRepository,
    IRepository<StaffBranchAssignment, Guid> assignmentRepository,
    IdentityUserManager userManager,
    IdentityRoleManager roleManager,
    IGuidGenerator guidGenerator,
    IConfiguration configuration,
    BlueDentalClinicalDemoSeeder clinicalSeeder,
    BlueDentalOperationsDemoSeeder operationsSeeder,
    BlueDentalReportsDemoSeeder reportsSeeder) : IDataSeedContributor, ITransientDependency
{
    /// <summary>
    /// The calendar picks its columns from whoever holds this role. Without it
    /// every account — the admin included — turns up as a bookable chair.
    /// </summary>
    private const string DentistRole = "dentist";

    /// <summary>
    /// The clinic keeps Vietnam hours whatever the server's clock is set to.
    /// Seeding against the machine's own offset put a UTC container's 08:00
    /// slot at 15:00 in front of the people reading it.
    /// </summary>
    internal static readonly TimeSpan ClinicOffset = TimeSpan.FromHours(7);

    /// <summary>Today as the clinic sees it.</summary>
    internal static DateTime ClinicToday => DateTimeOffset.UtcNow.ToOffset(ClinicOffset).Date;

    /// <summary>Days of diary before and after today.</summary>
    private const int DaysBack = 7;
    private const int DaysForward = 21;

    /// <summary>The clinic opens at 08:00 and the last slot starts at 17:30.</summary>
    private static readonly TimeSpan FirstSlot = new(8, 0, 0);
    private const int SlotMinutes = 30;
    private const int SlotsPerDay = 20;

    /// <summary>Synthetic dentists — invented names, not observed ones.</summary>
    private static readonly (string UserName, string Name)[] Dentists =
    [
        ("bs.anh", "BS. Trần Quốc Anh"),
        ("bs.chi", "BS. Nguyễn Lan Chi"),
        ("bs.duy", "BS. Phạm Khánh Duy"),
        ("bs.ha", "BS. Lê Thu Hà"),
        ("bs.minh", "BS. Vũ Nhật Minh")
    ];

    /// <summary>Extra staff (non-dentist) for a fuller staff list.</summary>
    private static readonly (string UserName, string Name, string Phone, string Address, bool IsDentist, bool IsAssistant, bool IsHygienist)[] ExtraStaff =
    [
        ("lt.huong",   "Nguyễn Thu Hương",    "0901234567", "123 Nguyễn Trãi, Q.1, TP.HCM",        false, false, false),
        ("pt.linh",    "Trần Thùy Linh",      "0912345678", "45 Lê Lợi, Q.3, TP.HCM",              false, true,  false),
        ("ys.trang",   "Phạm Thanh Trang",    "0923456789", "78 Hai Bà Trưng, Q.1, TP.HCM",        false, false, true),
        ("lt.mai",     "Lê Ngọc Mai",         "0934567890", "90 Võ Văn Tần, Q.3, TP.HCM",          false, true,  false),
        ("nv.tuan",    "Hoàng Văn Tuấn",      "0945678901", "12 Điện Biên Phủ, Bình Thạnh",        false, false, false),
        ("pt.nga",     "Vũ Thị Nga",          "0956789012", "56 Cách Mạng Tháng 8, Q.10, TP.HCM",  false, false, true),
        ("ys.hang",    "Đỗ Thị Hằng",         "0967890123", "34 Phan Đăng Lưu, Phú Nhuận",         false, false, true),
        ("nv.duc",     "Bùi Minh Đức",        "0978901234", "67 Nguyễn Huệ, Q.1, TP.HCM",          false, false, false),
        ("lt.thao",    "Ngô Phương Thảo",     "0989012345", "22 Trần Hưng Đạo, Q.5, TP.HCM",       false, true,  false),
        ("bs.long",    "BS. Đinh Thành Long",  "0990123456", "88 Lý Tự Trọng, Q.1, TP.HCM",        true,  false, false),
        ("lt.van",     "Trịnh Thị Vân",       "0911223344", "15 Pasteur, Q.3, TP.HCM",              false, false, false),
        ("pt.son",     "Lý Hoàng Sơn",        "0922334455", "200 Nguyễn Văn Cừ, Q.5, TP.HCM",      false, true,  false),
        ("ys.loan",    "Phan Thị Loan",        "0933445566", "8 Trường Sa, Phú Nhuận",               false, false, true),
        ("nv.hieu",    "Đặng Trung Hiếu",     "0944556677", "101 Lê Văn Sỹ, Q.3, TP.HCM",          false, false, false),
        ("bs.phuong",  "BS. Mai Anh Phương",   "0955667788", "55 Nam Kỳ Khởi Nghĩa, Q.1, TP.HCM",  true,  false, false),
    ];

    private static readonly string[] Complaints =
    [
        "Đau răng hàm dưới",
        "Khám định kỳ 6 tháng",
        "Lấy cao răng",
        "Tư vấn niềng răng",
        "Trám răng sâu",
        "Nhổ răng khôn",
        "Tái khám sau điều trị tủy",
        "Ê buốt khi ăn lạnh",
        "Tư vấn implant",
        "Tẩy trắng răng"
    ];

    private static readonly AppointmentType[] Types =
    [
        AppointmentType.Consultation,
        AppointmentType.Examination,
        AppointmentType.Cleaning,
        AppointmentType.Treatment,
        AppointmentType.FollowUp,
        AppointmentType.Orthodontic
    ];

    private static readonly PaymentMethod[] Methods =
    [
        PaymentMethod.Cash,
        PaymentMethod.BankTransfer,
        PaymentMethod.CreditCard,
        PaymentMethod.MobilePayment
    ];

    private readonly Guid _branchId = BlueDentalDataSeedContributor.DefaultBranchId;

    public async Task SeedAsync(DataSeedContext context)
    {
        var patients = await patientRepository.GetListAsync(p => p.BranchId == _branchId);

        // Development always gets the demo. Anywhere else it fills a clinic that
        // is still empty — a fresh install, which is the only time synthetic
        // records are welcome — and never touches one that has real ones.
        if (!IsDevelopment() && patients.Count > 0)
        {
            return;
        }

        var dentistIds = await EnsureDentistsAsync();
        var staffIds = await EnsureExtraStaffAsync();

        if (patients.Count == 0)
        {
            patients = await SeedPatientsAsync();
        }

        await SeedAppointmentsAsync(patients, dentistIds);
        await SeedInvoicesAsync();

        // The rest of the clinic. Both are idempotent per table, so a re-run
        // fills in whatever an earlier one could not.
        await clinicalSeeder.SeedAsync(patients, dentistIds);
        await operationsSeeder.SeedAsync(patients, dentistIds.Concat(staffIds).ToList());

        // Depth for the Vận hành reports: the same chain, spread over two
        // months so a date filter has something to filter.
        await reportsSeeder.SeedAsync(patients, dentistIds.Concat(staffIds).ToList());
    }

    /// <summary>
    /// A clinic with no patients has nothing to show on any screen. Registers a
    /// roster of synthetic ones — invented names, invented numbers — so the
    /// diary, the billing and the clinical chain all have someone to hang off.
    /// </summary>
    private async Task<List<Patient>> SeedPatientsAsync()
    {
        var random = new Random(20260831);
        var patients = new List<Patient>();

        for (var i = 0; i < DemoPatients.Length; i++)
        {
            var (lastName, firstName, gender) = DemoPatients[i];
            var birthYear = 1965 + random.Next(0, 40);

            patients.Add(Patient.Register(
                guidGenerator.Create(),
                $"BD26{9000 + i:D4}",
                firstName,
                lastName,
                new DateOnly(birthYear, 1 + random.Next(0, 12), 1 + random.Next(0, 27)),
                gender,
                new ContactInfo(
                    $"09{random.Next(10, 99)}{i:D6}",
                    null,
                    $"{10 + i} Nguyễn Huệ, Quận 1, TP.HCM"),
                _branchId));
        }

        await patientRepository.InsertManyAsync(patients, autoSave: true);
        return patients;
    }

    private bool IsDevelopment() =>
        string.Equals(
            configuration["ASPNETCORE_ENVIRONMENT"] ?? Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT"),
            "Development",
            StringComparison.OrdinalIgnoreCase);

    /// <summary>
    /// A calendar with one column is not a calendar. Creates the demo dentists
    /// if they are missing and returns everyone who can be booked.
    /// </summary>
    private async Task<List<Guid>> EnsureDentistsAsync()
    {
        var ids = new List<Guid>();

        if (await roleManager.FindByNameAsync(DentistRole) is null)
        {
            await roleManager.CreateAsync(
                new IdentityRole(guidGenerator.Create(), DentistRole) { IsStatic = false });
        }

        foreach (var (userName, name) in Dentists)
        {
            var user = await userManager.FindByNameAsync(userName);

            if (user is null)
            {
                user = new IdentityUser(
                    guidGenerator.Create(),
                    userName,
                    userName + "@bluedental.local")
                {
                    Name = name
                };

                var created = await userManager.CreateAsync(user, "Dentist@123456");
                if (!created.Succeeded)
                {
                    continue;
                }

                await userManager.AddToRoleAsync(user, "admin");
            }

            if (!await userManager.IsInRoleAsync(user, DentistRole))
            {
                await userManager.AddToRoleAsync(user, DentistRole);
            }

            // Without this property the user has no branch claim and every call
            // they make is refused.
            if (user.GetProperty<System.Guid?>(BlueDentalConsts.UserClinicBranchIdPropertyName) is null)
            {
                user.SetProperty(BlueDentalConsts.UserClinicBranchIdPropertyName, _branchId);
                await userManager.UpdateAsync(user);
            }

            var assigned = await assignmentRepository.AnyAsync(
                a => a.StaffId == user.Id && a.ClinicBranchId == _branchId);

            if (!assigned)
            {
                await assignmentRepository.InsertAsync(
                    StaffBranchAssignment.Assign(guidGenerator.Create(), user.Id, _branchId, isPrimary: true),
                    autoSave: true);
            }

            ids.Add(user.Id);
        }

        return ids;
    }

    private static readonly string[] DentistAddresses =
    [
        "10 Nguyễn Du, Q.1, TP.HCM",
        "25 Lý Thường Kiệt, Q.10, TP.HCM",
        "42 Trần Phú, Q.5, TP.HCM",
        "7 Phạm Ngọc Thạch, Q.3, TP.HCM",
        "99 Hoàng Văn Thụ, Tân Bình"
    ];

    private static readonly string[] DentistPhones =
    [
        "0911111111", "0922222222", "0933333333", "0944444444", "0955555555"
    ];

    /// <summary>
    /// Synthetic patients — invented names, invented numbers, no resemblance to
    /// anyone in the reference system.
    /// </summary>
    private static readonly (string LastName, string FirstName, Gender Gender)[] DemoPatients =
    [
        ("Nguyễn Văn", "An", Gender.Male),
        ("Trần Thị", "Bích", Gender.Female),
        ("Lê Hoàng", "Cường", Gender.Male),
        ("Phạm Thị", "Dung", Gender.Female),
        ("Hoàng Minh", "Đức", Gender.Male),
        ("Vũ Thị", "Giang", Gender.Female),
        ("Đặng Quốc", "Hùng", Gender.Male),
        ("Bùi Thị", "Hương", Gender.Female),
        ("Đỗ Trung", "Kiên", Gender.Male),
        ("Ngô Thị", "Lan", Gender.Female),
        ("Dương Văn", "Long", Gender.Male),
        ("Lý Thị", "Mai", Gender.Female),
        ("Phan Thanh", "Nam", Gender.Male),
        ("Trịnh Thị", "Ngọc", Gender.Female),
        ("Cao Hữu", "Phúc", Gender.Male),
        ("Mai Thị", "Quyên", Gender.Female),
        ("Tạ Văn", "Sơn", Gender.Male),
        ("Chu Thị", "Thảo", Gender.Female),
        ("Hồ Anh", "Tuấn", Gender.Male),
        ("Đinh Thị", "Vân", Gender.Female),
        ("Lương Bảo", "Việt", Gender.Male),
        ("Tô Thị", "Xuân", Gender.Female),
        ("Nguyễn Hải", "Yến", Gender.Female),
        ("Trương Công", "Định", Gender.Male)
    ];

    /// <summary>Creates the non-dentist staff and returns everyone it touched.</summary>
    private async Task<List<Guid>> EnsureExtraStaffAsync()
    {
        var staffIds = new List<Guid>();

        // Set ExtraProperties on existing dentists
        for (var i = 0; i < Dentists.Length; i++)
        {
            var user = await userManager.FindByNameAsync(Dentists[i].UserName);
            if (user is null) continue;

            if (user.ExtraProperties.GetOrDefault("IsDentist") is not true)
            {
                user.ExtraProperties["IsDentist"] = true;
                user.ExtraProperties["IsAssistant"] = false;
                user.ExtraProperties["IsHygienist"] = false;
                user.ExtraProperties["Address"] = DentistAddresses[i];
                user.ExtraProperties["MorningStartTime"] = "08:00";
                user.ExtraProperties["MorningEndTime"] = "12:00";
                user.ExtraProperties["AfternoonStartTime"] = "13:00";
                user.ExtraProperties["AfternoonEndTime"] = "17:00";
                user.SetPhoneNumber(DentistPhones[i], confirmed: false);
                await userManager.UpdateAsync(user);
            }
        }

        // Create extra staff
        foreach (var (userName, name, phone, address, isDentist, isAssistant, isHygienist) in ExtraStaff)
        {
            var user = await userManager.FindByNameAsync(userName);
            if (user is not null)
            {
                staffIds.Add(user.Id);
                continue;
            }

            user = new IdentityUser(
                guidGenerator.Create(),
                userName,
                userName + "@bluedental.local")
            {
                Name = name
            };

            user.SetPhoneNumber(phone, confirmed: false);
            user.ExtraProperties["Address"] = address;
            user.ExtraProperties["IsDentist"] = isDentist;
            user.ExtraProperties["IsAssistant"] = isAssistant;
            user.ExtraProperties["IsHygienist"] = isHygienist;
            user.ExtraProperties["MorningStartTime"] = "08:00";
            user.ExtraProperties["MorningEndTime"] = "12:00";
            user.ExtraProperties["AfternoonStartTime"] = "13:30";
            user.ExtraProperties["AfternoonEndTime"] = "17:30";

            var created = await userManager.CreateAsync(user, "Staff@123456");
            if (!created.Succeeded) continue;

            await userManager.AddToRoleAsync(user, "admin");

            if (isDentist)
            {
                if (await roleManager.FindByNameAsync(DentistRole) is not null)
                {
                    await userManager.AddToRoleAsync(user, DentistRole);
                }
            }

            var assigned = await assignmentRepository.AnyAsync(
                a => a.StaffId == user.Id && a.ClinicBranchId == _branchId);

            if (!assigned)
            {
                await assignmentRepository.InsertAsync(
                    StaffBranchAssignment.Assign(guidGenerator.Create(), user.Id, _branchId, isPrimary: true),
                    autoSave: true);
            }

            staffIds.Add(user.Id);
        }

        return staffIds;
    }

    private async Task<List<Appointment>> SeedAppointmentsAsync(
        List<Patient> patients,
        List<Guid> dentistIds)
    {
        if (dentistIds.Count == 0)
        {
            return [];
        }

        // The clinic thinks in local opening hours; Npgsql stores timestamptz and
        // only accepts UTC, so every instant is built locally and then converted.
        var today = ClinicToday;
        var offsetSpan = ClinicOffset;
        var windowStart = new DateTimeOffset(today.AddDays(-DaysBack), offsetSpan).ToUniversalTime();
        var windowEnd = new DateTimeOffset(today.AddDays(DaysForward + 1), offsetSpan).ToUniversalTime();

        // Which days already have a diary. Deciding per day rather than for the
        // whole window means a re-run tops up the days that are still empty
        // instead of either duplicating everything or refusing to do anything.
        var existing = await appointmentRepository.GetListAsync(
            a => a.BranchId == _branchId && a.Slot.Start >= windowStart && a.Slot.Start < windowEnd);

        var bookedPerDay = existing
            .GroupBy(a => a.Slot.Start.ToOffset(offsetSpan).Date)
            .ToDictionary(g => g.Key, g => g.Count());

        var random = new Random(20260823);
        var created = new List<Appointment>();

        for (var offset = -DaysBack; offset <= DaysForward; offset++)
        {
            var day = today.AddDays(offset);

            // How busy a day is must be a function of the day itself, not of the
            // RNG's position: a top-up run skips days, which shifts the sequence
            // and would keep raising the target — so every re-run would add more.
            var bookings = TargetBookings(day);

            if (bookedPerDay.GetValueOrDefault(day) >= bookings)
            {
                continue;
            }

            // One dentist cannot be in two chairs at once, so slots are handed
            // out per dentist rather than drawn at random.
            var takenSlots = new HashSet<(Guid Dentist, int Slot)>();

            for (var i = 0; i < bookings; i++)
            {
                var dentistId = dentistIds[random.Next(dentistIds.Count)];
                var slotIndex = random.Next(SlotsPerDay);

                if (!takenSlots.Add((dentistId, slotIndex)))
                {
                    continue;
                }

                var start = new DateTimeOffset(day, offsetSpan)
                    .Add(FirstSlot)
                    .AddMinutes(slotIndex * SlotMinutes)
                    .ToUniversalTime();

                // Longer work takes two slots.
                var length = random.Next(10) < 3 ? SlotMinutes * 2 : SlotMinutes;

                var appointment = new Appointment(
                    guidGenerator.Create(),
                    patients[random.Next(patients.Count)].Id,
                    dentistId,
                    _branchId,
                    new AppointmentSlot(start, start.AddMinutes(length)),
                    Types[random.Next(Types.Length)],
                    chiefComplaint: Complaints[random.Next(Complaints.Length)]);

                ApplyLifecycle(appointment, offset, random);
                created.Add(appointment);
            }
        }

        await appointmentRepository.InsertManyAsync(created, autoSave: true);
        return created;
    }

    /// <summary>
    /// The day's booking count. Weekdays are busy, Saturday runs a half list and
    /// Sunday a short one — the clinic does open, just with a skeleton rota.
    /// Derived from the date so the number is the same on every run.
    /// </summary>
    private static int TargetBookings(DateTime day)
    {
        var spread = Math.Abs(day.DayOfYear * 31 + day.Year) % 6;

        return day.DayOfWeek switch
        {
            DayOfWeek.Sunday => 3 + (spread % 3),
            DayOfWeek.Saturday => 4 + (spread % 4),
            _ => 9 + spread
        };
    }

    /// <summary>
    /// Walks an appointment to a status that fits where it sits relative to
    /// today, through the aggregate's own transitions rather than by assignment.
    /// </summary>
    private static void ApplyLifecycle(Appointment appointment, int dayOffset, Random random)
    {
        var roll = random.Next(100);

        if (dayOffset < 0)
        {
            // Past: mostly seen, a few no-shows and cancellations.
            if (roll < 8)
            {
                appointment.Cancel(CancellationReason.PatientRequest, "Khách bận đột xuất");
                return;
            }

            appointment.Confirm();

            if (roll < 14)
            {
                appointment.MarkNoShow();
                return;
            }

            appointment.CheckIn();
            appointment.Start();
            appointment.Complete("Hoàn tất theo kế hoạch điều trị");
            return;
        }

        if (dayOffset == 0)
        {
            // Today: the reception board wants every column populated.
            if (roll < 20) return;                          // Đã hẹn

            appointment.Confirm();
            if (roll < 45) return;                          // Đã xác nhận

            appointment.CheckIn();
            if (roll < 70) return;                          // Đã đến

            appointment.Start();
            if (roll < 88) return;                          // Đang khám

            appointment.Complete("Hoàn tất trong ngày");
            return;
        }

        // Future: requested, or already confirmed by the CSKH team.
        if (roll >= 35)
        {
            appointment.Confirm();
        }
    }

    /// <summary>
    /// Every finished visit leaves a bill. Some are settled, some part-paid and
    /// some still open, so the billing screen has all three states to show.
    ///
    /// It bills every completed visit that has none yet — not only the ones this
    /// run created — so a top-up run leaves no finished visit unbilled.
    /// </summary>
    private async Task SeedInvoicesAsync()
    {
        var completed = await appointmentRepository.GetListAsync(
            a => a.BranchId == _branchId && a.Status == AppointmentStatus.Completed);

        if (completed.Count == 0)
        {
            return;
        }

        var alreadyBilled = (await invoiceRepository.GetListAsync(i => i.BranchId == _branchId))
            .Where(i => i.AppointmentId.HasValue)
            .Select(i => i.AppointmentId!.Value)
            .ToHashSet();

        var billable = completed
            .Where(a => !alreadyBilled.Contains(a.Id))
            .OrderBy(a => a.Slot.Start)
            .ToList();

        if (billable.Count == 0)
        {
            return;
        }

        var random = new Random(20260824);
        var invoices = new List<Invoice>();
        var sequence = alreadyBilled.Count + 1;

        foreach (var appointment in billable)
        {
            // 500k – 12m VND, rounded to the nearest 50k like a real price list.
            var subTotal = random.Next(10, 240) * 50_000m;
            var discount = random.Next(4) == 0 ? Math.Round(subTotal * 0.1m, 0) : 0m;

            var issuedOn = appointment.Slot.Start;

            var invoice = new Invoice(
                guidGenerator.Create(),
                "HD-" + issuedOn.ToString("yyyyMM") + "-" + sequence++.ToString("D4"),
                appointment.PatientId,
                _branchId,
                new Money(subTotal, "VND"),
                new Money(0m, "VND"),
                new Money(discount, "VND"),
                issuedOn.AddDays(30),
                appointment.Id,
                issuedOn);

            invoice.Issue();

            var roll = random.Next(100);
            var method = Methods[random.Next(Methods.Length)];

            if (roll < 55)
            {
                invoice.RecordPayment(new Money(subTotal - discount, "VND"), method);
            }
            else if (roll < 80)
            {
                // A deposit against the treatment, in round hundreds of thousands.
                var deposit = Math.Floor((subTotal - discount) * 0.4m / 100_000m) * 100_000m;
                if (deposit > 0)
                {
                    invoice.RecordPayment(new Money(deposit, "VND"), method);
                }
            }

            invoices.Add(invoice);
        }

        await invoiceRepository.InsertManyAsync(invoices, autoSave: true);
    }
}
