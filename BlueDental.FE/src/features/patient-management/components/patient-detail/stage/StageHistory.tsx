import { useState } from "react";
import { Button, Checkbox, Image, Input } from "antd";
import { PictureOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import { formatShortDate } from "@/utils/format";
import type { TreatmentStageDto } from "@/features/treatment-management/api/stageApi";
import type { PatientImageDto } from "../../../api/patientImageApi";
import { StageWarrantyButton } from "./StageWarrantyButton";
import {
  namedSteps,
  type HistoryTooth,
  type HistoryToothState,
  type WarrantyState,
} from "./stageModel";

/** One calendar day's stages, the way the reference groups its rows. */
export interface StageDay {
  key: string;
  date: string;
  stages: TreatmentStageDto[];
}

interface Props {
  days: StageDay[];
  total: number;
  imagesOf: (stageId: string) => PatientImageDto[];
  savingNoteFor: string | null;
  uploadingFor: string | null;
  completingId: string | null;
  onSaveNote: (stage: TreatmentStageDto, note: string) => void;
  onComplete: (stage: TreatmentStageDto) => void;
  onUpload: (stage: TreatmentStageDto) => void;
  onCreateLabo: (stage: TreatmentStageDto) => void;
  /** Bảo hành, offered in place of Tạo Labo once a công đoạn is finished. */
  onWarranty: (stage: TreatmentStageDto) => void;
  /** Which of the reference's warranty controls a finished row shows. */
  warrantyOf: (stage: TreatmentStageDto) => WarrantyState;
  /** Every tooth of the row's service, each marked worked, done or neither. */
  historyTeethOf: (stage: TreatmentStageDto) => HistoryTooth[];
}

const TOOTH_CLASS: Record<HistoryToothState, string | undefined> = {
  idle: undefined,
  worked: "pd-stage-histtooth--worked",
  done: "pd-stage-histtooth--done",
};

/** The pencil that swaps a stage's note for an editor, in place. */
function NoteCell({
  stage,
  saving,
  onSave,
}: {
  stage: TreatmentStageDto;
  saving: boolean;
  onSave: (note: string) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const editing = draft !== null;

  return (
    <div>
      <div className="pd-stage-noteblock">
        <div className="pd-stage-notebar">
          {/* The reference drops the pencil on a continued công đoạn. */}
          {!editing && !stage.isSuperseded && (
            <button
              type="button"
              aria-label={t("Patient:Misc:EditNote")}
              onClick={() => setDraft(stage.note ?? "")}
            >
              {/* lucide-pencil, the reference's own glyph */}
              <svg
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />
                <path d="m15 5 4 4" />
              </svg>
            </button>
          )}
        </div>

        {editing ? (
          <div className="pd-stage-noteedit">
            <Input.TextArea
              rows={4}
              value={draft}
              maxLength={1000}
              onChange={(event) => setDraft(event.target.value)}
            />
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
          <p className="pd-stage-note">{stage.note ?? ""}</p>
        )}
      </div>

      <div className="pd-stage-notemeta">
        <div>
          <p>
            {t("Patient:Staff:Doctor")}: <span>{stage.staffName ?? t("Patient:QuoteSheet:Empty")}</span>
          </p>
          <p>
            {t("Patient:Staff:AssistingDoctor")}: <span>{stage.secondStaffName ?? t("Patient:QuoteSheet:Empty")}</span>
          </p>
        </div>
        <p>
          {t("Patient:Staff:Assistant")}: <span>{stage.subStaffName ?? t("Patient:QuoteSheet:Empty")}</span>
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
  uploadingFor,
  completingId,
  onSaveNote,
  onComplete,
  onUpload,
  onCreateLabo,
  onWarranty,
  warrantyOf,
  historyTeethOf,
}: Props) {
  return (
    <div className="pd-stage-history">
      <header>
        <h4>{t("Patient:Tab:TreatmentHistory")}</h4>
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
                    const images = imagesOf(stage.id);
                    // A công đoạn continued by a later one is history: the
                    // reference greys it out and drops its Tạo Labo. Several
                    // chains can run on one line, each with its own live row.
                    const live = !stage.isSuperseded;
                    const done = stage.completedAt !== null;
                    return (
                      <div
                        className={
                          live ? "pd-stage-histrow" : "pd-stage-histrow pd-stage-histrow--off"
                        }
                        aria-disabled={!live}
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
                          <p className="pd-stage-histservice">{stage.serviceName ?? stage.name}</p>
                          {/* Tooth numbers only: the reference prints no
                              surfaces on a công đoạn. Every tooth of the
                              service is listed and this visit's ones are
                              blue, so the day's work reads at a glance; a
                              công đoạn written with no teeth stood for them
                              all. A finished tooth is green from the row
                              that finished it on — see historyTeeth. */}
                          <div className="pd-stage-histteeth">
                            {historyTeethOf(stage).map(({ tooth, state }) => (
                              <span
                                key={tooth.toothCode}
                                className={TOOTH_CLASS[state]}
                                data-state={state}
                              >
                                {tooth.toothCode}
                              </span>
                            ))}
                          </div>
                          {images.length > 0 && (
                            <div className="pd-stage-histshots">
                              <Image.PreviewGroup>
                                {images.map((image) => (
                                  <span key={image.id}>
                                    <Image src={image.url} alt={t("Patient:Photo:Treatment")} />
                                    <em>{t("Patient:Photo:Treatment")}</em>
                                  </span>
                                ))}
                              </Image.PreviewGroup>
                            </div>
                          )}
                        </div>

                        <NoteCell
                          stage={stage}
                          saving={savingNoteFor === stage.id}
                          onSave={(note) => onSaveNote(stage, note)}
                        />

                        {/* Công đoạn — the service steps this công đoạn covers,
                            listed as plain text: they are chosen on the form,
                            not ticked off here. */}
                        <ul className="pd-stage-histstage">
                          {namedSteps(stage.serviceItems).map((step) => (
                            <li key={step.id}>{step.name}</li>
                          ))}
                        </ul>

                        <div className="pd-stage-rowactions">
                          {/* Turns both ways: the reference keeps a
                              `revert-status` beside its `status`, so un-ticking
                              re-opens the công đoạn. Only an earlier công đoạn
                              of the line, or one mid-request, is locked. */}
                          <Checkbox
                            checked={done}
                            disabled={!live || completingId === stage.id}
                            onChange={() => onComplete(stage)}
                          >
                            {t("Patient:Misc:Done")}
                          </Checkbox>
                          <Button
                            block
                            icon={<PictureOutlined />}
                            disabled={!live}
                            loading={uploadingFor === stage.id}
                            onClick={() => onUpload(stage)}
                          >
                            {t("Patient:Photo:Upload")}
                          </Button>
                          {/* A finished công đoạn swaps Tạo Labo for Bảo hành;
                              a continued one offers neither. */}
                          {done ? (
                            <StageWarrantyButton
                              state={warrantyOf(stage)}
                              onClick={() => onWarranty(stage)}
                            />
                          ) : (
                            live && (
                              <Button block type="primary" onClick={() => onCreateLabo(stage)}>
                                {t("Patient:Labo:Create")}
                              </Button>
                            )
                          )}
                        </div>
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
