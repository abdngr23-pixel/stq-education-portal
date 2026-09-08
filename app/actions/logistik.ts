'use server';

import prisma from '@/lib/prisma';
import { requireRole, getSession, recordAuditLog } from '@/lib/auth';
import { KategoriLogistik, JenisMutasiLogistik } from '@prisma/client';

export interface LogistikResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

/**
 * Registrasi Barang Logistik Baru
 * Akses: ADM (Tata Usaha), MK (Musyrif Keasramaan)
 */
export async function tambahStokLogistikAction(formData: {
  kodeBarang: string;
  namaBarang: string;
  kategori: KategoriLogistik;
  jumlahAwal: number;
  satuan: string;
  lokasi: string;
  keterangan?: string;
}): Promise<LogistikResponse> {
  try {
    const session = await requireRole(['ADM', 'MK', 'KS']);

    const existing = await prisma.stokLogistik.findUnique({
      where: { kodeBarang: formData.kodeBarang },
    });

    if (existing) {
      return { success: false, message: `Barang dengan kode ${formData.kodeBarang} sudah ada.` };
    }

    const item = await prisma.stokLogistik.create({
      data: {
        kodeBarang: formData.kodeBarang,
        namaBarang: formData.namaBarang,
        kategori: formData.kategori,
        jumlahStok: formData.jumlahAwal,
        satuan: formData.satuan,
        lokasi: formData.lokasi,
        keterangan: formData.keterangan,
        mutasiList: {
          create: {
            jenis: JenisMutasiLogistik.MASUK,
            jumlah: formData.jumlahAwal,
            keterangan: 'Stok awal registrasi inventaris',
            penanggungJawab: session.username,
          },
        },
      },
      include: { mutasiList: true },
    });

    await recordAuditLog(
      session.userId,
      'TAMBAH_LOGISTIK',
      'StokLogistik',
      item.id,
      { nama: formData.namaBarang, jumlah: formData.jumlahAwal }
    );

    return {
      success: true,
      message: `Barang ${formData.namaBarang} (${formData.jumlahAwal} ${formData.satuan}) berhasil didaftarkan.`,
      data: item,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem';
    return { success: false, message: errorMsg, error: errorMsg };
  }
}

/**
 * Catat Mutasi Barang (Barang Masuk / Keluar)
 * Akses: MK (Musyrif Keasramaan), ADM (Tata Usaha)
 */
export async function catatMutasiLogistikAction(formData: {
  logistikId: string;
  jenis: JenisMutasiLogistik;
  jumlah: number;
  keterangan: string;
}): Promise<LogistikResponse> {
  try {
    const session = await requireRole(['MK', 'ADM', 'KS']);

    if (formData.jumlah <= 0) {
      return { success: false, message: 'Jumlah mutasi harus lebih besar dari 0.' };
    }

    const result = await prisma.$transaction(async (tx) => {
      const item = await tx.stokLogistik.findUnique({
        where: { id: formData.logistikId },
      });

      if (!item) {
        throw new Error('Data barang logistik tidak ditemukan.');
      }

      if (formData.jenis === JenisMutasiLogistik.KELUAR && item.jumlahStok < formData.jumlah) {
        throw new Error(
          `Stok tidak mencukupi. Sisa stok: ${item.jumlahStok} ${item.satuan}, jumlah keluar: ${formData.jumlah} ${item.satuan}.`
        );
      }

      const updatedItem = await tx.stokLogistik.update({
        where: { id: formData.logistikId },
        data: {
          jumlahStok:
            formData.jenis === JenisMutasiLogistik.MASUK
              ? { increment: formData.jumlah }
              : { decrement: formData.jumlah },
        },
      });

      if (updatedItem.jumlahStok < 0) {
        throw new Error(`Stok tidak mencukupi setelah pembaruan konkuren.`);
      }

      const mutasi = await tx.mutasiLogistik.create({
        data: {
          logistikId: formData.logistikId,
          jenis: formData.jenis,
          jumlah: formData.jumlah,
          keterangan: formData.keterangan,
          penanggungJawab: session.username,
        },
      });

      return { item, updatedItem, mutasi };
    });

    await recordAuditLog({
      userId: session.userId,
      action: 'MUTASI_LOGISTIK',
      entity: 'MutasiLogistik',
      entityId: result.mutasi.id,
      details: { jenis: formData.jenis, jumlah: formData.jumlah, stokBaru: result.updatedItem.jumlahStok },
    });

    return {
      success: true,
      message: `Mutasi ${formData.jenis} (${formData.jumlah} ${result.item.satuan}) untuk ${result.item.namaBarang} berhasil. Sisa stok saat ini: ${result.updatedItem.jumlahStok} ${result.item.satuan}.`,
      data: { updatedItem: result.updatedItem, mutasi: result.mutasi },
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem';
    return { success: false, message: errorMsg, error: errorMsg };
  }
}

/**
 * Ambil Daftar Inventaris Logistik
 */
export async function getDaftarLogistikAction(kategori?: KategoriLogistik): Promise<LogistikResponse> {
  try {
    const session = await getSession();
    if (!session) {
      return { success: false, message: 'Sesi tidak sah' };
    }

    const list = await prisma.stokLogistik.findMany({
      where: kategori ? { kategori } : undefined,
      include: {
        mutasiList: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
      orderBy: { namaBarang: 'asc' },
    });

    return {
      success: true,
      message: 'Berhasil memuat daftar stok logistik',
      data: list,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem';
    return { success: false, message: errorMsg, error: errorMsg };
  }
}
