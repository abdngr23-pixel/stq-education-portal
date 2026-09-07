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
    let targetSantriId = santriIdInput;
    if (session.role === 'ST' && session.santriId) {
      targetSantriId = session.santriId;
    } else if (session.role === 'WS' && session.santriId) {
      targetSantriId = session.santriId;
    }

    // Jika tidak spesifik dan bukan staff, cari santri pertama
    const santri = targetSantriId
      ? await prisma.santri.findUnique({
          where: { id: targetSantriId },
          include: {
            halaqoh: { include: { pembina: true } },
            setoranList: { take: 10, orderBy: { createdAt: 'desc' } },
            ikhtibarList: { orderBy: { createdAt: 'desc' } },
            nilaiList: { include: { mapel: true }, take: 10 },
            bintangList: { orderBy: { createdAt: 'desc' } },
            pelanggaranList: { include: { kategori: true }, orderBy: { createdAt: 'desc' } },
            kesehatanList: { orderBy: { createdAt: 'desc' }, take: 5 },
            perizinanList: { orderBy: { createdAt: 'desc' }, take: 5 },
          },
        })
      : await prisma.santri.findFirst({
          include: {
            halaqoh: { include: { pembina: true } },
            setoranList: { take: 10, orderBy: { createdAt: 'desc' } },
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
    const totalSetoran = santri.setoranList.length;
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

/**
 * Mengambil Daftar Kotak Saran
 */
export async function getDaftarKotakSaranAction(): Promise<PortalWaliResponse> {
  try {
    const session = await getSession();

    let whereCondition: Record<string, unknown> | undefined = undefined;
    if (session?.role === 'WS' && session?.santriId) {
      whereCondition = { OR: [{ pengirimId: session.userId }, { santriId: session.santriId }] };
    }

    const list = await prisma.kotakSaran.findMany({
      where: whereCondition,
      include: { santri: { select: { nama: true, nis: true, kelas: true } } },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });

    return {
      success: true,
      message: 'Berhasil memuat daftar saran',
      data: list,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem';
    return { success: false, message: errorMsg, error: errorMsg };
  }
}
