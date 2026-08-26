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
.claude/rules/02-clone-methodology.md

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
- **UI & Styling**: Ant Design 6 + `src/styles/index.css` (class thủ công, token `--bd-*` đồng bộ với `src/theme/index.ts`). **KHÔNG dùng Tailwind** — đã gỡ khỏi dự án, xem commit `73755ce`.
- **Server state**: TanStack Query v5
- **Client state**: Zustand 5
- **Forms**: React Hook Form + Zod
- **Routing**: React Router DOM v7
- **Charts**: Recharts 3
- **Real-time**: @microsoft/signalr
- **i18n**: ABP Localization (Việt/Anh)

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

## 16. Frontend Clean Code Rules (Senior-Level)

### 16.1 Component Size & Responsibility

Mỗi component file tối đa **150 dòng** (không tính import/type). Nếu vượt quá:
- Tách sub-components ra file riêng trong cùng folder
- Tách logic ra custom hook
- Tách render sections ra compound components

```tsx
// SAI — God component 400+ dòng
function AppointmentPage() {
  // 50 dòng state + hooks
  // 100 dòng handlers
  // 250 dòng JSX với nested conditions
}

// ĐÚNG — Container mỏng + tách rời
function AppointmentPage() {
  const workflow = useAppointmentWorkflow();
  return (
    <PageLayout title={t("Lịch hẹn")}>
      <AppointmentToolbar filters={workflow.filters} />
      <AppointmentCalendar data={workflow.appointments} />
      <AppointmentDetailDrawer selected={workflow.selected} />
    </PageLayout>
  );
}
```

---

### 16.2 Hoist Static Data ra Module Scope

Config maps, label records, style maps mà **không phụ thuộc props/state** PHẢI đặt ngoài component body. Nếu phụ thuộc `t()` (i18n), dùng factory function hoặc `useMemo`.

```tsx
// SAI — tạo lại mỗi render
function StatusBadge({ status }: Props) {
  const colors = {
    Scheduled: 'bg-blue-100 text-blue-700',
    Completed: 'bg-green-100 text-green-700',
  };
  return <span className={colors[status]}>{status}</span>;
}

// ĐÚNG — module-level constant
const STATUS_STYLES: Record<AppointmentStatus, string> = {
  Scheduled: 'bg-blue-100 text-blue-700',
  Completed: 'bg-green-100 text-green-700',
} as const;

function StatusBadge({ status }: Props) {
  return <span className={STATUS_STYLES[status]}>{status}</span>;
}

// ĐÚNG — i18n-dependent thì dùng hook
function useStatusLabels() {
  const t = useT();
  return useMemo(() => ({
    Scheduled: t('Đã lên lịch'),
    Completed: t('Hoàn thành'),
  }), [t]);
}
```

---

### 16.3 Không Dùng Inline Style Objects

Dùng class trong `src/styles/index.css` thay vì `style={{}}`. Khi cần dynamic value, truyền qua CSS custom property.

```tsx
// SAI
<div style={{ backgroundColor: color, borderRadius: 8, padding: '12px 16px' }}>

// ĐÚNG — class + custom property cho phần động
<div className="status-card" style={{ "--status-color": color } as React.CSSProperties}>
```

```css
/* index.css — màu lấy từ token, không hard-code hex trong tsx */
.status-card {
  padding: 12px 16px;
  border-radius: var(--bd-radius-card);
  background: var(--status-color, var(--bd-bg-soft));
}
```

**Ngoại lệ duy nhất**: dynamic CSS không thể biểu diễn bằng class (animation transforms, canvas positions). Khi đó dùng CSS custom property, không inline trực tiếp.

---

### 16.4 Props Interface Rules

- **Discriminated unions** cho component có nhiều variant, không boolean flags
- Tối đa **7 props** cho leaf component, **10 props** cho container
- Nếu nhiều hơn → tách thành compound component hoặc gom vào config object

