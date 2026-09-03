using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Billing;
using BlueDental.Billing.Values;
using BlueDental.CustomerCare;
using BlueDental.Labo;
using BlueDental.PatientManagement;
using Volo.Abp.BlobStoring;
using Volo.Abp.DependencyInjection;
using Volo.Abp.Domain.Repositories;

namespace BlueDental.Data;

/// <summary>
/// Fills the tabs on a patient's record that the other demo seeders leave thin
/// or empty: Hình ảnh, Hóa đơn, Labo and Chăm sóc KH.
///
/// Those four were skewed rather than absent. Invoices are raised from
/// *completed* appointments, and the appointment seeder completes a long run
/// for one patient only — so 71 invoices all belonged to the same record and
/// every other Hóa đơn tab was blank. Images had no rows at all. This seeder
/// works per patient instead, so whichever record is opened has something on
/// every tab.
///
/// Everything is synthetic and deterministic, keyed off the patient's own id,
/// so a re-run adds nothing twice.
/// </summary>
public class BlueDentalPatientTabsDemoSeeder(
    IRepository<PatientImage, Guid> imageRepository,
    IRepository<Invoice, Guid> invoiceRepository,
    IRepository<LaboOrder, Guid> laboRepository,
    IRepository<LaboSupplier, Guid> laboSupplierRepository,
    IRepository<LaboMaterial, Guid> laboMaterialRepository,
    IRepository<CareRecord, Guid> careRepository,
    IBlobContainer blobContainer) : ITransientDependency
{
    private readonly Guid _branchId = BlueDentalDataSeedContributor.DefaultBranchId;

    /// <summary>What the demo photographs, and the hue each one is drawn in.</summary>
    private static readonly (string Label, byte R, byte G, byte B)[] Shots =
    [
        ("Ảnh trong miệng - mặt nhai", 92, 116, 148),
        ("Ảnh mặt ngoài", 118, 132, 116),
        ("Phim toàn cảnh", 96, 96, 104),
    ];

    private static readonly (CareType Type, string Subject)[] CareTopics =
    [
        (CareType.AfterTreatment, "Gọi hỏi thăm sau điều trị"),
        (CareType.Periodic, "Nhắc tái khám định kỳ 6 tháng"),
    ];

    private static readonly PaymentMethod[] Methods =
        [PaymentMethod.Cash, PaymentMethod.BankTransfer, PaymentMethod.CreditCard];

    public async Task SeedAsync(List<Patient> patients, List<Guid> staffIds)
    {
        if (patients.Count == 0 || staffIds.Count == 0)
        {
            return;
        }

        // Ordered so a run is repeatable whatever order the roster came back in.
        var roster = patients.OrderBy(p => p.PatientCode).ToList();

        await SeedImagesAsync(roster, staffIds);
        await SeedInvoicesAsync(roster);
        await SeedLaboOrdersAsync(roster, staffIds);
        await SeedCareRecordsAsync(roster, staffIds);
    }

    /// <summary>
    /// A stable id for a demo row belonging to one patient, derived from the
    /// patient's own id so a growing roster never reassigns an existing row.
    /// The leading bytes carry the kind, so two kinds never collide.
    /// </summary>
    private static Guid DemoIdFor(string kind, Guid patientId, int sub)
    {
        var bytes = patientId.ToByteArray();
        var value = int.Parse(kind, NumberStyles.HexNumber, CultureInfo.InvariantCulture);

        bytes[0] = (byte)(value >> 8);
        bytes[1] = (byte)value;
        bytes[2] = (byte)sub;

        return new Guid(bytes);
    }

    private async Task SeedImagesAsync(List<Patient> patients, List<Guid> staffIds)
    {
        var written = (await imageRepository.GetListAsync(i => i.ClinicBranchId == _branchId))
            .Select(i => i.Id)
            .ToHashSet();

        var fresh = new List<PatientImage>();
        var takenBase = DateTimeOffset.UtcNow.AddDays(-40);

        foreach (var (patient, index) in patients.Select((p, i) => (p, i)))
        {
            for (var shot = 0; shot < Shots.Length; shot++)
            {
                var (label, r, g, b) = Shots[shot];
                var id = DemoIdFor("00A1", patient.Id, shot);

                if (written.Contains(id))
                {
                    continue;
                }

                // The tab reads the blob, so the bytes have to exist: a row on
                // its own would render a broken thumbnail.
                var bytes = DemoPngWriter.Gradient(480, 360, (r, g, b));
                var blobName = $"patient-images/{patient.Id:N}/{id:N}.png";
                await blobContainer.SaveAsync(blobName, bytes, overrideExisting: true);

                fresh.Add(PatientImage.Attach(
                    id,
                    patient.Id,
                    _branchId,
                    blobName,
                    $"{patient.PatientCode}-{shot + 1}.png",
                    "image/png",
                    bytes.LongLength,
                    staffIds[(index + shot) % staffIds.Count],
                    takenBase.AddDays(index % 30).AddHours(shot),
                    note: label));
            }
        }

        if (fresh.Count > 0)
        {
            await imageRepository.InsertManyAsync(fresh, autoSave: true);
        }
    }

    /// <summary>
    /// Two invoices per patient: one settled, one still owing. These carry no
    /// appointment — they stand for walk-in billing, which is why they can be
    /// raised for every patient rather than only the one with a completed run.
    /// </summary>
    private async Task SeedInvoicesAsync(List<Patient> patients)
    {
        var written = (await invoiceRepository.GetListAsync(i => i.BranchId == _branchId))
            .Select(i => i.Id)
            .ToHashSet();

        var fresh = new List<Invoice>();

        foreach (var (patient, index) in patients.Select((p, i) => (p, i)))
        {
            for (var slot = 0; slot < 2; slot++)
            {
                if (written.Contains(DemoIdFor("00A2", patient.Id, slot)))
                {
                    continue;
                }

                // 800k – 9.6m VND, on the 50k steps a real price list uses.
                var subTotal = (16 + (index * 7 + slot * 23) % 176) * 50_000m;
                var discount = slot == 1 ? Math.Round(subTotal * 0.1m, 0) : 0m;
                var issuedAt = DateTimeOffset.UtcNow.AddDays(-(30 - slot * 14) - index % 20);

                var invoice = new Invoice(
                    DemoIdFor("00A2", patient.Id, slot),
                    $"HD-{issuedAt:yyyyMM}-{patient.PatientCode}-{slot + 1}",
                    patient.Id,
                    _branchId,
                    new Money(subTotal, "VND"),
                    new Money(0m, "VND"),
                    new Money(discount, "VND"),
                    issuedAt.AddDays(30),
                    issuedAt: issuedAt);

                invoice.Issue();

                var due = subTotal - discount;

                if (slot == 0)
                {
                    invoice.RecordPayment(new Money(due, "VND"), Methods[index % Methods.Length]);
                }
                else
                {
                    // Part-paid, so the Lịch sử dư nợ tab has a balance to show.
                    invoice.RecordPayment(
                        new Money(Math.Round(due * 0.4m, 0), "VND"),
                        Methods[(index + 1) % Methods.Length]);
                }

                fresh.Add(invoice);
            }
        }

        if (fresh.Count > 0)
        {
            await invoiceRepository.InsertManyAsync(fresh, autoSave: true);
        }
    }

    private async Task SeedLaboOrdersAsync(List<Patient> patients, List<Guid> staffIds)
    {
        // Point at the supplier and material records, not just their names: the
        // Mẫu labo table resolves those columns by id, and an order without
        // them reads "—" on every row.
        var suppliers = (await laboSupplierRepository.GetListAsync(s => s.ClinicBranchId == _branchId))
            .OrderBy(s => s.Name)
            .ToList();

        var materials = (await laboMaterialRepository.GetListAsync(m => m.ClinicBranchId == _branchId))
            .OrderBy(m => m.Name)
            .ToList();

        if (suppliers.Count == 0 || materials.Count == 0)
        {
            return;
        }

        var written = (await laboRepository.GetListAsync(o => o.BranchId == _branchId))
            .Select(o => o.Id)
            .ToHashSet();

        var fresh = new List<LaboOrder>();

        foreach (var (patient, index) in patients.Select((p, i) => (p, i)))
        {
            if (written.Contains(DemoIdFor("00A3", patient.Id, 0)))
            {
                continue;
            }

            var supplier = suppliers[index % suppliers.Count];
            var material = materials[index % materials.Count];

            var order = new LaboOrder(
                DemoIdFor("00A3", patient.Id, 0),
                $"LB-{patient.PatientCode}",
                patient.Id,
                _branchId,
                supplier.Name,
                (8 + index % 20) * 250_000m,
                staffIds[index % staffIds.Count],
                toothNumbers: (11 + index % 8).ToString(CultureInfo.InvariantCulture),
                workDescription: material.Name,
                dueDate: DateOnly.FromDateTime(DateTime.UtcNow.AddDays(7 + index % 14)),
                kind: index % 3 == 2 ? LaboOrderKind.Guarantee : LaboOrderKind.New,
                supplierId: supplier.Id,
                materialId: material.Id);

            // Half are already at the lab, so the status chips are not all one
            // colour.
            if (index % 2 == 0)
            {
                order.Send();
            }

            fresh.Add(order);
        }

        if (fresh.Count > 0)
        {
            await laboRepository.InsertManyAsync(fresh, autoSave: true);
        }
    }

    private async Task SeedCareRecordsAsync(List<Patient> patients, List<Guid> staffIds)
    {
        var written = (await careRepository.GetListAsync(c => c.BranchId == _branchId))
            .Select(c => c.Id)
            .ToHashSet();

        var fresh = new List<CareRecord>();

        foreach (var (patient, index) in patients.Select((p, i) => (p, i)))
        {
            for (var slot = 0; slot < CareTopics.Length; slot++)
            {
                if (written.Contains(DemoIdFor("00A4", patient.Id, slot)))
                {
                    continue;
                }

                var (type, subject) = CareTopics[slot];

                var record = new CareRecord(
                    DemoIdFor("00A4", patient.Id, slot),
                    patient.Id,
                    _branchId,
                    type,
                    subject,
                    staffIds[(index + slot) % staffIds.Count],
                    description: $"{subject} — {patient.PatientCode}",
                    dueAt: DateTimeOffset.UtcNow.AddDays(slot * 7 - 3 + index % 10));

                // The first is done, the second still open, so both halves of
                // the Chăm sóc KH chips have something behind them.
                if (slot == 0)
                {
                    record.MarkContacted();
                    record.Succeed(CareOutcome.Good, "Bệnh nhân hài lòng, không có biến chứng.");
                }

                fresh.Add(record);
            }
        }

        if (fresh.Count > 0)
        {
            await careRepository.InsertManyAsync(fresh, autoSave: true);
        }
    }
}
