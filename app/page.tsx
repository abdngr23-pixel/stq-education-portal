"use client";

import React, { useState, useEffect, useTransition, useMemo, useRef } from "react";
import { AppSidebar } from "@/components/navigation/app-sidebar";
import { AppHeader } from "@/components/navigation/app-header";
import { MobileBottomNav } from "@/components/navigation/mobile-bottom-nav";
import {
  AppNavId,
  normalizeNavTab,
  isNavPermitted,
  ROLE_NAV_MAP,
  ALL_NAV_ITEMS,
} from "@/types/navigation";
import {
  Role,
  getHalaqohByStaff,
} from "@/types/auth";
import { getCurrentUserAction, logoutAction } from "@/app/actions/auth";
import { getSantriListAction } from "@/app/actions/santri";
import { getHalaqohListAction } from "@/app/actions/halaqoh";
import { getDaftarKesehatanAction } from "@/app/actions/kesehatan";
import { PrintRapor } from "@/components/print/print-rapor";
import { PrintSurat } from "@/components/print/print-surat";
import { PrintSP } from "@/components/print/print-sp";
import { PrintLaporanBulanan } from "@/components/print/print-laporan-bulanan";
import { WhatsAppDialog } from "@/components/ui/whatsapp-dialog";
import { tambahAgendaAction } from "@/app/actions/kalender";
import { toggleUserStatusAction, resetUserPasswordAction } from "@/app/actions/users";
import { getAuditLogsAction, type AuditLogItem } from "@/app/actions/audit";
import { kirimKotakSaranAction } from "@/app/actions/portal-wali";
import { type LaporanBulananData } from "@/app/actions/laporan-bulanan";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertCircle, X, Printer } from "lucide-react";
import { cn } from "@/lib/utils";

// Domain Modules
import { BerandaModule, DashboardSantriSummary } from "@/components/modules/beranda-module";
import { SantriModule } from "@/components/modules/santri-module";
import { TahfizhModule } from "@/components/modules/tahfizh-module";
import { AkademikModule } from "@/components/modules/akademik-module";
import { PresensiModule } from "@/components/modules/presensi-module";
import { PerizinanModule, IzinItem } from "@/components/modules/perizinan-module";
import { KedisiplinanModule, SPRecord, PelanggaranRecord } from "@/components/modules/kedisiplinan-module";
import { KesehatanModule } from "@/components/modules/kesehatan-module";
import { LogistikModule } from "@/components/modules/logistik-module";
import { AnggaranModule } from "@/components/modules/anggaran-module";
import { SponsorModule } from "@/components/modules/sponsor-module";
import { SuratModule } from "@/components/modules/surat-module";
import { KalenderModule, AgendaItem } from "@/components/modules/kalender-module";
import { UsersModule, UserAccountItem } from "@/components/modules/users-module";
import { AuditModule } from "@/components/modules/audit-module";
import { PortalWaliModule, SaranItem } from "@/components/modules/portal-wali-module";

// =========================================================================
// MOCK DATA AWAL SISTEM STQ DARUL ULUM CENDEKIA
// =========================================================================

const INITIAL_AUDIT_LOGS: AuditLogItem[] = [
  {
    id: "log-1",
    action: "INPUT_SETORAN_TAHFIZH",
    entity: "SetoranTahfizh",
    entityId: "SET-00192",
    details: { santri: "Obama Ozearld Egberted Turizqi", juz: 4, nilai: "MUMTAZ", jenis: "SABAQ" },
    createdAt: new Date("2026-09-08T07:45:00.000Z"),
    user: { username: "razan.mt", email: "razan.mt@stqduc.sch.id", role: "MT" },
  },
  {
    id: "log-2",
    action: "PENCATATAN_PELANGGARAN_X2",
    entity: "PelanggaranSantri",
    entityId: "PLG-00045",
    details: { santri: "M. Hafizh Dzulqarnain", poin: 10, isPengulangan: false, catatan: "Terlambat halaqoh" },
    createdAt: new Date("2026-09-08T07:20:00.000Z"),
    user: { username: "mujaddid.mk", email: "mujaddid.mk@stqduc.sch.id", role: "MK" },
  },
  {
    id: "log-3",
    action: "APPROVAL_PERIZINAN_KS",
    entity: "PerizinanSantri",
    entityId: "IZN-00088",
    details: { santri: "Obama Ozearld Egberted Turizqi", jenis: "PULANG", status: "DISETUJUI" },
    createdAt: new Date("2026-09-08T06:30:00.000Z"),
    user: { username: "mudir.ks", email: "mudir.ks@stqduc.sch.id", role: "KS" },
  },
  {
    id: "log-4",
    action: "GENERASI_SURAT_RESMI_AI",
    entity: "SuratResmi",
    entityId: "SRT-00012",
    details: { nomorSurat: "012/STQ-DUC/SP/IX/2026", perihal: "Surat Keterangan Aktif" },
    createdAt: new Date("2026-09-08T05:15:00.000Z"),
    user: { username: "aminah.adm", email: "aminah.adm@stqduc.sch.id", role: "ADM" },
  },
];

