import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { apiGuard, recordAuditLog } from '@/lib/auth';
import { santriInputSchema, validateData } from '@/lib/validations';
import { JenisKelamin, SantriStatus } from '@prisma/client';

/**
 * GET /api/v1/santri
 * Daftar santri dengan pagination & filtering
 */
export async function GET(req: Request) {
  try {
    const auth = await apiGuard(req);
    if (auth.errorResponse) return auth.errorResponse;
    const session = auth.session;

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get('per_page') || '20')));
    const kelas = searchParams.get('kelas');
    const status = searchParams.get('status') as SantriStatus | null;
    const search = searchParams.get('search');

    const where: Record<string, unknown> = {};
    if (kelas) where.kelas = kelas;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { nama: { contains: search, mode: 'insensitive' } },
        { nis: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Role-based scoping: jika wali santri, hanya anaknya
    if (session.role === 'WS' && session.santriId) {
      where.id = session.santriId;
    } else if (session.role === 'ST' && session.santriId) {
      where.id = session.santriId;
    }

    const total = await prisma.santri.count({ where });
    const santriList = await prisma.santri.findMany({
      where,
      skip: (page - 1) * perPage,
      take: perPage,
      include: {
        halaqoh: {
          select: {
            id: true,
            nama: true,
            pembina: { select: { nama: true } },
          },
        },
      },
      orderBy: { nama: 'asc' },
    });

    return NextResponse.json({
      success: true,
      data: santriList,
      meta: {
        page,
        per_page: perPage,
        total,
        total_pages: Math.ceil(total / perPage),
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

/**
 * POST /api/v1/santri
 * Tambah santri baru (ADM, KS)
 */
export async function POST(req: Request) {
  try {
    const auth = await apiGuard(req, ['ADM', 'KS']);
    if (auth.errorResponse) return auth.errorResponse;
    const session = auth.session;

    const body = await req.json();
    const validation = validateData(santriInputSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: validation.errors[0] || 'Data input santri tidak valid.',
            details: validation.errors,
          },
        },
        { status: 400 }
      );
    }

    const { nis, nama, kelas, jenisKelamin, halaqohId, namaWali, noHpWali } = validation.data;

    const existing = await prisma.santri.findUnique({ where: { nis } });
    if (existing) {
      return NextResponse.json(
        { success: false, error: { code: 'DUPLICATE', message: `Santri dengan NIS ${nis} sudah terdaftar.` } },
        { status: 400 }
      );
    }

    const santri = await prisma.santri.create({
      data: {
        nis,
        nama,
        kelas,
        jenisKelamin: jenisKelamin as JenisKelamin,
        halaqohId: halaqohId || null,
        namaWali,
        noHpWali,
        createdBy: session.username,
      },
    });

    await recordAuditLog({
      userId: session.userId,
      action: 'API_CREATE_SANTRI',
      entity: 'Santri',
      entityId: santri.id,
      details: { nis, nama, kelas },
    });

    return NextResponse.json(
      {
        success: true,
        message: `Santri ${nama} (${nis}) berhasil didaftarkan.`,
        data: santri,
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
