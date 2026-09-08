/**
 * WhatsApp Direct Link Utility & Message Generators
 * STQ Darul Ulum Cendekia
 * 
 * Memfasilitasi komunikasi instan 1-klik ke Wali Santri tanpa perlu API Key berbayar.
 * Menggunakan protokol universal WhatsApp: https://wa.me/{nomor}?text={pesan}
 */

export interface SetoranTahfizhWAParams {
  santriNama: string;
  santriNis: string;
  kelas: string;
  namaWali?: string;
  noHpWali?: string;
  jenisSetoran: "SABAQ" | "SABQI" | "MANZIL" | "MUFAR" | string;
  juz: number | string;
  surah: string;
  ayatMulai: number | string;
  ayatSelesai: number | string;
  nilai: string;
  catatan?: string;
  jumlahHalaman?: number | string;
  pembinaNama: string;
  tanggal?: string;
}

export interface IzinSantriWAParams {
  santriNama: string;
  santriNis?: string;
  kelas: string;
  namaWali?: string;
  noHpWali?: string;
  kodeIzin: string;
  jenisIzin: string;
  durasi: string;
  alasan: string;
  status: string;
  diverifikasiOleh: string;
  batasKembali?: string;
}

export interface PelanggaranSPWAParams {
  santriNama: string;
  santriNis?: string;
  kelas: string;
  namaWali?: string;
  noHpWali?: string;
  perihal: string;
  totalPoin: number;
  kategori: string;
  tingkatSP?: number | string;
  tindakan?: string;
  pencatat?: string;
}

export interface ProgressSantriWAParams {
  santriNama: string;
  santriNis: string;
  kelas: string;
  halaqoh: string;
  namaWali?: string;
  noHpWali?: string;
  capaianJuz: number;
  targetJuz: number;
  setoranTerakhir?: string;
  nilaiTerakhir?: string;
  pembinaNama?: string;
}

const DEFAULT_FALLBACK_PHONE = "6281299887766";
const PORTAL_URL = "https://stq-education-portal-app-two.vercel.app";

/**
 * Memformat nomor telepon Indonesia menjadi format standar internasional WhatsApp (628xxx)
 * Menghapus spasi, strip, tanda kurung, dan mengonversi 08xx -> 628xx
 */
export function formatIndonesianPhone(phone?: string | null): string {
  if (!phone) return DEFAULT_FALLBACK_PHONE;
  
  // Hapus semua karakter non-digit
  let cleaned = phone.replace(/\D/g, "");
  
  if (!cleaned) return DEFAULT_FALLBACK_PHONE;
  
  // Jika diawali 0, ganti dengan 62
  if (cleaned.startsWith("0")) {
    cleaned = "62" + cleaned.slice(1);
  } else if (cleaned.startsWith("8")) {
    // Jika diawali langsung 8xxx, tambahkan 62
    cleaned = "62" + cleaned;
  }
  
  // Minimal valid length untuk nomor HP Indonesia (biasanya 10-15 digit)
  if (cleaned.length < 9) {
    return DEFAULT_FALLBACK_PHONE;
  }
  
  return cleaned;
}

/**
 * Menghasilkan tautan universal WhatsApp Web / App
 */
export function generateWALink(phone: string | undefined | null, message: string): string {
  const formattedPhone = formatIndonesianPhone(phone);
  const encodedText = encodeURIComponent(message.trim());
  return `https://wa.me/${formattedPhone}?text=${encodedText}`;
}

/**
 * Membuka langsung WhatsApp di jendela / tab baru
 */
