"use client";

import React, { useState, useEffect, useTransition } from "react";
import { TopNavbar } from "@/components/navigation/top-navbar";
import { MobileBottomNav, type NavTabId } from "@/components/navigation/mobile-bottom-nav";
import { DualTierNav, type NavClusterId } from "@/components/navigation/dual-tier-nav";
import { PrintRapor } from "@/components/print/print-rapor";
import { PrintSurat } from "@/components/print/print-surat";
import { PrintSP } from "@/components/print/print-sp";
import { DashboardWaliSantri } from "@/components/dashboard/dashboard-wali-santri";
import { DashboardMusyrifTahfizh } from "@/components/dashboard/dashboard-musyrif-tahfizh";
import { DashboardMusyrifKesantrian } from "@/components/dashboard/dashboard-musyrif-kesantrian";
import { DashboardGuruAkademik } from "@/components/dashboard/dashboard-guru-akademik";
import { DashboardMudirKS } from "@/components/dashboard/dashboard-mudir-ks";
import { RekapLaporanBulanan } from "@/components/dashboard/rekap-laporan-bulanan";
import { ManajemenHalaqoh } from "@/components/dashboard/manajemen-halaqoh";
import { MasterDataSantri } from "@/components/dashboard/master-data-santri";
import { PrintLaporanBulanan } from "@/components/print/print-laporan-bulanan";
import { DashboardYayasan } from "@/components/dashboard/dashboard-yayasan";
import { DashboardAdminTU } from "@/components/dashboard/dashboard-admin-tu";
import { DashboardPembinaAsrama } from "@/components/dashboard/dashboard-pembina-asrama";
import { DashboardOSDA } from "@/components/dashboard/dashboard-osda";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  ROLE_LABELS,
  Role,
  PERMISSION_MATRIX,
  ModuleName,
  DEMO_ACCOUNTS,
  ALL_STAFF_ACCOUNTS,
  ALL_MUDHABBIR_ACCOUNTS,
  ALL_MUSYRIF_TAHFIZH_ACCOUNTS,
  STAFF_HALAQOH_MAP,
  getHalaqohByStaff,
  type StaffAccountItem,
  ROLE_PERMITTED_CLUSTERS,
  ROLE_PERMITTED_TABS,
} from "@/types/auth";
import { quickDemoLoginAction, getCurrentUserAction } from "@/app/actions/auth";
import { createSetoranAction } from "@/app/actions/tahfizh";
import { inputNilaiAction } from "@/app/actions/akademik";
import { ajukanIzinAction, verifikasiIzinAction } from "@/app/actions/kesantrian";
import { catatPelanggaranAction, putihkanSPAction } from "@/app/actions/kedisiplinan";
import { ajukanKebutuhanAction, verifikasiPengajuanAction } from "@/app/actions/administrasi";
import { tambahSponsorAction, kirimLaporanWhatsAppAction } from "@/app/actions/sponsor";
import { generateSuratAIAction } from "@/app/actions/surat";
import { ajukanIkhtibarAction, inputHasilTahap1Action, inputHasilTahap2Action } from "@/app/actions/ikhtibar";
import { catatKesehatanAction, updateStatusKesehatanAction } from "@/app/actions/kesehatan";
import { catatMutasiLogistikAction } from "@/app/actions/logistik";
import { getAuditLogsAction, type AuditLogItem } from "@/app/actions/audit";
import { exportToCSV } from "@/lib/export-csv";
import { cn } from "@/lib/utils";
import { WhatsAppDialog } from "@/components/ui/whatsapp-dialog";
import {
  buildSetoranTahfizhWAMessage,
  buildIzinSantriWAMessage,
  buildPelanggaranSPWAMessage,
  buildProgressSantriWAMessage,
} from "@/lib/whatsapp";
import {
  Users,
  BookCheck,
  BookOpen,
  TrendingUp,
  ShieldCheck,
  ShieldAlert,
  PlusCircle,
  Award,
  CheckCircle2,
  Clock,
  Sparkles,
  Lock,
  AlertCircle,
  GraduationCap,
  Home as HomeIcon,
  Send,
  AlertTriangle,
  FileCheck,
  DollarSign,
  Check,
  RotateCcw,
  HeartHandshake,
  MessageSquare,
  FileText,
  Copy,
  Printer,
  Stethoscope,
  Package,
  CheckCircle,
  FileBadge,
  X,
  Calendar,
  UserCog,
  UserCheck,
  KeyRound,
  MessageCircle,
  Download,
  Activity,
  Building2,
  FileSpreadsheet,
} from "lucide-react";

