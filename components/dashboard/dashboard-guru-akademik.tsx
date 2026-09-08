import React from "react";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { GraduationCap, BookOpen, CheckCircle2, Download, Printer } from "lucide-react";
import { exportToCSV } from "@/lib/export-csv";

export interface DashboardGuruAkademikProps {
  selectedMapel: string;
  onSetSelectedMapel: (m: string) => void;
  inputNilaiAngka: string;
  onSetInputNilaiAngka: (v: string) => void;
  nilaiAkademikList: Array<{
    mapel: string;
    kategori: string;
    angka: number;
    huruf: string;
    guru: string;
  }>;
  onSaveNilai: () => void;
  onPrintRapor: () => void;
  isPending?: boolean;
}

export function DashboardGuruAkademik({
  selectedMapel,
  onSetSelectedMapel,
  inputNilaiAngka,
  onSetInputNilaiAngka,
  nilaiAkademikList,
  onSaveNilai,
  onPrintRapor,
  isPending = false,
}: DashboardGuruAkademikProps) {
  const rataRata =
    nilaiAkademikList.length > 0
      ? (
          nilaiAkademikList.reduce((acc, curr) => acc + curr.angka, 0) /
          nilaiAkademikList.length
        ).toFixed(1)
      : "88.5";

  return (
    <div className="space-y-6">
      {/* 1. KPI Metrik Akademik */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          title="Mata Pelajaran Diampu"
          value="4 Mapel"
          description="Diniyah &amp; Muatan Umum"
          icon={<GraduationCap className="h-5 w-5" />}
          badgeText="Aktif Semester Ini"
          badgeVariant="green"
        />
        <StatCard
          title="Rata-rata Kelas"
          value={`${rataRata} (A)`}
          description="Kelas 7A &amp; 8B"
          icon={<BookOpen className="h-5 w-5" />}
          badgeText="Target Tercapai"
          badgeVariant="green"
        />
        <StatCard
          title="Nilai Terinput"
          value={`${nilaiAkademikList.length} Nilai`}
          description="Sesi Evaluasi Tengah Semester"
          icon={<CheckCircle2 className="h-5 w-5" />}
          badgeText="Terverifikasi"
          badgeVariant="sky"
        />
        <StatCard
          title="Remedial / Perlu Ulang"
          value="0 Santri"
          description="Nilai di bawah KKM (<60)"
          icon={<CheckCircle2 className="h-5 w-5" />}
          badgeText="Tuntas 100%"
          badgeVariant="green"
        />
      </div>

      {/* 2. Form Input Nilai & Pratinjau Rekap Kelas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form Input Cepat Nilai */}
        <div className="lg:col-span-5">
          <Card rounded="3xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <GraduationCap className="h-5 w-5 text-[#0E7C3A]" />
                Input Nilai Mapel Cepat
              </CardTitle>
              <CardDescription>
                Konversi otomatis predikat (A: $\ge 85$, B: 70-84, C: 60-69, D: Remedial)
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Mata Pelajaran</label>
                <select
                  value={selectedMapel}
                  onChange={(e) => onSetSelectedMapel(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2.5 rounded-2xl bg-white border border-slate-200 text-xs sm:text-sm font-medium focus:ring-2 focus:ring-[#0E7C3A]/20 focus:border-[#0E7C3A]"
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

              <Input
                label="Nilai Angka (Skala 0 - 100)"
                type="number"
                value={inputNilaiAngka}
                onChange={(e) => onSetInputNilaiAngka(e.target.value)}
                placeholder="misal: 92"
              />

              <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 text-xs text-emerald-900">
                <p className="font-semibold">Pedoman Penilaian Standar STQ DUC:</p>
                <p className="text-[11px] text-emerald-800 mt-0.5">
                  Nilai $\ge 85$ predikat A (Mumtaz), 70–84 predikat B (Jayyid), 60–69 predikat C, &lt;60 wajib remedial.
                </p>
              </div>
            </CardContent>

            <CardFooter>
              <Button
                variant="primary"
                fullWidth
                isLoading={isPending}
                onClick={onSaveNilai}
                leftIcon={<CheckCircle2 className="h-4 w-4" />}
              >
                Simpan Nilai Mapel
              </Button>
            </CardFooter>
          </Card>
        </div>

        {/* Tabel Pratinjau Nilai Kelas */}
        <div className="lg:col-span-7">
          <Card rounded="3xl">
            <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <CardTitle className="text-base sm:text-lg">Rekapitulasi Nilai Santri</CardTitle>
                <CardDescription>Pratinjau sebelum pengesahan rapor semester</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    exportToCSV(
                      "Rekap_Nilai_Akademik",
                      ["Mata Pelajaran", "Kategori", "Nilai Angka", "Predikat", "Guru Pengampu"],
                      nilaiAkademikList.map((n) => [n.mapel, n.kategori, n.angka, n.huruf, n.guru])
                    )
                  }
                  leftIcon={<Download className="h-3.5 w-3.5 text-[#0E7C3A]" />}
                >
                  CSV
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={onPrintRapor}
                  leftIcon={<Printer className="h-3.5 w-3.5" />}
                >
                  Cetak Rapor A4
                </Button>
              </div>
            </CardHeader>

            <CardContent className="pt-3">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px]">
                      <th className="py-2.5 px-3">Mata Pelajaran</th>
                      <th className="py-2.5 px-3">Kategori</th>
                      <th className="py-2.5 px-3 text-center">Angka</th>
                      <th className="py-2.5 px-3 text-center">Predikat</th>
                      <th className="py-2.5 px-3">Pengampu</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {nilaiAkademikList.map((n, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-3 font-semibold text-slate-800">{n.mapel}</td>
                        <td className="py-3 px-3 text-slate-600">{n.kategori}</td>
                        <td className="py-3 px-3 text-center font-bold text-[#0E7C3A] text-sm">{n.angka}</td>
                        <td className="py-3 px-3 text-center">
                          <Badge variant={n.huruf === "A" ? "mumtaz" : n.huruf === "B" ? "jayyid_jiddan" : "maqbul"} size="sm">
                            {n.huruf}
                          </Badge>
                        </td>
                        <td className="py-3 px-3 text-slate-600">{n.guru}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
