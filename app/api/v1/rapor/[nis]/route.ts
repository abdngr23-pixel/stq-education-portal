import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthFromRequest } from '@/lib/auth';

/**
 * GET /api/v1/rapor/[nis]
 * Mengambil rapor gabungan santri (tahfizh + akademik) berdasarkan NIS
 */
export async function GET(
  req: Request,
  context: { params: Promise<{ nis: string }> }
) {
  try {
    const session = await getAuthFromRequest(req);
    if (!session) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Token otentikasi tidak valid.' } },
        { status: 401 }
      );
    }

    const { nis } = await context.params;

    const santri = await prisma.santri.findUnique({
      where: { nis },
      include: {
        halaqoh: { include: { pembina: true } },
        nilaiList: {
          include: { mapel: true, guru: true },
          orderBy: { mapel: { kodeMapel: 'asc' } },
        },
        setoranList: {
          take: 15,
          orderBy: { createdAt: 'desc' },
        },
        ikhtibarList: {
          orderBy: { createdAt: 'desc' },
        },
        bintangList: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!santri) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: `Santri dengan NIS ${nis} tidak ditemukan.` } },
        { status: 404 }
      );
    }

    // Scoping check untuk ST dan WS
    if (session.role === 'ST' && session.santriId !== santri.id) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Anda hanya berhak melihat rapor Anda sendiri.' } },
        { status: 403 }
      );
    }

    // Hitung rata-rata nilai akademik
    const totalNilai = santri.nilaiList.reduce((acc, curr) => acc + curr.angka, 0);
    const rataRataAkademik = santri.nilaiList.length > 0 ? (totalNilai / santri.nilaiList.length).toFixed(1) : '0.0';

    return NextResponse.json({
      success: true,
      message: 'Rapor gabungan berhasil diambil.',
      data: {
        santri: {
          nis: santri.nis,
          nama: santri.nama,
          kelas: santri.kelas,
          halaqoh: santri.halaqoh?.nama || 'Belum Ditentukan',
          musyrif: santri.halaqoh?.pembina?.nama || 'Belum Ditentukan',
        },
        ringkasan: {
          rataRataAkademik: parseFloat(rataRataAkademik),
          totalSetoranTercatat: santri.setoranList.length,
          totalBintangTeladan: santri.bintangList.length,
          ikhtibarLulus: santri.ikhtibarList.filter((i) => i.status === 'LULUS_SEMPURNA_TAHAP_2').length,
        },
        nilaiAkademik: santri.nilaiList.map((n: any) => ({
          mapel: n.mapel.nama,
          kategori: n.mapel.kategori,
          nilaiAngka: n.angka,
          predikat: n.huruf,
          guru: n.guru.nama,
        })),
        riwayatTahfizh: santri.setoranList.map((s: any) => ({
          juz: s.juz,
          surah: `${s.surahMulai}:${s.ayatMulai} - ${s.surahSelesai}:${s.ayatSelesai}`,
          jenis: s.jenis,
          nilai: s.nilai,
          tanggal: s.createdAt,
        })),
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Terjadi kesalahan internal';
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message } },
      { status: 500 }
    );
  }
}
