import { z } from 'zod';

/**
 * 1. Skema Validasi Autentikasi & Login
 */
export const loginSchema = z.object({
  username: z
    .string()
    .min(3, { message: 'Username minimal 3 karakter' })
    .max(100, { message: 'Username maksimal 100 karakter' })
    .optional(),
  email: z
    .string()
    .email({ message: 'Format email tidak valid' })
    .max(100, { message: 'Email maksimal 100 karakter' })
    .optional(),
  password: z
    .string()
    .min(6, { message: 'Kata sandi minimal 6 karakter' })
    .max(100, { message: 'Kata sandi maksimal 100 karakter' }),
}).refine((data) => data.username || data.email, {
  message: 'Username atau email wajib diisi',
  path: ['username'],
});

export type LoginInput = z.infer<typeof loginSchema>;

/**
 * 2. Skema Validasi Input Santri Baru
 */
export const santriInputSchema = z.object({
  nis: z
    .string()
    .min(3, { message: 'NIS minimal 3 karakter' })
    .max(20, { message: 'NIS maksimal 20 karakter' })
    .regex(/^[a-zA-Z0-9_-]+$/, { message: 'NIS hanya boleh huruf, angka, tanda strip, atau underscore' }),
  nama: z
    .string()
    .min(2, { message: 'Nama santri minimal 2 karakter' })
    .max(100, { message: 'Nama santri maksimal 100 karakter' }),
  kelas: z
    .string()
    .min(1, { message: 'Kelas wajib diisi' })
    .max(20, { message: 'Kelas maksimal 20 karakter' }),
  jenisKelamin: z.enum(['L', 'P'], {
    message: 'Jenis kelamin harus L (Laki-laki) atau P (Perempuan)',
  }),
  halaqohId: z.string().optional().nullable(),
  namaWali: z.string().max(100, { message: 'Nama wali maksimal 100 karakter' }).optional().nullable(),
  noHpWali: z.string().max(20, { message: 'Nomor HP wali maksimal 20 karakter' }).optional().nullable(),
});

export type SantriInput = z.infer<typeof santriInputSchema>;

/**
 * 3. Skema Validasi Input Setoran Tahfizh
 */
export const setoranSchema = z.object({
  santriId: z.string().min(1, { message: 'Santri wajib dipilih' }),
  jenis: z.enum(['SABAQ', 'SABQI', 'MANZIL', 'MUFAR'], {
    message: 'Jenis setoran harus SABAQ, SABQI, MANZIL, atau MUFAR',
  }),
  juz: z.coerce
    .number()
    .int()
    .min(1, { message: 'Juz minimal 1' })
    .max(30, { message: 'Juz maksimal 30' }),
  halamanMulai: z.coerce
    .number()
    .int()
    .min(1, { message: 'Halaman mulai minimal 1' })
    .max(604, { message: 'Halaman mulai maksimal 604' }),
  halamanSelesai: z.coerce
    .number()
    .int()
    .min(1, { message: 'Halaman selesai minimal 1' })
    .max(604, { message: 'Halaman selesai maksimal 604' }),
  jumlahHalaman: z.coerce
    .number()
    .min(0.5, { message: 'Jumlah halaman minimal 0.5' }),
  nilai: z.enum(['MUMTAZ', 'JAYYID_JIDDAN', 'JAYYID', 'MAQBUL', 'DHOIF', 'RASIB'], {
    message: 'Nilai setoran tidak valid',
  }),
  catatan: z.string().max(500, { message: 'Catatan maksimal 500 karakter' }).optional().nullable(),
});

export type SetoranInput = z.infer<typeof setoranSchema>;

/**
 * 4. Skema Validasi Nilai Mapel Akademik
 */
export const nilaiMapelSchema = z.object({
  santriId: z.string().min(1, { message: 'ID Santri wajib disertakan' }),
  mapelId: z.string().min(1, { message: 'Mata pelajaran wajib dipilih' }),
  angka: z.coerce
    .number()
    .min(0, { message: 'Nilai minimal 0' })
    .max(100, { message: 'Nilai maksimal 100' }),
  huruf: z.enum(['A', 'B', 'C', 'D']).optional(),
  semester: z.enum(['GANJIL', 'GENAP'], {
    message: 'Semester harus GANJIL atau GENAP',
  }),
  tahunAjaran: z.string().min(4).max(20),
  catatan: z.string().max(500).optional().nullable(),
});

export type NilaiMapelInput = z.infer<typeof nilaiMapelSchema>;

/**
 * 5. Skema Validasi Pengajuan Perizinan Santri
 */
