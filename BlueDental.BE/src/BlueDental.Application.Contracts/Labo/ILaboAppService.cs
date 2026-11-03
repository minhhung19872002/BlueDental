using System;
using System.Threading.Tasks;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;

namespace BlueDental.Labo;

/// <summary>
/// Phiếu Labo and its P2910_03 workflow: Nháp → Đã gửi Labo → Chờ kiểm tra →
/// Trả hàng / Hoàn thành → Bảo hành, with Đã hủy off the first three.
/// </summary>
public interface ILaboAppService : IApplicationService
{
    Task<PagedResultDto<LaboOrderDto>> GetListAsync(GetLaboOrderListInput input);
    Task<LaboStatsDto> GetStatsAsync(GetLaboOrderListInput input);
    Task<LaboOrderDto> GetAsync(Guid id);

    /// <summary>Lưu nháp, or Tạo phiếu Labo when <see cref="SaveLaboOrderDto.Submit"/> is set.</summary>
    Task<LaboOrderDto> CreateAsync(CreateLaboOrderDto input);

    /// <summary>
    /// Số phiếu Labo the next order would take, so "BE:LaboField:NewOrder" can open with it
    /// filled in the way the reference does.
    /// </summary>
    Task<string> GetNextOrderCodeAsync();

    /// <summary>The Đặt hàng tab saved again while the order is a Nháp.</summary>
    Task<LaboOrderDto> UpdateAsync(Guid id, UpdateLaboOrderDto input);

    /// <summary>Hủy phiếu.</summary>
    Task<LaboOrderDto> CancelAsync(Guid id);

    /// <summary>The bin on a Nháp row.</summary>
    Task DeleteAsync(Guid id);

    /// <summary>Kiểm tra hàng: Nhận hàng · lần N saved.</summary>
    Task<LaboOrderDto> ReceiveAsync(Guid id, ReceiveLaboOrderDto input);

    /// <summary>Kiểm tra từng răng + Kết luận.</summary>
    Task<LaboOrderDto> CheckAsync(Guid id, CheckLaboOrderDto input);

    /// <summary>Kích hoạt bảo hành.</summary>
    Task<LaboOrderDto> ActivateWarrantyAsync(Guid id, ActivateLaboWarrantyDto input);

    /// <summary>"BE:Common:ExportExcel" on the Labo screen.</summary>
    Task<byte[]> ExportAsync(GetLaboOrderListInput input);
}
