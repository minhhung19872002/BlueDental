import { useCallback, useMemo, useState } from "react";
import { MAY_LINK_TO_MINOR, PATIENT_RELATION, type PatientRelationType } from "@/utils/patientRelation";
import {
  GUARDIAN_RELATION,
  type GuardianRelationCode,
  type PhoneGuardian,
  type PhoneOwner,
  type SharedPhoneLink,
} from "../types/patient";

/** The "Là …" a guardian's role suggests when the hồ sơ is made from them (P2710_02). */
const RELATION_FROM_GUARDIAN: Record<GuardianRelationCode, PatientRelationType> = {
  [GUARDIAN_RELATION.Father]: PATIENT_RELATION.Parent,
  [GUARDIAN_RELATION.Mother]: PATIENT_RELATION.Parent,
  [GUARDIAN_RELATION.Grandfather]: PATIENT_RELATION.Grandparent,
  [GUARDIAN_RELATION.Grandmother]: PATIENT_RELATION.Grandparent,
  [GUARDIAN_RELATION.Sibling]: PATIENT_RELATION.Sibling,
  [GUARDIAN_RELATION.AuntUncle]: PATIENT_RELATION.OtherGuardian,
  [GUARDIAN_RELATION.LegalGuardian]: PATIENT_RELATION.OtherGuardian,
  [GUARDIAN_RELATION.Other]: PATIENT_RELATION.OtherGuardian,
};

/**
 * Who "của …" may name: holders over 18 (or of unknown age), anyone for the
 * relations that answer for a child, and everyone when nobody qualifies —
 * the same rule the server applies (PatientSharedPhoneRule.EligibleAnchors).
 */
export function eligibleAnchors(
  owners: readonly PhoneOwner[],
  relation: PatientRelationType | undefined,
): readonly PhoneOwner[] {
  if (relation !== undefined && MAY_LINK_TO_MINOR.has(relation)) return owners;
  const adults = owners.filter((owner) => owner.isAdult);
  return adults.length > 0 ? adults : owners;
}

/**
 * "Liên kết người dùng chung SĐT": what the hồ sơ being saved is to one already
 * on the number. Required whenever the number has a hồ sơ; "của …" falls back
 * to the record the dialog was opened for, then the Chủ số, then the first
 * eligible holder, so a pick that a relation change rules out is not kept.
 */
export function useSharedPhoneLink(owners: readonly PhoneOwner[], preferredAnchorId?: string) {
  const [relation, setRelationState] = useState<PatientRelationType>();
  const [pickedAnchorId, setPickedAnchorId] = useState<string>();
  const [error, setError] = useState<string | null>(null);

  const anchors = useMemo(() => eligibleAnchors(owners, relation), [owners, relation]);
  const anchor =
    anchors.find((owner) => owner.id === pickedAnchorId) ??
    anchors.find((owner) => owner.id === preferredAnchorId) ??
    anchors.find((owner) => owner.isPhoneOwner) ??
    anchors[0];

  const required = owners.length > 0;
  const link: SharedPhoneLink | null =
    required && relation !== undefined && anchor ? { relation, anchorPatientId: anchor.id } : null;

  const setRelation = useCallback((next: PatientRelationType | undefined) => {
    setRelationState(next);
    setError(null);
  }, []);

  const setAnchorId = useCallback((next: string) => {
    setPickedAnchorId(next);
    setError(null);
  }, []);

  const reset = useCallback(() => {
    setRelationState(undefined);
    setPickedAnchorId(undefined);
    setError(null);
  }, []);

  /** A guardian picked from the dropdown: "Bố/Mẹ của An" when An may stand on the "của …" side. */
  const suggestFromGuardian = useCallback(
    (guardian: PhoneGuardian) => {
      const suggested = RELATION_FROM_GUARDIAN[guardian.relation];
      const candidates = eligibleAnchors(owners, suggested);
      const ward = guardian.wards.find((w) => candidates.some((owner) => owner.id === w.patientId));
      if (!ward) return;
      setRelation(suggested);
      setAnchorId(ward.patientId);
    },
    [owners, setRelation, setAnchorId],
  );

  return {
    required,
    relation,
    anchor,
    anchors,
    link,
    ready: !required || link !== null,
    error,
    setError,
    setRelation,
    setAnchorId,
    reset,
    suggestFromGuardian,
  };
}

export type SharedPhoneLinkState = ReturnType<typeof useSharedPhoneLink>;