export default function Home() {
  const [isSessionLoading, setIsSessionLoading] = useState<boolean>(true);
  const [selectedRole, setSelectedRole] = useState<Role>("MT");
  const [currentUserName, setCurrentUserName] = useState<string>("");
  const [activeStaffKey, setActiveStaffKey] = useState<string>("");
  const [serverHalaqohName, setServerHalaqohName] = useState<string | null>(null);
  const [selectedSantriForPrint, setSelectedSantriForPrint] = useState<DashboardSantriSummary | null>(null);
  const [activeKesehatanRecordsCount, setActiveKesehatanRecordsCount] = useState<number>(0);
  const [halaqohFilter, setHalaqohFilter] = useState<string>("ALL");
  const [activeTab, setActiveTab] = useState<AppNavId>("beranda");
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [isPending, startTransition] = useTransition();

  // Accessible feedback banner state
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // -------------------------------------------------------------
  // MASTER DATA SANTRI (57 Santri Riil DUC)
  // -------------------------------------------------------------
  const [santriList, setSantriList] = useState<DashboardSantriSummary[]>([
    // Halaqoh Ust. Razan Mufli, S.Pd (Musyrif Ketahfidzhan)
    { id: "cm_santri_1", nis: "SAN-0001", nama: "Obama Ozearld Egberted Turizqi", kelas: "9A Takhossus", halaqoh: "Halaqoh Ust. Razan Mufli, S.Pd", capaianJuz: 22, targetJuz: 30, setoranTerakhir: "Al-Ahzab: 1-35", status: "AKTIF", nilaiTerakhir: "MUMTAZ", poinPelanggaran: 0, modalHalamanAwal: 420, totalHalaman: 444 },
    { id: "cm_santri_2", nis: "SAN-0002", nama: "Muhammad Fardhan", kelas: "9A Takhossus", halaqoh: "Halaqoh Ust. Razan Mufli, S.Pd", capaianJuz: 16, targetJuz: 20, setoranTerakhir: "Hlm 333 (16 Juz 13 Hlm)", status: "AKTIF", nilaiTerakhir: "JAYYID_JIDDAN", poinPelanggaran: 0, modalHalamanAwal: 317, totalHalaman: 333 },
    { id: "cm_santri_3", nis: "SAN-0003", nama: "Muh. Fauzan", kelas: "9A Takhossus", halaqoh: "Halaqoh Ust. Razan Mufli, S.Pd", capaianJuz: 19, targetJuz: 25, setoranTerakhir: "Maryam: 1-40", status: "AKTIF", nilaiTerakhir: "JAYYID_JIDDAN", poinPelanggaran: 0, modalHalamanAwal: 360, totalHalaman: 381 },
    { id: "cm_santri_4", nis: "SAN-0004", nama: "Khubaib", kelas: "9A Takhossus", halaqoh: "Halaqoh Ust. Razan Mufli, S.Pd", capaianJuz: 22, targetJuz: 30, setoranTerakhir: "Fatir: 1-30", status: "AKTIF", nilaiTerakhir: "JAYYID_JIDDAN", poinPelanggaran: 0, modalHalamanAwal: 420, totalHalaman: 442 },
    { id: "cm_santri_5", nis: "SAN-0005", nama: "Abd. Riziq Ardi", kelas: "9A Takhossus", halaqoh: "Halaqoh Ust. Razan Mufli, S.Pd", capaianJuz: 22, targetJuz: 30, setoranTerakhir: "Yasin: 1-50", status: "AKTIF", nilaiTerakhir: "JAYYID_JIDDAN", poinPelanggaran: 0, modalHalamanAwal: 420, totalHalaman: 443 },

    // Halaqoh Ust. Kamal (Mudhabbir)
    { id: "cm_santri_6", nis: "SAN-0006", nama: "Muhammad Amirul Hanif Al-Fatih", kelas: "8A Takhossus", halaqoh: "Halaqoh Ust. Kamal", capaianJuz: 12, targetJuz: 15, setoranTerakhir: "Yusuf: 1-30", status: "AKTIF", nilaiTerakhir: "JAYYID", poinPelanggaran: 0 },
    { id: "cm_santri_7", nis: "SAN-0007", nama: "Muh. Riski Isral Wijaya", kelas: "8A Takhossus", halaqoh: "Halaqoh Ust. Kamal", capaianJuz: 13, targetJuz: 15, setoranTerakhir: "Ibrahim: 1-25", status: "AKTIF", nilaiTerakhir: "JAYYID_JIDDAN", poinPelanggaran: 0 },
    { id: "cm_santri_8", nis: "SAN-0008", nama: "Muhammad Ridwan Kamil", kelas: "8A Takhossus", halaqoh: "Halaqoh Ust. Kamal", capaianJuz: 10, targetJuz: 12, setoranTerakhir: "At-Taubah: 50-80", status: "AKTIF", nilaiTerakhir: "MUMTAZ", poinPelanggaran: 0 },
    { id: "cm_santri_9", nis: "SAN-0009", nama: "Ahmad Ripai", kelas: "8A Takhossus", halaqoh: "Halaqoh Ust. Kamal", capaianJuz: 10, targetJuz: 12, setoranTerakhir: "Yunus: 1-30", status: "AKTIF", nilaiTerakhir: "JAYYID_JIDDAN", poinPelanggaran: 0 },
    { id: "cm_santri_10", nis: "SAN-0010", nama: "Muhammad Mikhael", kelas: "8A Takhossus", halaqoh: "Halaqoh Ust. Kamal", capaianJuz: 10, targetJuz: 12, setoranTerakhir: "Hud: 1-25", status: "AKTIF", nilaiTerakhir: "JAYYID", poinPelanggaran: 0 },
    { id: "cm_santri_11", nis: "SAN-0011", nama: "Arya Idris", kelas: "7A Takhossus", halaqoh: "Halaqoh Ust. Kamal", capaianJuz: 5, targetJuz: 7, setoranTerakhir: "An-Nisa: 100-120", status: "AKTIF", nilaiTerakhir: "MUMTAZ", poinPelanggaran: 0 },
    { id: "cm_santri_12", nis: "SAN-0012", nama: "Muhammad Ghozy Ma'Arif", kelas: "7A Takhossus", halaqoh: "Halaqoh Ust. Kamal", capaianJuz: 5, targetJuz: 7, setoranTerakhir: "Ali 'Imran: 50-70", status: "AKTIF", nilaiTerakhir: "JAYYID_JIDDAN", poinPelanggaran: 0 },
    { id: "cm_santri_13", nis: "SAN-0013", nama: "Muhammad Walied", kelas: "7A Takhossus", halaqoh: "Halaqoh Ust. Kamal", capaianJuz: 5, targetJuz: 7, setoranTerakhir: "Al-Baqarah: 250-270", status: "AKTIF", nilaiTerakhir: "JAYYID_JIDDAN", poinPelanggaran: 0 },
    { id: "cm_santri_14", nis: "SAN-0014", nama: "Hilmy Mutawakkil Al Muntashir", kelas: "8A Takhossus", halaqoh: "Halaqoh Ust. Kamal", capaianJuz: 15, targetJuz: 18, setoranTerakhir: "Al-Isra: 1-30", status: "AKTIF", nilaiTerakhir: "MUMTAZ", poinPelanggaran: 0 },

    // Halaqoh Ust. Rizaldi (Mudhabbir)
    { id: "cm_santri_15", nis: "SAN-0015", nama: "Achmad Sufiyan", kelas: "8B Takhossus", halaqoh: "Halaqoh Ust. Rizaldi", capaianJuz: 8, targetJuz: 10, setoranTerakhir: "Al-A'raf: 1-30", status: "AKTIF", nilaiTerakhir: "JAYYID", poinPelanggaran: 0 },
    { id: "cm_santri_16", nis: "SAN-0016", nama: "Muh. Rifki Pria Herman", kelas: "8B Takhossus", halaqoh: "Halaqoh Ust. Rizaldi", capaianJuz: 8, targetJuz: 10, setoranTerakhir: "Al-An'am: 100-130", status: "AKTIF", nilaiTerakhir: "JAYYID_JIDDAN", poinPelanggaran: 0 },
    { id: "cm_santri_17", nis: "SAN-0017", nama: "Muh Fadhlih Aksa", kelas: "7B Takhossus", halaqoh: "Halaqoh Ust. Rizaldi", capaianJuz: 4, targetJuz: 6, setoranTerakhir: "An-Nisa: 1-25", status: "AKTIF", nilaiTerakhir: "JAYYID", poinPelanggaran: 0 },
    { id: "cm_santri_18", nis: "SAN-0018", nama: "Muhammad Rizky Ashari", kelas: "7B Takhossus", halaqoh: "Halaqoh Ust. Rizaldi", capaianJuz: 5, targetJuz: 7, setoranTerakhir: "Ali 'Imran: 120-145", status: "AKTIF", nilaiTerakhir: "JAYYID", poinPelanggaran: 0 },
    { id: "cm_santri_19", nis: "SAN-0019", nama: "Hafidzh Asri", kelas: "7B Takhossus", halaqoh: "Halaqoh Ust. Rizaldi", capaianJuz: 3, targetJuz: 5, setoranTerakhir: "Al-Baqarah: 180-210", status: "AKTIF", nilaiTerakhir: "MUMTAZ", poinPelanggaran: 0 },
    { id: "cm_santri_20", nis: "SAN-0020", nama: "Qonit Su'Adiy", kelas: "7B Takhossus", halaqoh: "Halaqoh Ust. Rizaldi", capaianJuz: 5, targetJuz: 7, setoranTerakhir: "Ali 'Imran: 80-105", status: "AKTIF", nilaiTerakhir: "JAYYID_JIDDAN", poinPelanggaran: 0 },
    { id: "cm_santri_21", nis: "SAN-0021", nama: "Raja Muddin", kelas: "8B Takhossus", halaqoh: "Halaqoh Ust. Rizaldi", capaianJuz: 6, targetJuz: 8, setoranTerakhir: "Al-Ma'idah: 40-65", status: "AKTIF", nilaiTerakhir: "JAYYID", poinPelanggaran: 0 },
    { id: "cm_santri_22", nis: "SAN-0022", nama: "M. Alief Pratama", kelas: "8B Takhossus", halaqoh: "Halaqoh Ust. Rizaldi", capaianJuz: 7, targetJuz: 9, setoranTerakhir: "Al-An'am: 40-70", status: "AKTIF", nilaiTerakhir: "JAYYID", poinPelanggaran: 0 },
    { id: "cm_santri_23", nis: "SAN-0023", nama: "Muh Fadhlan Aksa", kelas: "7B Takhossus", halaqoh: "Halaqoh Ust. Rizaldi", capaianJuz: 5, targetJuz: 7, setoranTerakhir: "Ali 'Imran: 30-55", status: "AKTIF", nilaiTerakhir: "JAYYID", poinPelanggaran: 0 },
    { id: "cm_santri_24", nis: "SAN-0024", nama: "Muhammad Azaky", kelas: "9A Takhossus", halaqoh: "Halaqoh Ust. Rizaldi", capaianJuz: 15, targetJuz: 18, setoranTerakhir: "Al-Kahfi: 1-40", status: "AKTIF", nilaiTerakhir: "JAYYID_JIDDAN", poinPelanggaran: 0 },

    // Halaqoh Ust. Abi Hudzaifah (Mudhabbir)
    { id: "cm_santri_25", nis: "SAN-0025", nama: "Syahrul Haq", kelas: "7A Takhossus", halaqoh: "Halaqoh Ust. Abi Hudzaifah", capaianJuz: 5, targetJuz: 7, setoranTerakhir: "Ali 'Imran: 1-25", status: "AKTIF", nilaiTerakhir: "JAYYID", poinPelanggaran: 0 },
    { id: "cm_santri_26", nis: "SAN-0026", nama: "Iksanul Haq", kelas: "7A Takhossus", halaqoh: "Halaqoh Ust. Abi Hudzaifah", capaianJuz: 4, targetJuz: 6, setoranTerakhir: "Al-Baqarah: 220-240", status: "AKTIF", nilaiTerakhir: "JAYYID", poinPelanggaran: 0 },
    { id: "cm_santri_27", nis: "SAN-0027", nama: "M. Alamsyah", kelas: "7A Takhossus", halaqoh: "Halaqoh Ust. Abi Hudzaifah", capaianJuz: 3, targetJuz: 5, setoranTerakhir: "Al-Baqarah: 140-160", status: "AKTIF", nilaiTerakhir: "MAQBUL", poinPelanggaran: 0 },
    { id: "cm_santri_28", nis: "SAN-0028", nama: "Ahmad Fausan Al Farisi", kelas: "8A Takhossus", halaqoh: "Halaqoh Ust. Abi Hudzaifah", capaianJuz: 6, targetJuz: 8, setoranTerakhir: "Al-Ma'idah: 1-25", status: "AKTIF", nilaiTerakhir: "JAYYID", poinPelanggaran: 0 },
    { id: "cm_santri_29", nis: "SAN-0029", nama: "Abdul Karim", kelas: "7A Takhossus", halaqoh: "Halaqoh Ust. Abi Hudzaifah", capaianJuz: 3, targetJuz: 5, setoranTerakhir: "Al-Baqarah: 160-180", status: "AKTIF", nilaiTerakhir: "JAYYID", poinPelanggaran: 0 },
    { id: "cm_santri_30", nis: "SAN-0030", nama: "Muhammad Asfa Ilham Ridwan", kelas: "8A Takhossus", halaqoh: "Halaqoh Ust. Abi Hudzaifah", capaianJuz: 6, targetJuz: 8, setoranTerakhir: "Al-Ma'idah: 60-80", status: "AKTIF", nilaiTerakhir: "JAYYID_JIDDAN", poinPelanggaran: 0 },
    { id: "cm_santri_31", nis: "SAN-0031", nama: "Khaerul Azam Abu Bakar", kelas: "8A Takhossus", halaqoh: "Halaqoh Ust. Abi Hudzaifah", capaianJuz: 6, targetJuz: 8, setoranTerakhir: "Al-Ma'idah: 80-100", status: "AKTIF", nilaiTerakhir: "JAYYID_JIDDAN", poinPelanggaran: 0 },
    { id: "cm_santri_32", nis: "SAN-0032", nama: "Muh. Alif Ihsan", kelas: "8A Takhossus", halaqoh: "Halaqoh Ust. Abi Hudzaifah", capaianJuz: 6, targetJuz: 8, setoranTerakhir: "Al-An'am: 1-25", status: "AKTIF", nilaiTerakhir: "JAYYID_JIDDAN", poinPelanggaran: 0 },
    { id: "cm_santri_33", nis: "SAN-0033", nama: "Muh. Imran Maulana Sahid", kelas: "7A Takhossus", halaqoh: "Halaqoh Ust. Abi Hudzaifah", capaianJuz: 4, targetJuz: 6, setoranTerakhir: "Al-Baqarah: 240-260", status: "AKTIF", nilaiTerakhir: "JAYYID_JIDDAN", poinPelanggaran: 0 },
    { id: "cm_santri_34", nis: "SAN-0034", nama: "Affan Garatta", kelas: "9A Takhossus", halaqoh: "Halaqoh Ust. Abi Hudzaifah", capaianJuz: 14, targetJuz: 16, setoranTerakhir: "Al-Hijr: 1-40", status: "AKTIF", nilaiTerakhir: "MUMTAZ", poinPelanggaran: 0 },

    // Halaqoh Ust. Alwan (Mudhabbir)
    { id: "cm_santri_35", nis: "SAN-0035", nama: "Laode Hisyam Arqana", kelas: "7B Takhossus", halaqoh: "Halaqoh Ust. Alwan", capaianJuz: 3, targetJuz: 5, setoranTerakhir: "Al-Baqarah: 170-190", status: "AKTIF", nilaiTerakhir: "JAYYID", poinPelanggaran: 0 },
    { id: "cm_santri_36", nis: "SAN-0036", nama: "Xavier Omar Syarif Hidayatullah", kelas: "7B Takhossus", halaqoh: "Halaqoh Ust. Alwan", capaianJuz: 2, targetJuz: 4, setoranTerakhir: "Al-Baqarah: 100-120", status: "AKTIF", nilaiTerakhir: "JAYYID", poinPelanggaran: 0 },
    { id: "cm_santri_37", nis: "SAN-0037", nama: "Muhammad Syafiq", kelas: "7B Takhossus", halaqoh: "Halaqoh Ust. Alwan", capaianJuz: 2, targetJuz: 4, setoranTerakhir: "Al-Baqarah: 80-100", status: "AKTIF", nilaiTerakhir: "JAYYID", poinPelanggaran: 0 },
    { id: "cm_santri_38", nis: "SAN-0038", nama: "Andi Muhammad Ghazi Al Fatih", kelas: "7B Takhossus", halaqoh: "Halaqoh Ust. Alwan", capaianJuz: 3, targetJuz: 5, setoranTerakhir: "Al-Baqarah: 150-170", status: "AKTIF", nilaiTerakhir: "JAYYID", poinPelanggaran: 0 },
    { id: "cm_santri_39", nis: "SAN-0039", nama: "Zulkifli", kelas: "7B Takhossus", halaqoh: "Halaqoh Ust. Alwan", capaianJuz: 2, targetJuz: 4, setoranTerakhir: "Al-Baqarah: 120-140", status: "AKTIF", nilaiTerakhir: "JAYYID", poinPelanggaran: 0 },
    { id: "cm_santri_40", nis: "SAN-0040", nama: "M. Dzul Jalaali Walikhrom Rf", kelas: "7B Takhossus", halaqoh: "Halaqoh Ust. Alwan", capaianJuz: 1, targetJuz: 3, setoranTerakhir: "Al-Baqarah: 50-70", status: "AKTIF", nilaiTerakhir: "JAYYID", poinPelanggaran: 0 },
    { id: "cm_santri_41", nis: "SAN-0041", nama: "Abdullah Khairun Nizham", kelas: "7B Takhossus", halaqoh: "Halaqoh Ust. Alwan", capaianJuz: 3, targetJuz: 5, setoranTerakhir: "Al-Baqarah: 160-180", status: "AKTIF", nilaiTerakhir: "JAYYID", poinPelanggaran: 0 },
    { id: "cm_santri_42", nis: "SAN-0042", nama: "Andi Muh Rizky S", kelas: "7B Takhossus", halaqoh: "Halaqoh Ust. Alwan", capaianJuz: 1, targetJuz: 3, setoranTerakhir: "Al-Baqarah: 40-60", status: "AKTIF", nilaiTerakhir: "JAYYID", poinPelanggaran: 0 },
    { id: "cm_santri_43", nis: "SAN-0043", nama: "Muhammad Rifky Firjatullah", kelas: "8B Takhossus", halaqoh: "Halaqoh Ust. Alwan", capaianJuz: 5, targetJuz: 7, setoranTerakhir: "Ali 'Imran: 50-80", status: "AKTIF", nilaiTerakhir: "JAYYID_JIDDAN", poinPelanggaran: 0 },
    { id: "cm_santri_44", nis: "SAN-0044", nama: "Rahmatullah S.", kelas: "7B Takhossus", halaqoh: "Halaqoh Ust. Alwan", capaianJuz: 2, targetJuz: 4, setoranTerakhir: "Al-Baqarah: 110-130", status: "AKTIF", nilaiTerakhir: "JAYYID", poinPelanggaran: 0 },
    { id: "cm_santri_45", nis: "SAN-0045", nama: "Ade Naufal", kelas: "7B Takhossus", halaqoh: "Halaqoh Ust. Alwan", capaianJuz: 3, targetJuz: 5, setoranTerakhir: "Al-Baqarah: 160-180", status: "AKTIF", nilaiTerakhir: "MUMTAZ", poinPelanggaran: 0 },
    { id: "cm_santri_46", nis: "SAN-0046", nama: "Hafiz Abd Aziz", kelas: "8B Takhossus", halaqoh: "Halaqoh Ust. Alwan", capaianJuz: 5, targetJuz: 7, setoranTerakhir: "Ali 'Imran: 100-125", status: "AKTIF", nilaiTerakhir: "JAYYID", poinPelanggaran: 0 },
    { id: "cm_santri_47", nis: "SAN-0047", nama: "Badar Fayyadh Nabil", kelas: "7B Takhossus", halaqoh: "Halaqoh Ust. Alwan", capaianJuz: 1, targetJuz: 3, setoranTerakhir: "Al-Baqarah: 1-25", status: "AKTIF", nilaiTerakhir: "JAYYID", poinPelanggaran: 0 },

    // Halaqoh Ustadzah Lisa Dwina Fitri (Musyrifah Putri)
    { id: "cm_santri_48", nis: "SAN-0048", nama: "Habiba Asri", kelas: "9C Putri", halaqoh: "Halaqoh Ustadzah Lisa Dwina Fitri", capaianJuz: 21, targetJuz: 30, setoranTerakhir: "Al-Ahzab: 30-60", status: "AKTIF", nilaiTerakhir: "MUMTAZ", poinPelanggaran: 0 },
    { id: "cm_santri_49", nis: "SAN-0049", nama: "Meisya Arrahma", kelas: "9C Putri", halaqoh: "Halaqoh Ustadzah Lisa Dwina Fitri", capaianJuz: 17, targetJuz: 20, setoranTerakhir: "Al-Isra: 50-80", status: "AKTIF", nilaiTerakhir: "JAYYID_JIDDAN", poinPelanggaran: 0 },
    { id: "cm_santri_50", nis: "SAN-0050", nama: "Rahmawati", kelas: "8C Putri", halaqoh: "Halaqoh Ustadzah Lisa Dwina Fitri", capaianJuz: 11, targetJuz: 15, setoranTerakhir: "Yusuf: 40-70", status: "AKTIF", nilaiTerakhir: "JAYYID_JIDDAN", poinPelanggaran: 0 },
    { id: "cm_santri_51", nis: "SAN-0051", nama: "Annisa Az Zahrah A.", kelas: "8C Putri", halaqoh: "Halaqoh Ustadzah Lisa Dwina Fitri", capaianJuz: 12, targetJuz: 15, setoranTerakhir: "Hud: 50-80", status: "AKTIF", nilaiTerakhir: "JAYYID_JIDDAN", poinPelanggaran: 0 },
    { id: "cm_santri_52", nis: "SAN-0052", nama: "Aisyah Muthmainnah", kelas: "8C Putri", halaqoh: "Halaqoh Ustadzah Lisa Dwina Fitri", capaianJuz: 10, targetJuz: 13, setoranTerakhir: "At-Taubah: 80-100", status: "AKTIF", nilaiTerakhir: "JAYYID_JIDDAN", poinPelanggaran: 0 },
    { id: "cm_santri_53", nis: "SAN-0053", nama: "Nur Aqsa", kelas: "7C Putri", halaqoh: "Halaqoh Ustadzah Lisa Dwina Fitri", capaianJuz: 3, targetJuz: 5, setoranTerakhir: "Al-Baqarah: 170-190", status: "AKTIF", nilaiTerakhir: "JAYYID", poinPelanggaran: 0 },
    { id: "cm_santri_54", nis: "SAN-0054", nama: "Sri Ramadhaniyanti", kelas: "7C Putri", halaqoh: "Halaqoh Ustadzah Lisa Dwina Fitri", capaianJuz: 2, targetJuz: 5, setoranTerakhir: "Al-Baqarah: 130-150", status: "AKTIF", nilaiTerakhir: "JAYYID", poinPelanggaran: 0 },
    { id: "cm_santri_55", nis: "SAN-0055", nama: "Farhana", kelas: "7C Putri", halaqoh: "Halaqoh Ustadzah Lisa Dwina Fitri", capaianJuz: 4, targetJuz: 6, setoranTerakhir: "Al-Baqarah: 240-260", status: "AKTIF", nilaiTerakhir: "JAYYID", poinPelanggaran: 0 },
    { id: "cm_santri_56", nis: "SAN-0056", nama: "Rushaifa Rustam", kelas: "7C Putri", halaqoh: "Halaqoh Ustadzah Lisa Dwina Fitri", capaianJuz: 2, targetJuz: 5, setoranTerakhir: "Al-Baqarah: 110-130", status: "AKTIF", nilaiTerakhir: "JAYYID", poinPelanggaran: 0 },
    { id: "cm_santri_57", nis: "SAN-0057", nama: "Naafilah Kaltsum Aslan", kelas: "7C Putri", halaqoh: "Halaqoh Ustadzah Lisa Dwina Fitri", capaianJuz: 5, targetJuz: 7, setoranTerakhir: "Ali 'Imran: 20-45", status: "AKTIF", nilaiTerakhir: "JAYYID_JIDDAN", poinPelanggaran: 0 },
  ]);

  // -------------------------------------------------------------
  // PERIZINAN, DISIPLIN, AGENDA, USERS, AUDIT, KOTAK SARAN
  // -------------------------------------------------------------
  const [izinList] = useState<IzinItem[]>([
    {
      id: "iz_1",
      kodeIzin: "IZN-000001",
      santriNama: "Obama Ozearld Egberted Turizqi",
      santriNis: "SAN-0001",
      kelas: "9A Takhossus",
      jenis: "SAKIT",
      durasi: "2 Hari",
      alasan: "Demam dan flu, istirahat di UKS pengawasan klinik pesantren",
      status: "DISETUJUI",
      diverifikasiOleh: "Ust. Mujaddid Zhohruddin (MK)",
    },
    {
      id: "iz_2",
      kodeIzin: "IZN-000002",
      santriNama: "M. Hafizh Dzulqarnain",
      santriNis: "SAN-0002",
      kelas: "7A",
      jenis: "PULANG",
      durasi: "3 Hari",
      alasan: "Acara pernikahan keluarga kandung di luar kota",
      status: "MENUNGGU_KS",
      diverifikasiOleh: "Disetujui MK, Menunggu Pengesahan Mudir",
    },
  ]);

  const [pelanggaranHistory] = useState<PelanggaranRecord[]>([
    {
      id: "p_1",
      kode: "PLG-000001",
      santriNama: "Zaidan Al-Farisi",
      kategori: "Terlambat Sholat Berjamaah",
      poin: 5,
      isPengulangan: false,
      tanggal: "05/09/2026",
      pencatat: "Ust. Mujaddid (MK)",
    },
    {
      id: "p_2",
      kode: "PLG-000002",
      santriNama: "Zaidan Al-Farisi",
      kategori: "Terlambat Sholat Berjamaah",
      poin: 10,
      isPengulangan: true,
      tanggal: "07/09/2026",
      pencatat: "Ust. Mujaddid (MK)",
    },
  ]);

  const [spList] = useState<SPRecord[]>([
    {
      id: "sp_1",
      nomorSP: "001/SP-1/DUC/2026",
      santriNama: "Zaidan Al-Farisi",
      tingkat: 1,
      totalPoin: 25,
      tanggal: "07/09/2026",
      status: "AKTIF",
    },
  ]);

  const [agendaList, setAgendaList] = useState<AgendaItem[]>([
    { id: "agd-01", judul: "Ujian Ikhtibar Tahfizh Semester Ganjil", tanggal: "15 - 20 September 2026", kategori: "TAHFIZH", lokasi: "Masjid Utama Pesantren" },
    { id: "agd-02", judul: "Rihlah Tarbawiyah & Camping Qur'ani", tanggal: "01 - 03 Oktober 2026", kategori: "KEGIATAN_SANTRI", lokasi: "Bumi Perkemahan Mandiri" },
    { id: "agd-03", judul: "Pertemuan Evaluasi Wali Santri & Mudir", tanggal: "18 Oktober 2026", kategori: "KEGIATAN_SANTRI", lokasi: "Aula STQ DUC" },
    { id: "agd-04", judul: "Libur Kepulangan Pertengahan Semester", tanggal: "24 - 28 Oktober 2026", kategori: "LIBUR", lokasi: "Kompleks Pondok" },
  ]);

  const [usersList, setUsersList] = useState<UserAccountItem[]>([
    { id: "usr-01", username: "mudir.ks", role: "KS", nama: "Ust. Andi Quarzy Ayatullah, S.H, M.H", status: "AKTIF" },
    { id: "usr-02", username: "aminah.adm", role: "ADM", nama: "Siti Aminah, S.Kom.", status: "AKTIF" },
    { id: "usr-03", username: "razan.mt", role: "MT", nama: "Ust. Razan Mufli, S.Pd", status: "AKTIF" },
    { id: "usr-04", username: "mujaddid.mk", role: "MK", nama: "Ust. Mujaddid Zhohruddin", status: "AKTIF" },
    { id: "usr-05", username: "lisa.mt", role: "MT", nama: "Ustadzah Lisa Dwina Fitri", status: "AKTIF" },
    { id: "usr-06", username: "kamal.ph", role: "PH", nama: "Ust. Kamal", status: "AKTIF" },
    { id: "usr-07", username: "rizaldi.ph", role: "PH", nama: "Ust. Rizaldi", status: "AKTIF" },
    { id: "usr-08", username: "hudzaifah.ph", role: "PH", nama: "Ust. Abi Hudzaifah", status: "AKTIF" },
    { id: "usr-09", username: "alwan.ph", role: "PH", nama: "Ust. Alwan", status: "AKTIF" },
    { id: "usr-10", username: "nurul.ga", role: "GA", nama: "Ustzh. Nurul Hidayah, S.Pd.", status: "AKTIF" },
    { id: "usr-11", username: "yayasan", role: "YAY", nama: "Pembina Yayasan DUC", status: "AKTIF" },
    { id: "usr-12", username: "osda", role: "OSDA", nama: "Ketua OSDA Pesantren", status: "AKTIF" },
    { id: "usr-13", username: "walisantri", role: "WS", nama: "Wali Obama Ozearld", status: "AKTIF" },
    { id: "usr-14", username: "santri.obama", role: "ST", nama: "Obama Ozearld Egberted Turizqi", status: "AKTIF" },
  ]);

  const [kotakSaranList, setKotakSaranList] = useState<SaranItem[]>([
    {
      id: "srn-01",
      nama: "Wali Santri Obama Ozearld",
      kategori: "Gizi & Katering",
      pesan: "Mohon porsi sayur mayur dan buah segar untuk santri dapat divariasikan setiap pekan.",
      tanggapan: "Jazakallahu khairan atas masukannya. Menu dapur santri telah kami koordinasikan dengan bagian logistik keasramaan untuk penambahan buah pepaya dan pisang 3x seminggu.",
      status: "DITANGGAPI",
    },
  ]);

  const [auditLogsList, setAuditLogsList] = useState<AuditLogItem[]>(INITIAL_AUDIT_LOGS);

  // Print modal state
  const [showPrintModal, setShowPrintModal] = useState<"rapor" | "surat" | "sp" | "laporan_bulanan" | null>(null);
  const [printLaporanData, setPrintLaporanData] = useState<LaporanBulananData | null>(null);

  // WhatsApp Dialog State
  const [globalWaDialog, setGlobalWaDialog] = useState<{
    isOpen: boolean;
    phone: string;
    recipientName: string;
    message: string;
    title?: string;
    description?: string;
    onConfirmSent?: () => void;
  }>({
    isOpen: false,
    phone: "",
    recipientName: "",
    message: "",
  });

  // Halaqoh list mapping dinamis dari server
  const [dynamicHalaqohList, setDynamicHalaqohList] = useState<Array<{ id: string; nama: string; pembina: string }>>([
    { id: "HLQ-0001", nama: "Halaqoh Ust. Razan Mufli, S.Pd", pembina: "Ust. Razan Mufli, S.Pd" },
    { id: "HLQ-0002", nama: "Halaqoh Ust. Kamal", pembina: "Ust. Kamal" },
    { id: "HLQ-0003", nama: "Halaqoh Ust. Rizaldi", pembina: "Ust. Rizaldi" },
    { id: "HLQ-0004", nama: "Halaqoh Ust. Abi Hudzaifah", pembina: "Ust. Abi Hudzaifah" },
    { id: "HLQ-0005", nama: "Halaqoh Ust. Alwan", pembina: "Ust. Alwan" },
    { id: "HLQ-0006", nama: "Halaqoh Ustadzah Lisa Dwina Fitri", pembina: "Ustadzah Lisa Dwina Fitri" },
  ]);

  const halaqohList = dynamicHalaqohList;

  const currentHalaqohName = useMemo(() => {
    if (serverHalaqohName) return serverHalaqohName;
    return getHalaqohByStaff(activeStaffKey);
  }, [serverHalaqohName, activeStaffKey]);

  // Allowed tabs based on official server role
  const allowedTabs = useMemo(() => {
    return ROLE_NAV_MAP[selectedRole] || ["beranda"];
  }, [selectedRole]);

  // Helper untuk memuat ulang daftar santri dari server
  const fetchSantriData = async () => {
    try {
      const res = await getSantriListAction();
      if (res.success && res.data && res.data.length > 0) {
        setSantriList(
          res.data.map((s) => ({
            id: s.id,
            nis: s.nis,
            nama: s.nama,
            kelas: s.kelas,
            halaqoh: s.halaqoh?.nama || "Belum Ditentukan",
            capaianJuz: (s as unknown as { capaianJuz?: number }).capaianJuz || 0,
            targetJuz: 30,
            setoranTerakhir: "-",
            status: s.status,
            nilaiTerakhir: "MUMTAZ",
            poinPelanggaran: 0,
            namaWali: s.namaWali,
            noHpWali: s.noHpWali,
          }))
        );
      }
    } catch {
      // Pertahankan data lokal jika server offline
    }
  };

  // Ref stabil untuk selectedRole agar tidak memicu re-render / re-fetch pada popstate listener
  const selectedRoleRef = useRef<Role>(selectedRole);
  useEffect(() => {
    selectedRoleRef.current = selectedRole;
  }, [selectedRole]);

  // -------------------------------------------------------------
  // SYNC DENGAN SESI SERVER RESMI (Hanya dieksekusi 1x saat mount)
  // -------------------------------------------------------------
  useEffect(() => {
    let isMounted = true;

    const initApp = async () => {
      try {
        const session = await getCurrentUserAction();
        if (!isMounted) return;

        if (!session) {
          // Jangan matikan state loading agar dashboard tidak sempat berkedip sebelum browser berpindah halaman
          if (typeof window !== "undefined") {
            window.location.replace("/login?msg=session_required");
          }
          return;
        }

        setSelectedRole(session.role);
        setCurrentUserName(session.name || "");
        if (session.username) setActiveStaffKey(session.username);
        if (session.halaqohName) setServerHalaqohName(session.halaqohName);

        // Baca parameter navigasi aman (HANYA tab dan filter lokasi)
        if (typeof window !== "undefined") {
          const params = new URLSearchParams(window.location.search);
          const rawTab = params.get("tab");
          const urlHalaqoh = params.get("halaqoh");

          if (rawTab) {
            const normalized = normalizeNavTab(rawTab);
            if (isNavPermitted(normalized, session.role)) {
              setActiveTab(normalized);
            } else {
              setActiveTab("beranda");
            }
          }

          if (urlHalaqoh) {
            setHalaqohFilter(urlHalaqoh);
          }
        }

        // Sinkronisasi data server sekunder (halaqoh, santri, rekam medis)
        try {
          const hlqRes = await getHalaqohListAction();
          if (isMounted && hlqRes.success && hlqRes.data && hlqRes.data.length > 0) {
            setDynamicHalaqohList(
              hlqRes.data.map((h) => ({
                id: h.id,
                nama: h.nama,
                pembina: h.pembina?.nama || "Pembina",
              }))
            );
          }
        } catch {
          // ignore
        }

        try {
          const kesRes = await getDaftarKesehatanAction();
          if (isMounted && kesRes.success && kesRes.data && Array.isArray(kesRes.data)) {
            const activePatients = kesRes.data.filter(
              (k: { status: string }) => k.status === "RAWAT_PONDOK" || k.status === "DIRUJUK_PUSKESMAS" || k.status === "DIRUJUK_RS"
            );
            setActiveKesehatanRecordsCount(activePatients.length);
          }
        } catch {
          // ignore
        }

        if (isMounted) {
          await fetchSantriData();
        }

        if (isMounted) {
          setIsSessionLoading(false);
        }
      } catch (err) {
        console.error("Gagal menginisialisasi sesi:", err);
        if (isMounted) {
          setIsSessionLoading(false);
        }
      }
    };

    void initApp();

    return () => {
      isMounted = false;
    };
  }, []); // Run strictly once on mount

  // Listener navigasi popstate browser (Back/Forward) secara terpisah
  useEffect(() => {
    const handlePopState = () => {
      if (typeof window === "undefined") return;
      const p = new URLSearchParams(window.location.search);
      const t = p.get("tab");
      const h = p.get("halaqoh");

      // Validasi izin akses tab pada navigasi browser Back / Forward
      if (t) {
        const normalized = normalizeNavTab(t);
        if (isNavPermitted(normalized, selectedRoleRef.current)) {
          setActiveTab(normalized);
        } else {
          setActiveTab("beranda");
        }
      }
      if (h) setHalaqohFilter(h);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Sync state back to URL secara aman (TIDAK PERNAH menulis role ke URL)
  useEffect(() => {
    if (typeof window === "undefined" || isSessionLoading) return;
    const params = new URLSearchParams(window.location.search);
    let changed = false;

    // Bersihkan parameter 'role' jika pengguna mencoba memasukkannya secara manual
    if (params.has("role")) {
      params.delete("role");
      changed = true;
    }

    if (params.get("tab") !== activeTab) {
      params.set("tab", activeTab);
      changed = true;
    }

    if (halaqohFilter && halaqohFilter !== "ALL") {
      if (params.get("halaqoh") !== halaqohFilter) {
        params.set("halaqoh", halaqohFilter);
        changed = true;
      }
    } else if (params.has("halaqoh")) {
      params.delete("halaqoh");
      changed = true;
    }

    if (changed) {
      const queryStr = params.toString();
      const newUrl = queryStr ? `${window.location.pathname}?${queryStr}` : window.location.pathname;
      window.history.replaceState({}, "", newUrl);
    }
  }, [activeTab, halaqohFilter, isSessionLoading]);

  // Escape key listener untuk menutup modal global
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowPrintModal(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Tab Selection Handler dengan RBAC & History Push yang aman
  const handleSelectTab = (tab: AppNavId) => {
    // Validasi RBAC
    if (!isNavPermitted(tab, selectedRole)) {
      setFeedback({
        type: "error",
        text: `Modul "${ALL_NAV_ITEMS[tab]?.label || tab}" tidak diizinkan untuk peran ${selectedRole}.`,
      });
      setActiveTab("beranda");
      return;
    }
    setActiveTab(tab);
    setFeedback(null);

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      params.delete("role");
      params.set("tab", tab);
      const newUrl = `${window.location.pathname}?${params.toString()}`;
      window.history.pushState({}, "", newUrl);
    }
  };

  // Logout Handler
  const handleLogout = async () => {
    try {
      await logoutAction();
    } catch (e) {
      console.error("Gagal memanggil logoutAction:", e);
    }
    try {
      await fetch("/api/v1/auth/logout", { method: "POST" });
    } catch {
      // ignore
    }
    if (typeof window !== "undefined") {
      window.location.replace("/login");
    }
  };

  // Agenda Action
  const handleTambahAgenda = async (data: {
    judul: string;
    tanggal: string;
    kategori: string;
    lokasi: string;
  }) => {
    if (!["ADM", "KS"].includes(selectedRole)) {
      setFeedback({ type: "error", text: "Hanya Admin & Mudir yang berwenang menambah agenda." });
      return;
    }
    startTransition(async () => {
      const res = await tambahAgendaAction({
        judul: data.judul,
        tanggalMulai: data.tanggal,
        kategori: data.kategori,
        targetPeserta: "SEMUA",
        lokasi: data.lokasi,
      });

      if (!res.success) {
        setFeedback({ type: "error", text: res.message || "Gagal mencatat agenda." });
        return;
      }

      const resData = res.data as { id?: string } | undefined;
      const newAgd: AgendaItem = {
        id: resData?.id || `agd-${Date.now()}`,
        judul: data.judul,
        tanggal: data.tanggal,
        kategori: data.kategori,
        lokasi: data.lokasi,
      };

      setAgendaList((prev) => [...prev, newAgd]);
      setFeedback({
        type: "success",
        text: res.message || `Agenda "${data.judul}" berhasil dicatat di server kalender.`,
      });
    });
  };

  // User Actions
  const handleToggleUserStatus = async (id: string) => {
    if (selectedRole !== "ADM" && selectedRole !== "KS") {
      setFeedback({ type: "error", text: "Hanya Admin & Mudir yang berwenang mengelola status pengguna." });
      return;
    }
    if (typeof window !== "undefined" && !window.confirm("Apakah Anda yakin ingin mengubah status aktif akun ini?")) {
      return;
    }
    startTransition(async () => {
      const res = await toggleUserStatusAction(id);
      if (!res.success) {
        setFeedback({ type: "error", text: res.message || "Gagal mengubah status akun." });
        return;
      }
      setUsersList((prev) =>
        prev.map((u) => (u.id === id ? { ...u, status: u.status === "AKTIF" ? "NONAKTIF" : "AKTIF" } : u))
      );
      setFeedback({ type: "success", text: res.message || "Status pengguna berhasil diperbarui." });
    });
  };

  const handleResetPassword = async (username: string) => {
    if (selectedRole !== "ADM" && selectedRole !== "KS") {
      setFeedback({ type: "error", text: "Hanya Admin & Mudir yang berwenang me-reset kata sandi." });
      return;
    }
    if (typeof window !== "undefined" && !window.confirm(`Reset kata sandi akun "${username}" ke default?`)) {
      return;
    }
    startTransition(async () => {
      const targetUser = usersList.find((u) => u.username === username);
      if (!targetUser) return;
      const res = await resetUserPasswordAction(targetUser.id);
      if (!res.success) {
        setFeedback({ type: "error", text: res.message || "Gagal me-reset kata sandi." });
        return;
      }
      setFeedback({
        type: "success",
        text: res.message || `Kata sandi akun ${username} berhasil di-reset ke default.`,
      });
    });
  };

  // Audit refresh
  const handleRefreshAuditLogs = async () => {
    startTransition(async () => {
      const res = await getAuditLogsAction();
      if (res.success && res.data) {
        setAuditLogsList(res.data as AuditLogItem[]);
        setFeedback({ type: "success", text: "Catatan jejak audit berhasil disinkronkan dari server." });
      }
    });
  };

  // Kotak saran
  const handleKirimSaran = async (kategori: string, pesan: string) => {
    startTransition(async () => {
      const res = await kirimKotakSaranAction({ nama: currentUserName, kategori, pesan });
      if (!res.success) {
        setFeedback({ type: "error", text: res.message || "Gagal mengirim saran." });
        return;
      }
      const newSaran: SaranItem = {
        id: `srn-${Date.now()}`,
        nama: currentUserName,
        kategori,
        pesan,
        tanggapan: null,
        status: "MENUNGGU_TANGGAPAN",
      };
      setKotakSaranList((prev) => [newSaran, ...prev]);
      setFeedback({ type: "success", text: "Aspirasi Anda berhasil dikirimkan ke Mudir STQ." });
    });
  };

  // Counts for Beranda
  const izinPendingCount = useMemo(() => {
    return izinList.filter((i) => i.status === "MENUNGGU_MK" || i.status === "MENUNGGU_KS").length;
  }, [izinList]);

  const santriSakitCount = useMemo(() => {
    // Sesuai Tahap 2: Gunakan data rekam medis aktif server sebagai sumber kebenaran jika tersedia
    if (activeKesehatanRecordsCount > 0) {
      return activeKesehatanRecordsCount;
    }
    return izinList.filter((i) => i.jenis === "SAKIT" && i.status === "DISETUJUI").length;
  }, [activeKesehatanRecordsCount, izinList]);

  // Render current module based on activeTab
  const renderModule = () => {
    switch (activeTab) {
      case "beranda":
        return (
          <BerandaModule
            userRole={selectedRole}
            userName={currentUserName}
            currentHalaqohName={currentHalaqohName}
            santriList={santriList}
            izinPendingCount={izinPendingCount}
            ikhtibarPendingCount={2}
            santriSakitCount={santriSakitCount}
            onNavigate={handleSelectTab}
            onOpenSetoranQuick={() => handleSelectTab("tahfizh")}
          />
        );

      case "data_santri":
        return (
          <SantriModule
            santriList={santriList}
            userRole={selectedRole}
            halaqohList={halaqohList.map((h) => ({ id: h.id, nama: h.nama, pembina: { nama: h.pembina } }))}
            onPrintRapor={(santri) => {
              // Teruskan santri terpilih secara eksklusif (Eliminasi fallback santriList[0])
              const matched = santriList.find((s) => s.nis === santri.nis) || {
                id: santri.id,
                nis: santri.nis,
                nama: santri.nama,
                kelas: santri.kelas,
                halaqoh: (santri.halaqoh as unknown as { nama?: string })?.nama || "Halaqoh",
                capaianJuz: 0,
                targetJuz: 30,
                setoranTerakhir: "-",
                status: santri.status,
                nilaiTerakhir: "MUMTAZ",
                poinPelanggaran: 0,
              };
              setSelectedSantriForPrint(matched);
              setShowPrintModal("rapor");
            }}
            onRefresh={fetchSantriData}
          />
        );

      case "tahfizh":
        return (
          <TahfizhModule
            userRole={selectedRole}
            currentUserName={currentUserName}
            currentHalaqohName={currentHalaqohName}
            santriList={santriList}
            halaqohList={halaqohList}
            onPrintPreview={(data) => {
              setPrintLaporanData(data);
              setShowPrintModal("laporan_bulanan");
            }}
          />
        );

      case "akademik":
        return (
          <AkademikModule
            userRole={selectedRole}
            currentUserName={currentUserName}
            santriList={santriList}
          />
        );

      case "presensi":
        return (
          <PresensiModule
            userRole={selectedRole}
            currentUserName={currentUserName}
            currentHalaqohName={currentHalaqohName}
            santriList={santriList}
            halaqohList={halaqohList}
            onPresensiSaved={(info) => {
              setFeedback({
                type: "success",
                text: `Presensi ${info.kegiatan} berhasil disimpan (${info.total} santri).`,
              });
            }}
          />
        );

      case "perizinan":
        return (
          <PerizinanModule
            userRole={selectedRole}
            currentUserName={currentUserName}
            santriList={santriList}
            izinList={izinList}
            onIzinUpdated={() => {
              setFeedback({ type: "success", text: "Data perizinan santri telah diperbarui." });
            }}
          />
        );

      case "kedisiplinan":
        return (
          <KedisiplinanModule
            userRole={selectedRole}
            currentUserName={currentUserName}
            santriList={santriList}
          />
        );

      case "kesehatan":
        return (
          <KesehatanModule
            userRole={selectedRole}
            currentUserName={currentUserName}
            santriList={santriList}
          />
        );

      case "logistik":
        return (
          <LogistikModule
            userRole={selectedRole}
            currentUserName={currentUserName}
          />
        );

      case "anggaran":
        return (
          <AnggaranModule
            userRole={selectedRole}
            currentUserName={currentUserName}
          />
        );

      case "sponsor":
        return (
          <SponsorModule
            userRole={selectedRole}
            currentUserName={currentUserName}
          />
        );

      case "surat":
        return (
          <SuratModule
            userRole={selectedRole}
            currentUserName={currentUserName}
            santriList={santriList}
          />
        );

      case "kalender":
        return (
          <KalenderModule
            agendaList={agendaList}
            userRole={selectedRole}
            onTambahAgenda={handleTambahAgenda}
            isPending={isPending}
          />
        );

      case "users":
        return (
          <UsersModule
            usersList={usersList}
            userRole={selectedRole}
            onToggleStatus={handleToggleUserStatus}
            onResetPassword={handleResetPassword}
            isPending={isPending}
          />
        );

      case "audit":
        return (
          <AuditModule
            auditLogsList={auditLogsList}
            userRole={selectedRole}
            onRefresh={handleRefreshAuditLogs}
            isPending={isPending}
          />
        );

      case "portal_wali":
        return (
          <PortalWaliModule
            userRole={selectedRole}
            kotakSaranList={kotakSaranList}
            onKirimSaran={handleKirimSaran}
            onPrintRapor={() => setShowPrintModal("rapor")}
            isPending={isPending}
          />
        );

      default:
        return (
          <BerandaModule
            userRole={selectedRole}
            userName={currentUserName}
            currentHalaqohName={currentHalaqohName}
            santriList={santriList}
            izinPendingCount={izinPendingCount}
            ikhtibarPendingCount={2}
            santriSakitCount={santriSakitCount}
            onNavigate={handleSelectTab}
          />
        );
    }
  };

  if (isSessionLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 text-white">
        <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" />
        <h2 className="text-xl font-bold tracking-wide">STQ Darul Ulum Cendekia</h2>
        <p className="text-sm text-emerald-400 mt-1 font-medium">Memuat profil dan hak akses pengguna...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 font-sans text-slate-800">
      {/* 1. Desktop Collapsible Sidebar */}
      <AppSidebar
        activeTab={activeTab}
        allowedTabs={allowedTabs}
        userRole={selectedRole}
        userName={currentUserName}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        onSelectTab={handleSelectTab}
        onLogout={handleLogout}
      />

      {/* 2. Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Header */}
        <AppHeader
          activeTab={activeTab}
          userRole={selectedRole}
          userName={currentUserName}
          currentHalaqohName={currentHalaqohName}
          onLogout={handleLogout}
        />

        {/* Dynamic Page Container */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto pb-28 md:pb-12 space-y-6">
          {/* Accessible Feedback Banner */}
          {feedback && (
            <div
              role="alert"
              aria-live="polite"
              className={cn(
                "p-4 rounded-2xl border flex items-start gap-3 text-sm transition-all shadow-xs",
                feedback.type === "success"
                  ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                  : "bg-red-50 border-red-200 text-red-800"
              )}
            >
              {feedback.type === "success" ? (
                <CheckCircle2 className="h-5 w-5 text-[#0E7C3A] shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-xs">
                  {feedback.type === "success" ? "Operasi Berhasil" : "Akses atau Operasi Ditolak"}
                </p>
                <p className="text-xs opacity-90 mt-0.5">{feedback.text}</p>
              </div>
              <button
                type="button"
                onClick={() => setFeedback(null)}
                aria-label="Tutup Notifikasi"
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-black/5 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Module Output */}
          {renderModule()}
        </main>
      </div>

      {/* 3. Role-Tailored Mobile Bottom Nav */}
      <MobileBottomNav
        activeTab={activeTab}
        allowedTabs={allowedTabs}
        userRole={selectedRole}
        onSelectTab={handleSelectTab}
      />

      {/* 4. Global Print Modal */}
      {showPrintModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="print-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowPrintModal(null);
          }}
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200"
        >
          <div className="bg-white rounded-3xl max-w-4xl w-full p-4 sm:p-7 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 no-print">
              <div className="flex items-center gap-2">
                <Printer className="h-5 w-5 text-[#0E7C3A]" />
                <h3 id="print-modal-title" className="font-bold text-base sm:text-lg text-slate-800">
                  {showPrintModal === "rapor"
                    ? "Pratinjau Cetak Rapor Santri (A4)"
                    : showPrintModal === "sp"
                    ? "Pratinjau Surat Peringatan / SP (A4)"
                    : showPrintModal === "laporan_bulanan"
                    ? "Pratinjau Rekap Laporan Bulanan Resmi (A4 Landscape)"
                    : "Pratinjau Cetak Surat Resmi (A4)"}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  className="bg-[#0E7C3A] hover:bg-[#0B642E] text-white font-bold text-xs"
                  onClick={() => window.print()}
                  leftIcon={<Printer className="h-3.5 w-3.5" />}
                >
                  Cetak / Unduh PDF
                </Button>
                <button
                  type="button"
                  onClick={() => setShowPrintModal(null)}
                  aria-label="Tutup Dialog Pratinjau Cetak"
                  className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Preview Area */}
            <div className="border border-slate-200 rounded-2xl p-2 sm:p-6 bg-slate-50/50 overflow-x-auto">
              {showPrintModal === "rapor" && (
                <PrintRapor
                  santri={
                    selectedSantriForPrint
                      ? {
                          nama: selectedSantriForPrint.nama,
                          nis: selectedSantriForPrint.nis,
                          kelas: selectedSantriForPrint.kelas,
                          halaqoh: selectedSantriForPrint.halaqoh,
                          capaianJuz: selectedSantriForPrint.capaianJuz,
                          targetJuz: selectedSantriForPrint.targetJuz,
                          setoranTerakhir: selectedSantriForPrint.setoranTerakhir,
                          nilaiTerakhir: selectedSantriForPrint.nilaiTerakhir,
                        }
                      : {
                          nama: santriList[0]?.nama || "Santri",
                          nis: santriList[0]?.nis || "-",
                          kelas: santriList[0]?.kelas || "-",
                          halaqoh: santriList[0]?.halaqoh || "-",
                          capaianJuz: santriList[0]?.capaianJuz || 0,
                          targetJuz: 30,
                        }
                  }
                  nilaiAkademik={[
                    { mapel: "Bahasa Arab", kategori: "Kepesantrenan", angka: 90, huruf: "A", guru: "Ustzh. Nurul Hidayah, S.Pd." },
                    { mapel: "Tafsir Al-Qur'an", kategori: "Kepesantrenan", angka: 94, huruf: "A", guru: "Ust. Razan Mufli, S.Pd" },
                    { mapel: "Fikih Ibadah & Muamalah", kategori: "Kepesantrenan", angka: 92, huruf: "A", guru: "Ust. Mujaddid Zhohruddin" },
                    { mapel: "Aqidah Islamiyyah", kategori: "Kepesantrenan", angka: 95, huruf: "A", guru: "Ust. Andi Quarzy Ayatullah, S.H, M.H" },
                    { mapel: "Ilmu Tajwid", kategori: "Kepesantrenan", angka: 91, huruf: "A", guru: "Ust. Razan Mufli, S.Pd" },
                    { mapel: "Matematika Terapan", kategori: "Studi Umum", angka: 86, huruf: "A", guru: "Ustzh. Nurul Hidayah, S.Pd." },
                    { mapel: "Bahasa Inggris", kategori: "Studi Umum", angka: 88, huruf: "A", guru: "Ustzh. Nurul Hidayah, S.Pd." },
                  ]}
                />
              )}
              {showPrintModal === "surat" && (
                <PrintSurat
                  perihal="Surat Keterangan Santri Aktif"
                  tujuan="Kementerian Agama / Lembaga Beasiswa"
                  santriNama={selectedSantriForPrint?.nama || santriList[0]?.nama || "Santri"}
                  santriNis={selectedSantriForPrint?.nis || santriList[0]?.nis || "-"}
                  santriKelas={selectedSantriForPrint?.kelas || santriList[0]?.kelas || "-"}
                  isiPokok="Menerangkan bahwa santri yang bersangkutan terdaftar aktif dalam program ketahfidzhan dan pendidikan kesantrian di STQ Darul Ulum Cendekia untuk Tahun Ajaran 2026/2027."
                />
              )}
              {showPrintModal === "sp" && (
                <PrintSP
                  tingkatSP="SP1"
                  santriNama={selectedSantriForPrint?.nama || spList[0]?.santriNama || santriList[0]?.nama || "Santri"}
                  santriNis={selectedSantriForPrint?.nis || santriList[0]?.nis || "-"}
                  santriKelas={selectedSantriForPrint?.kelas || santriList[0]?.kelas || "-"}
                  totalPoin={spList[0]?.totalPoin || 25}
                  riwayatPelanggaran={pelanggaranHistory.map((p) => ({
                    deskripsi: p.kategori,
                    poin: p.poin,
                    tanggal: p.tanggal,
                    isPengulangan: p.isPengulangan,
                  }))}
                  arahanPembinaan="Diberikan pembinaan tarbiyah intensif, shalat tepat waktu di shaf pertama, dan penugasan murojaah juz pilihan bersama Musyrif Asrama."
                />
              )}
              {showPrintModal === "laporan_bulanan" && printLaporanData && (
                <PrintLaporanBulanan
                  laporanData={printLaporanData}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* 5. Universal WhatsApp Dialog */}
      <WhatsAppDialog
        isOpen={globalWaDialog.isOpen}
        onClose={() => setGlobalWaDialog((prev) => ({ ...prev, isOpen: false }))}
        defaultPhone={globalWaDialog.phone}
        defaultRecipientName={globalWaDialog.recipientName}
        defaultMessage={globalWaDialog.message}
        title={globalWaDialog.title}
        description={globalWaDialog.description}
        onConfirmSent={globalWaDialog.onConfirmSent}
      />
    </div>
  );
}