```tsx
// SAI — boolean flag hell
interface ButtonProps {
  isPrimary?: boolean;
  isSecondary?: boolean;
  isDanger?: boolean;
  isLoading?: boolean;
  isDisabled?: boolean;
  isOutline?: boolean;
  isGhost?: boolean;
}

// ĐÚNG — discriminated union + minimal flags
interface ButtonProps {
  variant: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
}
```

---

### 16.5 Event Handler Naming Convention

- Handler props: `onAction` (ví dụ `onClick`, `onSubmit`, `onPatientSelect`)
- Handler implementations: `handleAction` (ví dụ `handleClick`, `handleSubmit`)
- **Không** dùng anonymous arrow trong JSX cho logic phức tạp (> 1 expression)

```tsx
// SAI
<Button onClick={() => {
  setLoading(true);
  api.delete(id).then(() => { refetch(); toast.success('Đã xóa'); });
}}>

// ĐÚNG
const handleDelete = useCallback(async () => {
  setLoading(true);
  await api.delete(id);
  refetch();
  toast.success(t('Đã xóa'));
}, [id, refetch, t]);

<Button onClick={handleDelete}>
```

---

### 16.6 Conditional Rendering Patterns

Dùng early return thay vì nested ternary. Tách branch phức tạp ra component riêng.

```tsx
// SAI — nested ternary hell
return (
  <div>
    {isLoading ? <Spinner /> : error ? <ErrorView error={error} /> :
      data?.length === 0 ? <EmptyState /> : <DataTable data={data} />}
  </div>
);

// ĐÚNG — early return + clear flow
if (isLoading) return <Spinner />;
if (error) return <ErrorView error={error} />;
if (!data?.length) return <EmptyState message={t('Không có dữ liệu')} />;
return <DataTable data={data} />;
```

---

### 16.7 Custom Hook Rules (Nâng cao)

**Single Responsibility**: 1 hook = 1 concern. Không tạo hook "thần" (god hook) chứa tất cả logic của page.

```tsx
// SAI — god hook
function usePatientPage() {
  // fetching + filtering + sorting + pagination + modal state + form logic + permissions
  return { /* 30 fields */ };
}

// ĐÚNG — composable hooks
function usePatientFilters() { /* filter state + handlers */ }
function usePatientList(filters: PatientFilter) { /* TanStack Query */ }
function usePatientFormModal() { /* modal open/close + form state */ }

// Container compose chúng
function PatientPage() {
  const filters = usePatientFilters();
  const { data, isLoading } = usePatientList(filters.current);
  const modal = usePatientFormModal();
  // ...
}
```

**Return type rules**:
- Trả về `{}` object (có tên rõ ràng), **không** trả về array/tuple trừ `[value, setter]` đơn giản
- Mỗi field trong return phải có tên tự giải thích — không `data1`, `handler2`

---

### 16.8 Error Boundary & Error Handling

- Mỗi route-level page PHẢI được wrap bởi `ErrorBoundary`
- API errors hiển thị qua TanStack Query `isError` + component `ErrorView`
- **Không** swallow error bằng empty catch

```tsx
// ĐÚNG — Route level error boundary
<Route
  path="/appointments"
  element={
    <ErrorBoundary fallback={<ErrorFallback />}>
      <AppointmentPage />
    </ErrorBoundary>
  }
/>

// ĐÚNG — Query error handling
function PatientList() {
  const { data, isLoading, error } = usePatientList(filters);
  if (error) return <ErrorView error={error} onRetry={refetch} />;
  // ...
}

// SAI — swallow silently
try { await api.delete(id); } catch (e) { /* nothing */ }

// ĐÚNG — handle or propagate
try {
  await api.delete(id);
} catch (e) {
  toast.error(extractApiError(e, t('Không thể xóa')));
}
```

---

### 16.9 Performance Patterns

**Memoization rules** — chỉ dùng khi thật sự cần:

```tsx
// KHÔNG cần memo — primitive props, light component
<StatusBadge status={appointment.status} />

// CẦN useMemo — expensive computation
const chartData = useMemo(
  () => buildDentalChartData(treatments, toothStatuses),
  [treatments, toothStatuses]
);

// CẦN useCallback — handler truyền vào memoized child hoặc dependency array
const handleSelect = useCallback((id: string) => {
  setSelectedId(id);
}, []);

// CẦN React.memo — list item render nhiều lần
const AppointmentCard = React.memo(function AppointmentCard({ appointment, onSelect }: Props) {
  // ...
});
```

**Virtualization**: List > 50 items PHẢI dùng virtualized rendering (`@tanstack/react-virtual`).

**Code splitting**: Mỗi route-level page phải lazy load:
```tsx
const AppointmentPage = lazy(() => import('@/features/appointments/pages/AppointmentPage'));
```

---

### 16.10 Import Order & File Organization

```tsx
// 1. React / framework
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

// 2. Third-party libraries
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

// 3. Shared components / hooks / utils (@ alias)
import { DataTable } from '@/components/DataTable';
import { useDebounce } from '@/hooks/useDebounce';

// 4. Feature-local imports (relative)
import { usePatientList } from '../api/patientQueries';
import { PatientCard } from './PatientCard';
import type { PatientViewModel } from '../types';
```

**File naming**:
- Components: `PascalCase.tsx` (ví dụ `PatientCard.tsx`)
- Hooks: `camelCase.ts` bắt đầu `use` (ví dụ `usePatientList.ts`)
- Utils/helpers: `camelCase.ts` (ví dụ `formatCurrency.ts`)
- Types: `camelCase.ts` hoặc đặt trong `types/index.ts` của feature
- Constants: `SCREAMING_SNAKE_CASE` cho values, `camelCase.ts` cho files

---

### 16.11 Type Safety Rules

```tsx
// SAI — loose typing
function handleResponse(data: any) { ... }
const config = {} as Record<string, any>;
type Props = { data: object };

// ĐÚNG — explicit types
function handleResponse(data: PatientDto) { ... }
const config: AppConfig = { theme: 'light', locale: 'vi' };
type Props = { data: PatientViewModel };

// SAI — type assertion để bypass
const patient = response as unknown as Patient;

// ĐÚNG — runtime validation ở boundary
const patient = patientSchema.parse(response);
```

**Rules**:
- KHÔNG dùng `any` — dùng `unknown` + type guard nếu type không rõ
- KHÔNG dùng `as` type assertion trừ khi chứng minh được type safety (ví dụ CSS custom properties)
- Prefer `interface` cho component props, `type` cho unions/intersections
- Generic khi cần reuse: `DataTable<T>`, `FormModal<TValues>`
- Discriminated union cho state machines:

```tsx
type QueryState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; error: Error }
  | { status: 'success'; data: T };
```

---

### 16.12 Composition Over Configuration

Ưu tiên React composition (children, render props) hơn config objects hoặc prop flags.

```tsx
// SAI — config-driven, rigid
<DataTable
  showSearch
  showPagination
  showExport
  searchPlaceholder="Tìm kiếm..."
  exportFormat="xlsx"
  columns={columns}
  data={data}
/>

// ĐÚNG — composable, flexible
<DataTable data={data} columns={columns}>
  <DataTable.Toolbar>
    <DataTable.Search placeholder={t('Tìm kiếm...')} />
    <DataTable.Export format="xlsx" />
  </DataTable.Toolbar>
  <DataTable.Pagination />
</DataTable>
```

---

### 16.13 Dependency Direction (Import Rules)

```
pages/ → components/ → (nothing feature-local)
pages/ → api/hooks
pages/ → hooks/

components/ ← KHÔNG import từ pages/
api/ ← KHÔNG import từ components/ hoặc pages/
hooks/ ← có thể import từ api/ nhưng KHÔNG import từ components/
```

