import { useAbility } from "@/hooks/useAbility";
import { STAGE_TABS, type StageTab } from "./stageModel";

/** THÊM CÔNG ĐOẠN is treatmentStage.create; both "Tiếp tục" tabs are .continue. */
export function useStageTabs(): readonly StageTab[] {
  const stageAbility = useAbility("treatmentStage");
  return STAGE_TABS.filter((key) => (key === "add" ? stageAbility.canCreate : stageAbility.can("continue")));
}
