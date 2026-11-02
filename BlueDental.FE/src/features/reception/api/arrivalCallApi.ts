import dayjs from "dayjs";
import { api } from "@/lib/axios";
import type { ArrivalCall } from "../types/arrivalCall";

const BASE = "/v1/app/arrival-calls";

interface ServerArrivalCallDto {
  id: string;
  patientId: string;
  patientName: string;
  patientYearOfBirth: number | null;
  isTemporary: boolean;
  patientPhone: string | null;
  dentistName: string | null;
  slotStart: string;
  content: string | null;
  invitedAt: string | null;
}

function adaptArrivalCall(dto: ServerArrivalCallDto): ArrivalCall {
  return {
    id: dto.id,
    patientId: dto.patientId,
    patientName: dto.patientName,
    patientYearOfBirth: dto.patientYearOfBirth ?? undefined,
    isTemporary: dto.isTemporary,
    patientPhone: dto.patientPhone ?? undefined,
    doctorName: dto.dentistName ?? "",
    time: dayjs(dto.slotStart).format("HH:mm"),
    content: dto.content ?? "",
    invited: !!dto.invitedAt,
  };
}

export const arrivalCallApi = {
  async getWaiting(): Promise<ArrivalCall[]> {
    const res = await api.get<ServerArrivalCallDto[]>(`${BASE}/waiting`);
    return res.data.map(adaptArrivalCall);
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
