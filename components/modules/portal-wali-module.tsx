import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Role } from "@/types/auth";
import { getRingkasanAnakAction } from "@/app/actions/portal-wali";
import {
  Printer,
  MessageCircle,
  Send,
  UserX,
} from "lucide-react";

export interface SetoranItemWali {
  id: string;
  jenis: string;
  juz: number;
  halamanMulai: number;
  halamanSelesai: number;
  jumlahHalaman: number;
  catatan?: string | null;
  nilai: string;
}

export interface KesehatanItemWali {
  id: string;
  keluhan: string;
  status: string;
  tanggal?: Date | string;
}

export interface SantriDetailWali {
  id: string;
  nama: string;
  nis: string;
  kelas: string;
  status: string;
  halaqoh?: { nama: string; pembina?: { nama: string } | null } | null;
  setoranList?: SetoranItemWali[];
  kesehatanList?: KesehatanItemWali[];
}

export interface RingkasanDataWali {
  totalPoinPelanggaran: number;
  totalBintang: number;
  totalSetoran: number;
  ikhtibarLulus: number;
  rataRataAkademik?: string;
  totalMapelDinilai?: number;
  capaianJuzTertinggi?: number;
  totalIzin?: number;
}

export interface SaranItem {
  id: string;
  nama: string;
  kategori: string;
  pesan: string;
  tanggapan: string | null;
  status: string;
}

export interface PortalWaliModuleProps {
  userRole: Role;
  kotakSaranList: SaranItem[];
  onKirimSaran: (kategori: string, pesan: string) => Promise<void> | void;
  onPrintRapor: () => void;
  isPending?: boolean;
}

