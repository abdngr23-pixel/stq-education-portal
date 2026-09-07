import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthFromRequest, recordAuditLog } from '@/lib/auth';
import { JenisSetoran, NilaiSetoran } from '@prisma/client';

/**
 * GET /api/v1/setoran
 * Daftar riwayat setoran tahfizh
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

    const { searchParams } = new URL(req.url);
    const santriId = searchParams.get('santri_id');
    const juz = searchParams.get('juz') ? parseInt(searchParams.get('juz')!) : undefined;
    const jenis = searchParams.get('jenis') as JenisSetoran | null;
    const limit = Math.min(50, parseInt(searchParams.get('limit') || '20'));

    const where: Record<string, unknown> = {};
    if (santriId) where.santriId = santriId;
    if (juz) where.juz = juz;
    if (jenis) where.jenis = jenis;

    // Scope jika WS atau ST
    if (session.role === 'WS' && session.santriId) {
      where.santriId = session.santriId;
    } else if (session.role === 'ST' && session.santriId) {
      where.santriId = session.santriId;
    }

    const setoranList = await prisma.setoranTahfizh.findMany({
      where,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        santri: { select: { id: true, nis: true, nama: true, kelas: true } },
        musyrif: { select: { id: true, nama: true } },
      },
    });

    return NextResponse.json({
      success: true,
      data: setoranList,
      meta: { total: setoranList.length },
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
 * POST /api/v1/setoran
 * Input setoran tahfizh baru (MT, PH, KS)
 */
export async function POST(req: Request) {
  try {
    const session = await getAuthFromRequest(req);
    if (!session || !['MT', 'PH', 'KS', 'ADM'].includes(session.role)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Akses ditolak.' } },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { santriId, jenis, juz, surahMulai, ayatMulai, surahSelesai, ayatSelesai, nilai, catatan } = body;

    if (!santriId || !jenis || !juz || !surahMulai || !ayatMulai || !surahSelesai || !ayatSelesai || !nilai) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Semua field wajib diisi.' } },
        { status: 400 }
      );
    }

    const santri = await prisma.santri.findUnique({ where: { id: santriId } });
    if (!santri) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Data santri tidak ditemukan.' } },
        { status: 404 }
      );
    }

    const count = await prisma.setoranTahfizh.count();
    const setoranCode = `SET-${String(count + 1).padStart(6, '0')}`;

    const musyrifStaff = session.staffId
      ? await prisma.staff.findUnique({ where: { id: session.staffId } })
      : await prisma.staff.findFirst({ where: { roleStaff: 'MT' } });

    if (!musyrifStaff) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Musyrif penilai tidak valid.' } },
        { status: 400 }
      );
    }

    const newSetoran = await prisma.setoranTahfizh.create({
      data: {
        setoranCode,
        santriId,
        musyrifId: musyrifStaff.id,
        jenis: jenis as JenisSetoran,
        juz: parseInt(String(juz)),
        surahMulai,
        ayatMulai: parseInt(String(ayatMulai)),
        surahSelesai,
        ayatSelesai: parseInt(String(ayatSelesai)),
        nilai: nilai as NilaiSetoran,
        catatan,
        createdBy: session.username,
      },
      include: {
        santri: true,
        musyrif: true,
      },
    });

    await recordAuditLog({
      userId: session.userId,
      action: 'API_CREATE_SETORAN',
      entity: 'SetoranTahfizh',
      entityId: newSetoran.id,
      details: { setoranCode, santri: santri.nama, juz, nilai },
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Setoran berhasil dicatat.',
        data: newSetoran,
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
