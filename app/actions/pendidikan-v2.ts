"use server";

import prisma from "@/lib/prisma";
import { getCurrentSession } from "@/lib/auth";
import { EducationAttendanceStatus } from "@prisma/client";
import {
  PendidikanV2Service,
} from "@/lib/server/pendidikan-v2-service";
import { EducationSessionReadDTO } from "@/lib/pendidikan-v2";

export interface GetEducationSessionsFilter {
  educationTrack?: "STUDI_UMUM" | "KEPESANTRENAN";
  date?: string;
}

export interface StartEducationSessionActionInput {
  sessionId: string;
}

export interface RecordEducationSessionMaterialActionInput {
  sessionId: string;
  materi: string;
}

export interface RecordEducationSessionAttendanceActionItem {
  santriId: string;
  status: EducationAttendanceStatus;
  note?: string;
}

export interface RecordEducationSessionAttendanceActionInput {
  sessionId: string;
  records: RecordEducationSessionAttendanceActionItem[];
}

export interface ActionResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * SERVER ACTION: Query education sessions (Server-authoritative read model)
 * Verifies authenticated identity and schema readiness, returning authoritative DTOs.
 * Never exposes sessions to unauthenticated callers.
 * Never fabricates empty [] or 0 on schema failure.
 */
export async function getEducationSessionsAction(
  filter?: GetEducationSessionsFilter
): Promise<ActionResponse<EducationSessionReadDTO[]>> {
  const session = await getCurrentSession();
  if (!session || !session.userId) {
    return {
      success: false,
      error: "UNAUTHORIZED: Sesi autentikasi Anda tidak valid atau telah berakhir. Harap login kembali.",
      message: "UNAUTHORIZED: Sesi autentikasi Anda tidak valid atau telah berakhir. Harap login kembali.",
    };
  }

  try {
    const service = new PendidikanV2Service({ db: prisma });
    const data = await service.getEducationSessions(filter, { actorUserId: session.userId });
    return { success: true, data };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: msg,
      message: msg,
    };
  }
}

/**
 * SERVER ACTION: Start Education Session ("MULAI PEMBELAJARAN")
 * Server derives authenticated identity from session cookies.
 * Client sends ONLY business target `sessionId`.
 */
export async function startEducationSessionAction(
  input: StartEducationSessionActionInput
): Promise<ActionResponse<{ sessionId: string; status: string }>> {
  const session = await getCurrentSession();
  if (!session || !session.userId) {
    return {
      success: false,
      error: "UNAUTHORIZED: Sesi login Anda tidak valid atau telah berakhir",
      message: "UNAUTHORIZED: Sesi login Anda tidak valid atau telah berakhir",
    };
  }

  if (!input?.sessionId || typeof input.sessionId !== "string") {
    return {
      success: false,
      error: "INVALID_INPUT: Parameter sessionId wajib disertakan",
      message: "INVALID_INPUT: Parameter sessionId wajib disertakan",
    };
  }

  try {
    const service = new PendidikanV2Service({ db: prisma });
    const res = await service.startEducationSession(
      { sessionId: input.sessionId },
      { actorUserId: session.userId }
    );
    return {
      success: true,
      data: {
        sessionId: res.session.id,
        status: res.session.status,
      },
      message: "Sesi pembelajaran berhasil dimulai.",
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: msg,
      message: msg,
    };
  }
}

/**
 * SERVER ACTION: Record Session Material
 * Server derives authenticated identity from session cookies.
 * Client sends ONLY business target `sessionId` and `materi`.
 */
export async function recordEducationSessionMaterialAction(
  input: RecordEducationSessionMaterialActionInput
): Promise<ActionResponse<{ sessionId: string; materi: string | null }>> {
  const session = await getCurrentSession();
  if (!session || !session.userId) {
    return {
      success: false,
      error: "UNAUTHORIZED: Sesi login Anda tidak valid atau telah berakhir",
      message: "UNAUTHORIZED: Sesi login Anda tidak valid atau telah berakhir",
    };
  }

  if (!input?.sessionId || !input?.materi?.trim()) {
    return {
      success: false,
      error: "INVALID_INPUT: Parameter sessionId dan materi wajib diisi",
      message: "INVALID_INPUT: Parameter sessionId dan materi wajib diisi",
    };
  }

  try {
    const service = new PendidikanV2Service({ db: prisma });
    const res = await service.recordSessionMaterial(
      { sessionId: input.sessionId, materi: input.materi.trim() },
      { actorUserId: session.userId }
    );
    return {
      success: true,
      data: {
        sessionId: res.session.id,
        materi: res.session.materi,
      },
      message: "Materi pembelajaran berhasil disimpan.",
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: msg,
      message: msg,
    };
  }
}

/**
 * SERVER ACTION: Record Session Attendance
 * Server derives authenticated identity from session cookies.
 * Client sends ONLY business target `sessionId` and `records`.
 */
export async function recordEducationSessionAttendanceAction(
  input: RecordEducationSessionAttendanceActionInput
): Promise<ActionResponse<{ sessionId: string; count: number }>> {
  const session = await getCurrentSession();
  if (!session || !session.userId) {
    return {
      success: false,
      error: "UNAUTHORIZED: Sesi login Anda tidak valid atau telah berakhir",
      message: "UNAUTHORIZED: Sesi login Anda tidak valid atau telah berakhir",
    };
  }

  if (!input?.sessionId || !Array.isArray(input?.records) || input.records.length === 0) {
    return {
      success: false,
      error: "INVALID_INPUT: Parameter sessionId dan daftar presensi wajib disertakan",
      message: "INVALID_INPUT: Parameter sessionId dan daftar presensi wajib disertakan",
    };
  }

  try {
    const service = new PendidikanV2Service({ db: prisma });
    const res = await service.recordSessionAttendance(
      { sessionId: input.sessionId, records: input.records },
      { actorUserId: session.userId }
    );
    return {
      success: true,
      data: {
        sessionId: input.sessionId,
        count: res.count,
      },
      message: `Presensi untuk ${res.count} santri berhasil disimpan.`,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: msg,
      message: msg,
    };
  }
}
