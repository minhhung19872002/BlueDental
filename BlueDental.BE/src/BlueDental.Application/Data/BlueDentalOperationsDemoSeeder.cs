using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.CustomerCare;
using BlueDental.Finance;
using BlueDental.Inventory;
using BlueDental.Labo;
using BlueDental.Operations;
using BlueDental.Organizations;
using BlueDental.PatientManagement;
using BlueDental.Promotions;
using BlueDental.Timekeeping;
using BlueDental.TreatmentManagement;
using BlueDental.Timekeeping.Values;
using BlueDental.Tools;
using Volo.Abp.DependencyInjection;
using Volo.Abp.Domain.Repositories;

namespace BlueDental.Data;

/// <summary>
/// The operational half of the demo clinic: the screens that are not about one
/// patient's mouth — labo, vật tư, CSKH, voucher, chấm công, vận hành, công cụ
/// and thu chi.
///
/// Same rules as the clinical seeder: synthetic, deterministic, and each step
/// skipped once its own table holds rows for the branch.
/// </summary>
public class BlueDentalOperationsDemoSeeder(
    IRepository<Department, Guid> departmentRepository,
    IRepository<LaboSupplier, Guid> laboSupplierRepository,
    IRepository<LaboMaterial, Guid> laboMaterialRepository,
    IRepository<LaboOrder, Guid> laboOrderRepository,
    IRepository<InventoryItem, Guid> inventoryRepository,
    IRepository<MaterialAllocation, Guid> allocationRepository,
    IRepository<CskhGroup, Guid> cskhGroupRepository,
    IRepository<CareRecord, Guid> careRepository,
    IRepository<Voucher, Guid> voucherRepository,
    IRepository<TimeKeepingRecord, Guid> timekeepingRepository,
    IRepository<OperationCategory, Guid> operationCategoryRepository,
    IRepository<OperationArticle, Guid> operationArticleRepository,
    IRepository<OperationsArticle, Guid> operationsArticleRepository,
    IRepository<OperationsTask, Guid> operationsTaskRepository,
    IRepository<MessageTemplate, Guid> messageTemplateRepository,
    IRepository<CallAssignment, Guid> callAssignmentRepository,
    IRepository<CallLog, Guid> callLogRepository,
    IRepository<MessageLog, Guid> messageLogRepository,
    IRepository<CashflowCategory, Guid> cashflowCategoryRepository,
    IRepository<CashflowEntry, Guid> cashflowRepository,
    IRepository<SalesEntry, Guid> salesRepository) : ITransientDependency
{
    private readonly Guid _branchId = BlueDentalDataSeedContributor.DefaultBranchId;

    private static readonly string[] Departments = ["Lễ tân", "Trợ lý", "Điều trị", "Kho vật tư"];

    private static readonly (string Name, string Phone)[] LaboSuppliers =
    [
        ("Labo Nha Khoa Sài Gòn", "02838221100"),
        ("Labo Việt Đức", "02839551122"),
        ("Labo Kim Cương", "02837889900")
    ];

    private static readonly (string Name, string Category)[] LaboMaterials =
    [
        ("Sứ Zirconia", "Sứ"),
        ("Sứ Emax", "Sứ"),
        ("Kim loại Titan", "Kim loại"),
        ("Nhựa Acrylic", "Nhựa"),
        ("Sáp mẫu hàm", "Vật liệu mẫu")
    ];

    /// <summary>Stock, with three lines deliberately under their reorder level.</summary>
    private static readonly (string Code, string Name, string Category, string Unit, decimal Cost, decimal Reorder, decimal OnHand)[] Supplies =
    [
        ("VT-001", "Găng tay y tế", "Tiêu hao", "Hộp", 85_000m, 20m, 46m),
        ("VT-002", "Khẩu trang 4 lớp", "Tiêu hao", "Hộp", 65_000m, 25m, 12m),
        ("VT-003", "Kim tiêm nha khoa", "Tiêu hao", "Hộp", 120_000m, 10m, 34m),
        ("VT-004", "Thuốc tê Lidocaine", "Thuốc", "Ống", 25_000m, 40m, 18m),
        ("VT-005", "Composite trám răng", "Vật liệu", "Ống", 450_000m, 8m, 21m),
        ("VT-006", "Mũi khoan kim cương", "Dụng cụ", "Cái", 180_000m, 15m, 52m),
        ("VT-007", "Chỉ nha khoa", "Tiêu hao", "Cuộn", 35_000m, 30m, 7m),
        ("VT-008", "Bông gòn y tế", "Tiêu hao", "Gói", 40_000m, 20m, 63m),
        ("VT-009", "Nước súc miệng", "Thuốc", "Chai", 95_000m, 12m, 28m),
        ("VT-010", "Ly giấy dùng một lần", "Tiêu hao", "Lốc", 30_000m, 25m, 41m)
    ];

    private static readonly (string Name, string Criteria)[] CskhGroups =
    [
        ("Khách VIP", "Doanh số trên 50 triệu"),
        ("Khách mới trong tháng", "Hồ sơ tạo trong 30 ngày"),
        ("Đang điều trị dài hạn", "Có kế hoạch điều trị đang chạy"),
        ("Lâu chưa tái khám", "Không đến trong 6 tháng")
    ];

    private static readonly (string Code, string Name, decimal Value)[] Vouchers =
    [
        ("TET2026", "Ưu đãi Tết 2026", 500_000m),
        ("NEWCUST", "Khách hàng mới", 300_000m),
        ("IMPLANT10", "Giảm cấy ghép Implant", 2_000_000m),
        ("CLEAN50", "Lấy cao răng nửa giá", 150_000m),
        ("BIRTHDAY", "Quà sinh nhật", 200_000m)
    ];

    private static readonly (OperationsDepartment Department, string Title)[] OperationsArticles =
    [
        (OperationsDepartment.Reception, "Quy trình đón khách tại quầy"),
        (OperationsDepartment.Reception, "Xử lý khách đến trễ hẹn"),
        (OperationsDepartment.Assistant, "Chuẩn bị ghế trước ca điều trị"),
        (OperationsDepartment.Assistant, "Vô trùng dụng cụ sau ca"),
        (OperationsDepartment.Cskh, "Kịch bản gọi nhắc lịch"),
        (OperationsDepartment.Treatment, "Bàn giao ca giữa hai bác sĩ")
    ];

    private static readonly (string Name, string Content)[] MessageTemplates =
    [
        ("Nhắc lịch hẹn", "Chào {ten_khach}, phòng khám nhắc lịch hẹn của anh/chị vào {gio_hen} ngày {ngay_hen}."),
        ("Cảm ơn sau điều trị", "Cảm ơn anh/chị đã tin tưởng BlueDental. Chúc anh/chị mau hồi phục."),
        ("Chúc mừng sinh nhật", "BlueDental chúc mừng sinh nhật anh/chị, tặng voucher 200.000đ cho lần khám tới."),
        ("Nhắc tái khám", "Đã đến hẹn tái khám của anh/chị. Vui lòng liên hệ để đặt lịch.")
    ];

    private static readonly (string Name, SalesEntryType Type)[] CashflowCategories =
    [
        ("Thu từ điều trị", SalesEntryType.Income),
        ("Thu khác", SalesEntryType.Income),
        ("Lương nhân sự", SalesEntryType.Expense),
        ("Mua vật tư", SalesEntryType.Expense),
        ("Chi phí mặt bằng", SalesEntryType.Expense),
        ("Chi phí marketing", SalesEntryType.Expense)
    ];

    public async Task SeedAsync(List<Patient> patients, List<Guid> staffIds)
    {
        if (patients.Count == 0 || staffIds.Count == 0)
        {
            return;
        }

        var departmentIds = await EnsureDepartmentsAsync();
        await SeedLaboAsync(patients, staffIds);
        await SeedInventoryAsync(departmentIds);
        await SeedCustomerCareAsync(patients, staffIds);
        await SeedVouchersAsync();
        await SeedTimekeepingAsync(staffIds);
        await SeedOperationsAsync(staffIds);
        await SeedToolsAsync(patients, staffIds);
        await SeedFinanceAsync(patients, staffIds);
    }

    private static Guid DemoId(string kind, int index) =>
        BlueDentalClinicalDemoSeeder.DemoId(kind, index);

    private async Task<List<Guid>> EnsureDepartmentsAsync()
    {
        var ids = new List<Guid>();
        var missing = new List<Department>();

        for (var i = 0; i < Departments.Length; i++)
        {
            var id = DemoId("1000", i + 1);
            ids.Add(id);

            if (!await departmentRepository.AnyAsync(d => d.Id == id))
            {
                missing.Add(new Department(id, Departments[i], branchId: _branchId));
            }
        }

        if (missing.Count > 0)
        {
            await departmentRepository.InsertManyAsync(missing, autoSave: true);
        }

        return ids;
    }

    /// <summary>Suppliers, materials, and orders spread over the labo workflow.</summary>
    private async Task SeedLaboAsync(List<Patient> patients, List<Guid> staffIds)
    {
        if (await laboOrderRepository.AnyAsync(o => o.BranchId == _branchId))
        {
            return;
        }

        var suppliers = new List<LaboSupplier>();
        for (var i = 0; i < LaboSuppliers.Length; i++)
        {
            suppliers.Add(new LaboSupplier(
                DemoId("1100", i + 1),
                LaboSuppliers[i].Name,
                phone: LaboSuppliers[i].Phone,
                address: "TP.HCM"));
        }

        var materials = new List<LaboMaterial>();
        for (var i = 0; i < LaboMaterials.Length; i++)
        {
            materials.Add(new LaboMaterial(
                DemoId("1101", i + 1),
                LaboMaterials[i].Name,
                category: LaboMaterials[i].Category,
                supplierId: suppliers[i % suppliers.Count].Id));
        }

        var random = new Random(20260828);
        var today = DateOnly.FromDateTime(DateTime.Now);
        var orders = new List<LaboOrder>();

        for (var i = 0; i < 8; i++)
        {
            var order = new LaboOrder(
                DemoId("1102", i + 1),
                $"LB26-{i + 1:D4}",
                patients[i % patients.Count].Id,
                _branchId,
                LaboSuppliers[i % LaboSuppliers.Length].Name,
                random.Next(2, 30) * 500_000m,
                dentistId: staffIds[i % staffIds.Count],
                toothNumbers: (11 + i).ToString(),
                workDescription: LaboMaterials[i % LaboMaterials.Length].Name,
                dueDate: today.AddDays(random.Next(2, 21)));

            // One of each state the labo screen filters on.
            if (i % 4 >= 1)
            {
                order.Send();
            }

            if (i % 4 >= 2)
            {
                order.Receive();
            }

            if (i % 4 == 3)
            {
                order.Complete();
            }

            orders.Add(order);
        }

        await laboSupplierRepository.InsertManyAsync(suppliers, autoSave: true);
        await laboMaterialRepository.InsertManyAsync(materials, autoSave: true);
        await laboOrderRepository.InsertManyAsync(orders, autoSave: true);
    }

    /// <summary>
    /// Stock and its allocations. Three lines sit under their reorder level, so
    /// the dashboard's "Vật tư dưới định mức" card has something to warn about.
    /// </summary>
    private async Task SeedInventoryAsync(List<Guid> departmentIds)
    {
        if (await inventoryRepository.AnyAsync(i => i.BranchId == _branchId))
        {
            return;
        }

        var items = new List<InventoryItem>();

        for (var i = 0; i < Supplies.Length; i++)
        {
            var supply = Supplies[i];
            var item = new InventoryItem(
                DemoId("1200", i + 1),
                supply.Code,
                supply.Name,
                _branchId,
                supply.Reorder,
                category: supply.Category,
                unit: supply.Unit,
                unitCost: supply.Cost);

            item.AddStock(supply.OnHand);
            items.Add(item);
        }

        await inventoryRepository.InsertManyAsync(items, autoSave: true);

        var allocations = new List<MaterialAllocation>();
        for (var i = 0; i < 6; i++)
        {
            allocations.Add(new MaterialAllocation(
                DemoId("1201", i + 1),
                $"PB26-{i + 1:D4}",
                items[i % items.Count].Id,
                departmentIds[i % departmentIds.Count],
                _branchId,
                allocatedQuantity: 2 + i,
                performerName: "Kho vật tư",
                note: "Cấp phát định kỳ"));
        }

        await allocationRepository.InsertManyAsync(allocations, autoSave: true);
    }

    /// <summary>Care groups, and a care record in each state the board filters on.</summary>
    private async Task SeedCustomerCareAsync(List<Patient> patients, List<Guid> staffIds)
    {
        if (await careRepository.AnyAsync(c => c.BranchId == _branchId))
        {
            return;
        }

        var groups = new List<CskhGroup>();
        for (var i = 0; i < CskhGroups.Length; i++)
        {
            groups.Add(new CskhGroup(
                DemoId("1300", i + 1),
                CskhGroups[i].Name,
                criteria: CskhGroups[i].Criteria));
        }

        await cskhGroupRepository.InsertManyAsync(groups, autoSave: true);

        var records = new List<CareRecord>();
        for (var i = 0; i < 12; i++)
        {
            var type = (CareType)(1 + i % 4);
            var record = new CareRecord(
                DemoId("1301", i + 1),
                patients[i % patients.Count].Id,
                _branchId,
                type,
                type switch
                {
                    CareType.AfterTreatment => "Chăm sóc sau điều trị",
                    CareType.Birthday => "Chúc mừng sinh nhật",
                    CareType.AppointmentReminder => "Nhắc lịch hẹn",
                    _ => "Chăm sóc định kỳ"
                },
                assignedStaffId: staffIds[i % staffIds.Count],
                description: "Gọi điện hỏi thăm tình trạng của khách",
                dueAt: DateTimeOffset.UtcNow.AddDays(i % 7));

            if (i % 4 >= 1)
            {
                record.MarkContacted();
            }

            if (i % 4 == 2)
            {
                record.Succeed(CareOutcome.Good);
            }

            if (i % 4 == 3)
            {
                record.Fail("Khách không nghe máy");
            }

            records.Add(record);
        }

        await careRepository.InsertManyAsync(records, autoSave: true);
    }

    private async Task SeedVouchersAsync()
    {
        if (await voucherRepository.AnyAsync(v => v.ClinicBranchId == _branchId))
        {
            return;
        }

        var today = DateOnly.FromDateTime(DateTime.Now);
        var vouchers = new List<Voucher>();

        for (var i = 0; i < Vouchers.Length; i++)
        {
            var (code, name, value) = Vouchers[i];

            // The last one has already run out, so the expired filter is not empty.
            var validFrom = today.AddDays(-30);
            var validTo = i == Vouchers.Length - 1 ? today.AddDays(-1) : today.AddDays(60);

            var voucher = Voucher.Issue(
                DemoId("1400", i + 1),
                code,
                name,
                DiscountType.Money,
                value,
                validFrom,
                validTo,
                clinicBranchId: _branchId,
                minOrderAmount: value * 4,
                customerTarget: i == 1 ? VoucherCustomerTarget.New : VoucherCustomerTarget.All,
                usageLimit: 100);

            if (validTo >= today)
            {
                voucher.Activate();

                if (i == 3)
                {
                    voucher.Pause();
                }
            }
            else
            {
                voucher.Expire();
            }

            vouchers.Add(voucher);
        }

        await voucherRepository.InsertManyAsync(vouchers, autoSave: true);
    }

    /// <summary>Yesterday's finished shifts and today's, half of them checked in.</summary>
    private async Task SeedTimekeepingAsync(List<Guid> staffIds)
    {
        if (await timekeepingRepository.AnyAsync(t => t.ClinicBranchId == _branchId))
        {
            return;
        }

        var today = DateOnly.FromDateTime(DateTime.Now);
        var records = new List<TimeKeepingRecord>();
        var index = 0;

        for (var dayOffset = -3; dayOffset <= 0; dayOffset++)
        {
            var workDate = today.AddDays(dayOffset);

            for (var s = 0; s < staffIds.Count; s++)
            {
                index++;

                var morning = new WorkShift(WorkShiftKind.Morning, new TimeOnly(8, 0), new TimeOnly(12, 0));
                var afternoon = new WorkShift(WorkShiftKind.Afternoon, new TimeOnly(13, 0), new TimeOnly(17, 0));

                var record = TimeKeepingRecord.OpenDay(
                    DemoId("1500", index),
                    staffIds[s],
                    _branchId,
                    workDate,
                    morning,
                    afternoon);

                // One in five takes the day off; the rest register and work it.
                if (s % 5 == 4)
                {
                    record.RegisterDayOff("Nghỉ phép");
                    records.Add(record);
                    continue;
                }

                record.RegisterWorking();

                // Npgsql stores timestamptz and takes UTC only, so the local
                // wall clock is converted before it reaches a column.
                var dayStart = new DateTimeOffset(
                        workDate.ToDateTime(new TimeOnly(8, 0)),
                        DateTimeOffset.Now.Offset)
                    .ToUniversalTime();

                if (dayOffset < 0)
                {
                    record.CheckIn(WorkShiftKind.Morning, dayStart);
                    record.CheckOut(WorkShiftKind.Morning, dayStart.AddHours(4));
                    record.CheckIn(WorkShiftKind.Afternoon, dayStart.AddHours(5));
                    record.CheckOut(WorkShiftKind.Afternoon, dayStart.AddHours(9));
                }
                else if (s % 2 == 0)
                {
                    record.CheckIn(WorkShiftKind.Morning, dayStart);
                }

                records.Add(record);
            }
        }

        await timekeepingRepository.InsertManyAsync(records, autoSave: true);
    }

    /// <summary>The operations handbook: categories, articles and open tasks.</summary>
    private async Task SeedOperationsAsync(List<Guid> staffIds)
    {
        if (await operationsArticleRepository.AnyAsync(a => a.ClinicBranchId == _branchId))
        {
            return;
        }

        var categories = new List<OperationCategory>();
        var articles = new List<OperationArticle>();
        var drafts = new List<OperationsArticle>();
        var tasks = new List<OperationsTask>();
        var today = DateOnly.FromDateTime(DateTime.Now);

        for (var i = 0; i < OperationsArticles.Length; i++)
        {
            var (department, title) = OperationsArticles[i];
            var categoryId = DemoId("1600", i + 1);

            categories.Add(new OperationCategory(
                categoryId,
                department.ToString(),
                department.ToString(),
                "Quy trình",
                sortOrder: i));

            articles.Add(new OperationArticle(
                DemoId("1601", i + 1),
                title,
                categoryId,
                department.ToString(),
                "Quy trình",
                content: "Nội dung quy trình nội bộ (dữ liệu mẫu)."));

            drafts.Add(OperationsArticle.Draft(
                DemoId("1602", i + 1),
                _branchId,
                department,
                i % 2 == 0 ? OperationsSection.Process : OperationsSection.Home,
                title,
                summary: "Tóm tắt quy trình nội bộ",
                content: "Các bước thực hiện chi tiết (dữ liệu mẫu).",
                sortOrder: i));

            var task = OperationsTask.Create(
                DemoId("1603", i + 1),
                _branchId,
                department,
                $"Rà soát: {title}",
                description: "Kiểm tra và cập nhật quy trình cho quý này.",
                assigneeStaffId: staffIds[i % staffIds.Count],
                dueDate: today.AddDays(i * 3 - 3));

            if (i % 3 == 1)
            {
                task.Start();
            }

            if (i % 3 == 2)
            {
                task.Start();
                task.Complete();
            }

            tasks.Add(task);
        }

        await operationCategoryRepository.InsertManyAsync(categories, autoSave: true);
        await operationArticleRepository.InsertManyAsync(articles, autoSave: true);
        await operationsArticleRepository.InsertManyAsync(drafts, autoSave: true);
        await operationsTaskRepository.InsertManyAsync(tasks, autoSave: true);
    }

    /// <summary>Call lists, call history and message history for Công cụ.</summary>
    private async Task SeedToolsAsync(List<Patient> patients, List<Guid> staffIds)
    {
        if (await callLogRepository.AnyAsync(c => c.ClinicBranchId == _branchId))
        {
            return;
        }

        var templates = new List<MessageTemplate>();
        for (var i = 0; i < MessageTemplates.Length; i++)
        {
            templates.Add(new MessageTemplate(
                DemoId("1700", i + 1),
                _branchId,
                MessageTemplates[i].Name,
                MessageTemplates[i].Content,
                i % 2 == 0 ? MessageChannelType.Sms : MessageChannelType.Zalo,
                "Chăm sóc khách hàng"));
        }

        var random = new Random(20260829);
        var assignments = new List<CallAssignment>();
        var callLogs = new List<CallLog>();
        var messageLogs = new List<MessageLog>();

        for (var i = 0; i < 10; i++)
        {
            var patient = patients[i % patients.Count];
            var patientName = $"{patient.LastName} {patient.FirstName}".Trim();
            var phone = patient.Contact.PhoneNumber ?? "0900000000";

            if (i < 6)
            {
                assignments.Add(new CallAssignment(
                    DemoId("1701", i + 1),
                    _branchId,
                    patient.Id,
                    staffIds[i % staffIds.Count],
                    patientName,
                    phone,
                    "Nhắc lịch tái khám"));
            }

            callLogs.Add(new CallLog(
                DemoId("1702", i + 1),
                _branchId,
                patient.Id,
                staffIds[i % staffIds.Count],
                patientName,
                phone,
                staffName: "Lễ tân",
                durationSeconds: random.Next(0, 240),
                direction: i % 3 == 0 ? CallDirection.Inbound : CallDirection.Outbound,
                status: (CallLogStatus)(i % 3),
                notes: null));

            messageLogs.Add(new MessageLog(
                DemoId("1703", i + 1),
                _branchId,
                patient.Id,
                templates[i % templates.Count].Id,
                patientName,
                phone,
                templates[i % templates.Count].Content,
                i % 2 == 0 ? MessageChannelType.Sms : MessageChannelType.Zalo,
                i % 4 == 3 ? MessageSendStatus.Failed : MessageSendStatus.Sent,
                DateTime.Now.AddDays(-i),
                i % 4 == 3 ? "Số thuê bao không tồn tại" : null));
        }

        await messageTemplateRepository.InsertManyAsync(templates, autoSave: true);
        await callAssignmentRepository.InsertManyAsync(assignments, autoSave: true);
        await callLogRepository.InsertManyAsync(callLogs, autoSave: true);
        await messageLogRepository.InsertManyAsync(messageLogs, autoSave: true);
    }

    /// <summary>
    /// The books behind Báo cáo: a category list, a month of sales lines, and the
    /// cash movements that pay for them.
    /// </summary>
    private async Task SeedFinanceAsync(List<Patient> patients, List<Guid> staffIds)
    {
        if (await salesRepository.AnyAsync(s => s.ClinicBranchId == _branchId))
        {
            return;
        }

        var categories = new List<CashflowCategory>();
        for (var i = 0; i < CashflowCategories.Length; i++)
        {
            categories.Add(CashflowCategory.Create(
                DemoId("1800", i + 1),
                _branchId,
                CashflowCategories[i].Name,
                CashflowCategories[i].Type,
                sortOrder: i));
        }

        await cashflowCategoryRepository.InsertManyAsync(categories, autoSave: true);

        var incomeCategories = categories.Where(c => c.Type == SalesEntryType.Income).ToList();
        var expenseCategories = categories.Where(c => c.Type == SalesEntryType.Expense).ToList();

        var random = new Random(20260830);
        var today = DateOnly.FromDateTime(DateTime.Now);
        var sales = new List<SalesEntry>();
        var cashflows = new List<CashflowEntry>();
        var index = 0;

        for (var dayOffset = -29; dayOffset <= 0; dayOffset++)
        {
            var day = today.AddDays(dayOffset);
            if (day.DayOfWeek == DayOfWeek.Sunday)
            {
                continue;
            }

            // Two takings and, most days, one outgoing.
            for (var i = 0; i < 2; i++)
            {
                index++;
                var amount = random.Next(4, 40) * 500_000m;

                sales.Add(SalesEntry.Record(
                    DemoId("1801", index),
                    _branchId,
                    $"PT26-{index:D4}",
                    SalesEntryType.Income,
                    incomeCategories[index % incomeCategories.Count].Id,
                    staffIds[index % staffIds.Count],
                    amount,
                    (PaymentChannel)(1 + index % 3),
                    "Thu tiền điều trị",
                    day,
                    patientId: patients[index % patients.Count].Id));

                cashflows.Add(CashflowEntry.Deposit(
                    DemoId("1802", index),
                    _branchId,
                    index % 3 == 0 ? CashHolding.Bank : CashHolding.Cash,
                    amount,
                    staffIds[index % staffIds.Count],
                    day,
                    categoryId: incomeCategories[index % incomeCategories.Count].Id,
                    note: "Thu trong ngày"));
            }

            if (dayOffset % 3 != 0)
            {
                continue;
            }

            index++;
            var spend = random.Next(2, 20) * 500_000m;
            var expenseCategory = expenseCategories[index % expenseCategories.Count];

            sales.Add(SalesEntry.Record(
                DemoId("1801", index),
                _branchId,
                $"PC26-{index:D4}",
                SalesEntryType.Expense,
                expenseCategory.Id,
                staffIds[index % staffIds.Count],
                spend,
                PaymentChannel.Banking,
                expenseCategory.Name,
                day));

            cashflows.Add(CashflowEntry.Withdraw(
                DemoId("1802", index),
                _branchId,
                CashHolding.Bank,
                spend,
                staffIds[index % staffIds.Count],
                day,
                categoryId: expenseCategory.Id,
                note: expenseCategory.Name));
        }

        await salesRepository.InsertManyAsync(sales, autoSave: true);
        await cashflowRepository.InsertManyAsync(cashflows, autoSave: true);
    }
}
