# BlueDental

BlueDental is a clean-room implementation based on authorized,
read-only observation of an existing reference application.

## Projects

Frontend:

BlueDental.FE

Backend:

BlueDental.BE

Documentation:

docs/clone

Production reference:

https://app.nfcdental.com

## Non-negotiable rule

The production reference is STRICTLY READ ONLY.

Read and follow:

.claude/rules/00-reference-readonly.md
.claude/rules/01-production-data.md

before interacting with the reference application.

Never sacrifice production safety to obtain more information.

## Workflow

Work feature by feature.

For every feature:

1. Observe reference safely
2. Record findings
3. Separate facts from assumptions
4. Implement locally
5. Run local application
6. Compare visual result
7. Fix mismatches
8. Add automated tests
9. Record unresolved behavior

Do not silently invent behavior.

Use:

UNKNOWN_REFERENCE_BEHAVIOR

when exact behavior cannot safely be observed.

## Discovery output

Maintain:

docs/clone/routes.md
docs/clone/components.md
docs/clone/api.md
docs/clone/states.md
docs/clone/unknowns.md

Page-specific discoveries belong in:

docs/clone/pages/

## Implementation rules

Prefer reusable components.

Do not create giant page components.

Shared application chrome such as:

- sidebar
- header
- page toolbar
- buttons
- tabs
- inputs
- selectors
- empty states
- tables

must be extracted into reusable components when appropriate.

## Visual parity

Never claim visual parity based only on subjective inspection.

Compare:

REFERENCE screenshot

against

LOCAL screenshot.

Match:

- dimensions
- spacing
- typography
- borders
- border radius
- colors
- icon placement
- control heights
- alignment
- empty states
- responsive layout

## Testing

All destructive testing must occur ONLY against the local BlueDental
application or an explicitly designated non-production environment.

Never execute destructive tests against the reference system.
Hỗ trợ song ngữ Việt/Anh (i18n via ABP Localization).

---

## 2. Stack & References

### Backend
- **Framework**: .NET 9 + ABP Framework 9
- **Database**: PostgreSQL 15 + Redis 7
- **Pattern**: Clean Architecture + DDD (Aggregate Root, Value Object, Domain Events)
- **AppService**: ABP AppService pattern — KHÔNG dùng MediatR/CQRS thuần
- **Reference**: Chỉ tham khảo BE của `C:\Users\ADMIN\workspace\Free\FoodSafe\FoodSafe.BE`

### Frontend
- **Framework**: React 19 + TypeScript + Vite 8
- **UI**: Ant Design 6 (Admin dashboard)
- **Server state**: TanStack Query v5
- **Client state**: Zustand 5
- **Forms**: React Hook Form + Zod
- **Routing**: React Router DOM v7
- **Charts**: Recharts 3
- **Real-time**: @microsoft/signalr
- **i18n**: ABP Localization (Việt/Anh)
- **KHÔNG** tham khảo FE của bất kỳ dự án nào — thiết kế mới hoàn toàn

---

## 3. Ràng buộc kiến trúc Backend

### 3.1 Solution Structure
```
BlueDental.BE/
├── src/
│   ├── BlueDental.Domain.Shared/
│   ├── BlueDental.Domain/
│   │   └── Data/
│   │       ├── IBlueDentalDbSchemaMigrator.cs
│   │       └── BlueDentalDbMigrationService.cs
│   ├── BlueDental.Application.Contracts/
│   ├── BlueDental.Application/
│   ├── BlueDental.EntityFrameworkCore/
│   │   └── EntityFrameworkCore/
│   │       └── EntityFrameworkCoreBlueDentalDbSchemaMigrator.cs
│   ├── BlueDental.HttpApi/
│   ├── BlueDental.HttpApi.Host/
│   ├── BlueDental.HttpApi.Client/      ← ABP dynamic HTTP client proxy
│   └── BlueDental.DbMigrator/          ← Console app chạy EF migrations + seed
└── test/
    ├── BlueDental.TestBase/
    ├── BlueDental.Domain.Tests/
    ├── BlueDental.Application.Tests/
    ├── BlueDental.EntityFrameworkCore.Tests/
    └── BlueDental.HttpApi.Host.Tests/
```