- **Feature folders KHÔNG import chéo** — nếu 2 features cần share, move lên `src/components/` hoặc `src/hooks/`
- **Adapter functions (api/) KHÔNG import runtime singletons** — nhận dependency qua params

```tsx
// SAI — adapter coupled to singleton
import { DEFAULT_BRANCH_ID } from '@/lib/clinicBranch';
function adaptAppointment(dto: AppointmentDto) {
  return { ...dto, branchId: dto.branchId ?? DEFAULT_BRANCH_ID };
}

// ĐÚNG — pure function, dependency injected
function adaptAppointment(dto: AppointmentDto, fallbackBranchId: string) {
  return { ...dto, branchId: dto.branchId ?? fallbackBranchId };
}
```

---

### 16.14 Zustand Store Rules

- 1 store = 1 concern (auth store, UI store, branch store). **Không** gom tất cả vào 1 global store
- Store chỉ chứa **client-side state** — server state thuộc về TanStack Query
- Selector phải narrow — select đúng field cần, không select toàn bộ store

```tsx
// SAI — re-render toàn bộ khi bất kỳ field nào thay đổi
const store = useAuthStore();
const { user, token, permissions, clinicBranch } = store;

// ĐÚNG — narrow selector, chỉ re-render khi field thay đổi
const user = useAuthStore((s) => s.user);
const clinicBranchId = useAuthStore((s) => s.clinicBranchId);
```

- **Không** lưu derived state trong store — derive trong component hoặc hook:

```tsx
// SAI
const useAuthStore = create((set) => ({
  user: null,
  isAdmin: false, // derived từ user.role
  setUser: (user) => set({ user, isAdmin: user.role === 'admin' }),
}));

// ĐÚNG
const isAdmin = useAuthStore((s) => s.user?.role === 'admin');
```

---

### 16.15 Form Pattern Standards

- Zod schema là source of truth cho validation
- Schema định nghĩa trong file riêng hoặc cùng type file, **không** inline trong component
- `defaultValues` PHẢI match Zod schema — dùng `z.infer<typeof schema>` cho type

```tsx
// Schema file
const patientFormSchema = z.object({
  firstName: z.string().min(1, 'Tên không được trống'),
  lastName: z.string().min(1, 'Họ không được trống'),
  phone: z.string().regex(/^0\d{9}$/, 'Số điện thoại không hợp lệ'),
  email: z.string().email('Email không hợp lệ').optional().or(z.literal('')),
});

type PatientFormValues = z.infer<typeof patientFormSchema>;

// Component
function PatientForm({ onSubmit, initialData }: Props) {
  const form = useForm<PatientFormValues>({
    resolver: zodResolver(patientFormSchema),
    defaultValues: initialData ?? { firstName: '', lastName: '', phone: '', email: '' },
  });
  // ...
}
```

---

### 16.16 CSS Rules

- **Không** mix inline styles với class trong cùng 1 component — chọn một
- Màu, bán kính, khoảng cách lấy từ token `--bd-*`; **không** hard-code hex trong `.tsx`
- Conditional class: nối chuỗi template hoặc mảng `.filter(Boolean).join(" ")`
- Responsive: media query breakpoint 1280 / 1100 / 640
- Animations: CSS keyframes, **không** inline `transition` style objects

#### CSS File Scoping

- `src/styles/index.css` chỉ chứa **global styles**: tokens, reset, layout shell (sidebar, header), AntD overrides, và shared utility classes (`.reception-card`, `.page-header`, `.stat-card`, ...).
- **KHÔNG** thêm feature-specific CSS vào `index.css`. Mỗi feature tạo CSS file riêng trong folder `components/` của feature đó.
- Feature CSS file đặt tên theo feature: `voucher.css`, `appointment.css`, `patient.css`, ...
- Import CSS file từ page component (Container): `import "../components/voucher.css";`

```
features/voucher/components/voucher.css      ← feature-specific styles
features/appointments/components/appointment.css
features/patients/components/patient.css
src/styles/index.css                          ← global only
```

