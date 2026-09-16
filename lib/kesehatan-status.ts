export interface KesehatanItemSummary {
  id: string;
  keluhan: string;
  status: string;
  tanggal?: Date | string;
}

export function getStatusKesehatanSemantics(
  kesehatanList?: KesehatanItemSummary[] | null,
  error?: string | null
): { label: string; subLabel: string; isTextSmall: boolean; isErrorOrEmpty: boolean } {
  if (error) {
    const isAuth =
      error.toLowerCase().includes("akses") ||
      error.toLowerCase().includes("otorisasi") ||
      error.toLowerCase().includes("izin") ||
      error.toLowerCase().includes("sesi");
    if (isAuth) {
      return {
        label: "Akses data kesehatan tidak tersedia",
        subLabel: "Otorisasi Ditolak",
        isTextSmall: true,
        isErrorOrEmpty: true,
      };
    }
    return {
      label: "Gagal memuat data kesehatan",
      subLabel: "Koneksi Bermasalah",
      isTextSmall: true,
      isErrorOrEmpty: true,
    };
  }

  if (kesehatanList === undefined || kesehatanList === null) {
    return {
      label: "Data kesehatan tidak tersedia",
      subLabel: "Data Belum Tersedia",
      isTextSmall: true,
      isErrorOrEmpty: true,
    };
  }

  if (kesehatanList.length === 0) {
    return {
      label: "Belum ada data kesehatan",
      subLabel: "Belum Ada Catatan Poskestren",
      isTextSmall: true,
      isErrorOrEmpty: true,
    };
  }

  const latest = kesehatanList[0];
  if (!latest || !latest.status) {
    return {
      label: "Belum ada data kesehatan",
      subLabel: "Belum Ada Catatan Poskestren",
      isTextSmall: true,
      isErrorOrEmpty: true,
    };
  }

  const rawStatus = latest.status.toUpperCase();
  if (rawStatus === "SEMBUH") {
    return {
      label: "Sehat",
      subLabel: "Riwayat Sembuh",
      isTextSmall: false,
      isErrorOrEmpty: false,
    };
  }

  return {
    label: rawStatus.replace(/_/g, " "),
    subLabel: "Poskestren Terpantau",
    isTextSmall: false,
    isErrorOrEmpty: false,
  };
}