### 3.2 Domain Modules (Bounded Contexts)
Mỗi module là một thư mục con trong Domain:
- `Organizations` — Chi nhánh phòng khám, phân công nhân viên
- `Catalogs` — Danh mục dùng chung (danh mục thủ thuật nha khoa, loại bảo hiểm, thuốc, mã ICD-10, hệ thống đánh số răng FDI)
- `PatientManagement` — Bệnh nhân, tiền sử bệnh, dị ứng, sơ đồ răng (dental chart)
- `Appointments` — Lịch hẹn, ghế/phòng, nhắc lịch
- `TreatmentManagement` — Kế hoạch điều trị, hồ sơ điều trị, đơn thuốc
- `Billing` — Hóa đơn, thanh toán, yêu cầu bảo hiểm
- `Inventory` — Vật tư nha khoa, theo dõi kho, thiết bị
- `Reporting` — Báo cáo doanh thu, thống kê bệnh nhân, phân tích điều trị
- `Notifications` — Thông báo trong app + email, nhắc lịch hẹn

### 3.3 Data Scoping — QUAN TRỌNG
- **KHÔNG** dùng ABP Multi-tenancy cho phân cấp chi nhánh
- Dùng **Organization Unit pattern**: mỗi entity có `ClinicBranchId`
- User chỉ được xem/sửa data thuộc chi nhánh mình (data filtering ở AppService layer)
- Permission check PHẢI ở server — không tin client-side

### 3.4 Appointment Workflow State Machine
Lịch hẹn có trạng thái: `Scheduled → Confirmed → CheckedIn → InProgress → Completed / Cancelled / NoShow`
- Sau khi Confirmed, chỉ cho phép Cancel với lý do
- CheckedIn chỉ xảy ra khi bệnh nhân đến phòng khám
- Implement bằng Domain Events + ABP Background Jobs

### 3.5 Treatment Plan Workflow
Kế hoạch điều trị: `Draft → Active → Completed / Cancelled`
- Draft: có thể thêm/sửa/xóa item
- Active: chỉ thêm hồ sơ điều trị, không sửa plan items
- Completed: khi tất cả items đã hoàn thành

### 3.6 Invoice Workflow
Hóa đơn: `Draft → Issued → PartiallyPaid → Paid / Overdue / Voided`
- Draft: có thể sửa line items
- Issued: không sửa, chỉ ghi nhận thanh toán
- Voided: phải có lý do, không void hóa đơn đã Paid

### 3.7 Insurance Claim Workflow
Yêu cầu bảo hiểm: `Submitted → UnderReview → Approved / Rejected`
- Rejected phải có lý do
- Approved cập nhật số tiền bảo hiểm chi trả vào Invoice

---

## 4. Ràng buộc kiến trúc Frontend

### 4.1 Folder Structure
```
BlueDental.FE/src/
├── app/              # Router, providers, global layout
├── features/         # Feature-based (mỗi bounded context = 1 folder)
│   └── [feature]/
│       ├── api/      # TanStack Query hooks
│       ├── components/
│       ├── pages/
│       ├── types/
│       └── __tests__/
├── components/       # Shared UI (DataTable, FormModal, FileUploader, DentalChart...)
├── hooks/
├── lib/              # axios instance, queryClient config, signalr
├── utils/
└── types/
```

### 4.2 Coding Rules
- Mỗi feature folder là **độc lập** — không import chéo giữa features
- Shared logic đưa vào `components/` hoặc `hooks/`
- API calls **chỉ** qua TanStack Query hooks trong `api/` folder
- **KHÔNG** dùng `any` trong TypeScript
- Form validation: Zod schema định nghĩa trước, React Hook Form dùng sau
- i18n: mọi text hiển thị phải qua hệ thống localization, không hard-code

---

## 5. Security Requirements (Bắt buộc)

