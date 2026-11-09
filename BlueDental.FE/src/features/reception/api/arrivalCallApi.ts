import dayjs from "dayjs";
import { api } from "@/lib/axios";
import type { ArrivalCall, ArrivalDoctor, ArrivalDoctorPick } from "../types/arrivalCall";
import { getArrivalPunctuality } from "../utils/arrivalPunctuality";

const BASE = "/v1/app/arrival-calls";

interface ServerArrivalCallDto {
  id: string;
  patientId: string;
  patientName: string;
  patientYearOfBirth: number | null;
  isTemporary: boolean;
  patientPhone: string | null;
  dentistId: string;
  dentistName: string | null;
  dentistLabelColor: string | null;
  slotStart: string;
  content: string | null;
  checkedInAt: string | null;
  invitedAt: string | null;
  isFlagged: boolean;
}

interface ServerArrivalDoctorDto {
  id: string;
  name: string;
  labelColor: string | null;
}

function adaptArrivalCall(dto: ServerArrivalCallDto): ArrivalCall {
  return {
    id: dto.id,
    patientId: dto.patientId,
    patientName: dto.patientName,
    patientYearOfBirth: dto.patientYearOfBirth ?? undefined,
    isTemporary: dto.isTemporary,
    patientPhone: dto.patientPhone ?? undefined,
    doctorId: dto.dentistId,
    doctorName: dto.dentistName ?? "",
    doctorLabelColor: dto.dentistLabelColor ?? null,
    checkedInAt: dto.checkedInAt ?? undefined,
    time: dayjs(dto.slotStart).format("HH:mm"),
    arrivedTime: dto.checkedInAt ? dayjs(dto.checkedInAt).format("HH:mm") : "",
    punctuality: getArrivalPunctuality(dto.slotStart, dto.checkedInAt ?? undefined),
    content: dto.content ?? "",
    invited: !!dto.invitedAt,
    isFlagged: dto.isFlagged,
  };
}

export const arrivalCallApi = {
  /** An empty pick never gets here: the panel shows "Chưa chọn bác sĩ nào" instead. */
  async getWaiting(pick: ArrivalDoctorPick): Promise<ArrivalCall[]> {
    const params = pick.all ? { all: true } : { dentistIds: pick.doctorIds };
    const res = await api.get<ServerArrivalCallDto[]>(`${BASE}/waiting`, { params });
    return res.data.map(adaptArrivalCall);
  },

  async getDoctors(): Promise<ArrivalDoctor[]> {
    const res = await api.get<ServerArrivalDoctorDto[]>(`${BASE}/doctors`);
    return res.data.map((dto) => ({ id: dto.id, name: dto.name, labelColor: dto.labelColor ?? null }));
  },

  async getInvited(): Promise<ArrivalCall[]> {
    const res = await api.get<ServerArrivalCallDto[]>(`${BASE}/invited`);
    return res.data.map(adaptArrivalCall);
  },

  async invite(id: string): Promise<void> {
    await api.post(`${BASE}/${id}/invite`);
  },

  async admit(id: string): Promise<void> {
    await api.post(`${BASE}/${id}/admit`);
  },
};