export const perizinanSchema = z.object({
  santriId: z.string().min(1, { message: 'ID Santri wajib disertakan' }),
  jenisIzin: z.enum(['LOKAL', 'PULANG', 'KELUAR_KOTA', 'SAKIT'], {
    message: 'Jenis izin tidak valid',
  }),
  tanggalMulai: z.string().min(5, { message: 'Tanggal mulai wajib diisi' }),
  tanggalSelesai: z.string().min(5, { message: 'Tanggal selesai wajib diisi' }),
  alasan: z
    .string()
    .min(3, { message: 'Alasan perizinan minimal 3 karakter' })
    .max(500, { message: 'Alasan perizinan maksimal 500 karakter' }),
  penjemput: z.string().max(100).optional().nullable(),
});

export type PerizinanInput = z.infer<typeof perizinanSchema>;

/**
 * 6. Skema Validasi Aspirasi & Kotak Saran
 */
export const kotakSaranSchema = z.object({
  nama: z
    .string()
    .min(2, { message: 'Nama pengirim minimal 2 karakter' })
    .max(100, { message: 'Nama pengirim maksimal 100 karakter' }),
  noHp: z
    .string()
    .max(20, { message: 'Nomor HP maksimal 20 karakter' })
    .optional()
    .nullable(),
  santriId: z.string().optional().nullable(),
  kategori: z
    .string()
    .min(2, { message: 'Kategori minimal 2 karakter' })
    .max(50, { message: 'Kategori maksimal 50 karakter' }),
  pesan: z
    .string()
    .min(5, { message: 'Pesan aspirasi minimal 5 karakter' })
    .max(2000, { message: 'Pesan aspirasi maksimal 2000 karakter' }),
});

export type KotakSaranInput = z.infer<typeof kotakSaranSchema>;

/**
 * 7. Skema Validasi Agenda Kalender Akademik
 */
export const kalenderSchema = z.object({
  judul: z
    .string()
    .min(3, { message: 'Judul agenda minimal 3 karakter' })
    .max(150, { message: 'Judul agenda maksimal 150 karakter' }),
  deskripsi: z
    .string()
    .max(1000, { message: 'Deskripsi maksimal 1000 karakter' })
    .optional()
    .nullable(),
  tanggalMulai: z.string().min(5, { message: 'Tanggal mulai wajib diisi' }),
  tanggalSelesai: z.string().optional().nullable(),
  kategori: z.string().max(50).optional().nullable(),
  targetPeserta: z.string().max(50).optional().nullable(),
  lokasi: z.string().max(100).optional().nullable(),
});

export type KalenderInput = z.infer<typeof kalenderSchema>;

/**
 * 8. Skema Validasi Pembuatan Draft Surat AI
 */
export const suratAISchema = z.object({
  jenisSurat: z.string().min(2, { message: 'Jenis surat wajib ditentukan' }).max(100),
  perihal: z.string().min(3, { message: 'Perihal surat minimal 3 karakter' }).max(200),
  tujuan: z.string().min(2, { message: 'Tujuan surat minimal 2 karakter' }).max(200),
  santriId: z.string().optional().nullable(),
  catatanKhusus: z.string().max(1000).optional().nullable(),
});

export type SuratAIInput = z.infer<typeof suratAISchema>;

/**
 * 9. Skema Validasi Batch Presensi Shalat & Halaqoh
 */
export const batchPresensiSchema = z.object({
  kegiatan: z.string().min(2, { message: 'Nama kegiatan/sesi wajib diisi' }).max(100),
  tanggal: z.string().optional(),
  items: z
    .array(
      z.object({
        santriId: z.string().min(1, { message: 'ID Santri wajib disertakan' }),
        status: z.enum(['HADIR', 'MASBUK', 'IZIN', 'SAKIT', 'ALFA'], {
          message: 'Status absensi tidak valid',
        }),
        catatan: z.string().max(255).optional().nullable(),
      })
    )
    .min(1, { message: 'Minimal 1 santri dalam daftar presensi' }),
});

export type BatchPresensiInput = z.infer<typeof batchPresensiSchema>;

/**
 * Helper Validasi Generik
 */
export function validateData<T>(schema: z.ZodSchema<T>, data: unknown) {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues || [];
    const errorMessages = issues.map(
      (e) => `${e.path.join('.') || 'field'}: ${e.message}`
    );
    return {
      success: false as const,
      errors: errorMessages,
      issues,
    };
  }
  return {
    success: true as const,
    data: result.data,
  };
}