- Tất cả feature CSS vẫn dùng token `--bd-*` từ `:root` trong `index.css`.
- Khi refactor feature cũ: di chuyển CSS block từ `index.css` sang feature CSS file tương ứng.

```tsx
// ĐÚNG — class cơ sở + modifier, ghép tường minh
<div className={["stat-card", isActive && "stat-card--active", isError && "stat-card--error"]
  .filter(Boolean).join(" ")}>

// SAI — dựng style bằng hex ngay trong tsx
<div style={{ border: `1px solid ${isError ? "#ef4d4d" : "#e2e8f0"}` }}>
```

---

### 16.17 Testing Component Contracts

Khi viết component tests (Vitest + Testing Library), test **behavior** không test **implementation**.

```tsx
// SAI — test implementation details
expect(wrapper.find('.internal-class')).toHaveLength(1);
expect(component.state.isOpen).toBe(true);

// ĐÚNG — test user behavior
await user.click(screen.getByRole('button', { name: /xác nhận/i }));
expect(screen.getByText(/đã xác nhận/i)).toBeInTheDocument();
expect(onConfirm).toHaveBeenCalledWith(appointmentId);
```

**Query priority** (Testing Library): `getByRole` > `getByLabelText` > `getByText` > `getByTestId`. Chỉ dùng `data-testid` khi không có accessible selector nào khác.

---

### 16.18 Button Loading & Disabled State

Mọi button gọi API (submit form, delete, confirm) PHẢI:
- **Disabled** khi đang gọi API — tránh user click nhiều lần
- **Loading indicator** — hiển thị spinner (Loader2 animate-spin) thay icon mặc định khi đang loading
- Toast thông báo chỉ hiện **sau khi** API trả về kết quả, không hiện trước

```tsx
// ĐÚNG
<Button onClick={handleSubmit} disabled={loading}>
  {loading ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <Save className="mr-1.5 size-4" />}
  {t("Lưu")}
</Button>

// SAI — không disable, không loading
<Button onClick={handleSubmit}>
  <Save className="mr-1.5 size-4" />
  {t("Lưu")}
</Button>
```

Áp dụng cho: form submit, delete confirm, status change, và mọi action button gọi API.

---

### 16.19 Input tiền tệ — CurrencyInput (react-number-format)

Mọi field nhập **số tiền** (và số lớn cần phân cách hàng nghìn như số lượt voucher)
PHẢI dùng component chung `CurrencyInput` (`src/components/CurrencyInput.tsx`) —
wrapper của `react-number-format` (`NumericFormat` + `customInput` là AntD `Input`),
format kiểu VN: `1.000.000` (phân cách `.`, thập phân `,`, không số âm, không lẻ).

```tsx
// ĐÚNG — form giữ number, hiển thị đã format
<Form.Item name="amount" rules={[{ type: "number", min: 1, message: t("Số tiền phải lớn hơn 0") }]}>
  <CurrencyInput />
</Form.Item>

// SAI — InputNumber + formatter/parser tự chế cho field tiền mới
<InputNumber formatter={(v) => ...} parser={(v) => ...} />
```

Quy tắc:

- KHÔNG bọc `NumericFormat` quanh `InputNumber` — hai bên tranh nhau format. Chỉ dùng qua `CurrencyInput`.
- `CurrencyInput` không clamp min/max như `InputNumber` → ràng buộc phải khai báo bằng
  Form rules (`{ type: "number", min: 1 }`), và cũng mất nút step lên/xuống.
- Field rỗng trả về `undefined` (không phải `0`) — submit path phải xử lý (`?? null` / `?? 0`).
- **Ngoại lệ giữ `InputNumber`**: field cần suffix/format riêng đã chốt
  (`PaymentModal` ở Billing dùng `formatVND` — GIỮ NGUYÊN, không đổi qua `CurrencyInput`),
  field số nhỏ cần nút step (số lượng, số ngày, reorder level, batch count),
  và toàn bộ màn Danh mục `/taxonomy` (mục 17 — không đụng).

