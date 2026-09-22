/**
 * The arithmetic behind "Chuyển đổi dịch vụ".
 *
 * Read off the reference's own component on 2026-09-22 and checked against the
 * dialog it draws: with nothing picked yet the new-service block reads
 * 0 / 0 / 0 / <everything already collected> / 0.
 */
export interface ConversionMoney {
  /** Tổng tiền — the new service at its list price, for every tooth picked. */
  gross: number;
  /** Giảm giá — the gap between that and what is actually being charged. */
  discount: number;
  /** Đã thanh toán — how much of what was collected the new service absorbs. */
  paid: number;
  /** Hoàn trả chênh lệch — collected money the new service cannot absorb. */
  refund: number;
  /** Còn lại — what the patient still owes on the new service. */
  remaining: number;
}

interface Input {
  /** List price of the service being converted to. */
  unitPrice: number;
  /** One per tooth picked; a slip with no teeth still charges once. */
  quantity: number;
  /** "Thanh toán" as typed; null means charge the full price. */
  charge: number | null;
  /** What has already been collected against the line being closed. */
  oldPaid: number;
}

export function conversionMoney({ unitPrice, quantity, charge, oldPaid }: Input): ConversionMoney {
  const gross = Math.max(0, unitPrice) * Math.max(1, quantity);
  const charged = Math.min(Math.max(charge ?? gross, 0), gross);

  return {
    gross,
    discount: gross - charged,
    paid: Math.min(oldPaid, charged),
    refund: Math.max(oldPaid - charged, 0),
    remaining: Math.max(charged - oldPaid, 0),
  };
}

/**
 * The reference only asks what to do with the difference once there is a new
 * service to compare against — the dialog opens with money left over and still
 * shows no such question until a service is picked.
 */
export function asksAboutDifference(hasNewService: boolean, money: ConversionMoney): boolean {
  return hasNewService && money.refund > 0;
}
