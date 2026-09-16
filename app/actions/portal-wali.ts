'use server';

import prisma from '@/lib/prisma';
import { getSession, requireRole, recordAuditLog } from '@/lib/auth';

export interface PortalWaliResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

/**
 * Mengambil ringkasan lengkap data anak untuk Wali Santri (WS) atau Santri Mandiri (ST)
 */
export async function getRingkasanAnakAction(santriIdInput?: string): Promise<PortalWaliResponse> {
  try {
    const session = await getSession();
    if (!session) {
      return { success: false, message: 'Silakan login terlebih dahulu.' };
    }

    // Tentukan ID santri sesuai hak akses ABAC
    let targetSantriId: string | undefined = santriIdInput;

    if (session.role === 'WS' || session.role === 'ST') {
      if (!session.santriId) {
        return {
          success: false,
          message: 'Akun Anda belum terhubung dengan data santri terdaftar. Silakan hubungi bagian Administrasi/TU.',
        };
      }
      // Paksa targetSantriId selalu sama dengan session.santriId, abaikan santriIdInput
      targetSantriId = session.santriId;
    } else if (['KS', 'ADM', 'YAY'].includes(session.role)) {
      // Role manajerial lintas-domain (KS, ADM, YAY)
      if (!targetSantriId) {
        return {
          success: false,
          message: 'ID Santri wajib disertakan untuk melihat ringkasan.',
        };
      }
    } else if (session.role === 'MT' || session.role === 'PH') {
      // Pembina Tahfidz: Wajib terhubung profil staf dan dibatasi ketat ke halaqoh binaan sendiri.
      // Catatan: isKepalaBidangTahfidz BUKAN manajer kesehatan/pelanggaran umum, tetap dibatasi ke binaan.
      if (!session.staffId) {
        return {
          success: false,
          message: 'Profil staf pembina Anda belum terhubung. Silakan hubungi Admin.',
        };
      }
      if (!targetSantriId) {
        return {
          success: false,
          message: 'ID Santri wajib disertakan untuk melihat ringkasan.',
        };
      }
      const isBinaan = await prisma.halaqoh.findFirst({
        where: {
          pembinaId: session.staffId,
          santriList: { some: { id: targetSantriId } },
        },
      });
      if (!isBinaan) {
        return {
          success: false,
          message: 'Akses Ditolak: Anda hanya berwenang melihat data santri di dalam halaqoh binaan Anda.',
        };
      }
    } else {
      // Default Deny untuk seluruh role lain (MK, GMR, dll)
      return {
        success: false,
        message: 'Akses Ditolak: Anda tidak memiliki wewenang mengakses ringkasan santri ini.',
      };
    }

    const santri = await prisma.santri.findUnique({
      where: { id: targetSantriId },
      include: {
        halaqoh: { include: { pembina: true } },
        setoranList: { where: { status: { not: 'DIBATALKAN' } }, take: 10, orderBy: { createdAt: 'desc' } },
        ikhtibarList: { orderBy: { createdAt: 'desc' } },
        nilaiList: { include: { mapel: true }, take: 10 },
        bintangList: { orderBy: { createdAt: 'desc' } },
        pelanggaranList: { include: { kategori: true }, orderBy: { createdAt: 'desc' } },
        kesehatanList: { orderBy: { createdAt: 'desc' }, take: 5 },
        perizinanList: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
    });

    if (!santri) {
      return { success: false, message: 'Data santri tidak ditemukan.' };
    }

    const totalPoinPelanggaran = santri.pelanggaranList.reduce((acc, p) => acc + p.poinFinal, 0);
    const totalBintang = santri.bintangList.length;
    const totalSetoran = await prisma.setoranTahfizh.count({
      where: { santriId: targetSantriId, status: { not: 'DIBATALKAN' } },
    });
    const ikhtibarLulus = santri.ikhtibarList.filter((i) => i.status === 'LULUS_SEMPURNA_TAHAP_2').length;

    return {
      success: true,
      message: 'Berhasil memuat profil santri',
      data: {
        santri,
        ringkasan: {
          totalPoinPelanggaran,
          totalBintang,
          totalSetoran,
          ikhtibarLulus,
        },
      },
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem';
    return { success: false, message: errorMsg, error: errorMsg };
  }
}

/**
 * Kirim Aspirasi / Masukan Kotak Saran
 * Akses: WS (Wali Santri), ST (Santri), Umum
 */
export async function kirimKotakSaranAction(formData: {
  nama: string;
  noHp?: string;
  santriId?: string;
  kategori: string;
  pesan: string;
}): Promise<PortalWaliResponse> {
  try {
    const session = await getSession();

    if (!formData.nama.trim() || !formData.pesan.trim()) {
      return { success: false, message: 'Nama dan pesan aspirasi wajib diisi.' };
    }

    const saran = await prisma.kotakSaran.create({
      data: {
        pengirimId: session?.userId || null,
        nama: formData.nama,
        noHp: formData.noHp,
        santriId: formData.santriId || session?.santriId || null,
        kategori: formData.kategori,
        pesan: formData.pesan,
        status: 'BARU',
      },
    });

    if (session) {
      await recordAuditLog(
        session.userId,
        'KIRIM_KOTAK_SARAN',
        'KotakSaran',
        saran.id,
        { kategori: formData.kategori, pengirim: formData.nama }
      );
    }

    return {
      success: true,
      message: 'Jazakumullah Khairan. Saran dan masukan Anda telah diterima oleh Mudir & Pengurus STQ.',
      data: saran,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem';
    return { success: false, message: errorMsg, error: errorMsg };
  }
}

/**
 * Beri Tanggapan Resmi Kotak Saran
 * Akses: ADM (Tata Usaha), KS (Mudir)
 */
export async function tanggapiKotakSaranAction(formData: {
  saranId: string;
  tanggapan: string;
}): Promise<PortalWaliResponse> {
  try {
    const session = await requireRole(['ADM', 'KS']);

    const existing = await prisma.kotakSaran.findUnique({
      where: { id: formData.saranId },
    });

    if (!existing) {
      return { success: false, message: 'Data saran tidak ditemukan.' };
    }

    const updated = await prisma.kotakSaran.update({
      where: { id: formData.saranId },
      data: {
        tanggapan: formData.tanggapan,
        status: 'DITANGGAPI',
      },
    });

    await recordAuditLog(
      session.userId,
      'TANGGAPI_KOTAK_SARAN',
      'KotakSaran',
      updated.id,
      { penanggap: session.username }
    );

    return {
      success: true,
      message: 'Tanggapan resmi berhasil disimpan.',
      data: updated,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem';
    return { success: false, message: errorMsg, error: errorMsg };
  }
}

export interface SanitizedKotakSaranDTO {
  id: string;
  nama: string;
  kategori: string;
  pesan: string;
  tanggapan: string | null;
  status: string;
}

/**
 * Mengambil Daftar Kotak Saran (Read ABAC Fail-Closed)
 * - Sesi tidak ada -> Akses ditolak, data []
 * - WS / ST -> Milik sendiri saja (pengirimId = session.userId OR santriId = session.santriId)
 *              Jika santriId kosong -> pengirimId = session.userId (tidak pernah global!)
 * - KS / ADM -> Managerial global
 * - Role lain (MT, PH, MK, GA, OSDA, YAY) -> Akses ditolak, data []
 */
export async function getDaftarKotakSaranAction(): Promise<PortalWaliResponse<SanitizedKotakSaranDTO[]>> {
  try {
    const session = await getSession();
    if (!session) {
      return {
        success: false,
        message: 'Akses Ditolak: Sesi otentikasi tidak ditemukan.',
        data: [],
      };
    }

    let whereCondition: Record<string, unknown>;

    if (session.role === 'WS' || session.role === 'ST') {
      if (session.santriId) {
        whereCondition = {
          OR: [
            { pengirimId: session.userId },
            { santriId: session.santriId },
          ],
        };
      } else {
        // Missing santriId MUST NEVER result in global scope!
        whereCondition = { pengirimId: session.userId };
      }
    } else if (session.role === 'KS' || session.role === 'ADM') {
      whereCondition = {};
    } else {
      // Role lain (MT, PH, MK, GA, OSDA, YAY, dll) fail-closed
      return {
        success: false,
        message: 'Akses Ditolak: Role Anda tidak memiliki wewenang membaca kotak saran.',
        data: [],
      };
    }

    const list = await prisma.kotakSaran.findMany({
      where: whereCondition,
      select: {
        id: true,
        nama: true,
        kategori: true,
        pesan: true,
        tanggapan: true,
        status: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return {
      success: true,
      message: 'Berhasil memuat daftar saran',
      data: list,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem';
    return { success: false, message: errorMsg, error: errorMsg, data: [] };
  }
}