---

## 17. Màn hình đã chốt — ĐỪNG dựng lại

### Danh mục (`/taxonomy`) — HOÀN THIỆN

Màn hình này đã clone xong 1:1 theo bản gốc, đã chạy thật và đã được nghiệm thu.
**Không dựng lại, không "vibe code" đè lên nó.**

Phạm vi đã hoàn thiện — cả 11 tab:

| Tab | Route |
|---|---|
| Dịch vụ, Chẩn đoán, Loại thuốc, Dữ liệu tư vấn | `/taxonomy/service`, `/diagnosis`, `/medicine`, `/consulting` |
| Nguồn đến, Lịch sử bệnh, Nghề nghiệp | `/taxonomy/source`, `/history`, `/occupation` |
| Đơn thuốc mẫu, Bệnh án mẫu | `/taxonomy/prescription-template`, `/medical-record-template` |
| Thẻ hồ sơ, Phương thức thanh toán | `/taxonomy/tags`, `/payment-method` |

Những thứ đã dựng và đã có test bảo vệ:

- Panel nhóm: tìm kiếm **bằng API** (không lọc trên giao diện), kéo-thả sắp xếp
  đổi chỗ ngay khi kéo qua, lưu bằng **một** endpoint `reorder` duy nhất.
- Bảng mục: kéo-thả tương tự, phân trang, cột theo từng danh mục.
- **Mỗi danh mục một dialog riêng** (bản gốc làm vậy, không dùng chung một form):
  `ServiceDialog`, `MedicineDialog`, `RichCatalogDialog`, `PrescriptionTemplateDialog`,
  `MedicalRecordTemplateDialog`, `SimpleCatalogDialog`.
- Tờ A4 bệnh án mẫu: 3 trang, 17 ô nhập, dựng theo đúng bản in của bản gốc.
- Xoá mềm: cặp "Đang hoạt động" / "Đã xoá" là **một** trạng thái; dòng đã xoá vẫn
  nằm trong bảng, chỉ mất nút xoá, và lấy lại được.
- Ảnh QR cho phương thức thanh toán (upload thật lên MinIO).
- Phân quyền theo chi nhánh, có test cách ly chi nhánh.

Trước khi sửa bất cứ thứ gì trong `BlueDental.FE/src/features/taxonomy/`:

1. Đọc `docs/clone/pages/taxonomy.md` và `docs/testing/03-regression-log.md`
   (mục R-42 → R-91) — phần lớn "lỗi" nhìn thấy đã từng được đo và xử lý rồi,
   sửa lại theo cảm tính là làm hỏng.
2. Chạy `e2e/taxonomy*.spec.ts`, `payment-qr`, `branch-*` **trên bản build
   production** (`vite preview`, cổng 8080) — dev server bật StrictMode nên mount
   hai lần, gây đỏ giả.
3. Sửa xong phải xanh lại đủ 38 test đó.

Nếu bản gốc đổi, cập nhật màn hình này theo quy trình clone bình thường — nhưng
đừng viết lại từ đầu.

## 18. Không được làm

- KHÔNG commit secrets, credentials, connection strings vào git
- KHÔNG dùng `any` trong TypeScript
- KHÔNG bỏ qua bước test trong feature loop
- KHÔNG dùng ABP Multi-tenancy cho phân cấp chi nhánh
- KHÔNG deploy production khi chưa có `/security-review`
- KHÔNG mock chức năng — mọi feature phải chạy thật với DB thật
- KHÔNG lưu file DICOM binary trong PostgreSQL
- KHÔNG log thông tin y tế bệnh nhân (PHI) trong application logs
- KHÔNG hard-code text hiển thị — phải qua hệ thống i18n
- KHÔNG dựng lại màn hình Danh mục (`/taxonomy`) — xem mục 17


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