- **Password policy**: tối thiểu 8 ký tự, chữ + số + ký tự đặc biệt, hết hạn 90 ngày
- **Session**: timeout hợp lý, HTTP-Only cookie, Secure flag khi HTTPS
- **CSRF**: random token cho mọi request POST/PUT/DELETE
- **Input validation**: validate ở server (BE) — FE validate chỉ để UX
- **Audit log**: ghi log tất cả thao tác quan trọng (ABP built-in)
- **Password storage**: hash + salt (ABP Identity dùng ASP.NET Core Identity — đủ)
- **XSS**: html encode output, không render raw HTML từ user input
- **CAPTCHA**: trên trang đăng nhập và các chức năng quan trọng
- **HTTPS + TLS 1.2+** bắt buộc trên production
- **PHI Protection**: dữ liệu y tế bệnh nhân (tiền sử bệnh, dị ứng, hồ sơ điều trị) là PII Level 3 — mã hóa khi truyền, giới hạn truy cập theo vai trò
- **KHÔNG** log thông tin y tế bệnh nhân (PHI) trong application logs

---

## 6. Performance Requirements

- Response time trung bình < 10 giây (luồng chính)
- Response time chậm nhất < 30 giây
- Hỗ trợ ít nhất 30 concurrent users
- CPU server ≤ 75% trung bình
- Dental chart rendering < 2 giây (SVG-based)

---

## 7. UI/UX Requirements

- Giao diện song ngữ Việt/Anh, Unicode
- Hỗ trợ chuyển đổi ngôn ngữ realtime (không reload trang)
- Tìm kiếm bệnh nhân ≤ 2 lần click
- Loading indicator thống nhất toàn hệ thống (dùng Ant Design Spin)
- Thông báo lỗi rõ ràng, phân biệt lỗi user vs lỗi hệ thống
- Required fields hiển thị dấu `*` rõ ràng
- Hỗ trợ thao tác bằng bàn phím (Tab order đúng logic)
- Responsive web — tương thích Chrome, Edge, Firefox
- Dental chart: SVG tương tác, click vào răng để cập nhật trạng thái
- Appointment calendar: hiển thị theo tuần, grid 7 cột × 48 hàng (30 phút/slot)

---

## 8. File & Document Requirements

- File đính kèm: PDF, ảnh, Excel, X-ray images (JPEG/PNG — KHÔNG xử lý DICOM trong app)
- File storage: MinIO (self-hosted S3 compatible)
- Xuất Excel: ClosedXML + MiniExcel
- Xuất PDF (đơn thuốc, hóa đơn, báo cáo): QuestPDF
- File import Excel phải validate trước khi insert
- X-ray images chỉ lưu link reference, không lưu binary trong PostgreSQL

---

## 9. External Integration

- API tích hợp với hệ thống bảo hiểm y tế (khi có)
- API cung cấp ra ngoài phải có đặc tả (module Notifications cho nhắc lịch SMS/Email)
- Lưu lịch sử mọi API call (nhận + gửi)

---

## 10. Feature Build Loop (BẮT BUỘC tuân thủ)

Mỗi feature phải đi qua đủ các bước sau, **không được bỏ qua**:

```
1. API Contract   → Define DTOs + endpoints trước (API-first)
2. BE: Domain     → Entity, ValueObject, Domain Events
3. BE: Tests      → Domain.Tests + Application.Tests (phải pass)
4. BE: AppService → Business logic + EF migrations
5. FE: Types      → DTOs mirror từ BE
6. FE: API hooks  → TanStack Query hooks + MSW mocks
7. FE: UI         → Components + Pages
8. FE: Tests      → Vitest unit + Playwright E2E
9. /simplify      → Review & cleanup code
10. /run          → Verify chạy thật trên browser
11. /security-review → Security check trước PR
```

**Quy tắc**: Bước trước chưa pass → KHÔNG chuyển sang bước tiếp theo.

---

## 11. Skills phải dùng

| Skill | Khi nào |
|---|---|
| `/typescript-clean-code` | Viết TS mới bất kỳ |
| `/boy-scout` | Sửa code cũ |
| `/simplify` | Sau khi xong 1 feature |
| `/security-review` | Trước khi feature lên staging |
| `/run` | Verify feature chạy thật |
| `/dataviz` | Build chart/dashboard |
| `/artifact-design` | Thiết kế UI component mới |

---

## 12. Docker & Deployment

- `docker-compose.yml` bắt buộc cho local dev
- Services: PostgreSQL 15, Redis 7, MinIO, ClamAV, Backend, Frontend (nginx)
- Environment: `appsettings.Development.json` cho local, không commit secrets
- Production: HTTPS bắt buộc, reverse proxy Caddy

