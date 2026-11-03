import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { WarrantyCardSide } from "@/components/WarrantyCardPhotos";
import { api } from "@/lib/axios";
import { treatmentKeys, type TreatmentServiceStatus } from "./treatmentPlanApi";

/** Mirrors BlueDental.TreatmentManagement.WarrantyCellState. */
export const WARRANTY_CELL = { None: 0, NotEligible: 1, Pending: 2, Activated: 3 } as const;
export type WarrantyCellState = (typeof WARRANTY_CELL)[keyof typeof WARRANTY_CELL];

/** Mirrors WarrantyRowGroup: Sẵn sàng kích hoạt / Đã kích hoạt / Chưa đủ điều kiện. */
export const WARRANTY_ROW_GROUP = { Ready: 1, Activated: 2, NotEligible: 3 } as const;
export type WarrantyRowGroup = (typeof WARRANTY_ROW_GROUP)[keyof typeof WARRANTY_ROW_GROUP];

/** Mirrors WarrantyCardKind. */
export const WARRANTY_CARD_KIND = { Dental: 1, Labo: 2 } as const;
export type WarrantyCardKind = (typeof WARRANTY_CARD_KIND)[keyof typeof WARRANTY_CARD_KIND];

/** Mirrors WarrantyEventSource: the chip on a history event. */
export const WARRANTY_EVENT_SOURCE = { Labo: 1, Dental: 2, Treatment: 3 } as const;
export type WarrantyEventSource = (typeof WARRANTY_EVENT_SOURCE)[keyof typeof WARRANTY_EVENT_SOURCE];

/** Mirrors WarrantyEventKind. */
export const WARRANTY_EVENT_KIND = {
  LaboPassed: 1,
  LaboReturned: 2,
  LaboActivated: 3,
  DentalActivated: 4,
  RequestOpened: 5,
  RequestDone: 6,
} as const;
export type WarrantyEventKind = (typeof WARRANTY_EVENT_KIND)[keyof typeof WARRANTY_EVENT_KIND];

/** One live line of the slip in "Tình trạng bảo hành theo dịch vụ". Mirrors WarrantyServiceRowDto. */
export interface WarrantyServiceRowDto {
  lineId: string;
  lineCode: string;
  serviceName: string;
  /** Empty for a line without teeth. */
  teeth: number[];
  dentistName?: string | null;
  laboOrderCodes: string[];
  status: TreatmentServiceStatus;
  /** `YYYY-MM-DD`, the earliest day a card may start; null until the line is finished. */
  completedOn?: string | null;
  currentStageNumber?: number | null;
  currentStageName?: string | null;
  /** A Labo piece passed QC: "Đã lắp" rather than "Hoàn thành". */
  laboFitted: boolean;
  /** Danh mục's warranty period, "Theo danh mục". */
  warrantyDays: number;
  dental: WarrantyCellState;
  dentalCardCount: number;
  /** Teeth still without a dental card; a single null on a line without teeth. */
  dentalPendingTeeth: (number | null)[];
  labo: WarrantyCellState;
  laboCardCount: number;
  /** The order "Bảo hành Labo" opens on. */
  pendingLaboOrderId?: string | null;
  group: WarrantyRowGroup;
}

export interface WarrantyCardPhotoDto {
  id: string;
  url: string;
  side: WarrantyCardSide;
}

/** One activated card, dental or Labo. Mirrors WarrantyCardRowDto. */
export interface WarrantyCardRowDto {
  code: string;
  kind: WarrantyCardKind;
  lineId: string;
  serviceName: string;
  toothNumber?: number | null;
  dentistName?: string | null;
  laboOrderId?: string | null;
  laboOrderCode?: string | null;
  supplierName?: string | null;
  /** Labo: the order's material, "{nhà cung cấp} / {vật liệu}" (REQ-F4). */
  materialName?: string | null;
  manufacturerSerial?: string | null;
  /** `YYYY-MM-DD`. */
  startDate: string;
  endDate: string;
  /** Null when the card follows the catalog's days. */
  durationMonths?: number | null;
  durationDays?: number | null;
  conditions?: string | null;
  activatedAt: string;
  photos: WarrantyCardPhotoDto[];
}

