import { useState, type Ref } from "react";
import { Button } from "antd";
import { HistoryOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import { formatShortDate } from "@/utils/format";
import type { TreatmentStageDto } from "@/features/treatment-management/api/stageApi";
import type { PatientImageDto } from "../../../api/patientImageApi";
import { StageEditPencil } from "./StageEditPencil";
import { NOTE_LIMIT } from "./StageForm";
import { StageHistoryShots } from "./StageHistoryShots";
import { StageHistoryTeeth } from "./StageHistoryTeeth";
import { StageLaboChip } from "./StageLaboParts";
import { StageNoteBullets } from "./StageNoteBullets";
import { StageNoteInput } from "./StageNoteInput";
import { StageRemarkCell } from "./StageRemarkCell";
import { StageRowActions, type StageHistoryLeaves, type StageRowHandlers } from "./StageRowActions";
import { namedSteps, type HistoryTooth, type WarrantyState } from "./stageModel";

/** One calendar day's stages, the way the reference groups its rows. */
export interface StageDay {
  key: string;
  date: string;
  stages: TreatmentStageDto[];
}

export type { StageHistoryLeaves } from "./StageRowActions";

interface Props extends StageRowHandlers {
  days: StageDay[];
  total: number;
  imagesOf: (stageId: string) => PatientImageDto[];
  savingNoteFor: string | null;
  savingRemarkFor: string | null;
  uploadingFor: string | null;
  completingId: string | null;
  /** Which leaves of Công đoạn (and Labo) the user holds; a missing one hides its control. */
  can: StageHistoryLeaves;
  onSaveNote: (stage: TreatmentStageDto, note: string) => void;
  /** Ghi chú; resolves true once the server took it. */
  onSaveRemark: (stage: TreatmentStageDto, remark: string) => Promise<boolean>;
  /** The red × on a công đoạn picture: asks before it goes. */
  onDeleteImage: (image: PatientImageDto) => void;
  /** Which of the reference's warranty controls a finished row shows. */
  warrantyOf: (stage: TreatmentStageDto) => WarrantyState;
  /** Every tooth of the row's service, each marked worked, done or neither. */
  historyTeethOf: (stage: TreatmentStageDto) => HistoryTooth[];
  /** The patient's Labo tab, behind "+n phiếu trước · Xem tất cả ›". */
  laboListHref: string;
  /** "Lịch sử chỉnh sửa" of the whole slip; shown with can.delete. */
  onOpenChangeLog: () => void;
  /** The slip page watches the block to show its "back to top" button. */
  ref?: Ref<HTMLDivElement>;
}

/** The pencil that swaps a stage's note for an editor, in place. */
function NoteCell({
  stage,
  saving,
  editable,
  onSave,
}: {
  stage: TreatmentStageDto;
  saving: boolean;
  editable: boolean;
  onSave: (note: string) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const editing = draft !== null;

  return (
    <div>
      <div className="pd-stage-noteblock">
        <div className="pd-stage-notebar">
          {/* Open on every row, finished or continued, every edit logged (BA
              2026-11-02); the reference drops the pencil on a continued one. */}
          {editable && !editing && (
            <StageEditPencil
              label={t("Patient:Misc:EditNote")}
              onClick={() => setDraft(stage.note ?? "")}
            />
          )}
        </div>

        {editing ? (
          <div className="pd-stage-noteedit">
            <StageNoteInput rows={4} value={draft} maxLength={NOTE_LIMIT} onChange={setDraft} />
            <div>
              <Button onClick={() => setDraft(null)}>{t("Patient:Misc:Cancel")}</Button>
              <Button
                type="primary"
                loading={saving}
                onClick={() => {
                  onSave(draft);
                  setDraft(null);
                }}
              >
                {t("Patient:Misc:Save")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="pd-stage-note">
            <StageNoteBullets note={stage.note} />
          </div>
        )}
      </div>

      <div className="pd-stage-notemeta">
        <div>
          <p>
            {t("Patient:Staff:Doctor")}:{" "}
            <span>{stage.staffName ?? t("Patient:QuoteSheet:Empty")}</span>
          </p>
          <p>
            {t("Patient:Staff:AssistingDoctor")}:{" "}
            <span>{stage.secondStaffName ?? t("Patient:QuoteSheet:Empty")}</span>
          </p>
        </div>
        <p>
          {t("Patient:Staff:Assistant")}:{" "}
          <span>{stage.subStaffName ?? t("Patient:QuoteSheet:Empty")}</span>
        </p>
      </div>
    </div>
  );
}

/**
 * "LỊCH SỬ ĐIỀU TRỊ" — every công đoạn on the slip, grouped by the day it was
 * worked. The date cell spans its day's rows, which is why the row is a grid
 * inside a grid rather than one flat table.
 */
export function StageHistory({
  days,
  total,
  imagesOf,
  savingNoteFor,
  savingRemarkFor,
  uploadingFor,
  completingId,
  can,
  onSaveNote,
  onSaveRemark,
  onDeleteImage,
  onComplete,
  onUpload,
  onCreateLabo,
  onOpenLabo,
  onWarranty,
  onDelete,
  onOpenChangeLog,
  warrantyOf,
  historyTeethOf,
  laboListHref,
  ref,
}: Props) {
  const handlers: StageRowHandlers = {
    onComplete,
    onUpload,
    onCreateLabo,
    onOpenLabo,
    onWarranty,
    onDelete,
  };
  return (
    <div className="pd-stage-history" ref={ref}>
      <header>
        <h4>{t("Patient:Tab:TreatmentHistory")}</h4>
        {can.delete && (
          <Button className="stage-log-open" icon={<HistoryOutlined />} onClick={onOpenChangeLog}>
            {t("Patient:StageLog:Title")}
          </Button>
        )}
        <span>{t("Patient:Stage:StageCount", total)}</span>
      </header>
      {days.length === 0 ? (
        <p className="pd-stage-history--empty">{t("Patient:Stage:Empty")}</p>
      ) : (
        <div className="pd-stage-histscroll">
          <div className="pd-stage-histgrid">
            <div className="pd-stage-histhead">
              <div>{t("Patient:Misc:Date")}</div>
              <div>{t("Patient:Plan:ServiceAndTooth")}</div>
              <div>{t("Patient:Stage:TreatmentContent")}</div>
              <div>{t("Patient:Stage:Remark")}</div>
              <div>{t("Patient:Stage:Title")}</div>
              <div>{t("Patient:Misc:Actions")}</div>
            </div>

            {days.map((day) => (
              <div className="pd-stage-histday" key={day.key}>
                <div className="pd-stage-histdate">
                  <b>{formatShortDate(day.date)}</b>
                  <small>{t("Patient:Stage:StageCount", day.stages.length)}</small>
                </div>
                <div>
                  {day.stages.map((stage) => {
                    // A công đoạn continued by a later one is history: its
                    // controls lock one by one and Tạo Labo goes. The reference
                    // also fades the row; the owner dropped that (2026-10-29),
                    // and data-superseded marks it, as aria-disabled would
                    // announce its jaw button and pictures as disabled too.
                    // Several chains can run on one line, each with a live row.
                    const live = !stage.isSuperseded;
                    const serviceName = stage.serviceName ?? stage.name;
                    const { labo } = stage;
                    return (
                      <div
                        className="pd-stage-histrow"
                        data-superseded={!live}
                        /*
                         * A slip can hold several service lines, each with its
                         * own live công đoạn, so a row has to say which line it
                         * belongs to — the treatment table is addressed the
                         * same way through its data-row-key.
                         */
                        data-line-id={stage.treatmentServiceId}
                        data-stage-id={stage.id}
                        key={stage.id}
                      >
                        <div>
                          <p className="pd-stage-histservice">{serviceName}</p>
                          <StageHistoryTeeth teeth={historyTeethOf(stage)} serviceName={serviceName} />
                          {labo && (
                            <StageLaboChip
                              labo={labo}
                              onView={can.laboRead ? () => onOpenLabo(labo.orderId) : undefined}
                            />
                          )}
                          <StageHistoryShots
                            images={imagesOf(stage.id)}
                            canDelete={can.imageDelete}
                            onDelete={onDeleteImage}
                          />
                        </div>

                        <NoteCell
                          stage={stage}
                          saving={savingNoteFor === stage.id}
                          editable={can.update}
                          onSave={(note) => onSaveNote(stage, note)}
                        />

                        <StageRemarkCell
                          stage={stage}
                          saving={savingRemarkFor === stage.id}
                          editable={can.update}
                          onSave={(remark) => onSaveRemark(stage, remark)}
                        />

                        {/* Công đoạn — the service steps this công đoạn covers,
                            listed as plain text: they are chosen on the form,
                            not ticked off here. */}
                        <div className="pd-stage-histstage">
                          <ul>
                            {namedSteps(stage.serviceItems).map((step) => (
                              <li key={step.id}>{step.name}</li>
                            ))}
                          </ul>
                        </div>

                        <StageRowActions
                          stage={stage}
                          can={can}
                          completing={completingId === stage.id}
                          uploading={uploadingFor === stage.id}
                          warranty={warrantyOf(stage)}
                          handlers={handlers}
                          laboListHref={laboListHref}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
