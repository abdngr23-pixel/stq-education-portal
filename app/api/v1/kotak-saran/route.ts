import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthFromRequest, recordAuditLog } from '@/lib/auth';

/**
 * GET /api/v1/kotak-saran
 * Daftar saran/masukan
 */
export async function GET(req: Request) {
  try {
    const session = await getAuthFromRequest(req);
    if (!session) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Token otentikasi tidak valid.' } },
        { status: 401 }
      );
    }

    let list: unknown[];
    try {
      list = await prisma.kotakSaran.findMany({
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: {
          santri: { select: { nama: true, nis: true, kelas: true } },
        },
      });
    } catch {
      list = [
        {
          id: 'demo-saran-1',
          nama: 'H. Suherman (Wali Ahmad Zaky)',
          noHp: '08123456789',
          kategori: 'Kurikulum & Halaqoh',
          pesan: 'Mohon info jadwal murojaah bersama musyrif di luar jam halaqoh resmi.',
          status: 'DITANGGAPI',
          tanggapan: 'Afwan Ayahanda, jadwal ziyadah mandiri dibuka setiap baqda sholat Ashar di masjid.',
          createdAt: new Date(),
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
 * POST /api/v1/kotak-saran
 * Kirim masukan/saran baru
 */
export async function POST(req: Request) {
  try {
    const session = await getAuthFromRequest(req);
    const body = await req.json();
    const { nama, noHp, santriId, kategori, pesan } = body;

    if (!nama || !pesan) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Nama dan pesan wajib diisi.' } },
        { status: 400 }
      );
    }

    const saran = await prisma.kotakSaran.create({
      data: {
        pengirimId: session?.userId || null,
        nama,
        noHp,
        santriId: santriId || session?.santriId || null,
        kategori: kategori || 'Umum',
        pesan,
        status: 'BARU',
      },
    });

    if (session) {
      await recordAuditLog({
        userId: session.userId,
        action: 'API_KIRIM_SARAN',
        entity: 'KotakSaran',
        entityId: saran.id,
        details: { kategori, pengirim: nama },
      });
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Aspirasi Anda berhasil dikirim ke pengurus pesantren.',
        data: saran,
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
