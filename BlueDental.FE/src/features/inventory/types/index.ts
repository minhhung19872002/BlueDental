// TODO: Define inventory types (StockItem, Transaction).

export type TransactionType = "stock_in" | "stock_out" | "adjustment" | "expired";

export interface StockItemDto {
  id: string;
  materialId: string;
  materialName: string;
  materialCode: string;
  unit: string;
  quantity: number;
  minQuantity: number;
  unitCost: number;
  expiresAt: string | null;
}

export interface StockTransactionDto {
  id: string;
  stockItemId: string;
  type: TransactionType;
  quantity: number;
  notes: string | null;
  createdAt: string;
  createdBy: string;
}