---

## 13. Testing Requirements

### Backend
- xUnit với TestBase fixtures
- Application.Tests phải cover tất cả AppService methods
- Không mock database — dùng PostgreSQL Testcontainers hoặc test DB thật
- WebApplicationFactory cho API integration tests

### Frontend
- Vitest + Testing Library cho unit/integration
- Playwright cho E2E (happy path + edge cases)
- MSW v2 cho mock API trong tests
- Coverage tối thiểu: logic phức tạp (workflow, validation)

---

## 14. Frontend Design Patterns

### 14.1 Compound Component Pattern (Composition)

Dùng khi component có nhiều sub-parts liên quan, tránh prop drilling.

```tsx
// ĐÚNG — compound components
<AppointmentCalendar>
  <AppointmentCalendar.Toolbar>
    <AppointmentCalendar.WeekPicker />
    <AppointmentCalendar.DentistFilter />
  </AppointmentCalendar.Toolbar>
  <AppointmentCalendar.WeekGrid slots={slots} />
  <AppointmentCalendar.Legend />
</AppointmentCalendar>

// SAI — prop drilling
<AppointmentCalendar showWeekPicker showDentistFilter slots={slots} onWeekChange={...} />
```

Áp dụng cho: `AppointmentCalendar`, `DataTable`, `FormModal`, `DentalChart`, `FileUploader`.

---

### 14.2 Container / Presenter Pattern (Smart / Dumb)

Tách biệt data fetching khỏi rendering. Presenter là pure UI, không biết về API.

```tsx
// Container — biết về TanStack Query, routing, state
function PatientListContainer() {
  const { data, isLoading } = usePatientList(filters);
  const navigate = useNavigate();
  return <PatientListView data={data} loading={isLoading} onDetail={id => navigate(`/patients/${id}`)} />;
}

// Presenter — pure UI, dễ test
function PatientListView({ data, loading, onDetail }: Props) {
  return <Table dataSource={data} loading={loading} ... />;
}
```

**Rule**: Presenter không import hook, không import axios, không gọi navigate.

---

### 14.3 Custom Hook Pattern (Logic Extraction)

Mọi stateful logic phức tạp phải tách vào hook riêng.

```tsx
function useAppointmentWorkflow(appointmentId: string) {
  const confirmMutation = useConfirmAppointment();
  const cancelMutation = useCancelAppointment();
  const { data: appointment } = useAppointment(appointmentId);

  const canConfirm = appointment?.status === 'Scheduled';
  const canCancel = appointment?.status !== 'Completed' && appointment?.status !== 'Cancelled';
  const canCheckIn = appointment?.status === 'Confirmed';

  return { appointment, canConfirm, canCancel, canCheckIn, confirm: confirmMutation.mutate, cancel: cancelMutation.mutate };
}
```

**Naming rules**:
- Hook tên bắt đầu bằng `use`
- Return object `{}` (không return array, trừ `[state, setter]` pattern đơn giản)
- Hook trong `api/` folder: chỉ wrap TanStack Query
- Hook trong `hooks/` folder: logic phức tạp (workflow, form logic, permissions)

---

### 14.4 Adapter Pattern (API Response Transform)

Transform DTO từ BE → ViewModel phù hợp với UI tại `api/` layer.

```tsx
// api/patientApi.ts
function adaptPatient(dto: PatientDto): PatientViewModel {
  return {
    ...dto,
    fullName: `${dto.lastName} ${dto.firstName}`,
    age: calculateAge(dto.dateOfBirth),
    hasActiveAllergies: dto.allergies.some(a => a.isActive),
    statusLabel: PATIENT_STATUS_LABELS[dto.status],
  };
}

function usePatientList(filter: PatientFilter) {
  return useQuery({
    queryKey: ['patients', filter],
    queryFn: async () => {
      const res = await patientApi.getList(filter);
      return res.items.map(adaptPatient);
    },
  });
}
```

**Rule**: Page và component chỉ làm việc với `ViewModel`, không xử lý raw DTO.

---

### 14.5 Strategy Pattern (Conditional Rendering)

Thay thế chuỗi `if/else` hoặc `switch` bằng strategy map.

