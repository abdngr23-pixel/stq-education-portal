import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { apiGuard, recordAuditLog } from '@/lib/auth';
import { kalenderSchema, validateData } from '@/lib/validations';

/**
 * GET /api/v1/kalender
 * Agenda kegiatan & kalender akademik pesantren
 */
export async function GET() {
  try {
    let list: unknown[];
    try {
      list = await prisma.kalenderAkademik.findMany({
        orderBy: { tanggalMulai: 'asc' },
        take: 50,
      });
    } catch {
      // Fallback data jika PostgreSQL belum aktif
      list = [
        {
          id: 'demo-cal-1',
          judul: 'Ikhtibar Tahfizh Gelombang 1',
          deskripsi: 'Ujian komprehensif kelancaran hafalan juz 28, 29, 30',
          tanggalMulai: new Date('2026-09-15T08:00:00.000Z'),
          tanggalSelesai: new Date('2026-09-17T12:00:00.000Z'),
          kategori: 'TAHFIZH',
          targetPeserta: 'SEMUA',
          lokasi: 'Masjid Utama STQ',
        },
        {
          id: 'demo-cal-2',
          judul: 'Kajian Bulanan Wali Santri & Parenting',
          deskripsi: 'Membahas penguatan murojaah santri di lingkungan keluarga',
          tanggalMulai: new Date('2026-09-25T09:00:00.000Z'),
          tanggalSelesai: new Date('2026-09-25T11:30:00.000Z'),
          kategori: 'KEGIATAN_SANTRI',
          targetPeserta: 'WALI_SANTRI',
          lokasi: 'Aula Darul Ulum',
        },
      ];
    }

    return NextResponse.json({
      success: true,
      data: list,
      meta: { total: list.length },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Terjadi kesalahan internal';
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/kalender
 * Tambah agenda baru (ADM, KS)
 */
export async function POST(req: Request) {
  try {
    const auth = await apiGuard(req, ['ADM', 'KS']);
    if (auth.errorResponse) return auth.errorResponse;
    const session = auth.session;

    const body = await req.json();
    const validation = validateData(kalenderSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: validation.errors[0] || 'Data agenda kalender tidak valid.',
            details: validation.errors,
          },
        },
        { status: 400 }
      );
    }

    const { judul, deskripsi, tanggalMulai, tanggalSelesai, kategori, targetPeserta, lokasi } = validation.data;

    const agenda = await prisma.kalenderAkademik.create({
      data: {
        judul,
        deskripsi,
        tanggalMulai: new Date(tanggalMulai),
        tanggalSelesai: tanggalSelesai ? new Date(tanggalSelesai) : null,
        kategori: kategori || 'KEGIATAN_SANTRI',
        targetPeserta: targetPeserta || 'SEMUA',
        lokasi,
      },
    });

    await recordAuditLog({
      userId: session.userId,
      action: 'API_TAMBAH_AGENDA',
      entity: 'KalenderAkademik',
      entityId: agenda.id,
      details: { judul },
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Agenda berhasil ditambahkan.',
        data: agenda,
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Terjadi kesalahan internal';
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message } },
      { status: 500 }
    );
  }
}
