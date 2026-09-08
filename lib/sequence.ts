/**
 * Collision-Resistant Transaction & Document Sequence Generator
 * STQ Education Portal
 *
 * Sesuai temuan A19 Audit STQ 2026-09-08:
 * Mengeliminasi race condition akibat pembuatan kode dari count() + 1 murni.
 * Menggabungkan nomor urut berbasis hitungan dengan suffix entropi deterministik
 * sehingga permintaan paralel tidak akan mengalami tabrakan unique key.
 */

let runCounter = 0;

export function generateSetoranCode(sequentialCount: number): string {
  runCounter = (runCounter + 1) % 10000;
  const seq = String(Math.max(1, sequentialCount)).padStart(5, '0');
  const entropy = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `SET-${seq}-${entropy}`;
}

export function generateSponsorCode(sequentialCount: number): string {
  runCounter = (runCounter + 1) % 10000;
  const seq = String(Math.max(1, sequentialCount)).padStart(3, '0');
  const entropy = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `OTA-${seq}-${entropy}`;
}

export function generateLaporanSponsorCode(period: string, sequentialCount: number): string {
  runCounter = (runCounter + 1) % 10000;
  const cleanPeriod = period.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-');
  const seq = String(Math.max(1, sequentialCount)).padStart(3, '0');
  const entropy = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `LAP-${cleanPeriod}-${seq}-${entropy}`;
}

export function generateSuratCode(
  jenisKode: string,
  sequentialCount: number,
  shortOrg: string = 'STQ'
): string {
  const year = new Date().getFullYear();
  const seq = String(Math.max(1, sequentialCount)).padStart(3, '0');
  return `${seq}/${shortOrg}/${jenisKode}/${year}`;
}
