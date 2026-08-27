using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Catalogs;
using BlueDental.Inventory;
using BlueDental.Organizations;
using Volo.Abp;
using Volo.Abp.Data;
using Volo.Abp.DependencyInjection;
using Volo.Abp.Domain.Repositories;

namespace BlueDental.Data;

/// <summary>
/// Depth for the three Vật tư sections.
///
/// The reference branch is empty on all three — no materials, no departments,
/// no allocation vouchers — so there was nothing there to copy and nothing here
/// to look at either. Everything below is invented: Vietnamese dental supplies
/// with plausible suppliers and prices, spread so the screens show every state
/// they can draw rather than one happy row repeated.
///
/// <para>
/// Stock and expiry are chosen so Trạng thái shows all five of its values:
/// plenty in stock, at or under the reorder level, none left, expiring inside
/// its warning window, and already expired.
/// </para>
///
/// Development only. Deterministic ids, so a re-run duplicates nothing.
/// </summary>
public class BlueDentalMaterialsDemoSeeder(
    IRepository<Department, Guid> departmentRepository,
    IRepository<InventoryItem, Guid> itemRepository,
    IRepository<MaterialAllocation, Guid> allocationRepository,
    IRepository<Taxonomy, Guid> taxonomyRepository,
    IDataFilter<ISoftDelete> softDeleteFilter) : ITransientDependency
{
    /// <summary>The groups materials are filed under, beside the seeded "Hệ thống".</summary>
    private static readonly string[] Groups =
    [
        "Vật tư tiêu hao",
        "Dụng cụ",
        "Thuốc và hoá chất",
    ];

    private static readonly (string Name, int Order)[] Departments =
    [
        ("Phòng khám 1", 0),
        ("Phòng khám 2", 1),
        ("Phòng tiểu phẫu", 2),
        ("Phòng vô trùng", 3),
        ("Kho tổng", 4),
    ];

    /// <summary>
    /// Group, name, supplier, origin, buy, sell, on hand, reorder level, and how
    /// many days from today it expires — null meaning it does not.
    /// </summary>
    private static readonly (
        string Group,
        string Name,
        string Supplier,
        string Origin,
        decimal Cost,
        decimal Price,
        decimal OnHand,
        decimal Reorder,
        int? ExpiresInDays)[] Materials =
    [
        ("Vật tư tiêu hao", "Găng tay y tế Nitrile size M", "Công ty TNHH Nam Việt", "Việt Nam", 85_000m, 120_000m, 240m, 50m, 400),
        ("Vật tư tiêu hao", "Khẩu trang y tế 4 lớp", "Công ty TNHH Nam Việt", "Việt Nam", 45_000m, 70_000m, 180m, 40m, 320),
        ("Vật tư tiêu hao", "Ống hút nước bọt dùng một lần", "Dental Supply Co.", "Trung Quốc", 32_000m, 55_000m, 26m, 30m, null),
        ("Vật tư tiêu hao", "Gạc vô trùng 5x5cm", "Công ty CP Y tế Bảo An", "Việt Nam", 28_000m, 45_000m, 0m, 20m, 90),
        ("Vật tư tiêu hao", "Cuộn bông nha khoa", "Công ty CP Y tế Bảo An", "Việt Nam", 22_000m, 38_000m, 95m, 25m, 25),
        ("Dụng cụ", "Mũi khoan kim cương FG 012", "Dentsply Sirona", "Đức", 150_000m, 240_000m, 60m, 15m, null),
        ("Dụng cụ", "Kìm nhổ răng hàm trên", "Hu-Friedy", "Hoa Kỳ", 1_250_000m, 1_850_000m, 8m, 3m, null),
        ("Dụng cụ", "Gương nha khoa số 4", "Dental Supply Co.", "Trung Quốc", 65_000m, 110_000m, 42m, 10m, null),
        ("Dụng cụ", "Cây lấy cao răng siêu âm", "Woodpecker", "Trung Quốc", 480_000m, 750_000m, 5m, 5m, null),
        ("Thuốc và hoá chất", "Thuốc tê Lidocaine 2% ống 1.8ml", "Dược Hậu Giang", "Việt Nam", 12_000m, 25_000m, 320m, 60m, 180),
        ("Thuốc và hoá chất", "Sát khuẩn Chlorhexidine 0.12%", "Dược Hậu Giang", "Việt Nam", 55_000m, 95_000m, 48m, 12m, 12),
        ("Thuốc và hoá chất", "Composite quang trùng hợp A2", "3M ESPE", "Hoa Kỳ", 780_000m, 1_150_000m, 18m, 6m, -8),
        ("Thuốc và hoá chất", "Xi măng gắn tạm Eugenol", "GC Corporation", "Nhật Bản", 320_000m, 520_000m, 14m, 4m, 60),
    ];

    /// <summary>Who raised the voucher. Invented names.</summary>
    private static readonly string[] Performers =
    [
        "Nguyễn Thu Trang",
        "Lê Minh Khoa",
        "Trần Bảo Ngọc",
        "Phạm Anh Tuấn",
    ];

    private static readonly string?[] Notes =
    [
        null,
        "Cấp bổ sung đầu ca sáng",
        "Bù cho ca tiểu phẫu chiều",
        "Xuất theo kế hoạch tuần",
        "Cấp gấp theo yêu cầu bác sĩ",
    ];

    /// <summary>Four rounds over the five departments, so each gets four.</summary>
    private const int Vouchers = 20;

    public async Task SeedAsync(Guid branchId)
    {
        var today = DateOnly.FromDateTime(BlueDentalDemoSeedContributor.ClinicToday);

        var groupIds = await SeedGroupsAsync(branchId);
        var departmentIds = await SeedDepartmentsAsync(branchId);
        var itemIds = await SeedMaterialsAsync(branchId, groupIds, today);

        await SeedAllocationsAsync(branchId, departmentIds, itemIds);
    }

    private async Task<Dictionary<string, Guid>> SeedGroupsAsync(Guid branchId)
    {
        var ids = new Dictionary<string, Guid>();

        for (var index = 0; index < Groups.Length; index++)
        {
            var name = Groups[index];
            var id = DeterministicId($"taxonomy|{branchId}|{TaxonomyGroups.Supplies}|{name}");
            ids[name] = id;

            if (await ExistsAsync(taxonomyRepository, id))
            {
                continue;
            }

            await taxonomyRepository.InsertAsync(
                Taxonomy.Create(
                    id,
                    branchId,
                    TaxonomyGroups.Supplies,
                    name,
                    // The seeded "Hệ thống" group keeps first place.
                    sortOrder: index + 1),
                autoSave: true);
        }

        return ids;
    }

    private async Task<Dictionary<string, Guid>> SeedDepartmentsAsync(Guid branchId)
    {
        var ids = new Dictionary<string, Guid>();

        foreach (var (name, order) in Departments)
        {
            var id = DeterministicId($"department|{branchId}|{name}");
            ids[name] = id;

            if (await ExistsAsync(departmentRepository, id))
            {
                continue;
            }

            await departmentRepository.InsertAsync(
                new Department(id, name, description: null, branchId: branchId, sortOrder: order),
                autoSave: true);
        }

        return ids;
    }

    private async Task<Dictionary<string, Guid>> SeedMaterialsAsync(
        Guid branchId,
        Dictionary<string, Guid> groupIds,
        DateOnly today)
    {
        var ids = new Dictionary<string, Guid>();
        var index = 0;

        foreach (var material in Materials)
        {
            var id = DeterministicId($"supply|{branchId}|{material.Name}");
            ids[material.Name] = id;
            index++;

            if (await ExistsAsync(itemRepository, id))
            {
                continue;
            }

            var item = new InventoryItem(
                id,
                $"VT{index:D4}",
                material.Name,
                branchId,
                material.Reorder,
                category: null,
                unit: "Cái",
                unitCost: material.Cost);

            item.UpdateCatalogInfo(
                material.Name,
                groupIds.GetValueOrDefault(material.Group),
                material.Supplier,
                material.Origin,
                "Cái",
                material.Cost,
                material.Price);

            // Received a fortnight ago, so "Nhập kho" reads as a real past date
            // rather than everything landing the day the seeder ran.
            item.SetShelfLife(
                today.AddDays(-14),
                material.ExpiresInDays.HasValue
                    ? today.AddDays(material.ExpiresInDays.Value)
                    : null,
                // Wide enough that the near-expiry rows fall inside it.
                30);

            if (material.OnHand > 0)
            {
                item.AddStock(material.OnHand);
            }

            await itemRepository.InsertAsync(item, autoSave: true);
        }

        return ids;
    }

    private async Task SeedAllocationsAsync(
        Guid branchId,
        Dictionary<string, Guid> departmentIds,
        Dictionary<string, Guid> itemIds)
    {
        // Fixed seed: the same vouchers every run, so a screenshot taken today
        // matches one taken tomorrow.
        var random = new Random(20260827);
        var departments = departmentIds.Keys.ToList();
        var materials = itemIds.Keys.ToList();

        // Voucher codes are unique clinic-wide, so the two seeded branches need
        // different runs of numbers on the same day.
        var branchOffset = branchId == BlueDentalDataSeedContributor.DefaultBranchId ? 0 : 50;

        for (var index = 0; index < Vouchers; index++)
        {
            var id = DeterministicId($"allocation|{branchId}|{index}");

            if (await ExistsAsync(allocationRepository, id))
            {
                continue;
            }

            // Round-robin rather than random, so every department has vouchers
            // to show and each draws on only two materials — which means the
            // same material recurs and "Gộp số lượng vật tư" has something to
            // fold. Randomness is left to the quantities and the notes.
            var slot = index % departments.Count;
            var round = index / departments.Count;

            var department = departments[slot];
            var material = materials[(slot * 2 + round % 2) % materials.Count];
            var quantity = random.Next(2, 25);

            // Three vouchers a day, working backwards, at plausible hours — so
            // "Thời gian phân bổ" reads as a history rather than eighteen rows
            // all stamped the moment the seeder ran.
            var raisedAt = BlueDentalDemoSeedContributor.ClinicToday
                .AddDays(-round)
                .AddHours(8 + slot * 2)
                .AddMinutes(random.Next(0, 60));

            var allocation = new MaterialAllocation(
                id,
                // The shape the app generates on a real save — PB, the date, and
                // a counter that restarts each day. The counter is offset by the
                // branch because the column is unique across the whole clinic
                // and the two seeded branches would otherwise collide.
                $"PB{raisedAt:yyyyMMdd}{(branchOffset + round) * 10 + slot + 1:D4}",
                departmentIds[department],
                branchId,
                Performers[random.Next(Performers.Length)],
                Notes[random.Next(Notes.Length)],
                raisedAt);

            allocation.AddItem(
                DeterministicId($"allocation-item|{branchId}|{index}"),
                itemIds[material],
                material,
                quantity);

            // Some confirmed, some not — so "SL còn lại (đã duyệt)" is neither a
            // copy of the column beside it nor empty everywhere.
            if (random.Next(0, 3) > 0)
            {
                allocation.ConfirmRemaining(itemIds[material], random.Next(0, (int)quantity + 1));
            }

            await allocationRepository.InsertAsync(allocation, autoSave: true);
        }
    }

    /// <summary>
    /// A soft-deleted row still holds its primary key, so AnyAsync — which
    /// cannot see it — reports "no" and the insert then fails on a duplicate.
    /// Deleting a seeded row through the UI used to break the seeder for good.
    /// </summary>
    private async Task<bool> ExistsAsync<TEntity>(IRepository<TEntity, Guid> repository, Guid id)
        where TEntity : class, Volo.Abp.Domain.Entities.IEntity<Guid>
    {
        using (softDeleteFilter.Disable())
        {
            return await repository.AnyAsync(x => x.Id == id);
        }
    }

    private static Guid DeterministicId(string key)
    {
        var bytes = System.Security.Cryptography.MD5.HashData(
            System.Text.Encoding.UTF8.GetBytes(key));
        return new Guid(bytes);
    }
}