/** Mirrors WarrantyEventDto. */
export interface WarrantyEventDto {
  at: string;
  source: WarrantyEventSource;
  kind: WarrantyEventKind;
  lineId: string;
  serviceName: string;
  laboOrderCode?: string | null;
  teeth: number[];
  /** The cards the event concerns — "Lịch sử ↓" filters on them. */
  cardCodes: string[];
  stageName?: string | null;
  staffName?: string | null;
}

/** The slip's Bảo hành tab. Mirrors PlanWarrantyOverviewDto. */
export interface PlanWarrantyOverviewDto {
  /** `YYYY-MM-DD`, the clinic's day. */
  today: string;
  tabCount: number;
  pendingCount: number;
  rows: WarrantyServiceRowDto[];
  cards: WarrantyCardRowDto[];
  /** Newest first. */
  history: WarrantyEventDto[];
  openRequests: number;
  doneRequests: number;
}

/** One card of "Bảo hành dịch vụ". Mirrors ServiceWarrantyCardInputDto. */
export interface ServiceWarrantyCardInput {
  /** Null on a line without teeth. */
  toothNumber: number | null;
  /** `YYYY-MM-DD`. */
  startDate: string;
  /** Null = "Theo danh mục". */
  months: number | null;
  conditions?: string;
}

export interface ServiceWarrantyPhoto {
  /** The card's tooth; 0 for a line without teeth. */
  tooth: number;
  side: WarrantyCardSide;
  file: File;
}

export interface ActivateServiceWarrantyInput {
  planId: string;
  lineId: string;
  cards: ServiceWarrantyCardInput[];
  photos: ServiceWarrantyPhoto[];
}

const PLANS = "/v1/app/patient-treatments";

/** JSON without Ảnh thẻ; multipart with them, each card's fields under `cards[i].*`. */
function activateBody({ cards, photos }: ActivateServiceWarrantyInput) {
  if (photos.length === 0) return { cards };
  const form = new FormData();
  cards.forEach((card, i) => {
    for (const [key, value] of Object.entries(card)) {
      if (value !== null && value !== undefined) form.append(`cards[${i}].${key}`, String(value));
    }
  });
  for (const photo of photos) {
    form.append("cardPhotos", photo.file);
    form.append("cardPhotoTeeth", String(photo.tooth));
    form.append("cardPhotoSides", String(photo.side));
  }
  return form;
}

const planWarrantyApi = {
  overview: (planId: string): Promise<PlanWarrantyOverviewDto> =>
    api.get<PlanWarrantyOverviewDto>(`${PLANS}/${planId}/warranty-overview`).then((r) => r.data),

  activate: (input: ActivateServiceWarrantyInput): Promise<PlanWarrantyOverviewDto> =>
    api
      .post<PlanWarrantyOverviewDto>(`${PLANS}/${input.planId}/services/${input.lineId}/warranty`, activateBody(input))
      .then((r) => r.data),
};

/** Under the slip's own key, so every write that re-reads the slip re-reads its warranty too. */
export const planWarrantyKeys = {
  overview: (planId: string) => [...treatmentKeys.plan(planId), "warranty"] as const,
};

/**
 * The Bảo hành tab, read by the page itself: the tab's count and "k chờ"
 * badge show on every tab. Refused (no right, outside the treating scope) it
 * stays an error, so no retry.
 */
export function usePlanWarrantyOverview(planId: string) {
  return useQuery({
    queryKey: planWarrantyKeys.overview(planId),
    queryFn: () => planWarrantyApi.overview(planId),
    enabled: Boolean(planId),
    retry: false,
  });
}

/**
 * "Kích hoạt bảo hành" of "Bảo hành dịch vụ" (REQ-B5). The answer is the new
 * overview; the stage panel's TIẾP TỤC BẢO HÀNH and Hình ảnh (the card photos)
 * re-read too.
 */
export function useActivateServiceWarranty() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: planWarrantyApi.activate,
    meta: { invalidates: ["treatment", "treatmentStage"] },
    onSuccess: (overview, input) => {
      queryClient.setQueryData(planWarrantyKeys.overview(input.planId), overview);
      void queryClient.invalidateQueries({ queryKey: ["patient-images"] });
    },
  });
}
