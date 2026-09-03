using System;
using System.Globalization;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Billing;
using BlueDental.Catalogs;
using BlueDental.PatientManagement;
using BlueDental.TreatmentManagement;
using BlueDental.TreatmentManagement.Values;

using Volo.Abp.DependencyInjection;
using Volo.Abp;
using Volo.Abp.Data;
using Volo.Abp.Domain.Entities;
using Volo.Abp.Domain.Repositories;

namespace BlueDental.Data;

/// <summary>
/// The clinical half of the demo clinic: the catalogs every clinical screen
/// reads from, a reception board for today, and the chain a patient walks
/// through — chẩn đoán → tư vấn → kế hoạch điều trị → công đoạn → đơn thuốc →
/// thu tiền.
///
/// Everything is synthetic and deterministic. Each step is skipped once its own
/// table holds rows for the branch, so a re-run adds nothing twice.
/// </summary>
public class BlueDentalClinicalDemoSeeder(
    IRepository<Taxonomy, Guid> taxonomyRepository,
    IRepository<CatalogEntry, Guid> catalogRepository,

    IRepository<PatientDiagnosis, Guid> diagnosisRepository,
    IRepository<PatientAdvise, Guid> adviseRepository,
    IRepository<TreatmentPlan, Guid> planRepository,
    IRepository<TreatmentStage, Guid> stageRepository,
    IRepository<Prescription, Guid> prescriptionRepository,
    IRepository<PatientPayment, Guid> paymentRepository,
    IRepository<ConsultationRecord, Guid> consultationRepository,
    IRepository<DiagnosticRecord, Guid> diagnosticRepository,
    IDataFilter<ISoftDelete> softDeleteFilter) : ITransientDependency
{
    private readonly Guid _branchId = BlueDentalDataSeedContributor.DefaultBranchId;

    /// <summary>Services the clinic sells, with a believable price list.</summary>
    private static readonly (string Name, decimal Price)[] Services =
    [
        ("Trám răng thẩm mỹ", 500_000m),
        ("Lấy cao răng", 300_000m),
        ("Nhổ răng khôn", 2_500_000m),
        ("Điều trị tủy", 1_800_000m),
        ("Bọc răng sứ Zirconia", 4_500_000m),
        ("Cấy ghép Implant", 18_000_000m),
        ("Niềng răng mắc cài", 35_000_000m),
        ("Tẩy trắng răng", 1_200_000m)
    ];

    private static readonly string[] Diagnoses =
    [
        "Sâu ngà",
        "Viêm tủy không hồi phục",
        "Viêm quanh răng",
        "Răng khôn mọc lệch",
        "Mất răng đơn lẻ",
        "Răng nhiễm màu"
    ];

    private static readonly (string Name, string Dosage, string Frequency)[] Medications =
    [
        ("Amoxicillin 500mg", "1 viên", "3 lần/ngày"),
        ("Paracetamol 500mg", "1 viên", "2 lần/ngày"),
        ("Alphachymotrypsin", "2 viên", "2 lần/ngày"),
        ("Metronidazole 250mg", "1 viên", "3 lần/ngày"),
        ("Chlorhexidine 0.12%", "15ml", "2 lần/ngày")
    ];

    private static readonly string[] Sources = ["Facebook", "Giới thiệu", "Vãng lai", "Website"];

    private static readonly string[] Occupations =
        ["Nhân viên văn phòng", "Giáo viên", "Kinh doanh", "Học sinh - sinh viên"];

    /// <summary>Teeth the demo works on, in FDI numbering.</summary>
    private static readonly int[] Teeth = [11, 16, 21, 26, 36, 37, 46, 47];

    public async Task SeedAsync(List<Patient> patients, List<Guid> dentistIds)
    {
        if (patients.Count == 0 || dentistIds.Count == 0)
        {
            return;
        }

        var catalog = await EnsureCatalogAsync();

        // Ordered so a run is repeatable, and every patient is covered rather
        // than an arbitrary prefix: whichever record is opened has a history.
        patients = patients.OrderBy(p => p.PatientCode).ToList();

        await SeedTreatmentChainAsync(patients, dentistIds, catalog);
        await SeedConsultingRecordsAsync(patients, dentistIds, catalog);
        await SeedPaymentsAsync(patients, dentistIds);
    }

    /// <summary>The catalog rows the clinical chain points at.</summary>
    private sealed record DemoCatalog(
        List<(Guid Id, string Name, decimal Price)> Services,
        List<(Guid Id, string Name)> Diagnoses,
        List<(Guid Id, string Name, string Dosage, string Frequency)> Medications);

    /// <summary>
    /// Deterministic ids, so a second run recognises what the first one wrote
    /// without having to match on names.
    /// </summary>
    internal static Guid DemoId(string kind, int index) =>
        new($"5eed{kind}-0000-4000-8000-{index:D12}");

    /// <summary>
    /// A stable id for a demo row belonging to one patient.
    ///
    /// Derived from the patient's own id rather than a position in a list: the
    /// roster grows as the app is used, and an index-based id would hand an
    /// existing row's id to a different patient the moment the order shifted.
    /// The leading bytes carry the kind, so two kinds never collide.
    /// </summary>
    private static Guid DemoIdFor(string kind, Guid patientId, int sub = 0)
    {
        var bytes = patientId.ToByteArray();
        var value = int.Parse(kind, NumberStyles.HexNumber, CultureInfo.InvariantCulture);

        bytes[0] = (byte)(value >> 8);
        bytes[1] = (byte)value;
        bytes[2] = (byte)sub;

        return new Guid(bytes);
    }

    private async Task<DemoCatalog> EnsureCatalogAsync()
    {
        var services = await EnsureGroupAsync(
            "0001",
            TaxonomyGroups.CareService,
            "Nhóm dịch vụ chung",
            Services.Select(s => (s.Name, (decimal?)s.Price)).ToList());

        var diagnoses = await EnsureGroupAsync(
            "0002",
            TaxonomyGroups.Diagnosis,
            "Nhóm chẩn đoán chung",
            Diagnoses.Select(d => (d, (decimal?)null)).ToList());

        var medications = await EnsureGroupAsync(
            "0003",
            TaxonomyGroups.MedicationType,
            "Nhóm thuốc chung",
            Medications.Select(m => (m.Name, (decimal?)15_000m)).ToList());

        await EnsureGroupAsync(
            "0004",
            TaxonomyGroups.Source,
            "Nguồn khách đến",
            Sources.Select(s => (s, (decimal?)null)).ToList());

        await EnsureGroupAsync(
            "0005",
            TaxonomyGroups.Occupation,
            "Nghề nghiệp",
            Occupations.Select(o => (o, (decimal?)null)).ToList());

        return new DemoCatalog(
            services.Select((id, i) => (id, Services[i].Name, Services[i].Price)).ToList(),
            diagnoses.Select((id, i) => (id, Diagnoses[i])).ToList(),
            medications
                .Select((id, i) => (id, Medications[i].Name, Medications[i].Dosage, Medications[i].Frequency))
                .ToList());
    }

    /// <summary>
    /// Does a row with this id exist — deleted ones included? A soft-deleted row
    /// keeps its primary key but is invisible to an ordinary query, so asking
    /// the ordinary way sends the seeder into a duplicate-key crash.
    /// </summary>
    private async Task<bool> ExistsAsync<TEntity>(IRepository<TEntity, Guid> repository, Guid id)
        where TEntity : class, IEntity<Guid>
    {
        using (softDeleteFilter.Disable())
        {
            return await repository.AnyAsync(x => x.Id == id);
        }
    }

    /// <summary>Creates one taxonomy group and its entries, skipping what exists.</summary>
    private async Task<List<Guid>> EnsureGroupAsync(
        string kind,
        string group,
        string groupName,
        List<(string Name, decimal? Price)> entries)
    {
        var taxonomyId = DemoId(kind, 0);

        if (!await ExistsAsync(taxonomyRepository, taxonomyId))
        {
            await taxonomyRepository.InsertAsync(
                Taxonomy.Create(taxonomyId, _branchId, group, groupName),
                autoSave: true);
        }

        var ids = new List<Guid>();
        var missing = new List<CatalogEntry>();

        for (var i = 0; i < entries.Count; i++)
        {
            var id = DemoId(kind, i + 1);
            ids.Add(id);

            if (!await ExistsAsync(catalogRepository, id))
            {
                missing.Add(CatalogEntry.Create(
                    id,
                    _branchId,
                    taxonomyId,
                    group,
                    entries[i].Name,
                    price: entries[i].Price));
            }
        }

        if (missing.Count > 0)
        {
            await catalogRepository.InsertManyAsync(missing, autoSave: true);
        }

        return ids;
    }

    /// <summary>
    /// The clinical chain for the first eight patients: a diagnosis on a tooth,
    /// a consulting line accepted off it, the plan that line converts into, the
    /// stages the plan is worked through, and the prescription behind it.
    /// </summary>
    private async Task SeedTreatmentChainAsync(
        List<Patient> patients,
        List<Guid> dentistIds,
        DemoCatalog catalog)
    {
        // Decided per patient rather than for the branch: the branch-level
        // guard meant a re-run did nothing at all, so every patient registered
        // after the first seeding kept an empty record for ever.
        var covered = (await planRepository.GetListAsync(p => p.BranchId == _branchId))
            .Select(p => p.PatientId)
            .ToHashSet();

        var random = new Random(20260826);
        var today = DateOnly.FromDateTime(BlueDentalDemoSeedContributor.ClinicToday);
        var chosen = patients.Where(p => !covered.Contains(p.Id)).ToList();

        if (chosen.Count == 0)
        {
            return;
        }

        var diagnoses = new List<PatientDiagnosis>();
        var advises = new List<PatientAdvise>();
        var plans = new List<TreatmentPlan>();
        var stages = new List<TreatmentStage>();
        var prescriptions = new List<Prescription>();

        for (var i = 0; i < chosen.Count; i++)
        {
            var patient = chosen[i];
            var dentistId = dentistIds[i % dentistIds.Count];
            var service = catalog.Services[i % catalog.Services.Count];
            var diagnosis = catalog.Diagnoses[i % catalog.Diagnoses.Count];
            var tooth = new ToothSelection(Teeth[i % Teeth.Length], selected: true);

            var diagnosisRow = PatientDiagnosis.Record(
                DemoIdFor("0200", patient.Id),
                patient.Id,
                _branchId,
                diagnosis.Id,
                dentistId,
                $"CD26-{i + 1:D4}",
                [tooth],
                note: diagnosis.Name);
            diagnoses.Add(diagnosisRow);

            var advise = PatientAdvise.Offer(
                DemoIdFor("0201", patient.Id),
                patient.Id,
                _branchId,
                diagnosisRow.Id,
                diagnosis.Id,
                service.Id,
                dentistId,
                $"TV26-{i + 1:D4}",
                service.Price,
                service.Price,
                quantity: 1,
                teeth: [tooth]);

            var plan = TreatmentPlan.Open(
                DemoIdFor("0202", patient.Id),
                patient.Id,
                dentistId,
                _branchId,
                $"KH26-{i + 1:D4}",
                $"Kế hoạch {service.Name.ToLowerInvariant()}");

            var lineId = DemoIdFor("0203", patient.Id);
            var line = plan.AddService(
                lineId, service.Id, advise.Id, service.Price, 1, DiscountType.None, 0m, [tooth]);

            advise.Accept();
            advise.ConvertTo(plan.Id);

            advises.Add(advise);
            plans.Add(plan);

            // A plan opens InProgress, so the states worth showing are how far
            // its công đoạn have got: one in three has none yet, one in four is
            // finished end to end, and the rest are partway.
            if (i % 3 == 2)
            {
                continue;
            }

            var finished = i % 4 == 0;

            for (var step = 1; step <= 3; step++)
            {
                var stage = TreatmentStage.Add(
                    DemoIdFor("0204", patient.Id, step),
                    patient.Id,
                    _branchId,
                    plan.Id,
                    lineId,
                    service.Id,
                    step,
                    $"Công đoạn {step} - {service.Name}",
                    dentistId,
                    scheduledDate: today.AddDays(step * 7 - 7),
                    teeth: [tooth]);

                if (finished || step <= 1 + i % 3)
                {
                    stage.Continue();
                    stage.Complete();
                }

                stages.Add(stage);
            }

            if (finished)
            {
                line.Complete();
                plan.CloseIfAllServicesDone();
            }

            var medication = catalog.Medications[i % catalog.Medications.Count];

            // A prescription refuses to list the same medicine twice, so the
            // second line always steps one past the first.
            var painkiller = catalog.Medications[(i + 1) % catalog.Medications.Count];

            prescriptions.Add(Prescription.Issue(
                DemoIdFor("0205", patient.Id),
                patient.Id,
                _branchId,
                $"DT26-{i + 1:D4}",
                dentistId,
                [
                    new PrescriptionItem(
                        DemoIdFor("0206", patient.Id, 1),
                        medication.Id,
                        medication.Name,
                        medication.Dosage,
                        medication.Frequency,
                        durationDays: 5,
                        quantity: 15,
                        instructions: "Uống sau ăn"),
                    new PrescriptionItem(
                        DemoIdFor("0206", patient.Id, 2),
                        painkiller.Id,
                        painkiller.Name,
                        painkiller.Dosage,
                        painkiller.Frequency,
                        durationDays: 3,
                        quantity: 6,
                        instructions: "Uống khi đau")
                ],
                patientDiagnosisId: diagnosisRow.Id,
                diagnosisText: diagnosis.Name,
                followUpDate: today.AddDays(random.Next(7, 30))));
        }

        await diagnosisRepository.InsertManyAsync(diagnoses, autoSave: true);
        await adviseRepository.InsertManyAsync(advises, autoSave: true);
        await planRepository.InsertManyAsync(plans, autoSave: true);
        await stageRepository.InsertManyAsync(stages, autoSave: true);
        await prescriptionRepository.InsertManyAsync(prescriptions, autoSave: true);
    }

    /// <summary>
    /// The consulting tables the patient screen reads beside the chain above: a
    /// diagnostic slip and a consultation line per patient.
    /// </summary>
    private async Task SeedConsultingRecordsAsync(
        List<Patient> patients,
        List<Guid> dentistIds,
        DemoCatalog catalog)
    {
        var covered = (await consultationRepository.GetListAsync(c => c.ClinicBranchId == _branchId))
            .Select(c => c.PatientId)
            .ToHashSet();

        var consultations = new List<ConsultationRecord>();
        var diagnostics = new List<DiagnosticRecord>();
        var chosen = patients.Where(p => !covered.Contains(p.Id)).ToList();

        if (chosen.Count == 0)
        {
            return;
        }

        for (var i = 0; i < chosen.Count; i++)
        {
            var service = catalog.Services[i % catalog.Services.Count];
            var diagnosis = catalog.Diagnoses[i % catalog.Diagnoses.Count];

            consultations.Add(new ConsultationRecord(
                DemoIdFor("0300", chosen[i].Id),
                chosen[i].Id,
                _branchId,
                service.Name,
                service.Price,
                quantity: 1,
                procedureId: service.Id,
                notes: "Khách cân nhắc chi phí"));

            diagnostics.Add(new DiagnosticRecord(
                DemoIdFor("0301", chosen[i].Id),
                $"PK26-{i + 1:D4}",
                chosen[i].Id,
                _branchId,
                dentistIds[i % dentistIds.Count],
                teethNumbers: Teeth[i % Teeth.Length].ToString(),
                diagnosis: diagnosis.Name,
                notes: "Chụp phim kiểm tra"));
        }

        await consultationRepository.InsertManyAsync(consultations, autoSave: true);
        await diagnosticRepository.InsertManyAsync(diagnostics, autoSave: true);
    }

    /// <summary>
    /// Money held against the patient rather than an invoice: the payments,
    /// deposits and one refund that công nợ and thu chi read.
    /// </summary>
    private async Task SeedPaymentsAsync(List<Patient> patients, List<Guid> dentistIds)
    {
        var covered = (await paymentRepository.GetListAsync(p => p.ClinicBranchId == _branchId))
            .Select(p => p.PatientId)
            .ToHashSet();

        var random = new Random(20260827);
        var payments = new List<PatientPayment>();
        var chosen = patients.Where(p => !covered.Contains(p.Id)).ToList();

        if (chosen.Count == 0)
        {
            return;
        }

        // A payment or a refund has to name the slip it belongs to; only a
        // deposit stands on its own. So each one is hung off that patient's
        // plan, and patients without a plan can only be holding money.
        var plans = await planRepository.GetListAsync(p => p.BranchId == _branchId);
        var planByPatient = plans
            .GroupBy(p => p.PatientId)
            .ToDictionary(g => g.Key, g => g.First().Id);

        for (var i = 0; i < chosen.Count; i++)
        {
            var planId = planByPatient.GetValueOrDefault(chosen[i].Id);

            var kind = planId == Guid.Empty
                ? PatientPaymentKind.Prepaid
                : i % 6 == 5
                    ? PatientPaymentKind.Refund
                    : i % 3 == 2
                        ? PatientPaymentKind.Prepaid
                        : PatientPaymentKind.Payment;

            var method = (PaymentMethodKind)(1 + i % 3);
            var amount = random.Next(4, 40) * 500_000m;

            payments.Add(PatientPayment.Record(
                DemoIdFor("0400", chosen[i].Id),
                chosen[i].Id,
                _branchId,
                kind,
                method,
                amount,
                $"TT26-{i + 1:D4}",
                dentistIds[i % dentistIds.Count],
                DateTimeOffset.UtcNow.AddDays(-random.Next(0, 30)),
                treatmentPlanId: kind == PatientPaymentKind.Prepaid ? null : planId,
                note: kind == PatientPaymentKind.Refund ? "Hoàn phần chưa điều trị" : null));
        }

        await paymentRepository.InsertManyAsync(payments, autoSave: true);
    }
}