```tsx
const APPOINTMENT_STATUS_CONFIG: Record<AppointmentStatus, { color: string; label: string }> = {
  Scheduled:  { color: 'default',  label: 'Đã lên lịch' },
  Confirmed:  { color: 'blue',     label: 'Đã xác nhận' },
  CheckedIn:  { color: 'cyan',     label: 'Đã đến' },
  InProgress: { color: 'orange',   label: 'Đang khám' },
  Completed:  { color: 'green',    label: 'Hoàn thành' },
  Cancelled:  { color: 'red',      label: 'Đã hủy' },
  NoShow:     { color: 'volcano',  label: 'Vắng mặt' },
};

function AppointmentStatusBadge({ status }: { status: AppointmentStatus }) {
  const { color, label } = APPOINTMENT_STATUS_CONFIG[status];
  return <Tag color={color}>{label}</Tag>;
}
```

Áp dụng cho: status badges, action buttons, form fields theo loại entity.

---

### 14.6 Builder Pattern (Zod Schema)

Build schema phức tạp từ composable pieces, không lặp lại rules.

```tsx
const contactFields = {
  phoneNumber: z.string().min(1, 'Vui lòng nhập số điện thoại'),
  email: z.string().email('Email không hợp lệ').optional().or(z.literal('')),
};

const basePatientSchema = z.object({
  firstName: z.string().min(1, 'Tên không được trống'),
  lastName: z.string().min(1, 'Họ không được trống'),
  dateOfBirth: z.coerce.date({ required_error: 'Vui lòng chọn ngày sinh' }),
  gender: z.enum(['Male', 'Female', 'Other']),
  ...contactFields,
});

const patientWithInsuranceSchema = basePatientSchema.extend({
  insurancePlanId: z.string().min(1, 'Vui lòng chọn gói bảo hiểm'),
  insuranceNumber: z.string().min(1, 'Số bảo hiểm không được trống'),
});
```

---

### 14.7 Repository Pattern (TanStack Query hooks)

Mỗi feature có `api/` folder là "repository" — nơi duy nhất gọi API.

```
features/appointments/api/
  ├── appointmentQueries.ts   # useQuery hooks (read)
  ├── appointmentMutations.ts # useMutation hooks (write)
  ├── appointmentApi.ts       # axios calls thuần (không export ra ngoài api/)
  └── appointmentAdapters.ts  # DTO → ViewModel transforms
```

**Rule**: Component và hook KHÔNG gọi axios trực tiếp — phải qua `api/` folder.

---

## 15. Backend Design Patterns

### 15.1 Value Object Pattern

Nhóm các primitive liên quan thành Value Object — immutable, self-validating.

```csharp
// ĐÚNG
public class ToothLocation : ValueObject
{
    public int ToothNumber { get; }
    public ToothSurface Surface { get; }

    public ToothLocation(int toothNumber, ToothSurface surface)
    {
        if (toothNumber < 11 || toothNumber > 48)
            throw new BusinessException(BlueDentalErrorCodes.Patient.InvalidToothNumber);

        ToothNumber = toothNumber;
        Surface = surface;
    }

    protected override IEnumerable<object> GetAtomicValues()
        => [ToothNumber, Surface];
}

// SAI — primitive obsession
public class DentalChartRecord
{
    public int ToothNumber { get; set; }
    public int Surface { get; set; }
    ...
}
```

Các Value Object bắt buộc: `ToothLocation`, `ContactInfo`, `AppointmentSlot`, `Money` (VND), `Address`.

---

### 15.2 Guard Clause Pattern (Domain Validation)

Business rule validation thuộc Domain layer. AppService không chứa business logic.

```csharp
// ĐÚNG — Guard trong Domain entity
public class Appointment : FullAuditedAggregateRoot<Guid>
{
    public void Confirm()
    {
        if (Status != AppointmentStatus.Scheduled)
            throw new BusinessException(BlueDentalErrorCodes.Appointment.CannotConfirmNonScheduled);

        Status = AppointmentStatus.Confirmed;
        ConfirmedAt = DateTime.UtcNow;
        AddDomainEvent(new AppointmentConfirmedEvent(Id, PatientId, DentistId));
    }

    public void Cancel(string reason)
    {
        if (Status == AppointmentStatus.Completed)
            throw new BusinessException(BlueDentalErrorCodes.Appointment.CannotCancelCompleted);

        Check.NotNullOrWhiteSpace(reason, nameof(reason));
        Status = AppointmentStatus.Cancelled;
        CancellationReason = reason;
        CancelledAt = DateTime.UtcNow;
    }
}

// SAI — validation trong AppService
public async Task CancelAsync(Guid id, string reason)
{
    var appt = await _repo.GetAsync(id);
    if (appt.Status == "Completed") throw new Exception("...");  // KHÔNG
}
```