export default function Home() {
  const [selectedRole, setSelectedRole] = useState<Role>("MT");
  const [currentUserName, setCurrentUserName] = useState<string>(DEMO_ACCOUNTS["MT"].name);
  const [activeStaffKey, setActiveStaffKey] = useState<string>("razan.mt");
  const [halaqohFilter, setHalaqohFilter] = useState<string>("ALL");
  const [activeCluster, setActiveCluster] = useState<NavClusterId>("tahfizh");
  const [activeTab, setActiveTab] = useState<NavTabId | "beranda">("beranda");
  const [isPending, startTransition] = useTransition();

  // Load authenticated session on initial mount
  useEffect(() => {
    getCurrentUserAction().then((session) => {
      if (session) {
        setSelectedRole(session.role);
        setCurrentUserName(session.name);
        const demo = DEMO_ACCOUNTS[session.role];
        if (demo) {
          setActiveCluster(demo.defaultCluster);
          setActiveTab("beranda");
        }
        if (session.username) {
          setActiveStaffKey(session.username);
        }
      }
    });
  }, []);

  // Handle role change (switching or simulation)
  const handleRoleChange = (newRole: Role) => {
    setSelectedRole(newRole);
    const demo = DEMO_ACCOUNTS[newRole];
    if (demo) {
      setCurrentUserName(demo.name);
      setActiveStaffKey(demo.username);
      setActiveCluster(demo.defaultCluster);
      setActiveTab("beranda");
      setFeedback({
        type: "success",
        text: `Beralih ke tampilan peran: ${newRole} — ${demo.roleTitle} (${demo.name}).`,
      });
    }
    startTransition(async () => {
      await quickDemoLoginAction(newRole);
    });
  };

  // Handle direct switch to specific staff / mudhabbir account
  const handleSwitchStaff = (account: StaffAccountItem) => {
    setSelectedRole(account.role);
    setCurrentUserName(account.name);
    setActiveStaffKey(account.username);
    setActiveCluster(account.defaultCluster);
    setActiveTab("beranda");
    setFeedback({
      type: "success",
      text: `Beralih ke akun pembina: ${account.name} (${account.roleTitle} — ${account.halaqohName}). Santri setoran otomatis disesuaikan!`,
    });
    startTransition(async () => {
      await quickDemoLoginAction(account.username);
    });
  };

  // RBAC Permitted Clusters & Tabs
  const allowedClusters = ROLE_PERMITTED_CLUSTERS[selectedRole] || ["tahfizh"];
  const allowedTabs = ROLE_PERMITTED_TABS[selectedRole] || ["tahfizh"];

  // Feedback banner
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // -------------------------------------------------------------
  // DATA MASTER HALAQOH & MUSYRIF / MUDHABBIR (6 HALAQOH RESMI)
  // -------------------------------------------------------------
  const MASTER_HALAQOH_LIST = [
    {
      id: "HLQ-0001",
      halaqohCode: "HLQ-0001",
      nama: "Halaqoh Ust. Razan Mufli, S.Pd",
      tahunAjaran: "2026/2027",
      pembina: { id: "STF-0003", nama: "Ust. Razan Mufli, S.Pd (Musyrif Ketahfidzhan)", staffCode: "STF-0003" },
      _count: { santriList: 5 },
    },
    {
      id: "HLQ-0002",
      halaqohCode: "HLQ-0002",
      nama: "Halaqoh Ust. Kamal",
      tahunAjaran: "2026/2027",
      pembina: { id: "STF-0006", nama: "Ust. Kamal (Mudhabbir)", staffCode: "STF-0006" },
      _count: { santriList: 9 },
    },
    {
      id: "HLQ-0003",
      halaqohCode: "HLQ-0003",
      nama: "Halaqoh Ust. Rizaldi",
      tahunAjaran: "2026/2027",
      pembina: { id: "STF-0007", nama: "Ust. Rizaldi (Mudhabbir)", staffCode: "STF-0007" },
      _count: { santriList: 10 },
    },
    {
      id: "HLQ-0004",
      halaqohCode: "HLQ-0004",
      nama: "Halaqoh Ust. Abi Hudzaifah",
      tahunAjaran: "2026/2027",
      pembina: { id: "STF-0008", nama: "Ust. Abi Hudzaifah (Mudhabbir)", staffCode: "STF-0008" },
      _count: { santriList: 10 },
    },
    {
      id: "HLQ-0005",
      halaqohCode: "HLQ-0005",
      nama: "Halaqoh Ust. Alwan",
      tahunAjaran: "2026/2027",
      pembina: { id: "STF-0009", nama: "Ust. Alwan (Mudhabbir)", staffCode: "STF-0009" },
      _count: { santriList: 13 },
    },
    {
      id: "HLQ-0006",
      halaqohCode: "HLQ-0006",
      nama: "Halaqoh Ustadzah Lisa Dwina Fitri",
      tahunAjaran: "2026/2027",
      pembina: { id: "STF-0005", nama: "Ustadzah Lisa Dwina Fitri (Musyrifah Putri)", staffCode: "STF-0005" },
      _count: { santriList: 10 },
    },
  ];

  const MASTER_STAFF_MUSYRIF_LIST = [
    { id: "STF-0003", nama: "Ust. Razan Mufli, S.Pd (Musyrif Ketahfidzhan)", staffCode: "STF-0003" },
    { id: "STF-0004", nama: "Ust. Mujaddid Zhohruddin (Musyrif Keasramaan)", staffCode: "STF-0004" },
    { id: "STF-0005", nama: "Ustadzah Lisa Dwina Fitri (Musyrifah Putri)", staffCode: "STF-0005" },
    { id: "STF-0006", nama: "Ust. Kamal (Mudhabbir)", staffCode: "STF-0006" },
    { id: "STF-0007", nama: "Ust. Rizaldi (Mudhabbir)", staffCode: "STF-0007" },
    { id: "STF-0008", nama: "Ust. Abi Hudzaifah (Mudhabbir)", staffCode: "STF-0008" },
    { id: "STF-0009", nama: "Ust. Alwan (Mudhabbir)", staffCode: "STF-0009" },
  ];

  // -------------------------------------------------------------
  // DATA MASTER SANTRI
  // -------------------------------------------------------------
  const [santriList, setSantriList] = useState([
    // Halaqoh Ust. Razan Mufli, S.Pd (Musyrif Ketahfidzhan)
    { id: "cm_santri_1", nis: "SAN-0001", nama: "Obama Ozearld Egberted Turizqi", kelas: "9A Takhossus", halaqoh: "Halaqoh Ust. Razan Mufli, S.Pd", capaianJuz: 22, targetJuz: 30, setoranTerakhir: "Al-Ahzab: 1-35", status: "AKTIF", nilaiTerakhir: "MUMTAZ", poinPelanggaran: 0 },
    { id: "cm_santri_2", nis: "SAN-0002", nama: "Muhammad Fardhan", kelas: "9A Takhossus", halaqoh: "Halaqoh Ust. Razan Mufli, S.Pd", capaianJuz: 16, targetJuz: 20, setoranTerakhir: "An-Nahl: 50-80", status: "AKTIF", nilaiTerakhir: "JAYYID_JIDDAN", poinPelanggaran: 0 },
    { id: "cm_santri_3", nis: "SAN-0003", nama: "Muh. Fauzan", kelas: "9A Takhossus", halaqoh: "Halaqoh Ust. Razan Mufli, S.Pd", capaianJuz: 19, targetJuz: 25, setoranTerakhir: "Maryam: 1-40", status: "AKTIF", nilaiTerakhir: "JAYYID_JIDDAN", poinPelanggaran: 0 },
    { id: "cm_santri_4", nis: "SAN-0004", nama: "Khubaib", kelas: "9A Takhossus", halaqoh: "Halaqoh Ust. Razan Mufli, S.Pd", capaianJuz: 22, targetJuz: 30, setoranTerakhir: "Fatir: 1-30", status: "AKTIF", nilaiTerakhir: "JAYYID_JIDDAN", poinPelanggaran: 0 },
    { id: "cm_santri_5", nis: "SAN-0005", nama: "Abd. Riziq Ardi", kelas: "9A Takhossus", halaqoh: "Halaqoh Ust. Razan Mufli, S.Pd", capaianJuz: 22, targetJuz: 30, setoranTerakhir: "Yasin: 1-50", status: "AKTIF", nilaiTerakhir: "JAYYID_JIDDAN", poinPelanggaran: 0 },

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
  // TAB 1: TAHFIZH
  // -------------------------------------------------------------
  const [inputJenis, setInputJenis] = useState<"SABAQ" | "SABQI" | "MANZIL" | "MUFAR">("SABAQ");
  const [jumlahHalaman, setJumlahHalaman] = useState("1");
  const [tahfizhSubView, setTahfizhSubView] = useState<"rekap_bulanan" | "input">("rekap_bulanan");
  const [printLaporanData, setPrintLaporanData] = useState<any>(null);
  const [nilai, setNilai] = useState<"MUMTAZ" | "JAYYID_JIDDAN" | "JAYYID" | "MAQBUL" | "DHOIF">("MUMTAZ");
  const [selectedSantriNis, setSelectedSantriNis] = useState("SAN-0001");
  const [juz, setJuz] = useState("4");
  const [surahMulai, setSurahMulai] = useState("Ali 'Imran");
  const [ayatMulai, setAyatMulai] = useState("1");
  const [surahSelesai, setSurahSelesai] = useState("Ali 'Imran");
  const [ayatSelesai, setAyatSelesai] = useState("20");
  const [catatan, setCatatan] = useState("");

  // State WhatsApp Direct Dialog Universal
  const [globalWaDialog, setGlobalWaDialog] = useState<{
    isOpen: boolean;
    phone: string;
    recipientName: string;
    message: string;
    title: string;
    description: string;
  }>({
    isOpen: false,
    phone: "081299887766",
    recipientName: "Wali Santri",
    message: "",
    title: "Kirim Pesan via WhatsApp Direct",
    description: "Pesan terformat akan dibuka di WhatsApp resmi Anda tanpa biaya langganan API.",
  });

  // Notifikasi Setoran Terakhir Tersimpan untuk Direct WA Action
  const [lastSetoranSaved, setLastSetoranSaved] = useState<{
    santriNama: string;
    santriNis: string;
    kelas: string;
    namaWali?: string;
    noHpWali?: string;
    jenisSetoran: string;
    juz: number | string;
    surah: string;
    ayatMulai: number | string;
    ayatSelesai: number | string;
    nilai: string;
    catatan?: string;
    jumlahHalaman?: number | string;
  } | null>(null);

  // -------------------------------------------------------------
  // LOGIKA FILTER SANTRI DINAMIS PER KELOMPOK HALAQOH
  // -------------------------------------------------------------
  // Kelompok halaqoh aktif berdasarkan profil ustadz login saat ini
  const currentHalaqohName = React.useMemo(() => {
    const byStaff = getHalaqohByStaff(currentUserName) || getHalaqohByStaff(activeStaffKey);
    if (byStaff) return byStaff;
    if (selectedRole === "MT") return "Halaqoh Ust. Razan Mufli, S.Pd";
    if (selectedRole === "PH") return "Halaqoh Ust. Kamal";
    return null;
  }, [currentUserName, activeStaffKey, selectedRole]);

  // Santri yang tampil di modul setoran tahfizh:
  // Jika MT / PH: terisolasi HANYA santri binaan halaqohnya!
  // Jika KS / ADM: dapat melihat semua atau memfilter per halaqoh
  const displayedSantriTahfizh = React.useMemo(() => {
    if (selectedRole === "MT" || selectedRole === "PH") {
      if (currentHalaqohName) {
        const filtered = santriList.filter((s) => s.halaqoh === currentHalaqohName);
        if (filtered.length > 0) return filtered;
      }
    }
    if (halaqohFilter && halaqohFilter !== "ALL") {
      return santriList.filter((s) => s.halaqoh === halaqohFilter);
    }
    return santriList;
  }, [selectedRole, currentHalaqohName, halaqohFilter, santriList]);

  // Sinkronisasi: pastikan selectedSantriNis selalu berada di dalam displayedSantriTahfizh
  useEffect(() => {
    if (displayedSantriTahfizh.length > 0) {
      const exists = displayedSantriTahfizh.some((s) => s.nis === selectedSantriNis);
      if (!exists) {
        setSelectedSantriNis(displayedSantriTahfizh[0].nis);
      }
    }
  }, [displayedSantriTahfizh, selectedSantriNis]);

  // -------------------------------------------------------------
  // TAB 2: AKADEMIK & RAPOR (KURIKULUM RESMI BAB VI & VII)
  // -------------------------------------------------------------
  const [selectedMapel, setSelectedMapel] = useState("MP-KP-01");
  const [inputNilaiAngka, setInputNilaiAngka] = useState("90");
  const [jenisNilai, setJenisNilai] = useState<"TUGAS" | "KEAKTIFAN" | "UTS" | "UAS" | "PBL">("UTS");
  const [nilaiAkademikList, setNilaiAkademikList] = useState([
    { mapel: "Bahasa Arab", kategori: "Kepesantrenan", angka: 90, huruf: "A", guru: "Ustzh. Nurul Hidayah, S.Pd." },
    { mapel: "Tafsir Al-Qur'an", kategori: "Kepesantrenan", angka: 94, huruf: "A", guru: "Ust. Razan Mufli, S.Pd" },
    { mapel: "Fikih Ibadah & Muamalah", kategori: "Kepesantrenan", angka: 92, huruf: "A", guru: "Ust. Mujaddid Zhohruddin" },
    { mapel: "Aqidah Islamiyyah", kategori: "Kepesantrenan", angka: 95, huruf: "A", guru: "Ust. Andi Quarzy Ayatullah, S.H, M.H" },
    { mapel: "Ilmu Tajwid", kategori: "Kepesantrenan", angka: 91, huruf: "A", guru: "Ust. Razan Mufli, S.Pd" },
    { mapel: "Matematika Terapan", kategori: "Studi Umum", angka: 86, huruf: "A", guru: "Ustzh. Nurul Hidayah, S.Pd." },
    { mapel: "Bahasa Inggris", kategori: "Studi Umum", angka: 88, huruf: "A", guru: "Ustzh. Nurul Hidayah, S.Pd." },
    { mapel: "Bahasa Indonesia (PBL)", kategori: "Studi Umum (PBL)", angka: 90, huruf: "A", guru: "Ustzh. Nurul Hidayah, S.Pd." },
  ]);

  // -------------------------------------------------------------
  // TAB 3: KESANTRIAN & PERIZINAN
  // -------------------------------------------------------------
  const [izinList, setIzinList] = useState([
    {
      id: "iz_1",
      kodeIzin: "IZN-000001",
      santriNama: "Obama Ozearld Egberted Turizqi",
      kelas: "7A",
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
      kelas: "7A",
      jenis: "PULANG",
      durasi: "3 Hari",
      alasan: "Acara pernikahan keluarga kandung di luar kota",
      status: "MENUNGGU_KS",
      diverifikasiOleh: "Disetujui MK, Menunggu Pengesahan Mudir (Ust. Andi Quarzy Ayatullah, S.H, M.H)",
    },
  ]);
  const [formIzinJenis, setFormIzinJenis] = useState<"PULANG" | "KELUAR_KOMPLEK" | "SAKIT">("PULANG");
  const [formIzinAlasan, setFormIzinAlasan] = useState("");

  // -------------------------------------------------------------
  // TAB 4: KEDISIPLINAN & BINTANG
  // -------------------------------------------------------------
  const [kategoriPelanggaran, setKategoriPelanggaran] = useState<"PLG_SHOLAT" | "PLG_GADGET" | "PLG_PIKET">("PLG_SHOLAT");
  const [kronologi, setKronologi] = useState("");
  const [pelanggaranHistory, setPelanggaranHistory] = useState([
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
  const [spList, setSpList] = useState([
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

  // -------------------------------------------------------------
  // TAB 5: ADMINISTRASI & PENGAJUAN
  // -------------------------------------------------------------
  const [judulPengajuan, setJudulPengajuan] = useState("");
  const [kategoriPengajuan, setKategoriPengajuan] = useState("LOGISTIK");
  const [nominalPengajuan, setNominalPengajuan] = useState("2500000");
  const [keteranganPengajuan, setKeteranganPengajuan] = useState("");
  const [pengajuanList, setPengajuanList] = useState([
    {
      id: "aju_1",
      kode: "AJU-000001",
      judul: "Pengadaan Mushaf Al-Qur'an Pojok & ATK Halaqoh",
      kategori: "LOGISTIK",
      nominal: 3500000,
      status: "DIAJUKAN",
      diajukanOleh: "admin (Siti Aminah, S.Kom.)",
      catatan: "Kebutuhan mendesak untuk santri baru",
    },
    {
      id: "aju_2",
      kode: "AJU-000002",
      judul: "Konsumsi & Operasional Kajian Bulanan Wali Santri",
      kategori: "KEGIATAN",
      nominal: 1800000,
      status: "DISETUJUI_KS",
      diajukanOleh: "admin (Siti Aminah, S.Kom.)",
      catatan: "Disetujui Mudir/KS untuk pencairan",
    },
  ]);

  // -------------------------------------------------------------
  // TAB 6: ORANG TUA ASUH & WHATSAPP (FASE 4)
  // -------------------------------------------------------------
  const [sponsorList, setSponsorList] = useState([
    {
      id: "spn_1",
      kode: "OTA-001",
      nama: "H. Bambang Irawan & Keluarga",
      noHp: "081298765432",
      santriAsuh: "Zaidan Al-Farisi (SAN-0003)",
      nominal: 1500000,
      statusWA: "TERKIRIM",
      terakhirKirim: "07/09/2026",
    },
    {
      id: "spn_2",
      kode: "OTA-002",
      nama: "Ibu Hj. Rina Marlina",
      noHp: "081388776655",
      santriAsuh: "Muhammad Fatih (SAN-0001)",
      nominal: 2000000,
      statusWA: "BELUM_KIRIM",
      terakhirKirim: "-",
    },
  ]);
  const [pesanWAPreview, setPesanWAPreview] = useState<string | null>(null);

  // -------------------------------------------------------------
  // TAB 7: GENERATOR SURAT RESMI AI (FASE 4)
  // -------------------------------------------------------------
  const [jenisSuratPilihan, setJenisSuratPilihan] = useState<
    "SURAT_KETERANGAN_AKTIF" | "SURAT_UNDANGAN_WALI" | "SURAT_IZIN_KEGIATAN" | "SURAT_REKOMENDASI"
  >("SURAT_KETERANGAN_AKTIF");
  const [perihalSurat, setPerihalSurat] = useState("Surat Keterangan Santri Aktif Pondok");
  const [tujuanSurat, setTujuanSurat] = useState("Kementerian Agama / Lembaga Beasiswa");
  const [isiPokokSurat, setIsiPokokSurat] = useState("Untuk persyaratan administrasi beasiswa tahfizh dan validasi santri aktif.");
  const [hasilSuratAI, setHasilSuratAI] = useState<string | null>(null);

  // -------------------------------------------------------------
  // TAB 8: IKHTIBAR / UJIAN TAHFIZH 2 TAHAP (FASE 6)
  // -------------------------------------------------------------
  const [ikhtibarList, setIkhtibarList] = useState<Array<{
    id: string;
    santri: string;
    nis: string;
    juz: number;
    status: string;
    nilaiTahap1: number | null;
    catatanTahap1: string | null;
    nilaiTahap2: number | null;
    catatanTahap2: string | null;
  }>>([
    {
      id: "ikh-01",
      santri: "Muhammad Fatih Al-Ayyubi",
      nis: "SAN-0001",
      juz: 4,
      status: "LULUS_TAHAP_1",
      nilaiTahap1: 92,
      catatanTahap1: "Makhraj & tajwid fasih dan lancar.",
      nilaiTahap2: null as number | null,
      catatanTahap2: null as string | null,
    },
    {
      id: "ikh-02",
      santri: "Ahmad Ziyad Rahman",
      nis: "SAN-0002",
      juz: 7,
      status: "LULUS_SEMPURNA_TAHAP_2",
      nilaiTahap1: 95,
      catatanTahap1: "Mumtaz! Lancar tanpa jeda.",
      nilaiTahap2: 96,
      catatanTahap2: "Disahkan Mudir Pesantren. Sah hafal Juz 7.",
    },
  ]);
  const [ikhtibarJuz, setIkhtibarJuz] = useState("5");
  const [ikhtibarNilai, setIkhtibarNilai] = useState("90");
  const [ikhtibarCatatan, setIkhtibarCatatan] = useState("Kelancaran sangat baik, makhraj sempurna");

  // -------------------------------------------------------------
  // TAB 9: POSKESTREN / KESEHATAN SANTRI (FASE 6)
  // -------------------------------------------------------------
  const [kesehatanList, setKesehatanList] = useState([
    {
      id: "kes-01",
      santri: "Zaidan Al-Farisi",
      nis: "SAN-0003",
      keluhan: "Demam ringan dan pusing saat halaqoh subuh",
      diagnosa: "Gejala flu & kecapekan",
      tindakan: "Istirahat di UKS Asrama + Paracetamol 500mg & Madu",
      status: "RAWAT_PONDOK",
      tanggal: "07/09/2026",
    },
    {
      id: "kes-02",
      santri: "Muhammad Fatih Al-Ayyubi",
      nis: "SAN-0001",
      keluhan: "Nyeri lambung / maag kambuh",
      diagnosa: "Gastritis ringan",
      tindakan: "Antasida + bubur hangat dari dapur",
      status: "SEMBUH",
      tanggal: "05/09/2026",
    },
  ]);
  const [keluhanInput, setKeluhanInput] = useState("");
  const [tindakanInput, setTindakanInput] = useState("");
  const [statusKesehatanInput, setStatusKesehatanInput] = useState<"RAWAT_PONDOK" | "DIRUJUK_PUSKESMAS" | "DIRUJUK_RS" | "SEMBUH">("RAWAT_PONDOK");

  // -------------------------------------------------------------
  // TAB 10: LOGISTIK & INVENTARIS ASRAMA (FASE 6)
  // -------------------------------------------------------------
  const [logistikList, setLogistikList] = useState([
    { id: "log-01", kode: "LOG-001", nama: "Beras Rojolele Super", kategori: "SEMBAKO", stok: 450, satuan: "Kg", lokasi: "Gudang Dapur" },
    { id: "log-02", kode: "LOG-002", nama: "Minyak Goreng SunCo", kategori: "SEMBAKO", stok: 80, satuan: "Liter", lokasi: "Gudang Dapur" },
    { id: "log-03", kode: "LOG-003", nama: "Paracetamol 500mg", kategori: "OBAT_P3K", stok: 12, satuan: "Strip", lokasi: "Lemari UKS" },
    { id: "log-04", kode: "LOG-004", nama: "Sabun Mandi Lifebuoy", kategori: "PERLENGKAPAN_ASRAMA", stok: 60, satuan: "Pcs", lokasi: "Koperasi Asrama" },
  ]);
  const [selectedLogistikId, setSelectedLogistikId] = useState("log-01");
  const [jenisMutasi, setJenisMutasi] = useState<"MASUK" | "KELUAR">("MASUK");
  const [jumlahMutasi, setJumlahMutasi] = useState("50");
  const [ketMutasi, setKetMutasi] = useState("Donasi Wali Santri");

  // -------------------------------------------------------------
  // MODAL CETAK DOKUMEN RESMI (FASE 6)
  // -------------------------------------------------------------
  const [showPrintModal, setShowPrintModal] = useState<"rapor" | "surat" | "sp" | "laporan_bulanan" | null>(null);

  // -------------------------------------------------------------
  // TAB 11: KALENDER AKADEMIK & AGENDA (FASE 7)
  // -------------------------------------------------------------
  const [agendaList, setAgendaList] = useState([
    { id: "agd-01", judul: "Ujian Ikhtibar Tahfizh Semester Ganjil", tanggal: "15 - 20 September 2026", kategori: "TAHFIZH", lokasi: "Masjid Utama Pesantren" },
    { id: "agd-02", judul: "Rihlah Tarbawiyah & Camping Qur'ani", tanggal: "01 - 03 Oktober 2026", kategori: "KEGIATAN_SANTRI", lokasi: "Bumi Perkemahan Mandiri" },
    { id: "agd-03", judul: "Pertemuan Evaluasi Wali Santri & Mudir", tanggal: "18 Oktober 2026", kategori: "KEGIATAN_SANTRI", lokasi: "Aula STQ DUC" },
    { id: "agd-04", judul: "Libur Kepulangan Pertengahan Semester", tanggal: "24 - 28 Oktober 2026", kategori: "LIBUR", lokasi: "Kompleks Pondok" },
  ]);
  const [judulAgenda, setJudulAgenda] = useState("");
  const [tglAgenda, setTglAgenda] = useState("2026-09-25");
  const [katAgenda, setKatAgenda] = useState("TAHFIZH");
  const [subTabAgenda, setSubTabAgenda] = useState<"ritmik" | "kalender">("ritmik");

  // -------------------------------------------------------------
  // TAB 12: USER & STAFF MANAGEMENT (PENGURUS & ASATIDZ RIIL)
  // -------------------------------------------------------------
  const [usersList, setUsersList] = useState([
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

  // -------------------------------------------------------------
  // KOTAK SARAN WALI SANTRI (FASE 7)
  // -------------------------------------------------------------
  const [kotakSaranList, setKotakSaranList] = useState<Array<{
    id: string;
    nama: string;
    kategori: string;
    pesan: string;
    tanggapan: string | null;
    status: string;
  }>>([
    {
      id: "srn-01",
      nama: "Wali Santri Obama Ozearld",
      kategori: "Gizi & Katering",
      pesan: "Mohon porsi sayur mayur dan buah segar untuk santri dapat divariasikan setiap pekan.",
      tanggapan: "Jazakallahu khairan atas masukannya. Menu dapur santri telah kami koordinasikan dengan bagian logistik keasramaan untuk penambahan buah pepaya dan pisang 3x seminggu.",
      status: "DITANGGAPI",
    },
  ]);
  const [inputSaranKategori, setInputSaranKategori] = useState("Gizi & Katering");
  const [inputSaranPesan, setInputSaranPesan] = useState("");

  const roleInfo = ROLE_LABELS[selectedRole];

  // Audit Logs State (Fase 8)
  const [auditLogsList, setAuditLogsList] = useState<AuditLogItem[]>([
    {
      id: "log-1",
      action: "INPUT_SETORAN_TAHFIZH",
      entity: "SetoranTahfizh",
      entityId: "SET-00192",
      details: { santri: "Obama Ozearld Egberted Turizqi", juz: 4, nilai: "MUMTAZ", jenis: "SABAQ" },
      createdAt: new Date(),
      user: { username: "razan.mt", email: "razan.mt@stqduc.sch.id", role: "MT" },
    },
    {
      id: "log-2",
      action: "PENCATATAN_PELANGGARAN_X2",
      entity: "PelanggaranSantri",
      entityId: "PLG-00045",
      details: { santri: "M. Hafizh Dzulqarnain", poin: 10, isPengulangan: false, catatan: "Terlambat halaqoh" },
      createdAt: new Date(Date.now() - 1000 * 60 * 25),
      user: { username: "mujaddid.mk", email: "mujaddid.mk@stqduc.sch.id", role: "MK" },
    },
    {
      id: "log-3",
      action: "APPROVAL_PERIZINAN_KS",
      entity: "PerizinanSantri",
      entityId: "IZN-00088",
      details: { santri: "Obama Ozearld Egberted Turizqi", jenis: "PULANG", status: "DISETUJUI" },
      createdAt: new Date(Date.now() - 1000 * 60 * 75),
      user: { username: "mudir.ks", email: "mudir.ks@stqduc.sch.id", role: "KS" },
    },
    {
      id: "log-4",
      action: "GENERASI_SURAT_RESMI_AI",
      entity: "SuratResmi",
      entityId: "SRT-00012",
      details: { nomorSurat: "012/STQ-DUC/SP/IX/2026", perihal: "Surat Keterangan Aktif" },
      createdAt: new Date(Date.now() - 1000 * 60 * 150),
      user: { username: "aminah.adm", email: "aminah.adm@stqduc.sch.id", role: "ADM" },
    },
  ]);

  const handleRefreshAuditLogs = () => {
    startTransition(async () => {
      const res = await getAuditLogsAction();
      if (res.success && res.data) {
        setAuditLogsList(res.data);
        setFeedback({ type: "success", text: "Log audit sistem berhasil dimuat ulang." });
      } else {
        setFeedback({ type: "error", text: res.message || "Gagal memuat log audit." });
      }
    });
  };

  // -------------------------------------------------------------
  // HANDLERS
  // -------------------------------------------------------------

  // Tahfizh
  const handleSaveSetoran = () => {
    setFeedback(null);
    if (!["MT", "PH", "KS"].includes(selectedRole)) {
      setFeedback({ type: "error", text: `Role '${selectedRole}' tidak berhak input setoran tahfizh.` });
      return;
    }
    startTransition(async () => {
      const activeSantri = santriList.find((s) => s.nis === selectedSantriNis);
      if (!activeSantri) return;
      await createSetoranAction({
        santriId: activeSantri.id,
        jenis: inputJenis,
        juz: parseInt(juz) || 1,
        surahMulai,
        ayatMulai: parseInt(ayatMulai) || 1,
        surahSelesai,
        ayatSelesai: parseInt(ayatSelesai) || 1,
        nilai,
        catatan,
        jumlahHalaman: inputJenis === "SABAQ" ? parseInt(jumlahHalaman) || 1 : undefined,
      });
      setSantriList((prev) =>
        prev.map((s) => (s.nis === selectedSantriNis ? { ...s, setoranTerakhir: `${surahMulai}: ${ayatMulai}-${ayatSelesai}`, nilaiTerakhir: nilai } : s))
      );
      setLastSetoranSaved({
        santriNama: activeSantri.nama,
        santriNis: activeSantri.nis,
        kelas: activeSantri.kelas,
        namaWali: (activeSantri as any).namaWali,
        noHpWali: (activeSantri as any).noHpWali,
        jenisSetoran: inputJenis,
        juz,
        surah: surahMulai,
        ayatMulai,
        ayatSelesai,
        nilai,
        catatan,
        jumlahHalaman: inputJenis === "SABAQ" ? jumlahHalaman : undefined,
      });
      setFeedback({ type: "success", text: `Alhamdulillah! Setoran ${activeSantri.nama} berhasil dicatat di PostgreSQL.` });
      setCatatan("");
    });
  };

  // Akademik
  const handleSaveNilai = () => {
    setFeedback(null);
    if (selectedRole !== "GA" && selectedRole !== "KS") {
      setFeedback({ type: "error", text: `Role '${selectedRole}' tidak berhak input nilai akademik (Hanya GA & KS).` });
      return;
    }
    startTransition(async () => {
      const angkaNum = parseFloat(inputNilaiAngka) || 80;
      let huruf = "C";
      if (angkaNum >= 90) huruf = "A";
      else if (angkaNum >= 80) huruf = "B";

      const mapelMap: Record<string, { nama: string; kategori: string; guru: string }> = {
        "MP-KP-01": { nama: "Bahasa Arab", kategori: "Kepesantrenan", guru: "Ustzh. Nurul Hidayah, S.Pd." },
        "MP-KP-02": { nama: "Tafsir Al-Qur'an", kategori: "Kepesantrenan", guru: "Ust. Razan Mufli, S.Pd" },
        "MP-KP-03": { nama: "Fikih Ibadah & Muamalah", kategori: "Kepesantrenan", guru: "Ust. Mujaddid Zhohruddin" },
        "MP-KP-04": { nama: "Aqidah Islamiyyah", kategori: "Kepesantrenan", guru: "Ust. Andi Quarzy Ayatullah, S.H, M.H" },
        "MP-KP-05": { nama: "Ilmu Tajwid", kategori: "Kepesantrenan", guru: "Ust. Razan Mufli, S.Pd" },
        "MP-UM-01": { nama: "Matematika Terapan", kategori: "Studi Umum", guru: "Ustzh. Nurul Hidayah, S.Pd." },
        "MP-UM-02": { nama: "Bahasa Inggris", kategori: "Studi Umum", guru: "Ustzh. Nurul Hidayah, S.Pd." },
        "MP-PBL-01": { nama: "Bahasa Indonesia (PBL)", kategori: "Studi Umum (PBL)", guru: "Ustzh. Nurul Hidayah, S.Pd." },
        "MP-PBL-02": { nama: "IPA (PBL)", kategori: "Studi Umum (PBL)", guru: "Ustzh. Nurul Hidayah, S.Pd." },
        "MP-PBL-03": { nama: "IPS (PBL)", kategori: "Studi Umum (PBL)", guru: "Ustzh. Nurul Hidayah, S.Pd." },
        "MP-PBL-04": { nama: "TIK & Literasi Digital (PBL)", kategori: "Studi Umum (PBL)", guru: "Ustzh. Nurul Hidayah, S.Pd." },
        "MP-DIN-01": { nama: "Fikih Ibadah & Muamalah", kategori: "Kepesantrenan", guru: "Ust. Mujaddid Zhohruddin" },
        "MP-DIN-02": { nama: "Bahasa Arab", kategori: "Kepesantrenan", guru: "Ustzh. Nurul Hidayah, S.Pd." },
        "MP-PES-01": { nama: "Aqidah Islamiyyah", kategori: "Kepesantrenan", guru: "Ust. Andi Quarzy Ayatullah, S.H, M.H" },
      };

      const meta = mapelMap[selectedMapel] || {
        nama: "Mata Pelajaran Resmi",
        kategori: "Kepesantrenan",
        guru: "Ustzh. Nurul Hidayah, S.Pd.",
      };

      setNilaiAkademikList((prev) => [
        { mapel: meta.nama, kategori: meta.kategori, angka: angkaNum, huruf, guru: meta.guru },
        ...prev.filter((i) => i.mapel !== meta.nama),
      ]);
      setFeedback({ type: "success", text: `Nilai ${meta.nama} (${huruf} - ${angkaNum}) berhasil disimpan oleh ${meta.guru}.` });
    });
  };

  // Izin
  const handleAjukanIzin = () => {
    setFeedback(null);
    if (!formIzinAlasan.trim()) { setFeedback({ type: "error", text: "Alasan perizinan wajib diisi." }); return; }
    startTransition(async () => {
      const newIzin = {
        id: `iz_${Date.now()}`,
        kodeIzin: `IZN-00000${izinList.length + 1}`,
        santriNama: "Muhammad Fatih",
        kelas: "7A",
        jenis: formIzinJenis,
        durasi: "2 Hari",
        alasan: formIzinAlasan,
        status: "MENUNGGU_MK",
        diverifikasiOleh: "Menunggu Verifikasi Musyrif Keasramaan",
      };
      setIzinList([newIzin, ...izinList]);
      setFormIzinAlasan("");
      setFeedback({ type: "success", text: `Izin ${newIzin.kodeIzin} berhasil diajukan ke MK.` });
    });
  };

  const handleApproveIzin = (id: string, action: "APPROVE" | "ESCALATE" | "REJECT") => {
    setFeedback(null);
    if (selectedRole !== "MK" && selectedRole !== "KS") {
      setFeedback({ type: "error", text: `Role '${selectedRole}' tidak berwenang memverifikasi izin (Hanya MK & KS).` });
      return;
    }
    startTransition(async () => {
      setIzinList((prev) =>
        prev.map((item) => {
          if (item.id === id) {
            if (action === "REJECT") {
              return { ...item, status: "DITOLAK", diverifikasiOleh: `Ditolak oleh ${selectedRole}` };
            }
            return action === "ESCALATE"
              ? { ...item, status: "MENUNGGU_KS", diverifikasiOleh: "Disetujui MK, Dieskalasikan ke Mudir/KS" }
              : { ...item, status: "DISETUJUI", diverifikasiOleh: `Disetujui oleh ${selectedRole}` };
          }
          return item;
        })
      );
      setFeedback({ type: "success", text: action === "REJECT" ? "Izin santri DITOLAK." : action === "ESCALATE" ? "Izin dieskalasikan ke Mudir/KS." : "Izin resmi DISETUJUI." });
    });
  };

  // Kedisiplinan Poin x2
  const handleCatatPelanggaran = () => {
    setFeedback(null);
    if (!["PH", "MK", "MT", "KS"].includes(selectedRole)) {
      setFeedback({ type: "error", text: `Role '${selectedRole}' tidak berhak mencatat pelanggaran.` });
      return;
    }
    if (!kronologi.trim()) { setFeedback({ type: "error", text: "Kronologi kejadian wajib diisi." }); return; }

    startTransition(async () => {
      const activeSantri = santriList.find((s) => s.nis === selectedSantriNis) || santriList[0];
      const kategoriNama = kategoriPelanggaran === "PLG_SHOLAT" ? "Terlambat Sholat Berjamaah" : kategoriPelanggaran === "PLG_GADGET" ? "Membawa Gadget Ilegal" : "Tidak Melaksanakan Piket Asrama";
      const poinDasar = kategoriPelanggaran === "PLG_SHOLAT" ? 5 : kategoriPelanggaran === "PLG_GADGET" ? 25 : 10;
      const sudahPernah = pelanggaranHistory.some((p) => p.santriNama === activeSantri.nama && p.kategori === kategoriNama);
      const isPengulangan = sudahPernah;
      const poinFinal = isPengulangan ? poinDasar * 2 : poinDasar;
      const newTotalPoin = activeSantri.poinPelanggaran + poinFinal;

      setPelanggaranHistory([{ id: `plg_${Date.now()}`, kode: `PLG-00000${pelanggaranHistory.length + 1}`, santriNama: activeSantri.nama, kategori: kategoriNama, poin: poinFinal, isPengulangan, tanggal: "07/09/2026", pencatat: `${selectedRole}` }, ...pelanggaranHistory]);
      setSantriList((prev) => prev.map((s) => (s.nis === activeSantri.nis ? { ...s, poinPelanggaran: newTotalPoin } : s)));

      let spNotice = "";
      if (newTotalPoin >= 20 && !spList.some((sp) => sp.santriNama === activeSantri.nama && sp.tingkat === 1)) {
        const newSP = { id: `sp_${Date.now()}`, nomorSP: `00${spList.length + 1}/SP-1/DUC/2026`, santriNama: activeSantri.nama, tingkat: 1, totalPoin: newTotalPoin, tanggal: "07/09/2026", status: "AKTIF" };
        setSpList([newSP, ...spList]);
        spNotice = ` PERINGATAN: Total poin mencapai ${newTotalPoin}! SP 1 otomatis terbit.`;
      }
      setKronologi("");
      setFeedback({ type: "success", text: `Pelanggaran ${activeSantri.nama} dicatat (+${poinFinal} poin)${isPengulangan ? " [Poin x2]" : ""}.${spNotice}` });
    });
  };

  const handlePutihkanSP = (spId: string) => {
    if (selectedRole !== "KS") { setFeedback({ type: "error", text: "Hanya Mudir (KS) yang berwenang memutihkan SP." }); return; }
    startTransition(async () => {
      setSpList((prev) => prev.map((sp) => (sp.id === spId ? { ...sp, status: "DIPUTIHKAN" } : sp)));
      setFeedback({ type: "success", text: "Surat Peringatan telah resmi DIPUTIHKAN oleh Mudir/KS." });
    });
  };

  // Administrasi
  const handleAjukanKebutuhan = () => {
    if (selectedRole !== "ADM" && selectedRole !== "KS") { setFeedback({ type: "error", text: "Hanya Admin (ADM) yang berwenang mengajukan anggaran." }); return; }
    if (!judulPengajuan.trim()) { setFeedback({ type: "error", text: "Judul pengajuan wajib diisi." }); return; }
    startTransition(async () => {
      const nominalNum = parseFloat(nominalPengajuan) || 1000000;
      setPengajuanList([{ id: `aju_${Date.now()}`, kode: `AJU-00000${pengajuanList.length + 1}`, judul: judulPengajuan, kategori: kategoriPengajuan, nominal: nominalNum, status: "DIAJUKAN", diajukanOleh: "admin", catatan: keteranganPengajuan || "Kebutuhan operasional" }, ...pengajuanList]);
      setJudulPengajuan(""); setKeteranganPengajuan("");
      setFeedback({ type: "success", text: `Pengajuan anggaran Rp ${nominalNum.toLocaleString("id-ID")} diajukan ke Mudir/KS.` });
    });
  };

  const handleApprovePengajuan = (id: string, status: "DISETUJUI_KS" | "DITOLAK") => {
    if (selectedRole !== "KS") { setFeedback({ type: "error", text: "Hanya Mudir (KS) yang berwenang menyetujui anggaran." }); return; }
    startTransition(async () => {
      setPengajuanList((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)));
      setFeedback({ type: "success", text: `Status pengajuan diubah menjadi: ${status}.` });
    });
  };

  // Orang Tua Asuh & WhatsApp (Fase 4)
  const handleKirimWA = (id: string, nama: string, noHp: string, santri: string) => {
    startTransition(async () => {
      const formatPesan = `*LAPORAN PERKEMBANGAN TAHFIZH SANTRI*
*STQ DARUL ULUM CENDEKIA*
Periode: Agustus 2026

Kepada Yth. Donatur/Orang Tua Asuh:
*${nama}*

Alhamdulillah ananda asuh:
• Santri: *${santri}*
• Capaian Hafalan: *4 Juz (Mumtaz)*
• Setoran Terakhir: Ali 'Imran: 1-20
• Pembina: Ust. Razan Mufli, S.Pd

Catatan Musyrif:
_"Santri sangat tekun mengikuti halaqoh tahfizh dan berakhlak mulia."_

Jazakumullah Khairan Katsiran atas doa dan dukungan Bapak/Ibu.`;

      setPesanWAPreview(formatPesan);
      setSponsorList((prev) =>
        prev.map((s) => (s.id === id ? { ...s, statusWA: "TERKIRIM", terakhirKirim: "07/09/2026" } : s))
      );
      setFeedback({
        type: "success",
        text: `Laporan berhasil dikirim via WhatsApp Gateway ke ${nama} (${noHp}).`,
      });
    });
  };

  // Generator Surat Resmi AI (Fase 4)
  const handleGenerateSurat = () => {
    if (selectedRole !== "ADM" && selectedRole !== "KS") {
      setFeedback({ type: "error", text: "Hanya Admin (ADM) & Mudir (KS) yang berwenang menerbitkan surat resmi." });
      return;
    }
    startTransition(async () => {
      const naskah = `================================================================================
          PESANTREN TAHFIZH QUR'AN DARUL ULUM CENDEKIA
Alamat: Jl. Cendekia No. 12, Kompleks Pesantren STQ DUC | Telp: (021) 88997766
================================================================================

SURAT RESMI LEMBAGA
Nomor   : 024/STQ-DUC/SK/IX/2026
Perihal : ${perihalSurat}
Tujuan  : ${tujuanSurat}

Assalamu'alaikum Warahmatullahi Wabarakatuh,

Yang bertanda tangan di bawah ini Mudir STQ Darul Ulum Cendekia menerangkan bahwa:
Nama Santri : Obama Ozearld Egberted Turizqi
NIS         : SAN-0001
Kelas       : 9A (Takhossus Tahfizh)

Adalah benar santri aktif yang terdaftar di Pesantren STQ Darul Ulum Cendekia.

Pokok Surat & Keperluan:
"${isiPokokSurat}"

Demikian surat resmi ini dibuat dengan sebenarnya agar dapat dipergunakan sebagaimana mestinya.

Wassalamu'alaikum Warahmatullahi Wabarakatuh.

Mudir STQ Darul Ulum Cendekia,


( Ust. Andi Quarzy Ayatullah, S.H, M.H )`;

      setHasilSuratAI(naskah);
      setFeedback({
        type: "success",
        text: "Surat resmi nomor 024/STQ-DUC/SK/IX/2026 berhasil digenerate oleh AI!",
      });
    });
  };

  // Ikhtibar (Fase 6)
  const handleAjukanIkhtibar = () => {
    if (!["MT", "KS", "ADM"].includes(selectedRole)) {
      setFeedback({ type: "error", text: "Hanya Musyrif Tahfizh (MT) & Mudir (KS) yang dapat mendaftarkan ikhtibar." });
      return;
    }
    const santriObj = santriList.find((s) => s.nis === selectedSantriNis);
    if (!santriObj) return;

    startTransition(async () => {
      const juzNum = parseInt(ikhtibarJuz) || 1;
      const newIkh = {
        id: `ikh-${Date.now()}`,
        santri: santriObj.nama,
        nis: santriObj.nis,
        juz: juzNum,
        status: "PENGAJUAN",
        nilaiTahap1: null,
        catatanTahap1: null,
        nilaiTahap2: null,
        catatanTahap2: null,
      };
      setIkhtibarList((prev) => [newIkh, ...prev]);
      setFeedback({
        type: "success",
        text: `Alhamdulillah, pendaftaran Ujian Ikhtibar Juz ${juzNum} untuk ${santriObj.nama} berhasil diajukan.`,
      });
    });
  };

  const handleLuluskanTahap1 = (id: string) => {
    if (selectedRole !== "MT" && selectedRole !== "KS") {
      setFeedback({ type: "error", text: "Hanya Musyrif Tahfizh (MT) yang berwenang menguji Tahap 1." });
      return;
    }
    startTransition(async () => {
      setIkhtibarList((prev) =>
        prev.map((i) =>
          i.id === id
            ? { ...i, status: "LULUS_TAHAP_1", nilaiTahap1: parseFloat(ikhtibarNilai) || 90, catatanTahap1: ikhtibarCatatan }
            : i
        )
      );
      setFeedback({
        type: "success",
        text: "Ujian Tahap 1 Lulus! Santri kini berhak maju ke Ujian Tahap 2 di hadapan Mudir (KS).",
      });
    });
  };

  const handleSahkanTahap2 = (id: string) => {
    if (selectedRole !== "KS") {
      setFeedback({ type: "error", text: "Khusus Mudir Pesantren (KS) yang berwenang mengesahkan Ujian Tahap 2." });
      return;
    }
    startTransition(async () => {
      setIkhtibarList((prev) =>
        prev.map((i) =>
          i.id === id
            ? {
                ...i,
                status: "LULUS_SEMPURNA_TAHAP_2",
                nilaiTahap2: parseFloat(ikhtibarNilai) || 95,
                catatanTahap2: "Mumtaz! Resmi disahkan lulus oleh Mudir STQ DUC.",
              }
            : i
        )
      );
      setFeedback({
        type: "success",
        text: "Barakallahu fiik! Kelulusan Juz resmi disahkan oleh Mudir Pesantren.",
      });
    });
  };

  // Poskestren (Fase 6)
  const handleCatatKesehatan = () => {
    if (!["OSDA", "MK", "PH", "KS", "ADM"].includes(selectedRole)) {
      setFeedback({ type: "error", text: "Role Anda tidak memiliki wewenang mencatat data kesehatan." });
      return;
    }
    const santriObj = santriList.find((s) => s.nis === selectedSantriNis);
    if (!santriObj) return;

    if (!keluhanInput.trim() || !tindakanInput.trim()) {
      setFeedback({ type: "error", text: "Keluhan dan tindakan/obat wajib diisi." });
      return;
    }

    startTransition(async () => {
      const newKes = {
        id: `kes-${Date.now()}`,
        santri: santriObj.nama,
        nis: santriObj.nis,
        keluhan: keluhanInput,
        diagnosa: "Pemeriksaan UKS Poskestren",
        tindakan: tindakanInput,
        status: statusKesehatanInput,
        tanggal: new Date().toLocaleDateString("id-ID"),
      };
      setKesehatanList((prev) => [newKes, ...prev]);
      setFeedback({
        type: "success",
        text: `Data kesehatan ${santriObj.nama} berhasil dicatat di Poskestren (${statusKesehatanInput}).`,
      });
      setKeluhanInput("");
      setTindakanInput("");
    });
  };

  const handleUpdateStatusKesehatan = (id: string, newStatus: "DIRUJUK_PUSKESMAS" | "DIRUJUK_RS" | "SEMBUH") => {
    if (selectedRole !== "MK" && selectedRole !== "KS") {
      setFeedback({ type: "error", text: "Hanya Musyrif Keasramaan (MK) & Mudir (KS) yang dapat mengubah status rujukan medis." });
      return;
    }
    startTransition(async () => {
      setKesehatanList((prev) =>
        prev.map((k) => (k.id === id ? { ...k, status: newStatus } : k))
      );
      setFeedback({
        type: "success",
        text: `Status penanganan medis diperbarui menjadi: ${newStatus}.`,
      });
    });
  };

  // Logistik (Fase 6)
  const handleMutasiLogistik = () => {
    if (!["MK", "ADM", "KS"].includes(selectedRole)) {
      setFeedback({ type: "error", text: "Hanya Staf Logistik (MK/ADM/KS) yang berhak mencatat mutasi barang." });
      return;
    }
    const item = logistikList.find((l) => l.id === selectedLogistikId);
    if (!item) return;

    const qty = parseFloat(jumlahMutasi) || 0;
    if (qty <= 0) {
      setFeedback({ type: "error", text: "Jumlah mutasi harus lebih dari 0." });
      return;
    }

    if (jenisMutasi === "KELUAR" && item.stok < qty) {
      setFeedback({ type: "error", text: `Stok tidak mencukupi! Tersisa ${item.stok} ${item.satuan}.` });
      return;
    }

    startTransition(async () => {
      const newStok = jenisMutasi === "MASUK" ? item.stok + qty : item.stok - qty;
      setLogistikList((prev) =>
        prev.map((l) => (l.id === selectedLogistikId ? { ...l, stok: newStok } : l))
      );
      setFeedback({
        type: "success",
        text: `Mutasi ${jenisMutasi} (${qty} ${item.satuan}) untuk ${item.nama} berhasil dicatat. Sisa stok: ${newStok} ${item.satuan}.`,
      });
    });
  };

  // Portal Wali & Kotak Saran (Fase 7)
  const handleKirimSaran = () => {
    if (!inputSaranPesan.trim()) {
      setFeedback({ type: "error", text: "Pesan saran/aspirasi tidak boleh kosong." });
      return;
    }
    startTransition(async () => {
      const newSrn = {
        id: `srn-${Date.now()}`,
        nama: selectedRole === "WS" ? "Bambang Sudarmono (Wali Santri)" : "Santri Mandiri",
        kategori: inputSaranKategori,
        pesan: inputSaranPesan,
        tanggapan: null as string | null,
        status: "BARU",
      };
      setKotakSaranList((prev) => [newSrn, ...prev]);
      setFeedback({
        type: "success",
        text: "Jazakumullah Khairan. Saran Anda telah berhasil terkirim ke pimpinan pondok.",
      });
      setInputSaranPesan("");
    });
  };

  // Agenda Kalender (Fase 7)
  const handleTambahAgenda = () => {
    if (!["ADM", "KS"].includes(selectedRole)) {
      setFeedback({ type: "error", text: "Hanya Admin & Mudir yang berwenang menambah agenda." });
      return;
    }
    if (!judulAgenda.trim()) {
      setFeedback({ type: "error", text: "Judul agenda wajib diisi." });
      return;
    }
    startTransition(async () => {
      const newAgd = {
        id: `agd-${Date.now()}`,
        judul: judulAgenda,
        tanggal: tglAgenda,
        kategori: katAgenda,
        lokasi: "Kompleks Pondok STQ DUC",
      };
      setAgendaList((prev) => [...prev, newAgd]);
      setFeedback({
        type: "success",
        text: `Agenda "${judulAgenda}" berhasil ditambahkan ke kalender akademik.`,
      });
      setJudulAgenda("");
    });
  };

  // User Management (Fase 7)
  const handleToggleUserStatus = (id: string) => {
    if (selectedRole !== "ADM" && selectedRole !== "KS") {
      setFeedback({ type: "error", text: "Hanya Administrator & Mudir yang berwenang mengelola status user." });
      return;
    }
    startTransition(async () => {
      setUsersList((prev) =>
        prev.map((u) => (u.id === id ? { ...u, status: u.status === "AKTIF" ? "NONAKTIF" : "AKTIF" } : u))
      );
      setFeedback({
        type: "success",
        text: "Status akun berhasil diperbarui.",
      });
    });
  };

  const handleResetPassword = (username: string) => {
    if (selectedRole !== "ADM" && selectedRole !== "KS") {
      setFeedback({ type: "error", text: "Hanya Administrator & Mudir yang berwenang me-reset kata sandi." });
      return;
    }
    startTransition(async () => {
      setFeedback({
        type: "success",
        text: `Kata sandi akun ${username} berhasil di-reset ke "password123".`,
      });
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-sky-50 pb-20 md:pb-12">
      {/* Top Navigation */}
      {/* Top Navigation with interactive Role & Staff Switcher */}
      <TopNavbar
        currentRole={selectedRole}
        userName={currentUserName}
        currentHalaqoh={currentHalaqohName}
        onRoleChange={handleRoleChange}
        onSwitchStaff={handleSwitchStaff}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 space-y-5">
        {/* Banner Identitas & Info Arsitektur */}
        <div className="bg-gradient-to-r from-[#0E7C3A] via-[#0B642E] to-[#0E7C3A] text-white rounded-3xl p-5 md:p-7 shadow-sm relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-white/5 rounded-full blur-2xl pointer-events-none" />
          <div className="relative z-10 max-w-3xl space-y-1.5">
            <div className="inline-flex items-center gap-2 bg-white/15 px-3 py-1 rounded-full text-xs font-medium text-emerald-100 backdrop-blur-sm mb-1">
              <Sparkles className="h-3.5 w-3.5 text-[#C9990E]" />
              STQ Education Portal — Darul Ulum Cendekia
            </div>
            <h1 className="text-xl md:text-3xl font-bold tracking-tight text-white font-heading">
              Sistem Pendidikan STQ Darul Ulum Cendekia
            </h1>
            <p className="text-xs md:text-sm text-emerald-50 leading-relaxed">
              Arsitektur terpadu: <strong>Tahfizh</strong>, <strong>Akademik & Rapor</strong>, <strong>Kesantrian</strong>, <strong>Kedisiplinan (Poin x2)</strong>, <strong>Ikhtibar</strong>, <strong>Poskestren</strong>, <strong>Logistik</strong>, dan <strong>Portal Wali</strong>.
            </p>
          </div>
          <div className="relative z-10 shrink-0 hidden md:flex items-center justify-center p-3 bg-white rounded-3xl shadow-lg border border-white/20">
            <img src="/logo.png" alt="Logo STQ Darul Ulum Cendekia" className="h-20 w-20 object-contain" />
          </div>
        </div>

        {/* Status Bar: Peran Aktif & Info Akses Pengguna */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-2.5 bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200/80 shadow-xs text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <span className="text-slate-600 font-medium">Pengguna Aktif:</span>
            <strong className="text-slate-900">{currentUserName}</strong>
            <span className="text-slate-300">•</span>
            <Badge variant={roleInfo.badgeVariant} size="sm" className="font-bold">
              {selectedRole} — {roleInfo.title}
            </Badge>
            {currentHalaqohName && (
              <>
                <span className="text-slate-300">•</span>
                <span className="text-emerald-800 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  {currentHalaqohName} ({displayedSantriTahfizh.length} Santri)
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2 text-slate-500 text-[11px]">
            <span>Hak Akses: <strong className="text-emerald-700">{allowedClusters.length} Kluster, {allowedTabs.length} Modul</strong></span>
            <span className="text-slate-300">•</span>
            <a href="/login" className="text-[#0E7C3A] hover:underline font-bold">
              Ganti Akun di Login &rarr;
            </a>
          </div>
        </div>

        {/* Dual-Tier Module Navigation (RBAC Filtered) */}
        <DualTierNav
          activeCluster={activeCluster}
          activeTab={activeTab}
          allowedClusters={allowedClusters}
          allowedTabs={["beranda", ...allowedTabs]}
          onSelectCluster={(c) => {
            setActiveCluster(c);
            setFeedback(null);
          }}
          onSelectTab={(t) => {
            setActiveTab(t as any);
            setFeedback(null);
          }}
        />

        {/* Feedback Banner */}
        {feedback && (
          <div
            className={`p-4 rounded-2xl border flex items-start gap-3 text-sm transition-all ${
              feedback.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-red-50 border-red-200 text-red-800"
            }`}
          >
            {feedback.type === "success" ? (
              <CheckCircle2 className="h-5 w-5 text-[#0E7C3A] shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <p className="font-semibold">{feedback.type === "success" ? "Berhasil" : "Akses Dibatasi"}</p>
              <p className="text-xs opacity-90 mt-0.5">{feedback.text}</p>
            </div>
            <button onClick={() => setFeedback(null)} className="text-xs font-bold opacity-60 hover:opacity-100">
              ✕
            </button>
          </div>
        )}

        {/* ============================================================= */}
        {/* BERANDA: DASHBOARD UTAMA SESUAI PERAN (RBAC) */}
        {/* ============================================================= */}
        {activeTab === "beranda" && (
          <div className="space-y-6">
            {(selectedRole === "WS" || selectedRole === "ST") && (
              <DashboardWaliSantri
                santri={{
                  nama: santriList[0].nama,
                  nis: santriList[0].nis,
                  kelas: santriList[0].kelas,
                  halaqoh: santriList[0].halaqoh,
                  capaianJuz: santriList[0].capaianJuz,
                  targetJuz: santriList[0].targetJuz,
                  setoranTerakhir: santriList[0].setoranTerakhir,
                  nilaiTerakhir: santriList[0].nilaiTerakhir,
                  poinPelanggaran: santriList[0].poinPelanggaran,
                  bintangKebaikan: (santriList[0] as any).bintangKebaikan || 12,
                }}
                izinAktif={izinList[0]}
                nilaiAkademikList={nilaiAkademikList}
                onPrintRapor={() => setShowPrintModal("rapor")}
                onNavigateToIzin={() => {
                  setActiveCluster("kesantrian");
                  setActiveTab("kesantrian");
                }}
              />
            )}

            {selectedRole === "MT" && (
              <DashboardMusyrifTahfizh
                santriList={displayedSantriTahfizh}
                halaqohName={currentHalaqohName || undefined}
                selectedSantriNis={selectedSantriNis}
                onSelectSantriNis={setSelectedSantriNis}
                inputJenis={inputJenis}
                onSetInputJenis={setInputJenis}
                jumlahHalaman={jumlahHalaman}
                onSetJumlahHalaman={setJumlahHalaman}
                juz={juz}
                onSetJuz={setJuz}
                surahMulai={surahMulai}
                onSetSurahMulai={setSurahMulai}
                ayatMulai={ayatMulai}
                onSetAyatMulai={setAyatMulai}
                surahSelesai={surahSelesai}
                onSetSurahSelesai={setSurahSelesai}
                ayatSelesai={ayatSelesai}
                onSetAyatSelesai={setAyatSelesai}
                nilai={nilai}
                onSetNilai={setNilai}
                catatan={catatan}
                onSetCatatan={setCatatan}
                onSaveSetoran={handleSaveSetoran}
                onOpenLaporanBulanan={() => {
                  setActiveCluster("tahfizh");
                  setActiveTab("tahfizh");
                  setTahfizhSubView("rekap_bulanan");
                }}
                isPending={isPending}
              />
            )}

            {selectedRole === "MK" && (
              <DashboardMusyrifKesantrian
                izinList={izinList}
                onApproveIzin={(id, isEskalasi) =>
                  handleApproveIzin(id, isEskalasi ? "ESCALATE" : "APPROVE")
                }
                onRejectIzin={(id) => handleApproveIzin(id, "REJECT")}
                onNavigateToDisiplin={() => {
                  setActiveCluster("kesantrian");
                  setActiveTab("kedisiplinan");
                }}
                isPending={isPending}
              />
            )}

            {selectedRole === "GA" && (
              <DashboardGuruAkademik
                selectedMapel={selectedMapel}
                onSetSelectedMapel={setSelectedMapel}
                inputNilaiAngka={inputNilaiAngka}
                onSetInputNilaiAngka={setInputNilaiAngka}
                nilaiAkademikList={nilaiAkademikList}
                onSaveNilai={handleSaveNilai}
                onPrintRapor={() => setShowPrintModal("rapor")}
                isPending={isPending}
              />
            )}

            {selectedRole === "KS" && (
              <DashboardMudirKS
                totalSantri={santriList.length}
                izinEskalasiList={izinList.filter((i) => i.status === "MENUNGGU_KS")}
                ikhtibarTahap2List={ikhtibarList.filter((ik) => ik.status === "TAHAP_1_LULUS" || ik.status === "TAHAP_2_LULUS")}
                pengajuanAnggaranList={pengajuanList.map((p) => ({
                  id: p.id,
                  nomor: p.kode,
                  pemohon: p.diajukanOleh,
                  keperluan: p.judul,
                  nominal: p.nominal,
                  status: p.status,
                }))}
                halaqohList={MASTER_HALAQOH_LIST}
                staffMusyrifList={MASTER_STAFF_MUSYRIF_LIST}
                santriList={santriList.map((s, idx) => ({
                  id: s.id,
                  nis: s.nis,
                  nama: s.nama,
                  halaqohId:
                    idx < 5 ? "HLQ-0001" :
                    idx < 14 ? "HLQ-0002" :
                    idx < 24 ? "HLQ-0003" :
                    idx < 34 ? "HLQ-0004" :
                    idx < 47 ? "HLQ-0005" : "HLQ-0006",
                }))}
                onApproveIzinPulang={(id) => handleApproveIzin(id, "APPROVE")}
                onSahkanIkhtibar={(id) => handleSahkanTahap2(id)}
                onApproveAnggaran={(id) => handleApprovePengajuan(id, "DISETUJUI_KS")}
                onPrintLaporan={() => setShowPrintModal("laporan_bulanan")}
                isPending={isPending}
              />
            )}

            {selectedRole === "YAY" && (
              <DashboardYayasan
                totalSantri={santriList.length}
                auditLogsCount={auditLogsList.length}
                onNavigateToAudit={() => {
                  setActiveCluster("sistem");
                  setActiveTab("audit");
                }}
                onNavigateToSponsor={() => {
                  setActiveCluster("manajemen");
                  setActiveTab("sponsor");
                }}
              />
            )}

            {selectedRole === "ADM" && (
              <DashboardAdminTU
                totalSantri={santriList.length}
                totalUsers={usersList.length}
                onNavigateToSantri={() => {
                  setActiveCluster("manajemen");
                  setActiveTab("data_santri");
                }}
                onNavigateToSurat={() => {
                  setActiveCluster("manajemen");
                  setActiveTab("surat");
                }}
                onNavigateToAnggaran={() => {
                  setActiveCluster("manajemen");
                  setActiveTab("administrasi");
                }}
                onNavigateToUsers={() => {
                  setActiveCluster("sistem");
                  setActiveTab("users");
                }}
              />
            )}

            {selectedRole === "PH" && (
              <DashboardPembinaAsrama
                totalSantri={santriList.length}
                onNavigateToBintang={() => {
                  setActiveCluster("kesantrian");
                  setActiveTab("kedisiplinan");
                }}
                onNavigateToDisiplin={() => {
                  setActiveCluster("kesantrian");
                  setActiveTab("kedisiplinan");
                }}
                onNavigateToLogistik={() => {
                  setActiveCluster("kesantrian");
                  setActiveTab("logistik");
                }}
              />
            )}

            {selectedRole === "OSDA" && (
              <DashboardOSDA
                onNavigateToDisiplin={() => {
                  setActiveCluster("kesantrian");
                  setActiveTab("kedisiplinan");
                }}
                onNavigateToKesehatan={() => {
                  setActiveCluster("kesantrian");
                  setActiveTab("kesehatan");
                }}
              />
            )}
          </div>
        )}

        {/* ============================================================= */}
        {/* GUARD: AKSES TERBATAS RBAC */}
        {/* ============================================================= */}
        {activeTab !== "beranda" && !allowedTabs.includes(activeTab as any) && (
          <Card rounded="3xl" className="p-8 sm:p-12 text-center bg-white border border-slate-200 shadow-sm space-y-4 max-w-xl mx-auto my-6">
            <div className="h-16 w-16 mx-auto rounded-3xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200">
              <ShieldAlert className="h-8 w-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-slate-800 font-heading">
                Akses Modul Dibatasi (RBAC)
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed max-w-md mx-auto">
                Peran Anda (<strong>{selectedRole} — {roleInfo.title}</strong>) tidak memiliki wewenang untuk membuka modul <strong>{activeTab}</strong>.
              </p>
            </div>
            <Button
              variant="primary"
              className="bg-[#0E7C3A] hover:bg-[#0B642E] text-white font-bold"
              onClick={() => {
                setActiveTab("beranda");
              }}
            >
              Buka Beranda Peran Anda
            </Button>
          </Card>
        )}

        {/* ============================================================= */}
        {/* TAB MASTER: DATA SANTRI */}
        {/* ============================================================= */}
        {allowedTabs.includes("data_santri") && activeTab === "data_santri" && (
          <MasterDataSantri
            santriList={santriList}
            userRole={selectedRole}
            halaqohList={MASTER_HALAQOH_LIST.map((h) => ({ id: h.id, nama: h.nama, pembina: h.pembina }))}
            onPrintRapor={(s) => {
              setSelectedSantriNis(s.nis);
              setShowPrintModal("rapor");
            }}
          />
        )}

        {/* ============================================================= */}
        {/* TAB 1: TAHFIZH (MVP) */}
        {/* ============================================================= */}
        {allowedTabs.includes("tahfizh") && activeTab === "tahfizh" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                title="Santri Terdaftar"
                value={`${displayedSantriTahfizh.length} Santri`}
                description={currentHalaqohName || "Seluruh Halaqoh"}
                icon={<Users className="h-5 w-5" />}
                badgeText={currentHalaqohName ? "Halaqoh Binaan" : "Semua Halaqoh"}
                badgeVariant="green"
                accentBorder
              />
              <StatCard title="Setoran Hari Ini" value="38" description="Target: 45 santri" icon={<BookCheck className="h-5 w-5" />} badgeText="84% Tercapai" badgeVariant="gold" />
              <StatCard title="Rata-rata Hafalan" value="4.2 Juz" description="Target: 5 Juz" icon={<TrendingUp className="h-5 w-5" />} badgeText="Sesuai Target" badgeVariant="sky" />
              <StatCard title="Ikhtibar Pending" value="5" description="Tahap I & II" icon={<Award className="h-5 w-5" />} badgeText="Menunggu Ujian" badgeVariant="orange" />
            </div>

            {/* Banner Halaqoh Binaan (Untuk MT & PH) / Filter Supervisi (Untuk KS & ADM) */}
            {["KS", "ADM"].includes(selectedRole) ? (
              <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-3xl bg-white border border-slate-200/90 shadow-2xs">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <Badge variant="gold" size="sm" className="font-bold">Supervisi Mudir / TU</Badge>
                  <span className="text-xs font-bold text-slate-700">Filter Kelompok Halaqoh:</span>
                  <select
                    value={halaqohFilter}
                    onChange={(e) => setHalaqohFilter(e.target.value)}
                    className="px-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-white font-semibold text-slate-800 focus:ring-2 focus:ring-[#0E7C3A]/20"
                  >
                    <option value="ALL">Semua Kelompok Halaqoh (57 Santri)</option>
                    {MASTER_HALAQOH_LIST.map((h) => (
                      <option key={h.id} value={h.nama}>
                        {h.nama} ({h.pembina.nama})
                      </option>
                    ))}
                  </select>
                </div>
                <span className="text-xs text-slate-500 font-medium">
                  Menampilkan: <strong className="text-emerald-800">{displayedSantriTahfizh.length}</strong> dari 57 santri
                </span>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-3xl bg-emerald-50/90 border border-emerald-200/90 shadow-2xs">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="px-2.5 py-1 rounded-xl bg-[#0E7C3A] text-white text-[10px] font-extrabold uppercase tracking-wide">
                    Halaqoh Binaan
                  </span>
                  <span className="font-heading font-bold text-sm text-emerald-950">
                    {currentHalaqohName}
                  </span>
                  <Badge variant="green" size="sm" className="font-bold">
                    {displayedSantriTahfizh.length} Santri Terdaftar
                  </Badge>
                </div>
                <div className="text-xs text-emerald-900 font-medium flex items-center gap-1.5">
                  <span>Pembina: <strong className="text-emerald-950">{currentUserName}</strong></span>
                </div>
              </div>
            )}

            {/* Navigasi Sub-Modul: Rekap Laporan Bulanan (Excel STQ DUC) vs Form Input Cepat */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-2 rounded-3xl bg-white border border-slate-200 shadow-xs">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setTahfizhSubView("rekap_bulanan")}
                  className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    tahfizhSubView === "rekap_bulanan"
                      ? "bg-[#0E7C3A] text-white shadow-2xs"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  Rekap Laporan Bulanan (Format Excel)
                </button>
                <button
                  onClick={() => setTahfizhSubView("input")}
                  className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    tahfizhSubView === "input"
                      ? "bg-[#0E7C3A] text-white shadow-2xs"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <PlusCircle className="h-4 w-4" />
                  Form Input Setoran Cepat
                </button>
              </div>

              <Badge variant="green" size="sm">
                Standar Mushaf Madinah 20 Hlm/Juz
              </Badge>
            </div>

            {tahfizhSubView === "rekap_bulanan" ? (
              <RekapLaporanBulanan
                userRole={selectedRole}
                halaqohList={MASTER_HALAQOH_LIST.map((h) => ({
                  id: h.id,
                  nama: `${h.nama} (${h.pembina.nama})`,
                }))}
                onPrintPreview={(data) => {
                  setPrintLaporanData(data);
                  setShowPrintModal("laporan_bulanan");
                }}
              />
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                  {lastSetoranSaved && (
                    <div className="p-4 rounded-3xl bg-emerald-50 border border-emerald-300 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-2xl bg-[#25D366]/20 text-[#128C7E] flex items-center justify-center shrink-0">
                          <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
                            <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-xs font-bold text-emerald-950">
                            Setoran Disimpan: <span className="underline">{lastSetoranSaved.santriNama}</span> ({lastSetoranSaved.surah}: {lastSetoranSaved.ayatMulai}–{lastSetoranSaved.ayatSelesai} • Nilai: {lastSetoranSaved.nilai})
                          </p>
                          <p className="text-[11px] text-emerald-700">
                            Kirim laporan langsung ke orang tua santri lewat WhatsApp dengan teks otomatis.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => {
                            const msg = buildSetoranTahfizhWAMessage({
                              santriNama: lastSetoranSaved.santriNama,
                              santriNis: lastSetoranSaved.santriNis,
                              kelas: lastSetoranSaved.kelas,
                              namaWali: lastSetoranSaved.namaWali,
                              noHpWali: lastSetoranSaved.noHpWali,
                              jenisSetoran: lastSetoranSaved.jenisSetoran,
                              juz: lastSetoranSaved.juz,
                              surah: lastSetoranSaved.surah,
                              ayatMulai: lastSetoranSaved.ayatMulai,
                              ayatSelesai: lastSetoranSaved.ayatSelesai,
                              nilai: lastSetoranSaved.nilai,
                              catatan: lastSetoranSaved.catatan,
                              jumlahHalaman: lastSetoranSaved.jumlahHalaman,
                              pembinaNama: currentUserName || currentHalaqohName || "Musyrif Tahfizh STQ DUC",
                            });
                            setGlobalWaDialog({
                              isOpen: true,
                              phone: lastSetoranSaved.noHpWali || "081299887766",
                              recipientName: lastSetoranSaved.namaWali || `Wali ${lastSetoranSaved.santriNama}`,
                              message: msg,
                              title: `Kirim Setoran ${lastSetoranSaved.santriNama} ke WA Wali`,
                              description: "Pesan terformat akan dibuka di aplikasi WhatsApp resmi Anda.",
                            });
                          }}
                          className="bg-[#25D366] hover:bg-[#20bd5a] text-white border-0 font-bold shadow-xs"
                          leftIcon={
                            <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                              <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
                            </svg>
                          }
                        >
                          Kirim Laporan WA
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setLastSetoranSaved(null)}
                          className="text-xs text-slate-400 hover:text-slate-600"
                        >
                          Tutup
                        </Button>
                      </div>
                    </div>
                  )}

                  <Card rounded="3xl">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <PlusCircle className="h-5 w-5 text-[#0E7C3A]" /> Input Setoran Cepat
                      </CardTitle>
                      <CardDescription>Khusus Musyrif Tahfizh (<code>MT</code>), Pembina (<code>PH</code>), Mudir (<code>KS</code>)</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-semibold text-slate-700">Pilih Santri Menyimak</label>
                          <span className="text-[11px] text-emerald-700 font-medium">
                            {displayedSantriTahfizh.length} santri dalam kelompok
                          </span>
                        </div>
                        <select
                          value={selectedSantriNis}
                          onChange={(e) => setSelectedSantriNis(e.target.value)}
                          className="w-full min-h-[44px] px-4 py-2.5 rounded-2xl bg-white border border-slate-200 text-sm font-medium"
                        >
                          {displayedSantriTahfizh.map((s) => (
                            <option key={s.nis} value={s.nis}>
                              {s.nama} ({s.nis} - Kelas {s.kelas} - {s.capaianJuz} Juz)
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-700">Jenis Setoran</label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {(["SABAQ", "SABQI", "MANZIL", "MUFAR"] as const).map((j) => (
                            <button
                              key={j}
                              type="button"
                              onClick={() => setInputJenis(j)}
                              className={`min-h-[44px] rounded-2xl text-xs font-bold border ${
                                inputJenis === j ? "bg-[#0E7C3A] text-white border-[#0E7C3A]" : "bg-slate-50 text-slate-700 border-slate-200"
                              }`}
                            >
                              {j === "SABAQ"
                                ? "Sabaq (Baru)"
                                : j === "SABQI"
                                ? "Sabqi (Murojaah)"
                                : j === "MANZIL"
                                ? "Manzil (Lancar)"
                                : "Mufar (Khusus)"}
                            </button>
                          ))}
                        </div>
                      </div>

                      {inputJenis === "SABAQ" && (
                        <div className="p-3 rounded-2xl bg-emerald-50/60 border border-emerald-200">
                          <Input
                            label="Jumlah Halaman Sabaq (Standar 20 Hlm/Juz)"
                            type="number"
                            value={jumlahHalaman}
                            onChange={(e) => setJumlahHalaman(e.target.value)}
                            placeholder="1"
                            className="bg-white"
                          />
                          <p className="text-[10px] text-emerald-800 mt-1">
                            Akumulasi halaman akan otomatis dikonversi ke satuan Juz &amp; Halaman pada laporan bulanan.
                          </p>
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                        <Input label="Juz (1-30)" type="number" value={juz} onChange={(e) => setJuz(e.target.value)} />
                        <Input label="Surah" value={surahMulai} onChange={(e) => { setSurahMulai(e.target.value); setSurahSelesai(e.target.value); }} />
                        <Input label="Ayat Mulai" type="number" value={ayatMulai} onChange={(e) => setAyatMulai(e.target.value)} />
                        <Input label="Ayat Selesai" type="number" value={ayatSelesai} onChange={(e) => setAyatSelesai(e.target.value)} />
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                        {["MUMTAZ", "JAYYID_JIDDAN", "JAYYID", "MAQBUL", "DHOIF"].map((k) => (
                          <button
                            key={k}
                            type="button"
                            onClick={() => setNilai(k as any)}
                            className={`min-h-[44px] rounded-2xl text-xs font-bold border transition-all ${
                              nilai === k ? "bg-[#0E7C3A] text-white border-[#0E7C3A] shadow-xs" : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                            }`}
                          >
                            {k}
                          </button>
                        ))}
                      </div>
                      <Input label="Catatan Tajwid/Makhroj" value={catatan} onChange={(e) => setCatatan(e.target.value)} placeholder="e.g. Bacaan tartil" />
                    </CardContent>
                    <CardFooter className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4">
                      <div className="text-xs text-slate-500">
                        Santri: <strong className="text-slate-800">{displayedSantriTahfizh.find((s) => s.nis === selectedSantriNis)?.nama}</strong>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            const cur = displayedSantriTahfizh.find((s) => s.nis === selectedSantriNis);
                            if (!cur) return;
                            const msg = buildSetoranTahfizhWAMessage({
                              santriNama: cur.nama,
                              santriNis: cur.nis,
                              kelas: cur.kelas,
                              namaWali: (cur as any).namaWali,
                              noHpWali: (cur as any).noHpWali,
                              jenisSetoran: inputJenis,
                              juz,
                              surah: surahMulai,
                              ayatMulai,
                              ayatSelesai,
                              nilai,
                              catatan,
                              jumlahHalaman: inputJenis === "SABAQ" ? jumlahHalaman : undefined,
                              pembinaNama: currentUserName || currentHalaqohName || "Musyrif Tahfizh STQ DUC",
                            });
                            setGlobalWaDialog({
                              isOpen: true,
                              phone: (cur as any).noHpWali || "081299887766",
                              recipientName: (cur as any).namaWali || `Wali ${cur.nama}`,
                              message: msg,
                              title: `Kirim Setoran ${cur.nama} ke WA Wali`,
                              description: "Pesan terformat akan dibuka di aplikasi WhatsApp resmi Anda.",
                            });
                          }}
                          className="bg-[#25D366]/15 hover:bg-[#25D366]/25 text-[#128C7E] border border-[#25D366]/30 font-bold"
                          leftIcon={
                            <svg className="h-4 w-4 fill-current text-[#25D366]" viewBox="0 0 24 24">
                              <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
                            </svg>
                          }
                        >
                          Kirim WA Wali
                        </Button>
                        <Button
                          variant="primary"
                          isLoading={isPending}
                          onClick={handleSaveSetoran}
                          disabled={!["MT", "PH", "KS"].includes(selectedRole)}
                          leftIcon={<CheckCircle2 className="h-4 w-4" />}
                        >
                          {["MT", "PH", "KS"].includes(selectedRole) ? "Simpan Setoran" : `Role ${selectedRole} Tidak Berhak`}
                        </Button>
                      </div>
                    </CardFooter>
                  </Card>
                </div>

                <div>
                  <Card rounded="3xl">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <div>
                        <CardTitle>
                          Santri {currentHalaqohName ? currentHalaqohName.replace("Halaqoh ", "") : "Halaqoh"} ({displayedSantriTahfizh.length})
                        </CardTitle>
                        <CardDescription>
                          {currentHalaqohName || (halaqohFilter === "ALL" ? "Seluruh Santri DUC (57 Santri)" : halaqohFilter)}
                        </CardDescription>
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="text-xs h-8 px-2.5"
                        leftIcon={<Download className="h-3.5 w-3.5 text-emerald-700" />}
                        onClick={() =>
                          exportToCSV(
                            `Rekap_Tahfizh_${(currentHalaqohName || halaqohFilter).replace(/\s+/g, "_")}`,
                            ["Nama Santri", "NIS", "Kelas", "Halaqoh", "Capaian Juz", "Target Juz", "Setoran Terakhir", "Nilai Terakhir"],
                            displayedSantriTahfizh.map((s) => [s.nama, s.nis, s.kelas, s.halaqoh, s.capaianJuz, s.targetJuz, s.setoranTerakhir, s.nilaiTerakhir])
                          )
                        }
                      >
                        Ekspor CSV
                      </Button>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {displayedSantriTahfizh.map((s) => (
                        <div key={s.nis} className="p-3 rounded-2xl border border-slate-200/80 bg-slate-50/50 space-y-1.5 text-xs">
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-slate-800">{s.nama}</span>
                            <div className="flex items-center gap-1.5">
                              <Badge variant="green" size="sm">{s.capaianJuz} Juz</Badge>
                              <button
                                type="button"
                                onClick={() => {
                                  const msg = buildProgressSantriWAMessage({
                                    santriNama: s.nama,
                                    santriNis: s.nis,
                                    kelas: s.kelas,
                                    halaqoh: s.halaqoh,
                                    namaWali: (s as any).namaWali,
                                    noHpWali: (s as any).noHpWali,
                                    capaianJuz: s.capaianJuz,
                                    targetJuz: s.targetJuz,
                                    setoranTerakhir: s.setoranTerakhir,
                                    nilaiTerakhir: s.nilaiTerakhir,
                                    pembinaNama: currentUserName || currentHalaqohName || "Musyrif Tahfizh STQ DUC",
                                  });
                                  setGlobalWaDialog({
                                    isOpen: true,
                                    phone: (s as any).noHpWali || "081299887766",
                                    recipientName: (s as any).namaWali || `Wali ${s.nama}`,
                                    message: msg,
                                    title: `Kirim Progres Hafalan ${s.nama}`,
                                    description: "Ringkasan capaian juz dan hafalan santri akan dikirim via WhatsApp.",
                                  });
                                }}
                                title="Kirim Update WA ke Wali Santri"
                                className="p-1 rounded-lg bg-[#25D366]/15 hover:bg-[#25D366]/25 text-[#128C7E] transition-all"
                              >
                                <svg className="h-3.5 w-3.5 fill-current text-[#25D366]" viewBox="0 0 24 24">
                                  <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
                                </svg>
                              </button>
                            </div>
                          </div>
                          <p className="text-slate-500">Setoran: {s.setoranTerakhir}</p>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============================================================= */}
        {/* TAB 2: AKADEMIK & RAPOR (FASE 2) */}
        {/* ============================================================= */}
        {activeTab === "akademik" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-6">
              <Card rounded="3xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <GraduationCap className="h-5 w-5 text-[#0E7C3A]" /> Input Nilai Guru
                  </CardTitle>
                  <CardDescription>Khusus Guru Akademik (<code>GA</code>) & Mudir (<code>KS</code>)</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Mata Pelajaran</label>
                    <select
                      value={selectedMapel}
                      onChange={(e) => setSelectedMapel(e.target.value)}
                      className="w-full min-h-[44px] px-4 py-2.5 rounded-2xl bg-white border border-slate-200 text-sm"
                    >
                      <optgroup label="Program Kepesantrenan (Senin–Jumat)">
                        <option value="MP-KP-01">Bahasa Arab (Senin)</option>
                        <option value="MP-KP-02">Tafsir Al-Qur'an (Selasa)</option>
                        <option value="MP-KP-03">Fikih Ibadah &amp; Muamalah (Rabu)</option>
                        <option value="MP-KP-04">Aqidah Islamiyyah (Kamis)</option>
                        <option value="MP-KP-05">Ilmu Tajwid (Jumat)</option>
                      </optgroup>
                      <optgroup label="Program Studi Umum &amp; PBL (Sabtu)">
                        <option value="MP-UM-01">Matematika Terapan (Mapel Tetap)</option>
                        <option value="MP-UM-02">Bahasa Inggris (Mapel Tetap)</option>
                        <option value="MP-PBL-01">Bahasa Indonesia (PBL Tematik)</option>
                        <option value="MP-PBL-02">IPA / Sains (PBL Tematik)</option>
                        <option value="MP-PBL-03">IPS / Sosial (PBL Tematik)</option>
                        <option value="MP-PBL-04">TIK &amp; Literasi Digital (PBL)</option>
                      </optgroup>
                    </select>
                  </div>
                  <Input label="Nilai Angka (0-100)" type="number" value={inputNilaiAngka} onChange={(e) => setInputNilaiAngka(e.target.value)} />
                </CardContent>
                <CardFooter>
                  <Button
                    variant="primary"
                    fullWidth
                    onClick={handleSaveNilai}
                    isLoading={isPending}
                    leftIcon={<GraduationCap className="h-4 w-4" />}
                    disabled={selectedRole !== "GA" && selectedRole !== "KS"}
                  >
                    Simpan Nilai Santri
                  </Button>
                </CardFooter>
              </Card>
            </div>

            <div className="lg:col-span-2">
              <Card rounded="3xl" className="border-2 border-[#0E7C3A]/20 p-6 space-y-4">
                <div className="flex justify-between items-center pb-4 border-b border-slate-100">
                  <div>
                    <Badge variant="green" size="sm">Rapor Terpadu</Badge>
                    <h3 className="text-xl font-bold text-[#0E7C3A] mt-1 font-heading">Muhammad Fatih Al-Ayyubi</h3>
                    <p className="text-xs text-slate-500">NIS: SAN-0001 • Kelas 7A • Semester 1</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-500">Rata-rata:</span>
                    <p className="text-2xl font-bold text-[#0E7C3A] font-heading">89.8 (A)</p>
                  </div>
                </div>
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-600 border-y border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Mata Pelajaran</th>
                      <th className="py-2.5 px-3">Kategori</th>
                      <th className="py-2.5 px-3 text-center">Nilai</th>
                      <th className="py-2.5 px-3 text-center">Predikat</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {nilaiAkademikList.map((n, idx) => (
                      <tr key={idx}>
                        <td className="py-2.5 px-3 font-semibold">{n.mapel}</td>
                        <td className="py-2.5 px-3 text-slate-500">{n.kategori}</td>
                        <td className="py-2.5 px-3 font-bold text-center">{n.angka}</td>
                        <td className="py-2.5 px-3 text-center"><Badge variant={n.huruf === "A" ? "green" : "sky"} size="sm">{n.huruf}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </div>
          </div>
        )}

        {/* ============================================================= */}
        {/* TAB 3: ASRAMA & IZIN (FASE 2) */}
        {/* ============================================================= */}
        {activeTab === "kesantrian" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <Card rounded="3xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Send className="h-5 w-5 text-sky-600" /> Ajukan Izin Santri</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Input label="Alasan Izin" value={formIzinAlasan} onChange={(e) => setFormIzinAlasan(e.target.value)} placeholder="e.g. Acara keluarga" />
                </CardContent>
                <CardFooter>
                  <Button variant="primary" fullWidth onClick={handleAjukanIzin}>Ajukan Izin</Button>
                </CardFooter>
              </Card>
            </div>

            <div className="lg:col-span-2">
              <Card rounded="3xl">
                <CardHeader><CardTitle>Antrean Perizinan Berjenjang</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {izinList.map((i) => (
                    <div key={i.id} className="p-3.5 rounded-2xl border border-slate-200/80 bg-white flex justify-between items-center text-xs">
                      <div>
                        <span className="font-bold text-slate-800">{i.santriNama} ({i.jenis})</span>
                        <p className="text-slate-600">"{i.alasan}"</p>
                        <span className="text-[10px] text-slate-400">{i.diverifikasiOleh}</span>
                      </div>
                      <div className="flex gap-2 items-center">
                        <Badge variant={i.status === "DISETUJUI" ? "green" : "orange"} size="sm">{i.status}</Badge>
                        <button
                          type="button"
                          onClick={() => {
                            const msg = buildIzinSantriWAMessage({
                              santriNama: i.santriNama,
                              kelas: i.kelas,
                              kodeIzin: i.kodeIzin,
                              jenisIzin: i.jenis,
                              durasi: i.durasi,
                              alasan: i.alasan,
                              status: i.status,
                              diverifikasiOleh: i.diverifikasiOleh,
                              batasKembali: i.jenis === "PULANG" ? "Ahad pukul 17.00 WITA" : undefined,
                            });
                            setGlobalWaDialog({
                              isOpen: true,
                              phone: "081299887766",
                              recipientName: `Wali ${i.santriNama}`,
                              message: msg,
                              title: `Notifikasi Izin ${i.santriNama} via WA`,
                              description: "Kirim update status perizinan santri langsung ke WhatsApp orang tua.",
                            });
                          }}
                          title="Kirim Notifikasi Izin ke WA Wali"
                          className="p-1.5 rounded-xl bg-[#25D366]/15 hover:bg-[#25D366]/25 text-[#128C7E] border border-[#25D366]/30 transition-all flex items-center gap-1 font-bold"
                        >
                          <svg className="h-3.5 w-3.5 fill-current text-[#25D366]" viewBox="0 0 24 24">
                            <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
                          </svg>
                          <span className="text-[10px]">WA</span>
                        </button>
                        {i.status !== "DISETUJUI" && (selectedRole === "MK" || selectedRole === "KS") && (
                          <Button variant="primary" size="sm" onClick={() => handleApproveIzin(i.id, "APPROVE")}>Setujui</Button>
                        )}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* ============================================================= */}
        {/* TAB 4: KEDISIPLINAN (POIN X2 & SP) */}
        {/* ============================================================= */}
        {activeTab === "kedisiplinan" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <Card rounded="3xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-red-600" /> Catat Pelanggaran</CardTitle>
                  <CardDescription>Engine cerdas: <strong>Poin x2 otomatis jika pengulangan</strong></CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Pilih Santri</label>
                    <select
                      value={selectedSantriNis}
                      onChange={(e) => setSelectedSantriNis(e.target.value)}
                      className="w-full min-h-[44px] px-3 py-2 rounded-2xl bg-white border border-slate-200 text-xs"
                    >
                      {santriList.map((s) => (
                        <option key={s.nis} value={s.nis}>{s.nama} ({s.poinPelanggaran} Poin)</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Kategori</label>
                    <select
                      value={kategoriPelanggaran}
                      onChange={(e) => setKategoriPelanggaran(e.target.value as any)}
                      className="w-full min-h-[44px] px-3 py-2 rounded-2xl bg-white border border-slate-200 text-xs"
                    >
                      <option value="PLG_SHOLAT">Terlambat Sholat (5 Poin)</option>
                      <option value="PLG_PIKET">Tidak Piket (10 Poin)</option>
                      <option value="PLG_GADGET">Membawa Gadget (25 Poin)</option>
                    </select>
                  </div>
                  <Input label="Kronologi" value={kronologi} onChange={(e) => setKronologi(e.target.value)} placeholder="e.g. Masbuq sholat subuh" />
                </CardContent>
                <CardFooter>
                  <Button
                    variant="danger"
                    fullWidth
                    onClick={handleCatatPelanggaran}
                    disabled={!["PH", "MK", "MT", "KS"].includes(selectedRole)}
                  >
                    Catat & Deteksi Poin x2
                  </Button>
                </CardFooter>
              </Card>
            </div>

            <div className="lg:col-span-2 space-y-4">
              <Card rounded="3xl">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle>Surat Peringatan & Akumulasi Poin</CardTitle>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="text-xs h-8 px-2.5"
                    leftIcon={<Download className="h-3.5 w-3.5 text-amber-700" />}
                    onClick={() =>
                      exportToCSV(
                        "Rekap_Pelanggaran_Santri_STQ",
                        ["Nomor SP", "Nama Santri", "Total Poin", "Tingkat", "Status SP", "Tanggal"],
                        spList.map((sp) => [sp.nomorSP, sp.santriNama, sp.totalPoin, `SP-${sp.tingkat}`, sp.status, sp.tanggal])
                      )
                    }
                  >
                    Ekspor CSV
                  </Button>
                </CardHeader>
                <CardContent className="space-y-3">
                  {spList.map((sp) => (
                    <div key={sp.id} className="p-3.5 rounded-2xl border border-slate-200/80 bg-slate-50/50 flex justify-between items-center text-xs">
                      <div>
                        <span className="font-bold text-slate-800">{sp.santriNama} — {sp.nomorSP}</span>
                        <p className="text-slate-500">Poin Saat Terbit: {sp.totalPoin} Poin</p>
                      </div>
                      <div className="flex gap-2 items-center">
                        <Badge variant={sp.status === "AKTIF" ? "orange" : "green"} size="sm">{sp.status}</Badge>
                        <button
                          type="button"
                          onClick={() => {
                            const msg = buildPelanggaranSPWAMessage({
                              santriNama: sp.santriNama,
                              kelas: "7A",
                              perihal: `Penerbitan ${sp.nomorSP}`,
                              totalPoin: sp.totalPoin,
                              kategori: "Kedisiplinan & Adab Asrama",
                              tingkatSP: sp.tingkat,
                              tindakan: "Pemberian pembinaan adab & hafalan tambahan oleh Musyrif Keasramaan",
                            });
                            setGlobalWaDialog({
                              isOpen: true,
                              phone: "081299887766",
                              recipientName: `Wali ${sp.santriNama}`,
                              message: msg,
                              title: `Pemberitahuan SP ke Wali ${sp.santriNama}`,
                              description: "Pesan resmi peringatan kedisiplinan santri ke orang tua.",
                            });
                          }}
                          title="Kirim Pemberitahuan SP ke WA Wali"
                          className="p-1.5 rounded-xl bg-[#25D366]/15 hover:bg-[#25D366]/25 text-[#128C7E] border border-[#25D366]/30 transition-all flex items-center gap-1 font-bold"
                        >
                          <svg className="h-3.5 w-3.5 fill-current text-[#25D366]" viewBox="0 0 24 24">
                            <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
                          </svg>
                          <span className="text-[10px]">WA</span>
                        </button>
                        {sp.status === "AKTIF" && selectedRole === "KS" && (
                          <Button variant="gold" size="sm" onClick={() => handlePutihkanSP(sp.id)}>Putihkan SP</Button>
                        )}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* ============================================================= */}
        {/* TAB 5: ADMINISTRASI & PENGAJUAN */}
        {/* ============================================================= */}
        {activeTab === "administrasi" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <Card rounded="3xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><DollarSign className="h-5 w-5 text-[#0E7C3A]" /> Pengajuan Anggaran</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Input label="Judul Kebutuhan" value={judulPengajuan} onChange={(e) => setJudulPengajuan(e.target.value)} placeholder="e.g. Pembelian Mushaf" />
                  <Input label="Nominal (Rp)" type="number" value={nominalPengajuan} onChange={(e) => setNominalPengajuan(e.target.value)} />
                </CardContent>
                <CardFooter>
                  <Button variant="primary" fullWidth onClick={handleAjukanKebutuhan} disabled={selectedRole !== "ADM" && selectedRole !== "KS"}>
                    Kirim Pengajuan (Admin)
                  </Button>
                </CardFooter>
              </Card>
            </div>

            <div className="lg:col-span-2">
              <Card rounded="3xl">
                <CardHeader><CardTitle>Daftar Pengajuan Anggaran Bulanan</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {pengajuanList.map((p) => (
                    <div key={p.id} className="p-3.5 rounded-2xl border border-slate-200/80 bg-white flex justify-between items-center text-xs">
                      <div>
                        <span className="font-bold text-slate-800">{p.judul}</span>
                        <p className="text-[#0E7C3A] font-bold font-heading text-sm">Rp {p.nominal.toLocaleString("id-ID")}</p>
                      </div>
                      <div className="flex gap-2 items-center">
                        <Badge variant={p.status === "DISETUJUI_KS" ? "green" : "orange"} size="sm">{p.status}</Badge>
                        {p.status === "DIAJUKAN" && selectedRole === "KS" && (
                          <Button variant="primary" size="sm" onClick={() => handleApprovePengajuan(p.id, "DISETUJUI_KS")}>Setujui</Button>
                        )}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* ============================================================= */}
        {/* TAB 6: ORANG TUA ASUH & WHATSAPP (FASE 4) */}
        {/* ============================================================= */}
        {activeTab === "sponsor" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Card Pengantar Donatur */}
              <div className="lg:col-span-1 space-y-6">
                <Card rounded="3xl">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-xl bg-emerald-50 text-[#0E7C3A] flex items-center justify-center font-bold">
                        <HeartHandshake className="h-4 w-4" />
                      </div>
                      <div>
                        <CardTitle>Program Orang Tua Asuh</CardTitle>
                        <CardDescription>Integrasi WhatsApp API untuk laporan capaian santri</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 text-xs text-slate-600">
                    <p>
                      Setiap donatur/sponsor mendapatkan laporan berkala perkembangan tahfizh santri binaan secara otomatis langsung ke nomor WhatsApp pribadi.
                    </p>
                    <div className="p-3 rounded-2xl bg-emerald-50 text-emerald-800 border border-emerald-200/80 space-y-1">
                      <p className="font-bold flex items-center gap-1"><MessageSquare className="h-3.5 w-3.5" /> WhatsApp Gateway Aktif</p>
                      <p className="text-[11px]">Kompatibel dengan Wablas, Fonnte, dan Meta WhatsApp Business API.</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Tabel Daftar Donatur & Tombol Kirim WA */}
              <div className="lg:col-span-2 space-y-6">
                <Card rounded="3xl">
                  <CardHeader>
                    <div className="flex justify-between items-center">
                      <CardTitle>Daftar Donatur & Santri Asuh</CardTitle>
                      <Badge variant="sky" size="sm">{sponsorList.length} Donatur</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {sponsorList.map((spn) => (
                      <div key={spn.id} className="p-4 rounded-2xl border border-slate-200/80 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-800 text-sm">{spn.nama}</span>
                            <Badge variant="neutral" size="sm">{spn.kode}</Badge>
                          </div>
                          <p className="text-slate-600 mt-1">Santri Asuh: <strong>{spn.santriAsuh}</strong></p>
                          <p className="text-slate-500">WA: {spn.noHp} • Donasi: Rp {spn.nominal.toLocaleString("id-ID")}/bln</p>
                        </div>

                        <div className="flex items-center gap-2">
                          <Badge variant={spn.statusWA === "TERKIRIM" ? "green" : "orange"} size="sm">
                            {spn.statusWA}
                          </Badge>
                          <Button
                            variant="primary"
                            size="sm"
                            isLoading={isPending}
                            onClick={() => handleKirimWA(spn.id, spn.nama, spn.noHp, spn.santriAsuh)}
                            leftIcon={<MessageSquare className="h-3.5 w-3.5" />}
                          >
                            Kirim WA Laporan
                          </Button>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* Preview Pesan WhatsApp yang Terkirim */}
                {pesanWAPreview && (
                  <Card rounded="3xl" className="border-2 border-emerald-500/20 bg-emerald-50/20">
                    <CardHeader>
                      <CardTitle className="text-sm text-emerald-800 flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-[#0E7C3A]" /> Payload Pesan WhatsApp Terkirim (Preview):
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <pre className="p-4 rounded-2xl bg-white border border-emerald-200 text-xs text-slate-800 font-mono whitespace-pre-wrap leading-relaxed">
                        {pesanWAPreview}
                      </pre>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================= */}
        {/* TAB 7: GENERATOR SURAT RESMI AI (FASE 4) */}
        {/* ============================================================= */}
        {activeTab === "surat" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Form Konfigurasi Generator Surat */}
              <div className="lg:col-span-1 space-y-6">
                <Card rounded="3xl">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-xl bg-amber-50 text-[#C9990E] flex items-center justify-center font-bold">
                        <Sparkles className="h-4 w-4" />
                      </div>
                      <div>
                        <CardTitle>Generator Surat AI</CardTitle>
                        <CardDescription>Penerbitan surat resmi berkop pondok otomatis</CardDescription>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700">Jenis Surat</label>
                      <select
                        value={jenisSuratPilihan}
                        onChange={(e) => setJenisSuratPilihan(e.target.value as any)}
                        className="w-full min-h-[44px] px-3 py-2.5 rounded-2xl bg-white border border-slate-200 text-xs"
                      >
                        <option value="SURAT_KETERANGAN_AKTIF">Surat Keterangan Santri Aktif</option>
                        <option value="SURAT_UNDANGAN_WALI">Surat Undangan Pertemuan Wali</option>
                        <option value="SURAT_IZIN_KEGIATAN">Surat Permohonan Izin Kegiatan</option>
                        <option value="SURAT_REKOMENDASI">Surat Rekomendasi Santri Berprestasi</option>
                      </select>
                    </div>

                    <Input
                      label="Perihal Surat"
                      value={perihalSurat}
                      onChange={(e) => setPerihalSurat(e.target.value)}
                    />

                    <Input
                      label="Tujuan Surat / Penerima"
                      value={tujuanSurat}
                      onChange={(e) => setTujuanSurat(e.target.value)}
                    />

                    <Input
                      label="Pokok Isi / Keperluan"
                      value={isiPokokSurat}
                      onChange={(e) => setIsiPokokSurat(e.target.value)}
                    />
                  </CardContent>

                  <CardFooter>
                    <Button
                      variant="gold"
                      fullWidth
                      isLoading={isPending}
                      onClick={handleGenerateSurat}
                      disabled={selectedRole !== "ADM" && selectedRole !== "KS"}
                      leftIcon={<Sparkles className="h-4 w-4" />}
                    >
                      {selectedRole === "ADM" || selectedRole === "KS"
                        ? "Generate Naskah Surat (AI)"
                        : `Role ${selectedRole} Tidak Berhak`}
                    </Button>
                  </CardFooter>
                </Card>
              </div>

              {/* Tampilan Naskah Surat Resmi Berkop */}
              <div className="lg:col-span-2 space-y-6">
                <Card rounded="3xl" className="border-2 border-slate-300 shadow-md">
                  <CardHeader className="bg-slate-50 rounded-t-3xl border-b border-slate-200 flex flex-row items-center justify-between p-4 md:p-6">
                    <div>
                      <Badge variant="green" size="sm">Naskah Resmi Siap Cetak</Badge>
                      <CardTitle className="text-base mt-1">Pratinjau Dokumen Surat Resmi</CardTitle>
                    </div>
                    {hasilSuratAI && (
                      <div className="flex gap-2">
                        <Button variant="secondary" size="sm" leftIcon={<Printer className="h-3.5 w-3.5" />}>
                          Cetak PDF
                        </Button>
                      </div>
                    )}
                  </CardHeader>

                  <CardContent className="p-6">
                    {hasilSuratAI ? (
                      <pre className="p-6 rounded-2xl bg-white border border-slate-200 font-mono text-xs text-slate-800 whitespace-pre-wrap leading-relaxed shadow-xs">
                        {hasilSuratAI}
                      </pre>
                    ) : (
                      <div className="py-16 text-center space-y-2 text-slate-400">
                        <FileText className="h-10 w-10 mx-auto stroke-1" />
                        <p className="text-sm">Klik tombol <strong>"Generate Naskah Surat (AI)"</strong> untuk merumuskan draf surat resmi otomatis berkop pondok.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 8: IKHTIBAR / UJIAN TAHFIZH 2 TAHAP (FASE 6)          */}
        {/* ========================================================= */}
        {activeTab === "ikhtibar" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Form Ajukan & Input Ujian */}
              <div className="lg:col-span-1 space-y-6">
                <Card rounded="3xl">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <FileBadge className="h-5 w-5 text-[#0E7C3A]" />
                      <CardTitle className="text-base">Pengajuan Ujian Ikhtibar</CardTitle>
                    </div>
                    <CardDescription>
                      Standar kelulusan juz: Tahap 1 oleh Musyrif (`MT`), Tahap 2 disahkan Mudir (`KS`).
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700">Pilih Santri</label>
                      <select
                        value={selectedSantriNis}
                        onChange={(e) => setSelectedSantriNis(e.target.value)}
                        className="w-full min-h-[44px] px-4 py-2.5 rounded-2xl bg-white border border-slate-200 text-sm"
                      >
                        {santriList.map((s) => (
                          <option key={s.id} value={s.nis}>
                            {s.nama} ({s.nis}) — Juz {s.capaianJuz}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700">Juz yang Diujikan (1-30)</label>
                      <Input
                        type="number"
                        min="1"
                        max="30"
                        value={ikhtibarJuz}
                        onChange={(e) => setIkhtibarJuz(e.target.value)}
                      />
                    </div>

                    <div className="p-3 bg-emerald-50/80 rounded-2xl border border-emerald-100 text-xs text-emerald-800 space-y-1">
                      <p className="font-bold">Alur 2 Tahap:</p>
                      <p>1. Ujian Tahap 1: Penguji Musyrif Tahfizh (Kelancaran & Makhraj).</p>
                      <p>2. Ujian Tahap 2: Penguji Mudir (Pengesahan Legalitas Kelulusan Juz).</p>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button
                      className="w-full"
                      isLoading={isPending}
                      onClick={handleAjukanIkhtibar}
                      disabled={!["MT", "KS", "ADM"].includes(selectedRole)}
                      leftIcon={<PlusCircle className="h-4 w-4" />}
                    >
                      {["MT", "KS", "ADM"].includes(selectedRole)
                        ? "Daftarkan Santri Ikhtibar"
                        : `Role ${selectedRole} Tidak Berhak`}
                    </Button>
                  </CardFooter>
                </Card>

                {/* Nilai Ujian Editor */}
                <Card rounded="3xl">
                  <CardHeader>
                    <CardTitle className="text-base">Lembar Penilaian Ujian</CardTitle>
                    <CardDescription>Digunakan saat menguji santri di majelis</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700">Nilai Angka (0-100)</label>
                      <Input
                        type="number"
                        value={ikhtibarNilai}
                        onChange={(e) => setIkhtibarNilai(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700">Catatan Tajwid & Kelancaran</label>
                      <Input
                        value={ikhtibarCatatan}
                        onChange={(e) => setIkhtibarCatatan(e.target.value)}
                        placeholder="e.g. Sempurna, kelancaran mumtaz"
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Daftar Ikhtibar Berjalan */}
              <div className="lg:col-span-2 space-y-4">
                <Card rounded="3xl">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-base">Daftar Antrean & Riwayat Ikhtibar</CardTitle>
                      <CardDescription>Memantau progres kelulusan juz per santri</CardDescription>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setShowPrintModal("rapor")}
                      leftIcon={<Printer className="h-3.5 w-3.5" />}
                    >
                      Cetak Rapor Santri
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {ikhtibarList.map((item) => (
                      <div
                        key={item.id}
                        className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-3"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-800">{item.santri}</span>
                              <span className="text-xs text-slate-400">({item.nis})</span>
                            </div>
                            <p className="text-xs text-emerald-700 font-semibold mt-0.5">
                              Ujian Hafalan: <strong>Juz {item.juz}</strong>
                            </p>
                          </div>
                          <Badge
                            variant={
                              item.status === "LULUS_SEMPURNA_TAHAP_2"
                                ? "green"
                                : item.status === "LULUS_TAHAP_1"
                                ? "gold"
                                : "neutral"
                            }
                            size="sm"
                          >
                            {item.status.replace(/_/g, " ")}
                          </Badge>
                        </div>

                        {/* Detail Nilai */}
                        <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                          <div>
                            <span className="text-slate-500 font-medium">Ujian Tahap 1 (MT):</span>
                            <p className="font-bold text-slate-800">
                              {item.nilaiTahap1 !== null ? `${item.nilaiTahap1} / 100` : "Belum Diuji"}
                            </p>
                            {item.catatanTahap1 && (
                              <p className="text-[11px] text-slate-500 italic mt-0.5">{item.catatanTahap1}</p>
                            )}
                          </div>
                          <div>
                            <span className="text-slate-500 font-medium">Ujian Tahap 2 (Mudir KS):</span>
                            <p className="font-bold text-slate-800">
                              {item.nilaiTahap2 !== null ? `${item.nilaiTahap2} / 100` : "Menunggu Mudir"}
                            </p>
                            {item.catatanTahap2 && (
                              <p className="text-[11px] text-slate-500 italic mt-0.5">{item.catatanTahap2}</p>
                            )}
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-2 pt-1">
                          {item.status === "PENGAJUAN" && (
                            <Button
                              size="sm"
                              className="bg-emerald-600 hover:bg-emerald-700 text-xs"
                              onClick={() => handleLuluskanTahap1(item.id)}
                              disabled={selectedRole !== "MT" && selectedRole !== "KS"}
                              leftIcon={<Check className="h-3 w-3" />}
                            >
                              Luluskan Tahap 1 (MT)
                            </Button>
                          )}

                          {item.status === "LULUS_TAHAP_1" && (
                            <Button
                              size="sm"
                              className="bg-[#C9990E] hover:bg-amber-600 text-white text-xs"
                              onClick={() => handleSahkanTahap2(item.id)}
                              disabled={selectedRole !== "KS"}
                              leftIcon={<Award className="h-3 w-3" />}
                            >
                              Sahkan Kelulusan Juz (Mudir KS)
                            </Button>
                          )}

                          {item.status === "LULUS_SEMPURNA_TAHAP_2" && (
                            <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-bold">
                              <CheckCircle className="h-4 w-4" />
                              <span>Syahadah Kelulusan Juz Telah Diterbitkan</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 9: POSKESTREN / KESEHATAN SANTRI (FASE 6)             */}
        {/* ========================================================= */}
        {activeTab === "kesehatan" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Form Rekam Medis */}
              <div className="lg:col-span-1 space-y-6">
                <Card rounded="3xl">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Stethoscope className="h-5 w-5 text-rose-600" />
                      <CardTitle className="text-base">Catat Pasien Poskestren</CardTitle>
                    </div>
                    <CardDescription>
                      Pencatatan keluhan sakit & eskalasi medis berjenjang santri.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700">Nama Santri</label>
                      <select
                        value={selectedSantriNis}
                        onChange={(e) => setSelectedSantriNis(e.target.value)}
                        className="w-full min-h-[44px] px-4 py-2.5 rounded-2xl bg-white border border-slate-200 text-sm"
                      >
                        {santriList.map((s) => (
                          <option key={s.id} value={s.nis}>
                            {s.nama} ({s.kelas})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700">Keluhan & Gejala</label>
                      <Input
                        value={keluhanInput}
                        onChange={(e) => setKeluhanInput(e.target.value)}
                        placeholder="e.g. Demam 38°C, pusing, batuk"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700">Tindakan / Terapi P3K Diberikan</label>
                      <Input
                        value={tindakanInput}
                        onChange={(e) => setTindakanInput(e.target.value)}
                        placeholder="e.g. Paracetamol 500mg, kompres air hangat"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700">Status Penanganan Awal</label>
                      <select
                        value={statusKesehatanInput}
                        onChange={(e) => setStatusKesehatanInput(e.target.value as any)}
                        className="w-full min-h-[44px] px-4 py-2.5 rounded-2xl bg-white border border-slate-200 text-sm"
                      >
                        <option value="RAWAT_PONDOK">Rawat Pondok (UKS Asrama)</option>
                        <option value="DIRUJUK_PUSKESMAS">Rujuk ke Puskesmas</option>
                        <option value="DIRUJUK_RS">Rujuk ke Rumah Sakit</option>
                        <option value="SEMBUH">Sembuh</option>
                      </select>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button
                      className="w-full bg-rose-600 hover:bg-rose-700 text-white"
                      isLoading={isPending}
                      onClick={handleCatatKesehatan}
                      disabled={!["OSDA", "MK", "PH", "KS", "ADM"].includes(selectedRole)}
                      leftIcon={<PlusCircle className="h-4 w-4" />}
                    >
                      {["OSDA", "MK", "PH", "KS", "ADM"].includes(selectedRole)
                        ? "Simpan Rekam Medis"
                        : `Role ${selectedRole} Tidak Berhak`}
                    </Button>
                  </CardFooter>
                </Card>
              </div>

              {/* Daftar Riwayat Kesehatan */}
              <div className="lg:col-span-2 space-y-4">
                <Card rounded="3xl">
                  <CardHeader>
                    <CardTitle className="text-base">Daftar Pasien & Status Pemulihan</CardTitle>
                    <CardDescription>
                      Eskalasi rujukan medis: Pondok &rarr; Puskesmas &rarr; RS
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {kesehatanList.map((item) => (
                      <div
                        key={item.id}
                        className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-2.5"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="font-bold text-slate-800">{item.santri}</span>
                            <span className="text-xs text-slate-400 ml-2">({item.nis})</span>
                            <p className="text-xs text-slate-500 mt-0.5">Tanggal: {item.tanggal}</p>
                          </div>
                          <Badge
                            variant={
                              item.status === "SEMBUH"
                                ? "green"
                                : item.status === "DIRUJUK_RS"
                                ? "orange"
                                : item.status === "DIRUJUK_PUSKESMAS"
                                ? "gold"
                                : "neutral"
                            }
                            size="sm"
                          >
                            {item.status.replace(/_/g, " ")}
                          </Badge>
                        </div>

                        <div className="text-xs space-y-1 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                          <p>
                            <strong className="text-slate-700">Keluhan:</strong> {item.keluhan}
                          </p>
                          <p>
                            <strong className="text-slate-700">Diagnosa:</strong> {item.diagnosa}
                          </p>
                          <p>
                            <strong className="text-slate-700">Tindakan:</strong> {item.tindakan}
                          </p>
                        </div>

                        {/* Rujukan Button (MK / KS) */}
                        {item.status !== "SEMBUH" && (
                          <div className="flex flex-wrap gap-2 pt-1">
                            {item.status === "RAWAT_PONDOK" && (
                              <Button
                                size="sm"
                                variant="secondary"
                                className="text-xs border-amber-300 text-amber-800"
                                onClick={() => handleUpdateStatusKesehatan(item.id, "DIRUJUK_PUSKESMAS")}
                                disabled={selectedRole !== "MK" && selectedRole !== "KS"}
                              >
                                Rujuk ke Puskesmas
                              </Button>
                            )}

                            {item.status !== "DIRUJUK_RS" && (
                              <Button
                                size="sm"
                                variant="secondary"
                                className="text-xs border-rose-300 text-rose-700"
                                onClick={() => handleUpdateStatusKesehatan(item.id, "DIRUJUK_RS")}
                                disabled={selectedRole !== "MK" && selectedRole !== "KS"}
                              >
                                Rujuk ke RS
                              </Button>
                            )}

                            <Button
                              size="sm"
                              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                              onClick={() => handleUpdateStatusKesehatan(item.id, "SEMBUH")}
                              disabled={selectedRole !== "MK" && selectedRole !== "KS"}
                              leftIcon={<Check className="h-3 w-3" />}
                            >
                              Tandai Sembuh
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 10: LOGISTIK & INVENTARIS ASRAMA (FASE 6)             */}
        {/* ========================================================= */}
        {activeTab === "logistik" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Form Mutasi Logistik */}
              <div className="lg:col-span-1 space-y-6">
                <Card rounded="3xl">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Package className="h-5 w-5 text-[#0E7C3A]" />
                      <CardTitle className="text-base">Catat Mutasi Logistik</CardTitle>
                    </div>
                    <CardDescription>
                      Pencatatan barang masuk (donasi/pembelian) & barang keluar dapur asrama.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700">Pilih Barang</label>
                      <select
                        value={selectedLogistikId}
                        onChange={(e) => setSelectedLogistikId(e.target.value)}
                        className="w-full min-h-[44px] px-4 py-2.5 rounded-2xl bg-white border border-slate-200 text-sm"
                      >
                        {logistikList.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.nama} ({item.kode}) — Stok: {item.stok} {item.satuan}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700">Jenis Mutasi</label>
                        <select
                          value={jenisMutasi}
                          onChange={(e) => setJenisMutasi(e.target.value as any)}
                          className="w-full min-h-[44px] px-3 py-2.5 rounded-2xl bg-white border border-slate-200 text-sm"
                        >
                          <option value="MASUK">Masuk (Donasi/Beli)</option>
                          <option value="KELUAR">Keluar (Dapur/Pakai)</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700">Jumlah</label>
                        <Input
                          type="number"
                          value={jumlahMutasi}
                          onChange={(e) => setJumlahMutasi(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700">Keterangan Mutasi</label>
                      <Input
                        value={ketMutasi}
                        onChange={(e) => setKetMutasi(e.target.value)}
                        placeholder="e.g. Donasi Wali Santri Kelas 7"
                      />
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button
                      className="w-full"
                      isLoading={isPending}
                      onClick={handleMutasiLogistik}
                      disabled={!["MK", "ADM", "KS"].includes(selectedRole)}
                      leftIcon={<PlusCircle className="h-4 w-4" />}
                    >
                      {["MK", "ADM", "KS"].includes(selectedRole)
                        ? "Simpan Mutasi Barang"
                        : `Role ${selectedRole} Tidak Berhak`}
                    </Button>
                  </CardFooter>
                </Card>
              </div>

              {/* Grid Kartu Stok Barang */}
              <div className="lg:col-span-2 space-y-4">
                <Card rounded="3xl">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <div>
                      <CardTitle className="text-base">Inventaris Stok Gudang & Asrama</CardTitle>
                      <CardDescription>Pelacakan stok real-time sembako dan logistik santri</CardDescription>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="text-xs h-8 px-2.5"
                      leftIcon={<Download className="h-3.5 w-3.5 text-emerald-700" />}
                      onClick={() =>
                        exportToCSV(
                          "Rekap_Stok_Logistik_STQ",
                          ["Kode", "Nama Barang", "Kategori", "Lokasi", "Stok", "Satuan"],
                          logistikList.map((l) => [l.kode, l.nama, l.kategori, l.lokasi, l.stok, l.satuan])
                        )
                      }
                    >
                      Ekspor CSV
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {logistikList.map((item) => (
                        <div
                          key={item.id}
                          className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex flex-col justify-between space-y-3"
                        >
                          <div>
                            <div className="flex items-center justify-between">
                              <Badge variant="neutral" size="sm">
                                {item.kode}
                              </Badge>
                              <Badge
                                variant={item.kategori === "SEMBAKO" ? "green" : "gold"}
                                size="sm"
                              >
                                {item.kategori}
                              </Badge>
                            </div>
                            <h4 className="font-bold text-slate-800 text-sm mt-2">{item.nama}</h4>
                            <p className="text-xs text-slate-500">Lokasi: {item.lokasi}</p>
                          </div>

                          <div className="pt-2 border-t border-slate-100 flex items-baseline justify-between">
                            <span className="text-xs text-slate-400">Sisa Stok:</span>
                            <span className="font-extrabold text-lg text-[#0E7C3A]">
                              {item.stok} <span className="text-xs font-semibold text-slate-600">{item.satuan}</span>
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 11: PORTAL KHUSUS WALI SANTRI & SANTRI (FASE 7)       */}
        {/* ========================================================= */}
        {activeTab === "portal_wali" && (
          <div className="space-y-6">
            {/* Header Hero Wali Santri */}
            <div className="bg-gradient-to-r from-emerald-800 via-emerald-700 to-[#0E7C3A] text-white rounded-3xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <Badge variant="gold" size="sm" className="mb-2">Portal Orang Tua & Santri</Badge>
                <h3 className="text-xl font-bold font-heading">
                  {selectedRole === "WS" ? "Ahlan wa Sahlan, Ayah/Bunda Wali Santri" : "Ahlan wa Sahlan, Santri Mandiri STQ DUC"}
                </h3>
                <p className="text-xs text-emerald-100 mt-1">
                  Pantau perkembangan hafalan Al-Qur'an, adab & kedisiplinan, kesehatan, serta capaian prestasi ananda.
                </p>
              </div>
              <Button
                variant="secondary"
                size="md"
                onClick={() => setShowPrintModal("rapor")}
                leftIcon={<Printer className="h-4 w-4" />}
              >
                Unduh / Cetak Rapor Digital
              </Button>
            </div>

            {/* Kartu Profil Ananda */}
            <Card rounded="3xl" className="border-2 border-emerald-100 bg-white">
              <CardContent className="p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                  <div>
                    <h4 className="text-lg font-bold text-slate-900">Obama Ozearld Egberted Turizqi</h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      NIS: <strong>SAN-0001</strong> • Kelas: <strong>9A Takhossus</strong> • Musyrif: <strong>Ust. Razan Mufli, S.Pd</strong>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="green" size="md">Santri Aktif</Badge>
                    <Badge variant="gold" size="md">2 Bintang Teladan</Badge>
                  </div>
                </div>

                {/* 4 Metric Utama */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
                  <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-100">
                    <span className="text-xs text-emerald-800 font-semibold">Capaian Tahfizh</span>
                    <p className="text-xl font-extrabold text-[#0E7C3A] mt-1">22 Juz</p>
                    <span className="text-[11px] text-emerald-600 font-medium">Ikhtibar Juz 22 Lulus</span>
                  </div>

                  <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-100">
                    <span className="text-xs text-amber-800 font-semibold">Rapor Akademik</span>
                    <p className="text-xl font-extrabold text-[#C9990E] mt-1">89.0 / A</p>
                    <span className="text-[11px] text-amber-700 font-medium">Peringkat 3 Kelas</span>
                  </div>

                  <div className="p-4 rounded-2xl bg-sky-50/70 border border-sky-100">
                    <span className="text-xs text-sky-800 font-semibold">Poin Kedisiplinan</span>
                    <p className="text-xl font-extrabold text-sky-700 mt-1">0 Poin</p>
                    <span className="text-[11px] text-sky-600 font-medium">Bersih / Teladan</span>
                  </div>

                  <div className="p-4 rounded-2xl bg-purple-50/70 border border-purple-100">
                    <span className="text-xs text-purple-800 font-semibold">Status Kesehatan</span>
                    <p className="text-xl font-extrabold text-purple-700 mt-1">Sehat</p>
                    <span className="text-[11px] text-purple-600 font-medium">Pemulihan Poskestren</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 2 Kolom: Aktivitas & Kotak Saran */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Kolom Kiri: Riwayat Aktivitas & Izin */}
              <div className="space-y-4">
                <Card rounded="3xl">
                  <CardHeader>
                    <CardTitle className="text-base">Riwayat Setoran & Ikhtibar Terbaru</CardTitle>
                    <CardDescription>Catatan langsung dari majelis halaqoh</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                      <div>
                        <span className="font-bold text-slate-800 text-xs">Setoran Sabaq (Hafalan Baru)</span>
                        <p className="text-xs text-emerald-700 font-semibold">Ali 'Imran: 1-20 (Juz 4)</p>
                        <p className="text-[11px] text-slate-400">Catatan: Makhraj dan tajwid fasih</p>
                      </div>
                      <Badge variant="green" size="sm">MUMTAZ</Badge>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                      <div>
                        <span className="font-bold text-slate-800 text-xs">Ujian Ikhtibar Juz 4 (Tahap 1)</span>
                        <p className="text-xs text-amber-700 font-semibold">Penguji: Ust. Razan Mufli, S.Pd (MT)</p>
                        <p className="text-[11px] text-slate-400">Nilai: 92/100 • Siap Ujian Mudir</p>
                      </div>
                      <Badge variant="gold" size="sm">LULUS TAHAP 1</Badge>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                      <div>
                        <span className="font-bold text-slate-800 text-xs">Pengajuan Izin Pulang Terakhir</span>
                        <p className="text-xs text-slate-600">Keperluan: Menghadiri pernikahan keluarga</p>
                        <p className="text-[11px] text-emerald-600">Telah Disetujui Mudir & MK</p>
                      </div>
                      <Badge variant="green" size="sm">DISETUJUI</Badge>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Kolom Kanan: Kotak Saran Wali Santri */}
              <div className="space-y-4">
                <Card rounded="3xl">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <MessageCircle className="h-5 w-5 text-[#0E7C3A]" />
                      <CardTitle className="text-base">Kotak Saran & Aspirasi Wali Santri</CardTitle>
                    </div>
                    <CardDescription>
                      Kirimkan masukan atau pertanyaan langsung kepada Mudir & Pengurus Pesantren
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700">Kategori Aspirasi</label>
                      <select
                        value={inputSaranKategori}
                        onChange={(e) => setInputSaranKategori(e.target.value)}
                        className="w-full min-h-[44px] px-4 py-2.5 rounded-2xl bg-white border border-slate-200 text-sm"
                      >
                        <option value="Gizi & Katering">Gizi, Makanan & Katering Asrama</option>
                        <option value="Tahfizh & Musyrif">Ketahfidzan & Majelis Halaqoh</option>
                        <option value="Kedisiplinan & Asrama">Kedisiplinan & Kebersihan Kamar</option>
                        <option value="Fasilitas & Sarpras">Fasilitas, Ranjang & UKS</option>
                        <option value="Administrasi & SPP">Administrasi, SPP & Beasiswa</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700">Pesan / Masukan Anda</label>
                      <textarea
                        rows={3}
                        value={inputSaranPesan}
                        onChange={(e) => setInputSaranPesan(e.target.value)}
                        placeholder="Tuliskan masukan atau saran konstruktif Bapak/Ibu demi kemajuan ananda dan pesantren..."
                        className="w-full p-4 rounded-2xl bg-white border border-slate-200 text-xs focus:ring-2 focus:ring-[#0E7C3A] focus:outline-none"
                      />
                    </div>

                    <Button
                      className="w-full"
                      isLoading={isPending}
                      onClick={handleKirimSaran}
                      leftIcon={<Send className="h-4 w-4" />}
                    >
                      Kirim Saran ke Mudir
                    </Button>

                    {/* Riwayat Aspirasi & Tanggapan */}
                    <div className="pt-2 space-y-3">
                      <h5 className="text-xs font-bold text-slate-700">Aspirasi Anda Sebelumnya:</h5>
                      {kotakSaranList.map((s) => (
                        <div key={s.id} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-800">{s.kategori}</span>
                            <Badge variant={s.status === "DITANGGAPI" ? "green" : "gold"} size="sm">
                              {s.status}
                            </Badge>
                          </div>
                          <p className="text-slate-600 italic">"{s.pesan}"</p>
                          {s.tanggapan && (
                            <div className="p-2.5 rounded-xl bg-emerald-50/80 border border-emerald-100 text-emerald-900 mt-2">
                              <p className="font-bold text-[11px]">Tanggapan Pimpinan Pondok:</p>
                              <p className="mt-0.5">{s.tanggapan}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 12: KALENDER AKADEMIK & JADWAL RITMIK (BAB V)          */}
        {/* ========================================================= */}
        {activeTab === "agenda" && (
          <div className="space-y-6">
            {/* Sub-navigasi Tab Agenda */}
            <div className="flex items-center gap-2 p-1.5 bg-slate-100/80 rounded-2xl w-fit border border-slate-200/80">
              <button
                onClick={() => setSubTabAgenda("ritmik")}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2",
                  subTabAgenda === "ritmik"
                    ? "bg-[#0E7C3A] text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                <Clock className="h-3.5 w-3.5" />
                Jadwal Harian Ritmik Santri (Bab V)
              </button>
              <button
                onClick={() => setSubTabAgenda("kalender")}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2",
                  subTabAgenda === "kalender"
                    ? "bg-[#0E7C3A] text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                <Calendar className="h-3.5 w-3.5" />
                Kalender Kegiatan &amp; Agenda Pesantren
              </button>
            </div>

            {subTabAgenda === "ritmik" ? (
              <div className="space-y-6">
                {/* Header Kurikulum Bab V */}
                <Card rounded="3xl" className="border-2 border-[#0E7C3A]/20 bg-gradient-to-r from-emerald-50/50 to-white">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock className="h-5 w-5 text-[#0E7C3A]" />
                        <CardTitle className="text-base sm:text-lg">
                          Jadwal Harian Ritmik Santri — STQ Darul Ulum Cendekia
                        </CardTitle>
                      </div>
                      <Badge variant="green" size="md">Standar Kurikulum Resmi</Badge>
                    </div>
                    <CardDescription>
                      Pola ritmik harian terintegrasi: Tahfiz Al-Qur&apos;an (Metode Al-Pakistani), Program Kepesantrenan Malam, dan Studi Umum / PBL Sabtu.
                    </CardDescription>
                  </CardHeader>
                </Card>

                {/* Grid 3 Kolom: Senin-Jumat, Sabtu PBL, Ahad */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Kolom 1: Senin s.d. Jumat */}
                  <div className="lg:col-span-2 space-y-4">
                    <Card rounded="3xl">
                      <CardHeader className="pb-3 border-b border-slate-100">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base text-[#0E7C3A] flex items-center gap-2">
                            <BookOpen className="h-4 w-4" /> Senin s.d. Jumat (Tahfiz &amp; Kepesantrenan)
                          </CardTitle>
                          <Badge variant="green" size="sm">Halaqah Utama</Badge>
                        </div>
                        <CardDescription>Alur intensif 5 waktu halaqah Al-Qur&apos;an &amp; kajian diniyah malam</CardDescription>
                      </CardHeader>
                      <CardContent className="pt-4">
                        <div className="relative border-l-2 border-emerald-200 ml-3 space-y-4 text-xs">
                          {[
                            { jam: "03.30 – 04.30", judul: "Qiyamul Lail & Sahur", desc: "Shalat Tahajjud mandiri/berjamaah & sahur puasa sunnah (Senin/Kamis)", badge: "Ibadah Malam" },
                            { jam: "04.30 – 05.45", judul: "Shalat Shubuh & Dzikir Pagi", desc: "Shalat berjamaah di masjid, dzikir Al-Ma'tsurat, dan persiapan halaqah", badge: "Masjid" },
                            { jam: "05.45 – 07.00", judul: "Halaqah Tahfiz Pagi (Sabaq, Sabqi, Manzil, Mufar)", desc: "Setoran hafalan baru (Sabaq) dan penguatan hafalan kemarin (Sabqi)", badge: "Halaqah 1", hl: true },
                            { jam: "07.00 – 07.30", judul: "Tambahan Setoran Sabaq", desc: "Bimbingan intensif bagi santri yang membutuhkan perbaikan tajwid/kelancaran", badge: "Bimbingan" },
                            { jam: "07.30 – 09.00", judul: "Sarapan Pagi, Piket & MCK", desc: "Makan pagi bersama, piket kebersihan asrama/kamar, persiapan mandi", badge: "Asrama" },
                            { jam: "09.00 – 10.30", judul: "Halaqah Tahfiz Dhuha & Shalat Dhuha", desc: "Ziyadah hafalan baru serta sholat sunnah dhuha di masjid", badge: "Halaqah 2", hl: true },
                            { jam: "10.30 – 13.00", judul: "Zhuhur, Makan Siang & Qailulah", desc: "Shalat Zhuhur berjamaah, makan siang gizi seimbang, dan tidur siang (sunnah qailulah)", badge: "Istirahat" },
                            { jam: "13.00 – 15.00", judul: "Halaqah Tahfiz Siang", desc: "Murojaah Manzil (penguatan juz-juz lama agar mutqin)", badge: "Halaqah 3", hl: true },
                            { jam: "15.00 – 16.00", judul: "Shalat Ashar & Dzikir Petang", desc: "Shalat Ashar berjamaah dan pembacaan wirid/dzikir petang", badge: "Masjid" },
                            { jam: "16.00 – 17.00", judul: "Halaqah Tahfiz Sore", desc: "Mufar (sima'an berpasangan antar-santri & pemantapan hafalan)", badge: "Halaqah 4", hl: true },
                            { jam: "17.00 – 18.00", judul: "Istirahat Sore, Mandi & MCK", desc: "Aktivitas mandiri, mandi sore, dan persiapan menuju masjid", badge: "Asrama" },
                            { jam: "18.00 – 18.30", judul: "Shalat Maghrib Berjamaah", desc: "Shalat Maghrib berjamaah dan tilawah Al-Qur'an menjelang kajian", badge: "Masjid" },
                            { jam: "18.30 – 19.30", judul: "Program Kepesantrenan (Senin–Jumat)", desc: "Senin: B. Arab • Selasa: Tafsir • Rabu: Fikih • Kamis: Aqidah • Jumat: Tajwid", badge: "Kajian Diniyah", hl: true },
                            { jam: "19.30 – 20.00", judul: "Shalat Isya & Makan Malam", desc: "Shalat Isya berjamaah dilanjutkan makan malam bersama", badge: "Masjid & Dapur" },
                            { jam: "20.00 – 21.30", judul: "Halaqah Tahfiz Malam / Murojaah Mandiri", desc: "Persiapan setoran sabaq esok hari di bawah bimbingan musyrif/mudhabbir", badge: "Halaqah 5", hl: true },
                            { jam: "21.30 – 03.30", judul: "Istirahat Malam (Jam Wajib Tidur)", desc: "Lampu asrama dipadamkan, istirahat malam teratur demi stamina menghafal", badge: "Tidur Asrama" },
                          ].map((item, idx) => (
                            <div key={idx} className="relative pl-6">
                              <div className={cn(
                                "absolute -left-[9px] top-1.5 h-4 w-4 rounded-full border-2 bg-white",
                                item.hl ? "border-emerald-600 bg-emerald-500" : "border-slate-300"
                              )} />
                              <div className={cn("p-2.5 rounded-xl border", item.hl ? "bg-emerald-50/50 border-emerald-200" : "bg-white border-slate-200/70")}>
                                <div className="flex justify-between items-start gap-2">
                                  <div>
                                    <span className="font-bold text-slate-800 text-xs">{item.judul}</span>
                                    <p className="text-[11px] text-slate-500 mt-0.5">{item.desc}</p>
                                  </div>
                                  <div className="text-right shrink-0">
                                    <span className="font-mono text-[11px] font-bold text-emerald-800 block">{item.jam}</span>
                                    <Badge variant={item.hl ? "green" : "neutral"} size="sm">{item.badge}</Badge>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Kolom 2: Sabtu (Studi Umum & PBL) & Ahad */}
                  <div className="space-y-6">
                    {/* Sabtu: Studi Umum & PBL */}
                    <Card rounded="3xl" className="border-2 border-sky-200">
                      <CardHeader className="pb-3 border-b border-slate-100">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base text-sky-800 flex items-center gap-2">
                            <GraduationCap className="h-4 w-4" /> Sabtu: Studi Umum &amp; PBL
                          </CardTitle>
                          <Badge variant="sky" size="sm">08.00–15.30 WITA</Badge>
                        </div>
                        <CardDescription>Pemenuhan kurikulum nasional &amp; proyek berbasis masalah</CardDescription>
                      </CardHeader>
                      <CardContent className="pt-4 space-y-3 text-xs">
                        <div className="p-3 rounded-2xl bg-sky-50/70 border border-sky-200 space-y-1">
                          <div className="flex justify-between">
                            <span className="font-bold text-slate-800">08.00 – 09.30 WITA</span>
                            <Badge variant="sky" size="sm">Mapel Tetap</Badge>
                          </div>
                          <p className="font-semibold text-sky-900">Matematika Terapan</p>
                          <p className="text-[11px] text-slate-600">Pengampu: Ustzh. Nurul Hidayah, S.Pd.</p>
                        </div>

                        <div className="p-3 rounded-2xl bg-sky-50/70 border border-sky-200 space-y-1">
                          <div className="flex justify-between">
                            <span className="font-bold text-slate-800">09.30 – 11.00 WITA</span>
                            <Badge variant="sky" size="sm">Mapel Tetap</Badge>
                          </div>
                          <p className="font-semibold text-sky-900">Bahasa Inggris (Komunikasi &amp; Gramatika)</p>
                          <p className="text-[11px] text-slate-600">Pengampu: Ustzh. Nurul Hidayah, S.Pd.</p>
                        </div>

                        <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-1">
                          <div className="flex justify-between">
                            <span className="font-bold text-slate-800">11.00 – 12.30 WITA</span>
                            <Badge variant="green" size="sm">PBL Sesi 1</Badge>
                          </div>
                          <p className="font-semibold text-emerald-900">Project-Based Learning (Rotasi Siklus)</p>
                          <p className="text-[11px] text-slate-600">
                            Bahasa Indonesia, IPA, IPS, dan TIK bergantian per siklus 5 pekan.
                          </p>
                        </div>

                        <div className="p-2.5 rounded-xl bg-slate-50 text-[11px] text-slate-500 border border-slate-200">
                          <strong>12.30 – 14.00 WITA:</strong> Shalat Zhuhur Berjamaah &amp; Makan Siang
                        </div>

                        <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-1">
                          <div className="flex justify-between">
                            <span className="font-bold text-slate-800">14.00 – 15.30 WITA</span>
                            <Badge variant="green" size="sm">PBL Sesi 2</Badge>
                          </div>
                          <p className="font-semibold text-emerald-900">Presentasi Karya &amp; Portofolio Proyek</p>
                          <p className="text-[11px] text-slate-600">
                            Evaluasi produk proyek, penulisan laporan ilmiah, dan asesmen guru.
                          </p>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Ahad: Hari Mandiri */}
                    <Card rounded="3xl" className="border border-amber-200 bg-amber-50/30">
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base text-amber-900">Ahad: Hari Mandiri &amp; Wali</CardTitle>
                          <Badge variant="gold" size="sm">Istirahat &amp; Olahraga</Badge>
                        </div>
                        <CardDescription>Kegiatan penyegaran dan kunjungan orang tua santri</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-2 text-xs text-slate-700">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-amber-600 shrink-0" />
                          <span>08.00 – 11.00: Olahraga Sunnah (Memanah, Berenang, Beladiri)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-amber-600 shrink-0" />
                          <span>11.00 – 17.00: Waktu Kunjungan Resmi Wali Santri</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-amber-600 shrink-0" />
                          <span>17.00: Santri wajib kembali ke asrama &amp; persiapan Maghrib</span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </div>
            ) : (
              /* Tab Kalender Kegiatan */
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Form Tambah Agenda */}
                <div className="lg:col-span-1 space-y-6">
                  <Card rounded="3xl">
                    <CardHeader>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-5 w-5 text-[#0E7C3A]" />
                        <CardTitle className="text-base">Tambah Agenda Kalender</CardTitle>
                      </div>
                      <CardDescription>Khusus Administrator (`ADM`) &amp; Mudir (`KS`)</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700">Judul Kegiatan</label>
                        <Input
                          value={judulAgenda}
                          onChange={(e) => setJudulAgenda(e.target.value)}
                          placeholder="e.g. Ujian Tahfizh Semester Ganjil"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700">Tanggal Kegiatan</label>
                        <Input
                          type="date"
                          value={tglAgenda}
                          onChange={(e) => setTglAgenda(e.target.value)}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700">Kategori Kegiatan</label>
                        <select
                          value={katAgenda}
                          onChange={(e) => setKatAgenda(e.target.value)}
                          className="w-full min-h-[44px] px-4 py-2.5 rounded-2xl bg-white border border-slate-200 text-sm"
                        >
                          <option value="TAHFIZH">Ketahfidzan / Ikhtibar</option>
                          <option value="UJIAN">Ujian Akademik &amp; Diniyah</option>
                          <option value="KEGIATAN_SANTRI">Kegiatan Santri / Rihlah</option>
                          <option value="LIBUR">Libur &amp; Kepulangan Santri</option>
                        </select>
                      </div>
                    </CardContent>
                    <CardFooter>
                      <Button
                        className="w-full"
                        isLoading={isPending}
                        onClick={handleTambahAgenda}
                        disabled={selectedRole !== "ADM" && selectedRole !== "KS"}
                        leftIcon={<PlusCircle className="h-4 w-4" />}
                      >
                        {selectedRole === "ADM" || selectedRole === "KS"
                          ? "Tambahkan Agenda"
                          : `Role ${selectedRole} Tidak Berhak`}
                      </Button>
                    </CardFooter>
                  </Card>
                </div>

                {/* Daftar Agenda Kalender */}
                <div className="lg:col-span-2 space-y-4">
                  <Card rounded="3xl">
                    <CardHeader>
                      <CardTitle className="text-base">Kalender Kegiatan Pesantren 2026/2027</CardTitle>
                      <CardDescription>Jadwal penting yang dapat diakses oleh seluruh asatidz dan wali santri</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {agendaList.map((item) => (
                        <div
                          key={item.id}
                          className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-start justify-between gap-4"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Badge
                                variant={
                                  item.kategori === "TAHFIZH"
                                    ? "green"
                                    : item.kategori === "LIBUR"
                                    ? "gold"
                                    : "sky"
                                }
                                size="sm"
                              >
                                {item.kategori.replace(/_/g, " ")}
                              </Badge>
                              <span className="text-xs text-slate-400">Lokasi: {item.lokasi}</span>
                            </div>
                            <h4 className="font-bold text-sm text-slate-800 mt-1">{item.judul}</h4>
                            <p className="text-xs text-emerald-700 font-semibold flex items-center gap-1.5">
                              <Clock className="h-3.5 w-3.5" />
                              {item.tanggal}
                            </p>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 13: USER & STAFF MANAGEMENT (FASE 7)                  */}
        {/* ========================================================= */}
        {activeTab === "users" && (
          <div className="space-y-6">
            <Card rounded="3xl">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <UserCog className="h-5 w-5 text-[#0E7C3A]" />
                    <CardTitle className="text-base">Manajemen Pengguna Sistem (10 Role)</CardTitle>
                  </div>
                  <CardDescription>
                    Pengaturan hak akses, aktivasi akun, dan reset kata sandi staf & santri
                  </CardDescription>
                </div>
                <Badge variant="green" size="md">
                  {usersList.filter((u) => u.status === "AKTIF").length} Akun Aktif
                </Badge>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <th className="p-3 font-bold text-slate-700">Pengguna</th>
                        <th className="p-3 font-bold text-slate-700">Username</th>
                        <th className="p-3 font-bold text-slate-700">Peran (Role)</th>
                        <th className="p-3 font-bold text-slate-700">Status</th>
                        <th className="p-3 font-bold text-slate-700 text-right">Aksi Administrator</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {usersList.map((user) => (
                        <tr key={user.id} className="hover:bg-slate-50/80">
                          <td className="p-3 font-bold text-slate-800">{user.nama}</td>
                          <td className="p-3 text-slate-500 font-mono">{user.username}</td>
                          <td className="p-3">
                            <Badge variant={ROLE_LABELS[user.role as Role]?.badgeVariant || "neutral"} size="sm">
                              {user.role} — {ROLE_LABELS[user.role as Role]?.title.split(" ")[0]}
                            </Badge>
                          </td>
                          <td className="p-3">
                            <Badge variant={user.status === "AKTIF" ? "green" : "neutral"} size="sm">
                              {user.status}
                            </Badge>
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                size="sm"
                                variant="secondary"
                                className="text-[11px] h-8 px-2.5"
                                onClick={() => handleToggleUserStatus(user.id)}
                                disabled={selectedRole !== "ADM" && selectedRole !== "KS"}
                              >
                                {user.status === "AKTIF" ? "Nonaktifkan" : "Aktifkan"}
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                className="text-[11px] h-8 px-2.5 border-slate-300"
                                onClick={() => handleResetPassword(user.username)}
                                disabled={selectedRole !== "ADM" && selectedRole !== "KS"}
                                leftIcon={<KeyRound className="h-3 w-3 text-amber-600" />}
                              >
                                Reset Sandi
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 13: AUDIT TRAIL & MONITORING MUTASI (FASE 8)          */}
        {/* ========================================================= */}
        {activeTab === "audit" && (
          <div className="space-y-6">
            {!["YAY", "KS", "ADM"].includes(selectedRole) ? (
              <Card rounded="3xl" className="p-8 text-center bg-amber-50/60 border-amber-200">
                <div className="max-w-md mx-auto space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto text-amber-700">
                    <Lock className="h-6 w-6" />
                  </div>
                  <h3 className="font-bold text-slate-800 text-lg">Akses Audit Dibatasi</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Hanya peran eksekutif <strong>Yayasan (YAY)</strong>, <strong>Mudir (KS)</strong>, dan <strong>Tata Usaha (ADM)</strong> yang berwenang memantau catatan jejak audit transaksi.
                  </p>
                  <div className="pt-2">
                    <Button
                      variant="gold"
                      size="sm"
                      onClick={() => handleRoleChange("YAY")}
                    >
                      Beralih ke Akun Yayasan (YAY)
                    </Button>
                  </div>
                </div>
              </Card>
            ) : (
              <Card rounded="3xl">
                <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Activity className="h-5 w-5 text-[#0E7C3A]" />
                      <CardTitle className="text-base">Audit Trail & Log Mutasi Sistem</CardTitle>
                    </div>
                    <CardDescription>
                      Pemantauan real-time aktivitas transaksi, perizinan, tahfizh, dan surat resmi
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={handleRefreshAuditLogs}
                      leftIcon={<RotateCcw className="h-3.5 w-3.5" />}
                    >
                      Perbarui
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      leftIcon={<Download className="h-3.5 w-3.5 text-emerald-700" />}
                      onClick={() =>
                        exportToCSV(
                          "Audit_Trail_Log_STQ",
                          ["Timestamp", "User", "Email", "Role", "Aksi", "Entitas", "Entity ID", "Rincian"],
                          auditLogsList.map((log) => [
                            new Date(log.createdAt).toLocaleString("id-ID"),
                            log.user.username,
                            log.user.email,
                            log.user.role,
                            log.action,
                            log.entity,
                            log.entityId || "-",
                            JSON.stringify(log.details || {}),
                          ])
                        )
                      }
                    >
                      Ekspor CSV
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50">
                          <th className="p-3 font-bold text-slate-700">Waktu & Tanggal</th>
                          <th className="p-3 font-bold text-slate-700">Pengguna (Pelaksana)</th>
                          <th className="p-3 font-bold text-slate-700">Aksi (Action)</th>
                          <th className="p-3 font-bold text-slate-700">Entitas</th>
                          <th className="p-3 font-bold text-slate-700">Rincian Perubahan Data</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {auditLogsList.map((log) => (
                          <tr key={log.id} className="hover:bg-slate-50/80">
                            <td className="p-3 text-slate-500 whitespace-nowrap font-mono text-[11px]">
                              {new Date(log.createdAt).toLocaleDateString("id-ID", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </td>
                            <td className="p-3">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-slate-800">{log.user.username}</span>
                                <Badge variant={ROLE_LABELS[log.user.role as Role]?.badgeVariant || "neutral"} size="sm">
                                  {log.user.role}
                                </Badge>
                              </div>
                              <span className="text-[10px] text-slate-400">{log.user.email}</span>
                            </td>
                            <td className="p-3">
                              <Badge
                                variant={
                                  log.action.includes("SETORAN") || log.action.includes("IKHTIBAR")
                                    ? "green"
                                    : log.action.includes("PELANGGARAN") || log.action.includes("SP")
                                    ? "orange"
                                    : log.action.includes("APPROVAL") || log.action.includes("IZIN")
                                    ? "sky"
                                    : log.action.includes("SURAT")
                                    ? "purple"
                                    : "neutral"
                                }
                                size="sm"
                              >
                                {log.action}
                              </Badge>
                            </td>
                            <td className="p-3 font-mono text-[11px] text-slate-600">
                              {log.entity} {log.entityId ? `(${log.entityId})` : ""}
                            </td>
                            <td className="p-3 text-slate-600">
                              {log.details ? (
                                <div className="flex flex-wrap gap-1 max-w-xs">
                                  {Object.entries(log.details).map(([k, v]) => (
                                    <span
                                      key={k}
                                      className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-[10px] text-slate-700"
                                    >
                                      <strong>{k}:</strong> {String(v)}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-slate-400 italic">-</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* MODAL PRINT DOKUMEN RESMI (RAPOR, SURAT AI, & SP)         */}
        {/* ========================================================= */}
        {showPrintModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
            <div className="bg-white rounded-3xl max-w-4xl w-full p-4 sm:p-7 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3 no-print">
                <div className="flex items-center gap-2">
                  <Printer className="h-5 w-5 text-[#0E7C3A]" />
                  <h3 className="font-bold text-base sm:text-lg text-slate-800">
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
                    onClick={() => setShowPrintModal(null)}
                    className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Preview Dokumen Standar A4 Cetak */}
              <div className="border border-slate-200 rounded-2xl p-2 sm:p-6 bg-slate-50/50 overflow-x-auto">
                {showPrintModal === "rapor" && (
                  <PrintRapor
                    santri={{
                      nama: santriList[0].nama,
                      nis: santriList[0].nis,
                      kelas: santriList[0].kelas,
                      halaqoh: santriList[0].halaqoh,
                      capaianJuz: santriList[0].capaianJuz,
                      targetJuz: santriList[0].targetJuz,
                      setoranTerakhir: santriList[0].setoranTerakhir,
                      nilaiTerakhir: santriList[0].nilaiTerakhir,
                    }}
                    nilaiAkademik={nilaiAkademikList}
                  />
                )}
                {showPrintModal === "surat" && (
                  <PrintSurat
                    perihal={perihalSurat || "Surat Keterangan Santri Aktif"}
                    tujuan={tujuanSurat || "Orang Tua / Wali Santri"}
                    isiPokok={
                      hasilSuratAI ||
                      "Menyatakan bahwa santri yang bersangkutan terdaftar aktif dalam program Tahfizh Al-Qur'an dan pendidikan kepesantrenan Darul Ulum Cendekia untuk Tahun Ajaran 2026/2027."
                    }
                  />
                )}
                {showPrintModal === "sp" && (
                  <PrintSP
                    tingkatSP="SP1"
                    santriNama="Zaidan Al-Farisi"
                    santriNis="SAN-0003"
                    santriKelas="7A"
                    totalPoin={25}
                    riwayatPelanggaran={pelanggaranHistory.map((p) => ({
                      deskripsi: p.kategori,
                      poin: p.poin,
                      tanggal: p.tanggal,
                      isPengulangan: p.isPengulangan,
                    }))}
                    arahanPembinaan="Diberikan pembinaan tarbiyah intensif, shalat tepat waktu di shaf pertama, dan penugasan murojaah juz pilihan bersama Musyrif Asrama."
                  />
                )}
                {showPrintModal === "laporan_bulanan" && (
                  <PrintLaporanBulanan
                    laporanData={
                      printLaporanData || {
                        halaqoh: {
                          id: "HLQ-0001",
                          nama: "Halaqoh Ust. Razan Mufli, S.Pd",
                          pembina: "Ust. Razan Mufli, S.Pd (Musyrif Ketahfidzhan)",
                          tahunAjaran: "2026/2027",
                        },
                        periode: {
                          bulan: 9,
                          tahunAjaran: "2026/2027",
                          tahunKalender: 2026,
                        },
                        rekapSantri: santriList.map((s) => ({
                          santri: { id: s.id, nis: s.nis, nama: s.nama, kelas: s.kelas },
                          tahfizh: {
                            sabaq: {
                              targetBulanan: 20,
                              pekan: { p1: 6, p2: 5, p3: 6, p4: 5 },
                              totalHalaman: 22,
                              konversi: { juz: 1, sisaHalaman: 2, label: "1 Juz 2 Halaman" },
                              persentase: 110.0,
                              isTercapai: true,
                            },
                            sabqi: {
                              targetBulanan: 16,
                              totalFrekuensi: 16,
                              persentase: 100.0,
                              isPatuh: true,
                            },
                            manzil: {
                              targetBulanan: 16,
                              totalFrekuensi: 15,
                              persentase: 93.8,
                              isPatuh: true,
                            },
                            mufar: {
                              targetBulanan: 8,
                              totalFrekuensi: 8,
                            },
                          },
                          nonTahfizh: [
                            {
                              kategori: "HAFALAN_HADITS",
                              label: "Hadits",
                              hbl: 12,
                              penambahanBulanIni: 4,
                              totalKumulatif: 16,
                              targetMin: 4,
                              isTuntas: true,
                            },
                            {
                              kategori: "HAFALAN_MUFRODAT",
                              label: "Mufrodat",
                              hbl: 36,
                              penambahanBulanIni: 12,
                              totalKumulatif: 48,
                              targetMin: 12,
                              isTuntas: true,
                            },
                            {
                              kategori: "HAFALAN_VOCABULARY",
                              label: "Vocab",
                              hbl: 24,
                              penambahanBulanIni: 12,
                              totalKumulatif: 36,
                              targetMin: 12,
                              isTuntas: true,
                            },
                          ],
                          tasmiSimaan: {
                            countTasmi: 1,
                            countSimaan: 2,
                            rataRataNilai: 92.5,
                            ringkasanTeks:
                              "Telah melakukan 2 kali Sima'an dan 1 kali Tasmi' dengan rata-rata nilai 92.5 (Mumtaz)",
                          },
                        })),
                      }
                    }
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Mobile Bottom Navigation (Strictly 4 Items + Slide-up Sheet) */}
      <MobileBottomNav
        activeTab={activeTab}
        allowedTabs={allowedTabs}
        onSelectTab={(tab) => {
          setActiveTab(tab as any);
          if (["tahfizh", "akademik", "ikhtibar"].includes(tab)) setActiveCluster("tahfizh");
          else if (["kesantrian", "kedisiplinan", "kesehatan", "logistik"].includes(tab)) setActiveCluster("kesantrian");
          else if (["administrasi", "surat", "sponsor", "agenda"].includes(tab)) setActiveCluster("manajemen");
          else if (["portal_wali"].includes(tab)) setActiveCluster("wali");
          else if (["users", "audit"].includes(tab)) setActiveCluster("sistem");
          setFeedback(null);
        }}
      />

      {/* Modal Dialog WhatsApp Direct Universal */}
      <WhatsAppDialog
        isOpen={globalWaDialog.isOpen}
        onClose={() => setGlobalWaDialog((prev) => ({ ...prev, isOpen: false }))}
        defaultPhone={globalWaDialog.phone}
        defaultRecipientName={globalWaDialog.recipientName}
        defaultMessage={globalWaDialog.message}
        title={globalWaDialog.title}
        description={globalWaDialog.description}
      />
    </div>
  );
}
