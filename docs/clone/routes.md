# Routes — Reference Application

Source: https://app.nfcdental.com
Observed: 2026-08-21

All routes include `?branchId=<id>` query parameter for clinic branch scoping.

## Observed Routes

| Route | Label (VI) | Label (EN) | Notes |
|---|---|---|---|
| `/reception` | Tiếp nhận | Reception | Daily reception/visit tracking |
| `/patient` | Danh sách bệnh nhân | Patient List | Patient registry with financial summary |
| `/calendar` | Lịch hẹn | Appointments | Calendar view |
| `/cskh-grouping` | CSKH - Phân nhóm | Customer Care - Grouping | Customer care segmentation |
| `/labo` | Labo | Lab | Lab orders |
| `/operations` | Quản trị vận hành | Operations Management | Operations admin |
| `/report` | Báo cáo | Reports | Reporting |
| `/staff` | Nhân viên | Staff | Staff management |
| `/materials` | Vật tư | Materials/Supplies | Inventory/materials |
| `/taxonomy` | Danh mục | Categories | Category/catalog management |
| `/tools` | Công cụ | Tools | System tools |

## External Links

| Route | Label (VI) | Notes |
|---|---|---|
| `https://nfcdental.com/` | Hướng dẫn & hỗ trợ | Help & Support — external site |

## Patient Detail Route

Pattern: `/patient/:patientId?branchId=<id>`

Example observed: `/patient/6a826ca096965840407319df?branchId=6a7909122bbcbb000133e6bb`

## Branch ID

All routes carry `branchId` as a query parameter. Observed value: `6a7909122bbcbb000133e6bb` (MongoDB ObjectId format — 24 hex chars).

## Technology

The reference app uses Next.js with React Server Components (RSC). Evidence:
- `_rsc` query parameter on route prefetch requests
- `/_next/static/chunks/` JS bundle paths
- Route prefetching observed for all sidebar links on page load