**Rule**: AppService chỉ gọi method trên Aggregate. Aggregate chứa tất cả invariants.

---

### 15.3 Static Factory Method Pattern

Tạo Aggregate Root qua factory method, không new trực tiếp.

```csharp
public class Patient : FullAuditedAggregateRoot<Guid>
{
    private Patient() { }

    public static Patient Register(
        Guid id, string mrn, string firstName, string lastName,
        DateTime dateOfBirth, Gender gender, ContactInfo contactInfo, Guid clinicBranchId)
    {
        Check.NotNullOrWhiteSpace(firstName, nameof(firstName));
        Check.NotNullOrWhiteSpace(lastName, nameof(lastName));

        if (dateOfBirth > DateTime.UtcNow)
            throw new BusinessException(BlueDentalErrorCodes.Patient.InvalidDateOfBirth);

        var patient = new Patient
        {
            Id = id, Mrn = mrn, FirstName = firstName, LastName = lastName,
            DateOfBirth = dateOfBirth, Gender = gender, ContactInfo = contactInfo,
            ClinicBranchId = clinicBranchId, Status = PatientStatus.Active,
        };
        patient.AddDomainEvent(new PatientRegisteredEvent(id, clinicBranchId));
        return patient;
    }
}
```

---

### 15.4 Specification Pattern (Complex Queries)

Tách query logic ra Specification class, tái sử dụng và combine.

```csharp
public class AppointmentsByDentistSpec : Specification<Appointment>
{
    private readonly Guid _dentistId;
    public AppointmentsByDentistSpec(Guid dentistId) => _dentistId = dentistId;

    public override Expression<Func<Appointment, bool>> ToExpression()
        => a => a.DentistId == _dentistId;
}

public class AppointmentsByDateRangeSpec : Specification<Appointment>
{
    private readonly DateTime _start;
    private readonly DateTime _end;
    public AppointmentsByDateRangeSpec(DateTime start, DateTime end)
    { _start = start; _end = end; }

    public override Expression<Func<Appointment, bool>> ToExpression()
        => a => a.StartTime >= _start && a.StartTime < _end;
}

// Combine
var spec = new AppointmentsByDentistSpec(dentistId)
    .And(new AppointmentsByDateRangeSpec(weekStart, weekEnd));
var appointments = await _repo.GetListAsync(spec);
```

---

### 15.5 Domain Service Pattern

Khi logic liên quan nhiều Aggregate và không thuộc về Aggregate cụ thể nào.

```csharp
public class AppointmentConflictChecker : IDomainService
{
    public async Task<bool> HasConflictAsync(
        IAppointmentRepository repo,
        Guid dentistId, Guid? chairId,
        DateTime startTime, DateTime endTime,
        Guid? excludeAppointmentId = null)
    {
        return await repo.HasOverlapAsync(dentistId, chairId, startTime, endTime, excludeAppointmentId);
    }
}

public class TreatmentCostCalculationService : IDomainService
{
    public decimal CalculateTotalCost(
        IReadOnlyList<TreatmentPlanItem> items,
        InsurancePlan? insurancePlan)
    {
        var subtotal = items.Sum(i => i.EstimatedCost);
        var insuranceCoverage = insurancePlan?.CoverageRate ?? 0m;
        return subtotal * (1 - insuranceCoverage);
    }
}
```

**Rule**: Domain Service là stateless, không inject Repository — nhận aggregate làm params.

---

### 15.6 Strategy Pattern (Business Rules biến đổi theo loại)

Thay switch/if-else bằng strategy được inject qua DI.

