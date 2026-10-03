"use server";

import prisma from "@/lib/prisma";
import { JenisSurat } from "@prisma/client";

export interface GenerateSuratInput {
  jenisSurat: JenisSurat;
  perihal: string;
  tujuan: string;
  namaSantri?: string;
  nisSantri?: string;
  kelasSantri?: string;
  isiPokok: string;
}

/**
 * Server Action: Generator Surat Resmi AI (Kop Resmi Pondok, Penomoran Otomatis, Redaksi Formal)
 */
export async function generateSuratAIAction(input: GenerateSuratInput) {
  void input;
  return {
    success: false,
    message: "Fitur penerbitan surat resmi belum diaktifkan pada tahap peluncuran ini (Post-Launch Locked).",
    errorCode: "POLICY_NOT_ACTIVE",
    error: "POLICY_NOT_ACTIVE",
  };
}

/**
 * Server Action: Mengambil arsip surat resmi
 */
export async function getDaftarSuratAction() {
  try {
    const list = await prisma.suratResmi.findMany({
      orderBy: { createdAt: "desc" },
    });
    return { success: true, data: list };
  } catch (error) {
    console.error("Gagal mengambil daftar surat:", error);
    return { success: false, data: [] };
  }
}
