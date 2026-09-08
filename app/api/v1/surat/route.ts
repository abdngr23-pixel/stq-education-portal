import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { apiGuard } from '@/lib/auth';

/**
 * GET /api/v1/surat
 * Daftar arsip surat resmi STQ Darul Ulum Cendekia (Khusus Staff/Pengurus)
 */
export async function GET(req: Request) {
  try {
    const auth = await apiGuard(req, ['ADM', 'KS', 'MK', 'PH', 'GA', 'MT', 'YAY']);
    if (auth.errorResponse) return auth.errorResponse;
    const session = auth.session;

    const { searchParams } = new URL(req.url);
    const limit = Math.min(50, parseInt(searchParams.get('limit') || '20'));

    const suratList = await prisma.suratResmi.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      data: suratList,
      meta: { total: suratList.length },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Terjadi kesalahan internal';
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message } },
      { status: 500 }
    );
  }
}