```csharp
public interface IPaymentProcessingStrategy
{
    PaymentMethod Method { get; }
    Task<PaymentResult> ProcessAsync(Invoice invoice, decimal amount);
}

public class CashPaymentStrategy : IPaymentProcessingStrategy
{
    public PaymentMethod Method => PaymentMethod.Cash;
    public Task<PaymentResult> ProcessAsync(Invoice invoice, decimal amount)
    {
        invoice.RecordPayment(amount, PaymentMethod.Cash);
        return Task.FromResult(new PaymentResult(true));
    }
}

public class InsurancePaymentStrategy : IPaymentProcessingStrategy
{
    public PaymentMethod Method => PaymentMethod.Insurance;
    public async Task<PaymentResult> ProcessAsync(Invoice invoice, decimal amount)
    {
        // validate insurance claim, record payment
    }
}
```

Áp dụng cho: xử lý thanh toán theo phương thức, tính chi phí theo loại thủ thuật, export template theo loại tài liệu.

---

### 15.7 Template Method Pattern (Base AppService)

Base class định nghĩa skeleton, subclass override bước cụ thể.

```csharp
public abstract class BaseCatalogAppService<TEntity, TDto, TKey, TCreateDto, TUpdateDto>
    : CrudAppService<TEntity, TDto, TKey, PagedAndSortedResultRequestDto, TCreateDto, TUpdateDto>
{
    protected virtual Task ValidateCreateAsync(TCreateDto input) => Task.CompletedTask;
    protected virtual Task ValidateUpdateAsync(TKey id, TUpdateDto input) => Task.CompletedTask;

    public override async Task<TDto> CreateAsync(TCreateDto input)
    {
        await ValidateCreateAsync(input);
        return await base.CreateAsync(input);
    }
}

public class DentalProcedureAppService
    : BaseCatalogAppService<DentalProcedure, DentalProcedureDto, Guid, CreateDentalProcedureDto, UpdateDentalProcedureDto>
{
    protected override async Task ValidateCreateAsync(CreateDentalProcedureDto input)
    {
        if (await _repo.AnyAsync(p => p.Code == input.Code))
            throw new BusinessException(BlueDentalErrorCodes.Catalog.DuplicateCode);
    }
}
```

---

### 15.8 Repository Extension Pattern (Custom Queries)

Extend IRepository với method riêng cho complex queries — không viết SQL trong AppService.

```csharp
public interface IAppointmentRepository : IRepository<Appointment, Guid>
{
    Task<List<Appointment>> GetCalendarViewAsync(Guid clinicBranchId, DateTime weekStart, DateTime weekEnd);
    Task<bool> HasOverlapAsync(Guid dentistId, Guid? chairId, DateTime start, DateTime end, Guid? excludeId = null);
    Task<int> GetTodayCountAsync(Guid clinicBranchId);
}

public class AppointmentRepository : EfCoreRepository<BlueDentalDbContext, Appointment, Guid>, IAppointmentRepository
{
    public async Task<List<Appointment>> GetCalendarViewAsync(Guid branchId, DateTime start, DateTime end)
    {
        return await DbSet
            .Include(a => a.Patient)
            .Include(a => a.Dentist)
            .Where(a => a.ClinicBranchId == branchId)
            .Where(a => a.StartTime >= start && a.StartTime < end)
            .Where(a => a.Status != AppointmentStatus.Cancelled)
            .OrderBy(a => a.StartTime)
            .ToListAsync();
    }
}
```

---

## 16. Không được làm

- KHÔNG commit secrets, credentials, connection strings vào git
- KHÔNG dùng `any` trong TypeScript
- KHÔNG bỏ qua bước test trong feature loop
- KHÔNG dùng ABP Multi-tenancy cho phân cấp chi nhánh
- KHÔNG deploy production khi chưa có `/security-review`
- KHÔNG mock chức năng — mọi feature phải chạy thật với DB thật
- KHÔNG lưu file DICOM binary trong PostgreSQL
- KHÔNG log thông tin y tế bệnh nhân (PHI) trong application logs
- KHÔNG hard-code text hiển thị — phải qua hệ thống i18n


# Testing Strategy — Mandatory

BlueDental uses feature-level verification, real integration testing, and impact-based retesting.

## Core testing path

Acceptance testing must verify the real application path:

