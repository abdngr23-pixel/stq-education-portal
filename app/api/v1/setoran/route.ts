import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { apiGuard } from '@/lib/auth';
import { setoranSchema, validateData } from '@/lib/validations';
import { JenisSetoran } from '@prisma/client';
import { executeCanonicalCreateSetoran } from '@/lib/tahfizh-persistence';

/**
 * GET /api/v1/setoran
 * Daftar riwayat setoran tahfizh
 * Locked: PR #8 detailed quality = INTERNAL TAHFIZH ONLY. PR #11 owns Wali-safe exposure.
 */
export async function GET(req: Request) {
  try {
    const auth = await apiGuard(req);
    if (auth.errorResponse) return auth.errorResponse;
    const session = auth.session;

    const { searchParams } = new URL(req.url);
    const santriId = searchParams.get('santri_id');
    const juz = searchParams.get('juz') ? parseInt(searchParams.get('juz')!) : undefined;
    const jenis = searchParams.get('jenis') as JenisSetoran | null;
    const limit = Math.min(50, parseInt(searchParams.get('limit') || '20'));

    const where: Record<string, unknown> = {};
    if (santriId) where.santriId = santriId;
    if (juz) where.juz = juz;
    if (jenis) where.jenis = jenis;

    // Scope jika WS atau ST (Audit P0 - A06 & A07)
    if (session.role === 'WS' || session.role === 'ST') {
      if (!session.santriId) {
        return NextResponse.json(
          { success: false, error: { code: 'FORBIDDEN', message: 'Akun Anda belum terhubung dengan data santri terdaftar.' } },
          { status: 403 }
        );
      }
      where.santriId = session.santriId;
    } else if (session.role === 'MT' || session.role === 'PH') {
      if (!session.staffId) {
        return NextResponse.json({
          success: true,
          data: [],
          meta: { total: 0 },
        });
      }
      where.santri = {
        halaqoh: { pembinaId: session.staffId },
      };
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

    // Jalur Aman WS / ST: Hilangkan seluruh dimensi kualitas internal, rincian kesalahan, dan detail evaluator
    if (session.role === 'WS' || session.role === 'ST') {
      const safeData = setoranList.map((item) => ({
        id: item.id,
        setoranCode: item.setoranCode,
        santriId: item.santriId,
        santri: item.santri,
        jenis: item.jenis,
        juz: item.juz,
        halamanMulai: item.halamanMulai,
        halamanSelesai: item.halamanSelesai,
        jumlahHalaman: item.jumlahHalaman,
        jumlahJuzMufar: item.jumlahJuzMufar,
        nilai: item.nilai,
        catatan: item.catatan,
        tanggal: item.tanggal,
        createdAt: item.createdAt,
      }));

      return NextResponse.json({
        success: true,
        data: safeData,
        meta: { total: safeData.length },
      });
    }

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
 * Input setoran tahfizh baru (MT, PH, KS, ADM) menggunakan eksekutor kanonikal tunggal
 */
export async function POST(req: Request) {
  try {
    const auth = await apiGuard(req, ['MT', 'PH', 'KS', 'ADM']);
    if (auth.errorResponse) return auth.errorResponse;
    const session = auth.session;

    const body = await req.json();
    const validation = validateData(setoranSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: validation.errors[0] || 'Data setoran tidak valid.',
            details: validation.errors,
          },
        },
        { status: 400 }
      );
    }

    const res = await executeCanonicalCreateSetoran(prisma, {
      input: {
        santriId: validation.data.santriId,
        jenis: validation.data.jenis,
        juz: validation.data.juz,
        halamanMulai: validation.data.halamanMulai,
        halamanSelesai: validation.data.halamanSelesai,
        jumlahHalaman: validation.data.jumlahHalaman,
        nilaiTajwid: validation.data.nilaiTajwid,
        nilaiFashahah: validation.data.nilaiFashahah,
        nilaiKelancaran: validation.data.nilaiKelancaran,
        rincianKesalahan: validation.data.rincianKesalahan,
        nilai: validation.data.nilai,
        catatan: validation.data.catatan,
      },
      session: {
        userId: session.userId,
        username: session.username,
        role: session.role,
        staffId: session.staffId,
        isKepalaBidangTahfidz: Boolean((session as { isKepalaBidangTahfidz?: boolean }).isKepalaBidangTahfidz),
      },
    });

    if (!res.success) {
      const isForbidden = res.message.includes("Akses Ditolak");
      const isNotFound = res.message.includes("tidak ditemukan");
      const statusCode = isForbidden ? 403 : isNotFound ? 404 : 400;
      return NextResponse.json(
        {
          success: false,
          error: {
            code: isForbidden ? 'FORBIDDEN' : isNotFound ? 'NOT_FOUND' : 'VALIDATION_ERROR',
            message: res.message,
          },
        },
        { status: statusCode }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Setoran berhasil dicatat.',
        data: res.data,
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
