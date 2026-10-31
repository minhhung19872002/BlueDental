/** The face of a warranty card a photo shows. Mirrors BlueDental.PatientManagement.WarrantyCardSide. */
export const WARRANTY_CARD_SIDE = {
  Front: 1,
  Back: 2,
} as const;
export type WarrantyCardSide = (typeof WARRANTY_CARD_SIDE)[keyof typeof WARRANTY_CARD_SIDE];

/** Mặt trước then Mặt sau, the order the slots are drawn in. */
export const WARRANTY_CARD_SIDES: readonly WarrantyCardSide[] = [WARRANTY_CARD_SIDE.Front, WARRANTY_CARD_SIDE.Back];

export const WARRANTY_CARD_SIDE_LABEL: Record<WarrantyCardSide, string> = {
  [WARRANTY_CARD_SIDE.Front]: "Common:WarrantyCard:Front",
  [WARRANTY_CARD_SIDE.Back]: "Common:WarrantyCard:Back",
};

/** The files picked for one card, by face; a face left out has none. */
export type WarrantyCardFiles = Partial<Record<WarrantyCardSide, File>>;

/** The photos to show for one card, by face: a saved photo's content URL. */
export type WarrantyCardUrls = Partial<Record<WarrantyCardSide, string>>;