export function openWhatsAppDirect(phone: string | undefined | null, message: string): void {
  const url = generateWALink(phone, message);
  if (typeof window !== "undefined") {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

/**
 * Format label jenis setoran tahfizh
 */
export function getJenisSetoranLabel(jenis: string): string {
  switch (jenis?.toUpperCase()) {
    case "SABAQ":
      return "Sabaq (Hafalan Baru)";
    case "SABQI":
      return "Sabqi (Muroja'ah Hafalan Baru)";
    case "MANZIL":
      return "Manzil (Muroja'ah Hafalan Mutqin)";
    case "MUFAR":
      return "Mufar (Pemantapan Khusus)";
    default:
      return jenis || "Setoran Harian";
  }
}

/**
 * Format label predikat nilai tahfizh
 */
export function getNilaiLabel(nilai: string): string {
  switch (nilai?.toUpperCase()) {
    case "MUMTAZ":
      return "Mumtaz (Sempurna / A+)";
    case "JAYYID_JIDDAN":
      return "Jayyid Jiddan (Sangat Baik / A)";
    case "JAYYID":
      return "Jayyid (Baik / B)";
    case "MAQBUL":
      return "Maqbul (Cukup / C)";
    case "DHOIF":
      return "Dhoif (Perlu Mengulang / D)";
    default:
      return nilai || "Baik";
  }
}

/**
 * Template Pesan: Laporan Setoran Tahfizh Harian
 */
export function buildSetoranTahfizhWAMessage(p: SetoranTahfizhWAParams): string {
  const jenisLabel = getJenisSetoranLabel(p.jenisSetoran);
  const nilaiLabel = getNilaiLabel(p.nilai);
  const waliGreeting = p.namaWali ? `Ayah/Bunda *${p.namaWali}*` : "Ayah/Bunda Wali Santri";
  const tgl = p.tanggal || new Date().toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  let msg = `*LAPORAN SETORAN TAHFIZH SANTRI*\n`;
  msg += `*STQ DARUL ULUM CENDEKIA*\n`;
  msg += `📅 ${tgl}\n\n`;
  msg += `Assalamu'alaikum Warahmatullahi Wabarakatuh,\n`;
  msg += `Yth. ${waliGreeting} dari ananda *${p.santriNama}* (${p.santriNis}, Kelas ${p.kelas}),\n\n`;
  msg += `Alhamdulillah, ananda telah selesai menyetorkan hafalan Al-Qur'an dengan rincian berikut:\n`;
  msg += `• *Jenis Setoran*: ${jenisLabel}\n`;
  msg += `• *Juz*: Juz ${p.juz}\n`;
  msg += `• *Surah & Ayat*: QS. ${p.surah}: ${p.ayatMulai}–${p.ayatSelesai}\n`;
  
  if (p.jumlahHalaman && String(p.jumlahHalaman) !== "0") {
    msg += `• *Volume*: ${p.jumlahHalaman} Halaman (Standar Madinah)\n`;
  }
  
  msg += `• *Predikat Nilai*: ${nilaiLabel}\n`;
  msg += `• *Pembina Halaqoh*: ${p.pembinaNama}\n`;
  
  if (p.catatan && p.catatan.trim()) {
    msg += `• *Catatan Pembina*: _"${p.catatan.trim()}"_\n`;
  }
  
  msg += `\nMohon senantiasa mendoakan ananda agar terus istiqomah dan mutqin hafalannya.\n\n`;
  msg += `Pantau buku mutaba'ah & rapor lengkap ananda di portal:\n`;
  msg += `🔗 ${PORTAL_URL}\n\n`;
  msg += `_Jazakumullahu Khairan Katsiran_\n`;
  msg += `*Bidang Ketahfidzhan STQ Darul Ulum Cendekia*`;

  return msg;
}

/**
 * Template Pesan: Notifikasi Status Perizinan Santri
 */
export function buildIzinSantriWAMessage(p: IzinSantriWAParams): string {
  const waliGreeting = p.namaWali ? `Ayah/Bunda *${p.namaWali}*` : "Ayah/Bunda Wali Santri";
  const statusFormatted =
    p.status === "DISETUJUI"
      ? "✅ TELAH DISETUJUI"
      : p.status === "DITOLAK"
      ? "❌ BELUM DISETUJUI / DITOLAK"
      : p.status === "MENUNGGU_KS"
      ? "⏳ DIESKALASI KE MUDIR / KS"
      : "⏳ MENUNGGU VERIFIKASI";

  let msg = `*NOTIFIKASI PERIZINAN SANTRI*\n`;
  msg += `*STQ DARUL ULUM CENDEKIA*\n\n`;
  msg += `Assalamu'alaikum Warahmatullahi Wabarakatuh,\n`;
  msg += `Yth. ${waliGreeting} dari ananda *${p.santriNama}* (Kelas ${p.kelas}),\n\n`;
  msg += `Memberitahukan tindak lanjut permohonan izin santri:\n`;
  msg += `• *Kode Izin*: ${p.kodeIzin}\n`;
  msg += `• *Jenis Izin*: ${p.jenisIzin.replace(/_/g, " ")}\n`;
  msg += `• *Durasi*: ${p.durasi}\n`;
  msg += `• *Keperluan/Alasan*: ${p.alasan}\n`;
  msg += `• *Status Pengajuan*: *${statusFormatted}*\n`;
  msg += `• *Pemeriksa*: ${p.diverifikasiOleh}\n`;

  if (p.batasKembali) {
    msg += `\n⚠️ *Penting*: Batas waktu wajib kembali ke asrama adalah: *${p.batasKembali}*.\n`;
    msg += `Mohon kerjasama Ayah/Bunda untuk mendampingi kepulangan ananda tepat waktu.\n`;
  }

  msg += `\nInformasi lebih lengkap dapat diakses pada portal santri:\n`;
  msg += `🔗 ${PORTAL_URL}\n\n`;
  msg += `_Wassalamu'alaikum Warahmatullahi Wabarakatuh_\n`;
  msg += `*Bagian Keasramaan STQ Darul Ulum Cendekia*`;

  return msg;
}

/**
 * Template Pesan: Catatan Kedisiplinan & Surat Peringatan (SP)
 */
export function buildPelanggaranSPWAMessage(p: PelanggaranSPWAParams): string {
  const waliGreeting = p.namaWali ? `Ayah/Bunda *${p.namaWali}*` : "Ayah/Bunda Wali Santri";

  let msg = `*PEMBERITAHUAN KEDISIPLINAN SANTRI*\n`;
  msg += `*STQ DARUL ULUM CENDEKIA*\n\n`;
  msg += `Assalamu'alaikum Warahmatullahi Wabarakatuh,\n`;
  msg += `Yth. ${waliGreeting} dari ananda *${p.santriNama}* (Kelas ${p.kelas}),\n\n`;
  msg += `Dengan ini kami menyampaikan catatan kedisiplinan ananda di lingkungan pesantren:\n`;
  msg += `• *Kategori*: ${p.kategori}\n`;
  msg += `• *Perihal Pelanggaran*: ${p.perihal}\n`;
  msg += `• *Total Poin Pelanggaran*: *${p.totalPoin} Poin*\n`;

  if (p.tingkatSP) {
    msg += `• *Status Peringatan*: ⚠️ *SURAT PERINGATAN (SP ${p.tingkatSP}) TERBIT*\n`;
  }

  if (p.tindakan) {
    msg += `• *Bentuk Pembinaan*: ${p.tindakan}\n`;
  }

  msg += `\nCatatan ini kami sampaikan agar Ayah/Bunda dapat turut menasihati dan memberikan motivasi kepada ananda agar lebih disiplin dan beradab mulia.\n\n`;
  msg += `_Wassalamu'alaikum Warahmatullahi Wabarakatuh_\n`;
  msg += `*Tim Kedisiplinan & Kesantrian STQ Darul Ulum Cendekia*`;

  return msg;
}

/**
 * Template Pesan: Rangkuman Capaian Hafalan Santri
 */
export function buildProgressSantriWAMessage(p: ProgressSantriWAParams): string {
  const waliGreeting = p.namaWali ? `Ayah/Bunda *${p.namaWali}*` : "Ayah/Bunda Wali Santri";
  const persentase = Math.round((p.capaianJuz / (p.targetJuz || 30)) * 100);

  let msg = `*LAPORAN PERKEMBANGAN HAFALAN AL-QUR'AN*\n`;
  msg += `*STQ DARUL ULUM CENDEKIA*\n\n`;
  msg += `Assalamu'alaikum Warahmatullahi Wabarakatuh,\n`;
  msg += `Yth. ${waliGreeting} dari ananda *${p.santriNama}* (${p.santriNis}, Kelas ${p.kelas}),\n\n`;
  msg += `Berikut ringkasan capaian tahfizh Al-Qur'an ananda saat ini:\n`;
  msg += `• *Kelompok Halaqoh*: ${p.halaqoh}\n`;
  msg += `• *Capaian Hafalan*: *${p.capaianJuz} Juz* dari target ${p.targetJuz} Juz (${persentase}%)\n`;

  if (p.setoranTerakhir) {
    msg += `• *Setoran Terakhir*: ${p.setoranTerakhir}\n`;
  }
  if (p.nilaiTerakhir) {
    msg += `• *Predikat Nilai*: ${getNilaiLabel(p.nilaiTerakhir)}\n`;
  }
  if (p.pembinaNama) {
    msg += `• *Pembina*: ${p.pembinaNama}\n`;
  }

  msg += `\nAlhamdulillah atas capaian ananda. Semoga senantiasa diberikan kelancaran dan keistiqomahan.\n\n`;
  msg += `Simak rekaman nilai dan mutaba'ah ananda di:\n`;
  msg += `🔗 ${PORTAL_URL}\n\n`;
  msg += `_Wassalamu'alaikum Warahmatullahi Wabarakatuh_\n`;
  msg += `*STQ Darul Ulum Cendekia*`;

  return msg;
}

export interface RekapPresensiWAParams {
  kegiatan: string;
  tanggal?: string;
  petugasNama: string;
  totalSantri: number;
  hadir: number;
  masbuk: number;
  sakit: number;
  izin: number;
  alpa: number;
  daftarTidakHadir?: Array<{ nama: string; kelas: string; status: string; catatan?: string }>;
}

/**
 * Template Pesan: Laporan Rekap Presensi Shaf Shalat & Halaqoh (ke Grup Asatidz)
 */
export function buildRekapPresensiWAMessage(p: RekapPresensiWAParams): string {
  const tgl = p.tanggal || new Date().toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const jam = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  const totalHadir = p.hadir + p.masbuk;
  const persentase = Math.round((totalHadir / (p.totalSantri || 1)) * 100);

  const isPuasa = p.kegiatan.toLowerCase().includes("puasa");
  const isTahajjud = p.kegiatan.toLowerCase().includes("tahajjud");
  const isDhuha = p.kegiatan.toLowerCase().includes("dhuha");

  const headerTitle = isPuasa
    ? "*LAPORAN MUTABA'AH PUASA SUNNAH*"
    : isTahajjud
    ? "*LAPORAN MUTABA'AH SHALAT TAHAJJUD (QIYAMUL LAIL)*"
    : isDhuha
    ? "*LAPORAN MUTABA'AH SHALAT DHUHA*"
    : "*LAPORAN PRESENSI SHALAT & HALAQOH*";

  let msg = `${headerTitle}\n`;
  msg += `*STQ DARUL ULUM CENDEKIA*\n`;
  msg += `📅 ${tgl} • Pukul ${jam} WITA\n\n`;
  msg += `• *Sesi Kegiatan*: ${p.kegiatan}\n`;
  msg += `• *Petugas Presensi*: ${p.petugasNama}\n`;
  msg += `• *Total Santri*: ${p.totalSantri} Santri\n\n`;
  msg += `📊 *Ringkasan Kehadiran*:\n`;

  if (isPuasa) {
    msg += `✅ *Berpuasa*: ${p.hadir} santri\n`;
    if (p.masbuk > 0) msg += `⏱️ *Batal / Tidak Tuntas*: ${p.masbuk} santri\n`;
    if (p.sakit > 0) msg += `🏥 *Sakit (Tidak Puasa)*: ${p.sakit} santri\n`;
    if (p.izin > 0) msg += `📝 *Izin/Safar*: ${p.izin} santri\n`;
    if (p.alpa > 0) msg += `❌ *Tidak Berpuasa*: ${p.alpa} santri\n`;
    msg += `📈 *Tingkat Kepatuhan Puasa*: *${persentase}%*\n`;
  } else if (isTahajjud || isDhuha) {
    msg += `✅ *Melaksanakan*: ${p.hadir} santri\n`;
    if (p.masbuk > 0) msg += `⏱️ *Menyusul / Masbuk*: ${p.masbuk} santri\n`;
    if (p.sakit > 0) msg += `🏥 *Sakit (UKS)*: ${p.sakit} santri\n`;
    if (p.izin > 0) msg += `📝 *Izin Resmi*: ${p.izin} santri\n`;
    if (p.alpa > 0) msg += `❌ *Kesiangan / Belum*: ${p.alpa} santri\n`;
    msg += `📈 *Tingkat Kepatuhan*: *${persentase}%*\n`;
  } else {
    msg += `✅ *Hadir Tepat Waktu*: ${p.hadir} santri\n`;
    if (p.masbuk > 0) msg += `⏱️ *Masbuk/Terlambat*: ${p.masbuk} santri\n`;
    if (p.sakit > 0) msg += `🏥 *Sakit*: ${p.sakit} santri\n`;
    if (p.izin > 0) msg += `📝 *Izin Resmi*: ${p.izin} santri\n`;
    if (p.alpa > 0) msg += `❌ *Alpa/Tanpa Keterangan*: ${p.alpa} santri\n`;
    msg += `📈 *Tingkat Kehadiran*: *${persentase}%*\n`;
  }

  if (p.daftarTidakHadir && p.daftarTidakHadir.length > 0) {
    msg += `\n📋 *Daftar Santri Masbuk / Sakit / Izin / Alpa*:\n`;
    p.daftarTidakHadir.forEach((s, idx) => {
      const icon = s.status === "ALPA" ? "❌" : s.status === "SAKIT" ? "🏥" : s.status === "IZIN" ? "📝" : "⏱️";
      msg += `${idx + 1}. ${icon} *${s.nama}* (${s.kelas}) — [${s.status}]${s.catatan ? ` : _${s.catatan}_` : ""}\n`;
    });
  }

  msg += `\n_Laporan otomatis terverifikasi sistem portal:_\n`;
  msg += `🔗 ${PORTAL_URL}\n`;

  return msg;
}

