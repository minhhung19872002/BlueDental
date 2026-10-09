import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/axios";

/**
 * A Thẻ trả trước a patient may pay with now — active, with value and a use
 * left, owned or shared as a family member.
 *
 * Shared rather than feature-local: the prepaid-card feature owns the cards,
 * but the patient record's payment dialog has to offer them, and a feature may
 * not reach into another feature's folder.
 */
export interface PrepaidCardOption {
  id: string;
  code: string;
  name: string;
  ownerPatientId: string;
  ownerName: string | null;
  balance: number;
  maxUses: number | null;
  usedCount: number;
  remainingUses: number | null;
  serviceIds: string[];
  serviceGroupIds: string[];
}

export const prepaidCardOptionKeys = {
  all: ["prepaid-cards"] as const,
  usable: (patientId: string) => [...prepaidCardOptionKeys.all, "usable", patientId] as const,
};

/** A card as the patient record lists it — every card the patient owns or shares, whatever its state. */
export interface PatientPrepaidCard extends PrepaidCardOption {
  /** 1 Active · 2 Locked · 3 Cancelled (BlueDental.PrepaidCards.PrepaidCardStatus). */
  status: number;
  isExhausted: boolean;
  isExpired: boolean;
  expiresOn: string | null;
}

/** The patient record's "Thẻ trả trước" strip; needs prepaidCard.read, so the caller passes `enabled`. */
export function usePatientPrepaidCards(patientId: string, enabled: boolean) {
  return useQuery({
    queryKey: [...prepaidCardOptionKeys.all, "patient", patientId],
    queryFn: async () =>
      (
        await api.get<{ items: PatientPrepaidCard[] }>("/v1/app/prepaid-cards", {
          params: { PatientId: patientId, MaxResultCount: 50 },
        })
      ).data.items,
    enabled: enabled && Boolean(patientId),
  });
}

/** Fetched only once "Thẻ trả trước" is picked as the payment method. */
export function usePrepaidCardOptions(patientId: string, enabled: boolean) {
  return useQuery({
    queryKey: prepaidCardOptionKeys.usable(patientId),
    queryFn: async () =>
      (
        await api.get<{ items: PrepaidCardOption[] }>("/v1/app/prepaid-cards/usable", {
          params: { patientId },
        })
      ).data.items,
    enabled: enabled && Boolean(patientId),
  });
}
