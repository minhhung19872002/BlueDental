import type { StepState, StepTrackItem } from "@/components/StepTrack";
import { t } from "@/lib/i18n";
import { STATION_STAGE, type StationStage } from "../api/signingStationApi";

/** The iPad's four steps (P2610 mock). "Xác nhận thông tin" completes the first two. */
const STEP_KEYS = [
  "SigningStation:Step:Review",
  "SigningStation:Step:Consent",
  "SigningStation:Step:Sign",
  "SigningStation:Step:Done",
] as const;

/** How many steps each screen has completed; the next one is the current. */
const DONE_BY_STAGE: Record<StationStage, number> = {
  [STATION_STAGE.Idle]: 0,
  [STATION_STAGE.Review]: 0,
  [STATION_STAGE.Signing]: 2,
  [STATION_STAGE.Signed]: 3,
  [STATION_STAGE.Issued]: 4,
  // The printed screen shows no bar; listed so every stage has a count.
  [STATION_STAGE.Printed]: 4,
};

export function stationSteps(stage: StationStage): StepTrackItem[] {
  const done = DONE_BY_STAGE[stage];
  return STEP_KEYS.map((key, index) => {
    let state: StepState = "todo";
    if (index < done) state = "done";
    else if (index === done) state = "current";
    return { key, label: t(key), state };
  });
}
