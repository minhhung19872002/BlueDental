import { useState } from "react";
import { Button, Checkbox, Image, Input } from "antd";
import { MedicineBoxOutlined, PictureOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import { formatShortDate } from "@/utils/format";
import { toothLabels } from "@/features/treatment-management/api/consultingApi";
import type { TreatmentStageDto } from "@/features/treatment-management/api/stageApi";
import type { PatientImageDto } from "../../../api/patientImageApi";

/** One calendar day's stages, the way the reference groups its rows. */
export interface StageDay {
  key: string;
  date: string;
  stages: TreatmentStageDto[];
}

interface Props {
  days: StageDay[];
  total: number;
  /**
   * The newest công đoạn of each service line — the only one still live. The
   * reference marks every earlier one `disabled` on the row itself.
   */
  liveStageIds: Set<string>;
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
  /** Whether the row's service carries a warranty period at all. */
  warrantable: (stage: TreatmentStageDto) => boolean;
}

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
          {!editing && (
            <button
              type="button"
              aria-label={t("Sửa ghi chú")}
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
              <Button onClick={() => setDraft(null)}>{t("Hủy")}</Button>
              <Button
                type="primary"
                loading={saving}
                onClick={() => {
                  onSave(draft);
                  setDraft(null);
                }}
              >
                {t("Lưu")}
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
            {t("Bác sĩ")}: <span>{stage.staffName ?? t("(Trống)")}</span>
          </p>
          <p>
            {t("Bác sĩ hỗ trợ")}: <span>{stage.secondStaffName ?? t("(Trống)")}</span>
          </p>
        </div>
        <p>
          {t("Phụ tá")}: <span>{stage.subStaffName ?? t("(Trống)")}</span>
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
  liveStageIds,
  imagesOf,
  savingNoteFor,
  uploadingFor,
  completingId,
  onSaveNote,
  onComplete,
  onUpload,
  onCreateLabo,
  onWarranty,
  warrantable,
}: Props) {
  return (
    <div className="pd-stage-history">
      <header>
        <h4>{t("Lịch sử điều trị")}</h4>
        <span>{t("{0} công đoạn", total)}</span>
      </header>
      {days.length === 0 ? (
        <p className="pd-stage-history--empty">{t("Chưa có dữ liệu công đoạn")}</p>
      ) : (
        <div className="pd-stage-histscroll">
          <div className="pd-stage-histgrid">
            <div className="pd-stage-histhead">
              <div>{t("Ngày")}</div>
              <div>{t("Dịch vụ & răng")}</div>
              <div>{t("Ghi chú")}</div>
              <div>{t("Công đoạn")}</div>
              <div>{t("Hành động")}</div>
            </div>

            {days.map((day) => (
              <div className="pd-stage-histday" key={day.key}>
                <div className="pd-stage-histdate">
                  <b>{formatShortDate(day.date)}</b>
                  <small>{t("{0} công đoạn", day.stages.length)}</small>
                </div>
                <div>
                  {day.stages.map((stage) => {
                    const images = imagesOf(stage.id);
                    // Only the line's newest công đoạn can still be worked on;
                    // the reference greys the rest out and drops their Tạo Labo.
                    const live = liveStageIds.has(stage.id);
                    return (
                      <div
                        className={
                          live ? "pd-stage-histrow" : "pd-stage-histrow pd-stage-histrow--off"
                        }
                        aria-disabled={!live}
                        key={stage.id}
                      >
                        <div>
                          <p className="pd-stage-histservice">{stage.serviceName ?? stage.name}</p>
                          <div className="pd-stage-histteeth">
                            {toothLabels(stage.teeth).map((label) => (
                              <span key={label}>{label}</span>
                            ))}
                          </div>
                          {images.length > 0 && (
                            <div className="pd-stage-histshots">
                              <Image.PreviewGroup>
                                {images.map((image) => (
                                  <span key={image.id}>
                                    <Image src={image.url} alt={t("Ảnh điều trị")} />
                                    <em>{t("Ảnh điều trị")}</em>
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

                        <div className="pd-stage-histstage">{stage.name}</div>

                        <div className="pd-stage-rowactions">
                          <Checkbox
                            checked={stage.completedAt !== null}
                            disabled={
                              !live || stage.completedAt !== null || completingId === stage.id
                            }
                            onChange={() => onComplete(stage)}
                          >
                            {t("Hoàn thành")}
                          </Checkbox>
                          <Button
                            block
                            icon={<PictureOutlined />}
                            loading={uploadingFor === stage.id}
                            onClick={() => onUpload(stage)}
                          >
                            {t("Tải ảnh")}
                          </Button>
                          {/* A finished công đoạn swaps Tạo Labo for Bảo hành —
                              and offers neither when its service has no
                              warranty period. */}
                          {stage.completedAt !== null
                            ? warrantable(stage) && (
                                <Button
                                  block
                                  type="primary"
                                  className="pd-stage-warranty"
                                  icon={<MedicineBoxOutlined />}
                                  onClick={() => onWarranty(stage)}
                                >
                                  {t("Bảo hành")}
                                </Button>
                              )
                            : live && (
                                <Button block type="primary" onClick={() => onCreateLabo(stage)}>
                                  {t("Tạo Labo")}
                                </Button>
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
