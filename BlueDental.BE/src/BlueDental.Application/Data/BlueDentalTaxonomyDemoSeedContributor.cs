using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using BlueDental.Catalogs;
using Microsoft.Extensions.Configuration;
using Volo.Abp;
using Volo.Abp.Data;
using Volo.Abp.DependencyInjection;
using Volo.Abp.Domain.Entities;
using Volo.Abp.Domain.Repositories;

namespace BlueDental.Data;

/// <summary>
/// Fills every "Danh mục" tab with synthetic data in <b>both</b> clinic
/// branches.
///
/// The catalogs are branch-scoped, so an empty second branch makes the branch
/// switcher impossible to exercise: every tab looks the same whichever branch is
/// selected, and a leak between branches would go unnoticed. Each branch
/// therefore gets its own groups and its own entries, deliberately different
/// from the other's.
///
/// Only runs in Development. Every name, phone number and account number here is
/// invented — nothing is copied from the reference application.
/// </summary>
public class BlueDentalTaxonomyDemoSeedContributor(
    IRepository<Taxonomy, Guid> taxonomyRepository,
    IRepository<CatalogEntry, Guid> catalogRepository,
    IRepository<PatientTag, Guid> tagRepository,
    IRepository<PaymentAccount, Guid> paymentRepository,
    IDataFilter<ISoftDelete> softDeleteFilter,
    IConfiguration configuration) : IDataSeedContributor, ITransientDependency
{
    /// <summary>
    /// Does a row with this id exist — deleted ones included?
    ///
    /// Seeded ids are deterministic, and a soft-deleted row keeps its primary
    /// key while dropping out of every ordinary query. Asking the ordinary way
    /// answers "no" for a row that is still very much occupying that id, and the
    /// insert that follows dies on the primary key. One deleted demo row was
    /// enough to stop the whole seeder, and with it every screen downstream.
    /// </summary>
    private async Task<bool> ExistsAsync<TEntity>(IRepository<TEntity, Guid> repository, Guid id)
        where TEntity : class, IEntity<Guid>
    {
        using (softDeleteFilter.Disable())
        {
            return await repository.AnyAsync(x => x.Id == id);
        }
    }

    /// <summary>One group of a catalog and the rows inside it.</summary>
    private sealed record GroupSeed(string Name, params EntrySeed[] Entries);

    /// <summary>One row of a catalog. Price and content apply only where the catalog carries them.</summary>
    private sealed record EntrySeed(string Name, decimal? Price = null, string? Content = null);

    public async Task SeedAsync(DataSeedContext context)
    {
        if (!IsDevelopment())
        {
            return;
        }

        var firstBranch = BlueDentalDataSeedContributor.DefaultBranchId;
        var secondBranch = BlueDentalBranchSeedContributor.SecondBranchId;

        await SeedCatalogsAsync(firstBranch, FirstBranchCatalogs());
        await SeedCatalogsAsync(secondBranch, SecondBranchCatalogs());

        await SeedTagsAsync(firstBranch, FirstBranchTags());
        await SeedTagsAsync(secondBranch, SecondBranchTags());

        await SeedPaymentAccountsAsync(firstBranch, FirstBranchAccounts());
        await SeedPaymentAccountsAsync(secondBranch, SecondBranchAccounts());

        await SeedSuppliesSystemGroupAsync(firstBranch);
        await SeedSuppliesSystemGroupAsync(secondBranch);

        await SeedLaboCatalogsAsync(firstBranch, FirstBranchLaboCatalogs());
        await SeedLaboCatalogsAsync(secondBranch, SecondBranchLaboCatalogs());
    }

    /// <summary>
    /// Khớp cắn, Đường hoàn tất and Kiểu nhịp.
    ///
    /// These three are taxonomy rows in their own right rather than groups with
    /// entries inside them — the reference files them the same way, one flat
    /// list per <c>group</c>. See docs/clone/pages/labo.md §4.
    ///
    /// The priority ascends so the seeded order is the order they list in, and
    /// a row created later still lands on top: a new row carries the default
    /// priority and ties with the first seed, and the server breaks that tie
    /// newest-first.
    /// </summary>
    private async Task SeedLaboCatalogsAsync(Guid branchId, Dictionary<string, string[]> catalogs)
    {
        foreach (var (group, names) in catalogs)
        {
            for (var index = 0; index < names.Length; index++)
            {
                var id = DeterministicId($"taxonomy|{branchId}|{group}|{names[index]}");

                if (await ExistsAsync(taxonomyRepository, id))
                {
                    continue;
                }

                await taxonomyRepository.InsertAsync(
                    Taxonomy.Create(id, branchId, group, names[index], sortOrder: index),
                    autoSave: true);
            }
        }
    }

    /// <summary>Clinical vocabulary, not copied records — see the class summary.</summary>
    private static Dictionary<string, string[]> FirstBranchLaboCatalogs() => new()
    {
        [TaxonomyGroups.LaboBite] =
        [
            "Khớp cắn chéo",
            "Khớp cắn hở",
            "Khớp cắn hạng I",
            "Khớp cắn hạng II",
            "Khớp cắn hạng III",
        ],
        [TaxonomyGroups.LaboFinishLine] =
        [
            "Bờ nghiêng",
            "Bờ xuôi",
            "Bờ cong",
            "Bờ vai",
            "Bờ vai vát",
        ],
        [TaxonomyGroups.LaboRhythm] =
        [
            "Nhịp bán yên ngựa",
            "Nhịp yên ngựa",
            "Nhịp hình trứng",
            "Nhịp thoát",
        ],
    };

    /// <summary>
    /// Deliberately a different, shorter set: two branches holding the same
    /// rows would hide a leak between them.
    /// </summary>
    private static Dictionary<string, string[]> SecondBranchLaboCatalogs() => new()
    {
        [TaxonomyGroups.LaboBite] = ["Khớp cắn hạng I", "Khớp cắn đối đầu"],
        [TaxonomyGroups.LaboFinishLine] = ["Bờ vai", "Bờ lõm"],
        [TaxonomyGroups.LaboRhythm] = ["Nhịp thoát", "Nhịp tiếp xúc"],
    };

    /// <summary>
    /// The one material group the reference ships with: "Hệ thống", marked as a
    /// system group so it can be neither renamed nor deleted. Vật tư's panel
    /// draws it amber with an ⓘ where a normal group keeps its menu.
    /// </summary>
    private async Task SeedSuppliesSystemGroupAsync(Guid branchId)
    {
        var id = DeterministicId($"taxonomy|{branchId}|{TaxonomyGroups.Supplies}|Hệ thống");

        if (await ExistsAsync(taxonomyRepository, id))
        {
            return;
        }

        await taxonomyRepository.InsertAsync(
            Taxonomy.Create(
                id,
                branchId,
                TaxonomyGroups.Supplies,
                "Hệ thống",
                isSystem: true),
            autoSave: true);
    }

    private bool IsDevelopment() =>
        string.Equals(
            configuration["ASPNETCORE_ENVIRONMENT"]
                ?? Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT"),
            "Development",
            StringComparison.OrdinalIgnoreCase);

    // ---------------------------------------------------------------- catalogs

    /// <summary>Chi nhánh chính — a general practice that also does braces and implants.</summary>
    private static Dictionary<string, GroupSeed[]> FirstBranchCatalogs() => new()
    {
        [TaxonomyGroups.CareService] =
        [
            new GroupSeed("Nhóm Tổng Quát",
                new EntrySeed("Khám và tư vấn tổng quát", 200_000m),
                new EntrySeed("Cạo vôi răng - đánh bóng", 300_000m),
                new EntrySeed("Trám răng composite", 450_000m),
                new EntrySeed("Điều trị tuỷ răng cửa", 1_200_000m)),
            new GroupSeed("Nhóm Chỉnh Nha",
                new EntrySeed("Niềng răng mắc cài kim loại", 35_000_000m),
                new EntrySeed("Niềng răng mắc cài sứ", 45_000_000m),
                new EntrySeed("Niềng răng trong suốt", 75_000_000m)),
            new GroupSeed("Nhóm Implant",
                new EntrySeed("Cấy ghép Implant Hàn Quốc", 18_000_000m),
                new EntrySeed("Cấy ghép Implant Thuỵ Sĩ", 32_000_000m)),
        ],
        [TaxonomyGroups.Diagnosis] =
        [
            new GroupSeed("Nhóm Răng Hàm Mặt",
                new EntrySeed("Sâu men"),
                new EntrySeed("Viêm tuỷ không hồi phục"),
                new EntrySeed("Viêm quanh chóp cấp")),
            new GroupSeed("Nhóm Nha Chu",
                new EntrySeed("Viêm nướu"),
                new EntrySeed("Viêm nha chu mạn tính")),
        ],
        [TaxonomyGroups.MedicationType] =
        [
            new GroupSeed("Nhóm Kháng Sinh",
                new EntrySeed("Augmentin 625mg", 12_000m),
                new EntrySeed("Metronidazol 250mg", 3_000m),
                new EntrySeed("Spiramycin 750.000UI", 8_000m)),
            new GroupSeed("Nhóm Giảm Đau",
                new EntrySeed("Paracetamol 500mg", 2_000m),
                new EntrySeed("Ibuprofen 400mg", 3_500m)),
        ],
        [TaxonomyGroups.ConsultingData] =
        [
            new GroupSeed("Nhóm Tư Vấn Chỉnh Nha",
                new EntrySeed("Thời gian điều trị dự kiến"),
                new EntrySeed("Chính sách trả góp 0%")),
            new GroupSeed("Nhóm Tư Vấn Implant",
                new EntrySeed("Quy trình cấy ghép 3 giai đoạn"),
                new EntrySeed("Chế độ bảo hành trụ Implant")),
        ],
        [TaxonomyGroups.Source] =
        [
            new GroupSeed("Nhóm Online",
                new EntrySeed("Facebook"),
                new EntrySeed("Website phòng khám"),
                new EntrySeed("Zalo OA")),
            new GroupSeed("Nhóm Giới Thiệu",
                new EntrySeed("Khách hàng cũ giới thiệu"),
                new EntrySeed("Người thân giới thiệu")),
        ],
        [TaxonomyGroups.DiseaseHistory] =
        [
            new GroupSeed("Nhóm Bệnh Nền",
                new EntrySeed("Tiểu đường type 2"),
                new EntrySeed("Cao huyết áp"),
                new EntrySeed("Bệnh tim mạch")),
            new GroupSeed("Nhóm Dị Ứng",
                new EntrySeed("Dị ứng kháng sinh nhóm Penicillin"),
                new EntrySeed("Dị ứng thuốc tê")),
        ],
        [TaxonomyGroups.PrescriptionTemplate] =
        [
            // This catalog is shown as one flat table, so its group never
            // appears on screen — it exists only because an entry belongs to one.
            new GroupSeed("Đơn thuốc mẫu",
                new EntrySeed("Đơn hậu phẫu nhổ răng khôn",
                    Content: "Augmentin 625mg — 1 viên x 2 lần/ngày sau ăn, 5 ngày.\nParacetamol 500mg — uống khi đau, tối đa 4 viên/ngày."),
                new EntrySeed("Đơn viêm nướu cấp",
                    Content: "Metronidazol 250mg — 1 viên x 3 lần/ngày, 5 ngày.\nNước súc miệng Chlorhexidine 0,12% — súc 2 lần/ngày.")),
        ],
        [TaxonomyGroups.MedicalRecordTemplate] =
        [
            new GroupSeed("Mẫu Bệnh Án Chỉnh Nha",
                new EntrySeed("Bệnh án chỉnh nha cơ bản",
                    Content: "Lý do đến khám:\nTiền sử:\nKhám ngoài mặt:\nKhám trong miệng:\nPhân tích phim:\nKế hoạch điều trị:")),
            new GroupSeed("Mẫu Bệnh Án Implant",
                new EntrySeed("Bệnh án cấy ghép Implant",
                    Content: "Vùng mất răng:\nMật độ xương:\nChiều cao xương:\nTrụ dự kiến:\nKế hoạch phục hình:")),
        ],
        [TaxonomyGroups.Occupation] =
        [
            new GroupSeed("Nhóm Văn Phòng",
                new EntrySeed("Nhân viên văn phòng"),
                new EntrySeed("Kỹ sư"),
                new EntrySeed("Giáo viên")),
            new GroupSeed("Nhóm Lao Động",
                new EntrySeed("Công nhân"),
                new EntrySeed("Tài xế")),
        ],
    };

    /// <summary>Chi nhánh 2 — a smaller branch: general dentistry, cosmetics, children.</summary>
    private static Dictionary<string, GroupSeed[]> SecondBranchCatalogs() => new()
    {
        [TaxonomyGroups.CareService] =
        [
            new GroupSeed("Nhóm Khám Chữa",
                new EntrySeed("Khám và tư vấn tổng quát", 180_000m),
                new EntrySeed("Nhổ răng sữa", 150_000m),
                new EntrySeed("Nhổ răng khôn mọc lệch", 3_500_000m)),
            new GroupSeed("Nhóm Thẩm Mỹ",
                new EntrySeed("Tẩy trắng răng tại phòng", 2_500_000m),
                new EntrySeed("Dán sứ Veneer", 6_000_000m)),
            new GroupSeed("Nhóm Nha Khoa Trẻ Em",
                new EntrySeed("Trám bít hố rãnh", 400_000m),
                new EntrySeed("Bôi Fluor phòng ngừa", 250_000m)),
        ],
        [TaxonomyGroups.Diagnosis] =
        [
            new GroupSeed("Nhóm Chẩn Đoán Cơ Bản",
                new EntrySeed("Sâu ngà"),
                new EntrySeed("Răng khôn mọc lệch")),
            new GroupSeed("Nhóm Khớp Cắn",
                new EntrySeed("Sai khớp cắn hạng II"),
                new EntrySeed("Răng chen chúc mức độ nhẹ")),
        ],
        [TaxonomyGroups.MedicationType] =
        [
            new GroupSeed("Nhóm Kháng Viêm",
                new EntrySeed("Alphachymotrypsin 4.2mg", 4_000m),
                new EntrySeed("Medrol 16mg", 6_000m)),
            new GroupSeed("Nhóm Chăm Sóc Tại Nhà",
                new EntrySeed("Nước súc miệng Chlorhexidine 0,12%", 65_000m),
                new EntrySeed("Gel bôi giảm ê buốt", 120_000m)),
        ],
        [TaxonomyGroups.ConsultingData] =
        [
            new GroupSeed("Nhóm Tư Vấn Tổng Quát",
                new EntrySeed("Hướng dẫn vệ sinh răng miệng"),
                new EntrySeed("Lịch tái khám định kỳ 6 tháng")),
        ],
        [TaxonomyGroups.Source] =
        [
            new GroupSeed("Nhóm Online",
                new EntrySeed("TikTok"),
                new EntrySeed("Google Maps")),
            new GroupSeed("Nhóm Trực Tiếp",
                new EntrySeed("Khách vãng lai"),
                new EntrySeed("Chuyển từ chi nhánh chính")),
        ],
        [TaxonomyGroups.DiseaseHistory] =
        [
            new GroupSeed("Nhóm Bệnh Nền",
                new EntrySeed("Hen suyễn"),
                new EntrySeed("Viêm gan B")),
            new GroupSeed("Nhóm Lưu Ý Khác",
                new EntrySeed("Đang mang thai"),
                new EntrySeed("Đang dùng thuốc chống đông")),
        ],
        [TaxonomyGroups.PrescriptionTemplate] =
        [
            new GroupSeed("Đơn thuốc mẫu",
                new EntrySeed("Đơn sau nhổ răng sữa",
                    Content: "Paracetamol 250mg dạng gói — uống khi đau, tối đa 3 gói/ngày.")),
        ],
        [TaxonomyGroups.MedicalRecordTemplate] =
        [
            new GroupSeed("Mẫu Bệnh Án Tổng Quát",
                new EntrySeed("Bệnh án khám tổng quát",
                    Content: "Lý do đến khám:\nTiền sử toàn thân:\nKhám lâm sàng:\nChẩn đoán:\nHướng xử trí:")),
        ],
        [TaxonomyGroups.Occupation] =
        [
            new GroupSeed("Nhóm Học Sinh - Sinh Viên",
                new EntrySeed("Học sinh"),
                new EntrySeed("Sinh viên")),
            new GroupSeed("Nhóm Tự Do",
                new EntrySeed("Kinh doanh tự do"),
                new EntrySeed("Nội trợ")),
        ],
    };

    private async Task SeedCatalogsAsync(Guid branchId, Dictionary<string, GroupSeed[]> catalogs)
    {
        foreach (var (group, groups) in catalogs)
        {
            var priced = TaxonomyGroups.Priced.Contains(group);
            var templated = TaxonomyGroups.Templated.Contains(group);

            for (var groupIndex = 0; groupIndex < groups.Length; groupIndex++)
            {
                var seed = groups[groupIndex];
                var taxonomyId = DeterministicId($"taxonomy|{branchId}|{group}|{seed.Name}");

                if (!await ExistsAsync(taxonomyRepository, taxonomyId))
                {
                    await taxonomyRepository.InsertAsync(
                        Taxonomy.Create(taxonomyId, branchId, group, seed.Name, sortOrder: groupIndex),
                        autoSave: true);
                }

                for (var entryIndex = 0; entryIndex < seed.Entries.Length; entryIndex++)
                {
                    var entry = seed.Entries[entryIndex];
                    var entryId = DeterministicId($"entry|{branchId}|{group}|{seed.Name}|{entry.Name}");

                    if (await ExistsAsync(catalogRepository, entryId))
                    {
                        continue;
                    }

                    await catalogRepository.InsertAsync(
                        CatalogEntry.Create(
                            entryId,
                            branchId,
                            taxonomyId,
                            group,
                            entry.Name,
                            // The domain refuses a price on an unpriced catalog and
                            // content on an untemplated one, so neither is passed
                            // where the catalog does not carry it.
                            price: priced ? entry.Price : null,
                            content: templated ? entry.Content : null,
                            sortOrder: entryIndex),
                        autoSave: true);
                }
            }
        }
    }

    // -------------------------------------------------------------------- tags

    private static (string Name, string Color)[] FirstBranchTags() =>
    [
        ("Tư Vấn Chỉnh Nha", "#EF4444"),
        ("Implant", "#3B82F6"),
        ("Tổng quát", "#10B981"),
        ("Chỉnh Nha", "#F59E0B"),
    ];

    private static (string Name, string Color)[] SecondBranchTags() =>
    [
        ("Khách VIP", "#A855F7"),
        ("Trẻ em", "#EC4899"),
        ("Bảo hiểm", "#64748B"),
        ("Hẹn tái khám", "#6366F1"),
    ];

    private async Task SeedTagsAsync(Guid branchId, (string Name, string Color)[] tags)
    {
        foreach (var (name, color) in tags)
        {
            var id = DeterministicId($"tag|{branchId}|{name}");

            if (await tagRepository.AnyAsync(x => x.Id == id))
            {
                continue;
            }

            await tagRepository.InsertAsync(PatientTag.Create(id, branchId, name, color), autoSave: true);
        }
    }

    // -------------------------------------------------------- payment accounts

    /// <summary>A MoMo wallet or a bank account, in the shape each kind needs.</summary>
    private sealed record AccountSeed(
        PaymentAccountKind Kind,
        string HolderName,
        string? PhoneNumber = null,
        string? BankName = null,
        string? AccountNumber = null);

    private static AccountSeed[] FirstBranchAccounts() =>
    [
        new(PaymentAccountKind.MoMo, "PHONG KHAM BLUEDENTAL", PhoneNumber: "0901000111"),
        new(PaymentAccountKind.MoMo, "LE THI THU HA", PhoneNumber: "0901000222"),
        new(PaymentAccountKind.Bank, "CONG TY TNHH BLUEDENTAL",
            BankName: "Vietcombank - CN Tân Định", AccountNumber: "0071000123456"),
        new(PaymentAccountKind.Bank, "CONG TY TNHH BLUEDENTAL",
            BankName: "Techcombank - CN Sài Gòn", AccountNumber: "19001234567890"),
    ];

    private static AccountSeed[] SecondBranchAccounts() =>
    [
        new(PaymentAccountKind.MoMo, "BLUEDENTAL CHI NHANH 2", PhoneNumber: "0902000333"),
        new(PaymentAccountKind.Bank, "BLUEDENTAL CHI NHANH 2",
            BankName: "ACB - CN Lê Lợi", AccountNumber: "123456789012"),
        new(PaymentAccountKind.Bank, "TRAN MINH QUAN",
            BankName: "MB Bank - CN Bến Thành", AccountNumber: "8888000099"),
    ];

    private async Task SeedPaymentAccountsAsync(Guid branchId, AccountSeed[] accounts)
    {
        foreach (var account in accounts)
        {
            var key = account.Kind == PaymentAccountKind.MoMo
                ? account.PhoneNumber
                : account.AccountNumber;
            var id = DeterministicId($"payment|{branchId}|{account.Kind}|{key}");

            if (await paymentRepository.AnyAsync(x => x.Id == id))
            {
                continue;
            }

            var entity = account.Kind == PaymentAccountKind.MoMo
                ? PaymentAccount.CreateMoMo(id, branchId, account.PhoneNumber!, account.HolderName)
                : PaymentAccount.CreateBank(
                    id, branchId, account.BankName!, account.HolderName, account.AccountNumber!);

            await paymentRepository.InsertAsync(entity, autoSave: true);
        }
    }

    /// <summary>
    /// The same key always produces the same id, so re-running the seeder tops up
    /// what is missing instead of duplicating what is already there.
    /// </summary>
    private static Guid DeterministicId(string key) =>
        new(MD5.HashData(Encoding.UTF8.GetBytes(key)));
}
