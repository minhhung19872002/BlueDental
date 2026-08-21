# Ma trận Phân quyền — BlueDental

## Vai trò hệ thống

| # | Vai trò | Mô tả | Phạm vi dữ liệu |
|---|---------|-------|-----------------|
| 1 | SystemAdmin | Quản trị viên hệ thống | Toàn bộ hệ thống, tất cả chi nhánh |
| 2 | ClinicManager | Quản lý chi nhánh | Dữ liệu chi nhánh được phân công |
| 3 | Dentist | Nha sĩ điều trị | Bệnh nhân và lịch hẹn của mình |
| 4 | Receptionist | Lễ tân | Dữ liệu chi nhánh (không xem hồ sơ y tế) |
| 5 | BillingStaff | Nhân viên thanh toán | Hóa đơn, thanh toán chi nhánh |
| 6 | NurseAssistant | Y tá / Trợ thủ | Hỗ trợ điều trị chi nhánh |

---

## Ma trận chi tiết

### Quản trị hệ thống (Nhóm A)

| Chức năng | SystemAdmin | ClinicManager | Dentist | Receptionist | BillingStaff | NurseAssistant |
|-----------|:-----------:|:------------:|:-------:|:------------:|:------------:|:--------------:|
| Quản lý user | Full | Branch | - | - | - | - |
| Quản lý role | Full | - | - | - | - | - |
| Quản lý chi nhánh | Full | Read | - | - | - | - |
| Audit log | Full | Branch | - | - | - | - |
| Cài đặt hệ thống | Full | - | - | - | - | - |

### Danh mục (Nhóm B)

| Chức năng | SystemAdmin | ClinicManager | Dentist | Receptionist | BillingStaff | NurseAssistant |
|-----------|:-----------:|:------------:|:-------:|:------------:|:------------:|:--------------:|
| Danh mục thủ thuật | Full | Read | Read | Read | Read | Read |
| Gói bảo hiểm | Full | Read | Read | Read | Read | - |
| Danh mục thuốc | Full | Read | Read | - | - | Read |
| Vật tư nha khoa | Full | Full | Read | - | - | Read |

### Quản lý bệnh nhân (Nhóm C)

| Chức năng | SystemAdmin | ClinicManager | Dentist | Receptionist | BillingStaff | NurseAssistant |
|-----------|:-----------:|:------------:|:-------:|:------------:|:------------:|:--------------:|
| Hồ sơ bệnh nhân | Full | Branch-Full | Own | Create+Read | Read (no PHI) | Branch-Read |
| Tiền sử bệnh | Full | Branch-Read | Own | - | - | Branch-Read |
| Dị ứng | Full | Branch-Read | Own | - | - | Branch-Read |
| Sơ đồ răng | Full | Branch-Read | Own-Full | - | - | Branch-Read |

### Lịch hẹn (Nhóm C)

| Chức năng | SystemAdmin | ClinicManager | Dentist | Receptionist | BillingStaff | NurseAssistant |
|-----------|:-----------:|:------------:|:-------:|:------------:|:------------:|:--------------:|
| Xem lịch | Full | Branch | Own | Branch | - | Branch |
| Tạo lịch hẹn | Full | Branch | Own | Branch | - | - |
| Xác nhận / Hủy | Full | Branch | Own | Branch | - | - |
| Check-in | Full | Branch | - | Branch | - | Branch |

### Điều trị (Nhóm C)

| Chức năng | SystemAdmin | ClinicManager | Dentist | Receptionist | BillingStaff | NurseAssistant |
|-----------|:-----------:|:------------:|:-------:|:------------:|:------------:|:--------------:|
| Kế hoạch điều trị | Full | Branch-Read | Own-Full | Read | Read | Branch-Read |
| Hồ sơ điều trị | Full | Branch-Read | Own-Full | - | Read | Assist |
| Đơn thuốc | Full | Branch-Read | Own-Full | - | - | Branch-Read |

### Thanh toán (Nhóm D)

| Chức năng | SystemAdmin | ClinicManager | Dentist | Receptionist | BillingStaff | NurseAssistant |
|-----------|:-----------:|:------------:|:-------:|:------------:|:------------:|:--------------:|
| Hóa đơn | Full | Branch-Full | Read | Read+Issue | Full | - |
| Thanh toán | Full | Branch-Full | - | Record | Full | - |
| Yêu cầu bảo hiểm | Full | Branch-Full | Read | - | Full | - |

### Kho vật tư (Nhóm D)

| Chức năng | SystemAdmin | ClinicManager | Dentist | Receptionist | BillingStaff | NurseAssistant |
|-----------|:-----------:|:------------:|:-------:|:------------:|:------------:|:--------------:|
| Xem tồn kho | Full | Branch | Read | - | - | Branch |
| Nhập/Xuất kho | Full | Branch | - | - | - | Branch |
| Báo cáo kho | Full | Branch | - | - | - | - |

### Báo cáo & Thống kê (Nhóm E)

| Chức năng | SystemAdmin | ClinicManager | Dentist | Receptionist | BillingStaff | NurseAssistant |
|-----------|:-----------:|:------------:|:-------:|:------------:|:------------:|:--------------:|
| Dashboard tổng quan | Full | Branch | Own | Branch-limited | Branch-revenue | - |
| Báo cáo doanh thu | Full | Branch | - | - | Branch | - |
| Thống kê bệnh nhân | Full | Branch | Own | - | - | - |
| Phân tích điều trị | Full | Branch | Own | - | - | - |

---

## Ghi chú phạm vi

- **Full**: CRUD không giới hạn
- **Branch**: CRUD trong phạm vi chi nhánh được phân công
- **Branch-Full**: Full CRUD trong phạm vi chi nhánh
- **Branch-Read**: Chỉ đọc trong phạm vi chi nhánh
- **Own**: Chỉ dữ liệu của chính nha sĩ đó (bệnh nhân, lịch hẹn, điều trị)
- **Own-Full**: Full CRUD trên dữ liệu của mình
- **Read**: Chỉ đọc
- **Create+Read**: Tạo mới + đọc
- **Read+Issue**: Đọc + phát hành hóa đơn
- **Record**: Ghi nhận thanh toán
- **Assist**: Hỗ trợ (ghi chú, không tạo hồ sơ chính)
- **Read (no PHI)**: Đọc thông tin cơ bản, không xem dữ liệu y tế
- **Branch-limited**: Dashboard hạn chế (số lịch hẹn, không có doanh thu)
- **Branch-revenue**: Chỉ xem doanh thu chi nhánh
- `-`: Không có quyền
