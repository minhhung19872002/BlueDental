import { StageForm, type StageFormActions, type StageFormHandlers } from "./StageForm";
import { StageWarrantyForm } from "./StageWarrantyForm";
import type { StageItem } from "./stageModel";
import type { StageComposer } from "./useStageComposer";

interface Props {
  item: StageItem;
  composer: StageComposer;
  actions?: StageFormActions;
}

/** The form of one picked card: TIẾP TỤC BẢO HÀNH has its own (REQ-F1). */
export function StageItemForm({ item, composer, actions }: Props) {
  const draft = composer.draftOf(item);
  const errors = composer.errorsOf(item);
  const handlers: StageFormHandlers = {
    onChange: (patch) => composer.patchDraft(item, patch),
    onPickSteps: (stepIds) => composer.pickSteps(item, stepIds),
    onPickImages: () => composer.pickForForm(item),
  };

  if (item.tab !== "continueWarranty") {
    return <StageForm item={item} draft={draft} errors={errors} handlers={handlers} actions={actions} />;
  }

  const { covers } = composer;
  return (
    <StageWarrantyForm
      item={item}
      draft={draft}
      errors={errors}
      handlers={handlers}
      actions={actions}
      warranty={{
        cover: covers.coverOf(item.line.id),
        row: covers.rowOf(item.line.id),
        offered: covers.offeredTeeth(item, draft),
        onPick: (kind, laboOrderId) => composer.pickWarranty(item, kind, laboOrderId),
      }}
    />
  );
}