React frontend
→ real HTTP request
→ ASP.NET Core API
→ authentication and authorization
→ application layer
→ Entity Framework Core
→ real PostgreSQL database
→ real HTTP response
→ rendered frontend result

A passing unit test, mocked API test, isolated component test, or intercepted Playwright test is not sufficient evidence that a feature works.

## Default test types

The default backend test is:

- real API integration test
- actual ASP.NET Core request pipeline
- actual authentication and authorization
- actual dependency injection
- actual application services
- actual EF Core mappings
- disposable real PostgreSQL database
- real migrations
- real HTTP requests

The default frontend acceptance test is:

- real React application
- real ASP.NET Core backend
- real authentication
- real PostgreSQL database
- real persistence
- Playwright browser testing without BlueDental API interception

Do not create new unit-test suites unless explicitly requested.

Do not create new mocked frontend tests unless explicitly requested.

Existing unit or mocked tests may remain, but they must not be used as runtime acceptance evidence.

## Prohibited in real frontend acceptance tests

Do not use:

- `page.route()`
- `route.fulfill()`
- `route.abort()`
- BlueDental API interception
- MSW for BlueDental business APIs
- `vi.mock()` for BlueDental API clients
- fake API responses
- manually injected access tokens
- manually injected refresh tokens
- fake localStorage authentication
- fake permissions
- fake clinic branch context
- hard-coded successful business responses

A browser test using any of the above must not be classified as real full-stack acceptance testing.

## Backend API test requirements

Backend tests must verify applicable items through real HTTP endpoints:

- HTTP status
- response contract
- database persistence
- validation
- functional permission
- clinic branch scope
- workflow transition
- duplicate prevention
- audit or history side effects
- concurrency behavior
- follow-up retrieval using a separate request

Do not mock:

- DbContext
- repositories
- application services
- authorization handlers
- current-user context
- clinic-branch-scope resolver
- internal BlueDental business APIs

Use PostgreSQL Testcontainers or a disposable PostgreSQL test database.

Do not use EF Core InMemory as acceptance evidence.

## Frontend acceptance requirements

Frontend acceptance tests should normally:

1. Start or connect to the real database.
2. Apply real migrations.
3. Seed deterministic test accounts and reference data.
4. Start the real backend.
5. Start the real frontend.
6. Open the real frontend URL.
7. Log in through the real login screen.
8. Navigate through real routes.
9. Perform real user actions.
10. Verify real backend responses through visible UI behavior.
11. Reload the browser.
12. Verify persisted data.
13. Verify applicable authorization-denied behavior.

Frontend tests must verify meaningful behavior, not only that a heading or component renders.

## Feature verification registry

Maintain:

- `docs/testing/00-test-policy.md`
- `docs/testing/01-feature-verification-registry.md`
- `docs/testing/02-impact-map.md`
- `docs/testing/03-regression-log.md`
- `docs/testing/features/<feature>.md`

Allowed feature statuses:

- `NOT_STARTED`
- `IN_PROGRESS`
- `READY_FOR_TEST`
- `FAILED`
- `VERIFIED`
- `DIRTY`
- `BLOCKED`

Only `VERIFIED` means the feature passed real runtime acceptance.

## Impact-based retesting levels

### Level 0 — No retest

Use only for: documentation-only changes, comments, formatting, text corrections that cannot affect behavior.

### Level 1 — Visual smoke retest

Use for: CSS, spacing, typography, icons, design tokens, layout changes without business behavior changes.

### Level 2 — Full feature runtime retest

Use for changes inside one feature: feature frontend code, feature API contract, feature backend service, feature validation, feature database mapping, feature workflow.

### Level 3 — Dependent feature regression

Use when changing shared dependencies: authentication, authorization, clinic branch scope, API client, shared components, DbContext, global exception handling.

### Level 4 — Full regression

Run only for: release candidate, final acceptance, major architecture changes, authentication redesign.

## Completion reporting

Before claiming a feature is complete, report:

- Feature ID
- Current status
- Verified commit
- Backend API test result
- Frontend real-browser test result
- Database persistence result
- Permission result
- Clinic-branch-isolation result
- Workflow result
- Retest level used
- Affected features
- Remaining blockers

Never describe mocked tests as runtime verification.
