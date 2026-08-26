using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using System.Threading.Tasks;
using BlueDental.Catalogs;
using BlueDental.PatientManagement;
using BlueDental.TreatmentManagement;
using BlueDental.TreatmentManagement.Values;
using Volo.Abp.Data;
using Volo.Abp.DependencyInjection;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Guids;
using Volo.Abp.Auditing;

namespace BlueDental.Data;

/// <summary>
/// Depth for the Vận hành report tabs.
///
/// The clinical seeder lays down one case per patient, all stamped the moment
/// it ran. That is enough for the screens that show a patient's own record and
/// useless for a report: every row lands in the same day, so Ngày, Tuần and
/// Tháng all show the same list and "so với kỳ trước" has nothing to compare
/// against.
///
/// This spreads a fuller set of cases across the current month and the one
/// before it, and deliberately leaves some diagnoses untreated so that
/// "Chẩn đoán chưa điều trị" has rows of its own.
///
/// <para>
/// Backdating needs a word. ABP stamps <c>CreationTime</c> on insert, but only
/// where it is still <c>default</c> — so setting it first is enough, and the row
/// goes in once. Writing it afterwards instead does not work: these entities own
/// their teeth as a JSON collection, and updating one makes EF complain that an
/// identifying foreign key is being modified.
/// </para>
///
/// Development only, and every name, tooth and price here is invented.
/// </summary>
public class BlueDentalReportsDemoSeeder(
    IRepository<Patient, Guid> patientRepository,
    IRepository<PatientDiagnosis, Guid> diagnosisRepository,
    IRepository<PatientAdvise, Guid> adviseRepository,
    IRepository<TreatmentPlan, Guid> planRepository,
    IRepository<TreatmentStage, Guid> stageRepository,
    IRepository<CatalogEntry, Guid> catalogRepository,
    IGuidGenerator guidGenerator) : ITransientDependency
{
    private readonly Guid _branchId = BlueDentalDataSeedContributor.DefaultBranchId;

    /// <summary>Enough cases that a day, a week and a month each look different.</summary>
    private const int Cases = 120;

    /// <summary>How far back cases are spread — two months, so a comparison has a baseline.</summary>
    private const int DaysBack = 75;

    /// <summary>Below this the report tabs look broken, so the seeder tops them up.</summary>
    private const int EnoughPlans = 60;

    private static readonly string[] StageNames =
    [
        "Lấy dấu", "Gắn thử", "Gắn cố định", "Tái khám", "Vệ sinh", "Chụp phim"
    ];

    public async Task SeedAsync(List<Patient> patients, List<Guid> staffIds)
    {
        if (patients.Count == 0 || staffIds.Count == 0)
        {
            return;
        }

        if (await planRepository.CountAsync(p => p.BranchId == _branchId) >= EnoughPlans)
        {
            return;
        }

        var services = await CatalogAsync(TaxonomyGroups.CareService);
        var diagnoses = await CatalogAsync(TaxonomyGroups.Diagnosis);

        if (services.Count == 0 || diagnoses.Count == 0)
        {
            return;
        }

        // Fixed seed: the same demo clinic every time it is rebuilt.
        var random = new Random(20260826);
        var today = BlueDentalDemoSeedContributor.ClinicToday;

        for (var i = 0; i < Cases; i++)
        {
            var when = today.AddDays(-random.Next(0, DaysBack))
                .AddHours(8 + random.Next(0, 10))
                .AddMinutes(random.Next(0, 60));

            var patient = patients[random.Next(patients.Count)];
            var diagnosisEntry = diagnoses[random.Next(diagnoses.Count)];
            var serviceEntry = services[random.Next(services.Count)];
            var consultant = staffIds[random.Next(staffIds.Count)];
            var dentist = staffIds[random.Next(staffIds.Count)];
            var toothCode = 11 + random.Next(0, 8);
            // A fresh instance per owner: EF owns these by reference, so one
            // object handed to four parents is tracked as four conflicting rows.
            ToothSelection Tooth() => new(toothCode, selected: true);

            // One case in three is left at the diagnosis, which is what
            // "Chẩn đoán chưa điều trị" reports on.
            var treated = random.Next(0, 3) != 0;

            var diagnosis = PatientDiagnosis.Record(
                guidGenerator.Create(),
                patient.Id,
                _branchId,
                diagnosisEntry.Id,
                consultant,
                $"CD{i + 1:D4}",
                [Tooth()],
                note: treated ? null : "Khách hẹn quay lại cân nhắc");

            // Marked before the insert so the row lands in its final state, and
            // "Chẩn đoán chưa điều trị" only keeps the ones that stopped here.
            if (treated)
            {
                diagnosis.MarkTreatmentServiceCreated();
            }

            await InsertBackdatedAsync(diagnosisRepository, diagnosis, when);

            if (!treated)
            {
                continue;
            }

            var price = serviceEntry.Price ?? 500_000m;
            var quantity = 1 + random.Next(0, 2);

            var advise = PatientAdvise.Offer(
                guidGenerator.Create(),
                patient.Id,
                _branchId,
                diagnosis.Id,
                diagnosisEntry.Id,
                serviceEntry.Id,
                consultant,
                $"TV{i + 1:D4}",
                originalPrice: price,
                price: price,
                quantity: quantity,
                teeth: [Tooth()],
                note: "Khách đồng ý phương án điều trị");

            await InsertBackdatedAsync(adviseRepository, advise, when.AddMinutes(20));

            var plan = TreatmentPlan.Open(
                guidGenerator.Create(),
                patient.Id,
                dentist,
                _branchId,
                $"KH{i + 1:D4}",
                $"Kế hoạch {serviceEntry.Name}",
                consultantStaffId: consultant);

            var service = plan.AddService(
                guidGenerator.Create(),
                serviceEntry.Id,
                advise.Id,
                price,
                quantity,
                DiscountType.None,
                0m,
                [Tooth()]);

            // Most lines are finished; the rest are still being worked, which is
            // what separates "đã hoàn thành" from "tính doanh số riêng".
            var roll = random.Next(0, 100);
            if (roll < 60)
            {
                service.Complete();
            }
            else if (roll < 85)
            {
                service.Start();
            }

            // The line has no table of its own to be inserted into: it travels
            // with the plan, and needs the same backdated stamp.
            SetCreationTime(service, when.AddMinutes(40));
            await InsertBackdatedAsync(planRepository, plan, when.AddMinutes(30));

            var stageCount = 1 + random.Next(0, 2);
            for (var s = 0; s < stageCount; s++)
            {
                var stage = TreatmentStage.Add(
                    guidGenerator.Create(),
                    patient.Id,
                    _branchId,
                    null,
                    service.Id,
                    serviceEntry.Id,
                    s + 1,
                    StageNames[random.Next(StageNames.Length)],
                    dentist,
                    teeth: [Tooth()]);

                await InsertBackdatedAsync(stageRepository, stage, when.AddMinutes(50 + (s * 10)));
            }
        }
    }

    private sealed record CatalogRef(Guid Id, string Name, decimal? Price);

    private async Task<List<CatalogRef>> CatalogAsync(string group)
    {
        var entries = await catalogRepository.GetListAsync(
            e => e.ClinicBranchId == _branchId && e.Group == group);

        return entries.Select(e => new CatalogRef(e.Id, e.Name, e.Price)).ToList();
    }

    /// <summary>
    /// Stamps a row with when it is meant to have happened, then inserts it.
    /// Order matters — see the note on the class.
    /// </summary>
    private static async Task InsertBackdatedAsync<TEntity>(
        IRepository<TEntity, Guid> repository,
        TEntity entity,
        DateTime occurredAt)
        where TEntity : class, Volo.Abp.Domain.Entities.IEntity<Guid>
    {
        SetCreationTime(entity, occurredAt);
        await repository.InsertAsync(entity, autoSave: true);
    }

    /// <summary>
    /// CreationTime is public to read and private to write, so the setter has to
    /// be reached directly.
    /// </summary>
    private static void SetCreationTime(object entity, DateTime occurredAt)
        => entity.GetType()
            .GetProperty(nameof(IHasCreationTime.CreationTime))
            ?.GetSetMethod(nonPublic: true)
            ?.Invoke(entity, [occurredAt]);
}