export function PortalWaliModule({
  userRole,
  kotakSaranList,
  onKirimSaran,
  onPrintRapor,
  isPending = false,
}: PortalWaliModuleProps) {
  const [kategori, setKategori] = useState("Gizi & Katering");
  const [pesan, setPesan] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [loadingSantri, setLoadingSantri] = useState(true);
  const [santriData, setSantriData] = useState<SantriDetailWali | null>(null);
  const [ringkasanData, setRingkasanData] = useState<RingkasanDataWali | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const loadChildData = async () => {
      try {
        setLoadingSantri(true);
        const res = await getRingkasanAnakAction();
        if (res.success && res.data) {
          const payload = res.data as unknown as { santri: SantriDetailWali; ringkasan: RingkasanDataWali };
          setSantriData(payload.santri);
          setRingkasanData(payload.ringkasan);
          setLoadError(null);
        } else {
          setLoadError(res.message || "Data santri tidak dapat dimuat.");
        }
      } catch {
        setLoadError("Gagal terhubung ke server saat memuat data ananda.");
      } finally {
        setLoadingSantri(false);
      }
    };
    void loadChildData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pesan.trim()) {
      setErrorMsg("Pesan atau saran tidak boleh kosong.");
      return;
    }
    setErrorMsg("");
    await onKirimSaran(kategori, pesan.trim());
    setPesan("");
  };

  return (
    <div className="space-y-6">
      {/* Header Hero Wali Santri */}
      <div className="bg-gradient-to-r from-emerald-800 via-emerald-700 to-[#0E7C3A] text-white rounded-3xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <Badge variant="gold" size="sm" className="mb-2">Portal Orang Tua & Santri</Badge>
          <h3 className="text-xl font-bold font-heading">
            {userRole === "WS" ? "Ahlan wa Sahlan, Ayah/Bunda Wali Santri" : "Ahlan wa Sahlan, Santri Mandiri STQ DUC"}
          </h3>
          <p className="text-xs text-emerald-100 mt-1">
            Pantau perkembangan hafalan Al-Qur&apos;an, adab & kedisiplinan, kesehatan, serta capaian prestasi ananda.
          </p>
        </div>
        {santriData && (
          <Button
            variant="secondary"
            size="sm"
            onClick={onPrintRapor}
            leftIcon={<Printer className="h-4 w-4" />}
          >
            Unduh / Cetak Rapor Digital
          </Button>
        )}
      </div>

      {/* Kartu Profil Ananda Riil / State Pemuatan / State Kosong */}
      {loadingSantri ? (
        <Card rounded="3xl" className="border border-slate-200 p-8 text-center bg-white">
          <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
            <div className="h-2.5 w-2.5 rounded-full bg-emerald-600 animate-ping" />
            Memuat data perkembangan ananda dari pangkalan data resmi...
          </div>
        </Card>
      ) : loadError || !santriData ? (
        <Card rounded="3xl" className="border-2 border-amber-200 bg-amber-50/50 p-6 text-center space-y-3">
          <div className="inline-flex p-3 rounded-2xl bg-amber-100 text-amber-800">
            <UserX className="h-6 w-6" />
          </div>
          <h4 className="text-base font-bold text-amber-900 font-heading">
            Akun Belum Terhubung dengan Data Santri
          </h4>
          <p className="text-xs text-amber-800 max-w-lg mx-auto">
            {loadError || "Akun Anda saat ini belum ditautkan dengan data santri terdaftar di STQ Darul Ulum Cendekia. Silakan hubungi bagian Administrasi / Tata Usaha untuk melengkapi relasi wali dan santri."}
          </p>
        </Card>
      ) : (
        <Card rounded="3xl" className="border-2 border-emerald-100 bg-white">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h4 className="text-lg font-bold text-slate-900">{santriData.nama}</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  NIS: <strong>{santriData.nis}</strong> • Kelas: <strong>{santriData.kelas}</strong> • Musyrif: <strong>{santriData.halaqoh?.pembina?.nama || santriData.halaqoh?.nama || "Musyrif Halaqoh"}</strong>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="green" size="md">
                  Status: {santriData.status}
                </Badge>
                {(ringkasanData?.totalBintang || 0) > 0 && (
                  <Badge variant="gold" size="md">
                    {ringkasanData?.totalBintang} Bintang Teladan
                  </Badge>
                )}
              </div>
            </div>

            {/* 4 Metrik Ringkas Riil */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
              <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-100">
                <span className="text-xs text-emerald-800 font-semibold">Total Setoran</span>
                <p className="text-xl font-extrabold text-[#0E7C3A] mt-1">
                  {ringkasanData?.totalSetoran || santriData.setoranList?.length || 0}x
                </p>
                <span className="text-[11px] text-emerald-600 font-medium">Mutaba&apos;ah Hafalan</span>
              </div>

              <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-100">
                <span className="text-xs text-amber-800 font-semibold">Ikhtibar Selesai</span>
                <p className="text-xl font-extrabold text-[#C9990E] mt-1">
                  {ringkasanData?.ikhtibarLulus || 0} Juz
                </p>
                <span className="text-[11px] text-amber-700 font-medium">Ujian Sah 2-Tahap</span>
              </div>

              <div className="p-4 rounded-2xl bg-sky-50/70 border border-sky-100">
                <span className="text-xs text-sky-800 font-semibold">Poin Kedisiplinan</span>
                <p className="text-xl font-extrabold text-sky-700 mt-1">
                  {ringkasanData?.totalPoinPelanggaran || 0} Poin
                </p>
                <span className="text-[11px] text-sky-600 font-medium">
                  {ringkasanData?.totalPoinPelanggaran === 0 ? "Adab Teladan" : "Dalam Pemantauan"}
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-purple-50/70 border border-purple-100">
                <span className="text-xs text-purple-800 font-semibold">Status Kesehatan</span>
                <p className="text-xl font-extrabold text-purple-700 mt-1">
                  {santriData.kesehatanList && santriData.kesehatanList.length > 0
                    ? santriData.kesehatanList[0].status.replace(/_/g, " ")
                    : "Sehat"}
                </p>
                <span className="text-[11px] text-purple-600 font-medium">Poskestren Terpantau</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 2 Kolom: Aktivitas & Kotak Saran */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Kolom Kiri: Riwayat Aktivitas Terkini Riil */}
        <div className="space-y-4">
          <Card rounded="3xl">
            <CardHeader>
              <CardTitle className="text-base">Riwayat Setoran & Ikhtibar Terbaru</CardTitle>
              <CardDescription>Catatan langsung dari majelis halaqoh santri</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {santriData?.setoranList && santriData.setoranList.length > 0 ? (
                santriData.setoranList.slice(0, 3).map((item: SetoranItemWali) => (
                  <div key={item.id} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-800 text-xs">Setoran {item.jenis} (Juz {item.juz})</span>
                      <p className="text-xs text-emerald-700 font-semibold">Halaman {item.halamanMulai}–{item.halamanSelesai} ({item.jumlahHalaman} Hlm)</p>
                      <p className="text-[11px] text-slate-400">Catatan: {item.catatan || "Lancar dan tertib"}</p>
                    </div>
                    <Badge variant="green" size="sm">{item.nilai}</Badge>
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-xs text-slate-400">
                  Belum ada riwayat setoran yang tercatat pada semester ini.
                </div>
              )}
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
              <form onSubmit={handleSubmit} className="space-y-4">
                {errorMsg && (
                  <div className="p-2.5 rounded-xl bg-red-50 text-red-700 text-xs">
                    {errorMsg}
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Kategori Aspirasi</label>
                  <select
                    value={kategori}
                    onChange={(e) => setKategori(e.target.value)}
                    className="w-full min-h-[44px] px-4 py-2.5 rounded-2xl bg-white border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-[#0E7C3A]/20"
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
                    value={pesan}
                    onChange={(e) => setPesan(e.target.value)}
                    placeholder="Tuliskan masukan atau saran konstruktif Bapak/Ibu demi kemajuan ananda dan pesantren..."
                    className="w-full p-3.5 rounded-2xl bg-white border border-slate-200 text-xs focus:ring-2 focus:ring-[#0E7C3A] focus:outline-none"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  isLoading={isPending}
                  leftIcon={<Send className="h-4 w-4" />}
                  size="sm"
                >
                  Kirim Saran ke Mudir
                </Button>
              </form>

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
                    <p className="text-slate-600 italic">&quot;{s.pesan}&quot;</p>
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
  );
}
