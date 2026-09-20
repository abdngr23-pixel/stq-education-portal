/**
 * Canonical Pendidikan Foundation (Studi Umum & Kepesantrenan)
 * STQ Education Portal — Milestone 3.3B
 *
 * Single Source of Truth for:
 * - Studi Umum exact subjects, Saturday JP matrix, and PBL 20-week rotation.
 * - Kepesantrenan exact subjects, daily schedule, Arabic pedagogical levels, and scheduling facts.
 * - Additive Cohort / Angkatan program-level calculation.
 * - Attendance status validation (HADIR, IZIN, SAKIT, ALFA - NO MASBUK).
 */

// ====================================================
// 1. TRACK & SUBJECT SEPARATION
// ====================================================

export const EDUCATION_TRACKS = {
  STUDI_UMUM: "STUDI_UMUM",
  KEPESANTRENAN: "KEPESANTRENAN",
} as const;

export type EducationTrackType = (typeof EDUCATION_TRACKS)[keyof typeof EDUCATION_TRACKS];

/**
 * Studi Umum exact 6 subjects:
 * - Core / Weekly: Matematika, Bahasa Inggris
 * - PBL Rotation: IPS, IPA, Bahasa Indonesia, TIK
 */
export const CANONICAL_STUDI_UMUM_SUBJECTS = [
  "Matematika",
  "Bahasa Inggris",
  "IPS",
  "IPA",
  "Bahasa Indonesia",
  "TIK",
] as const;

export const STUDI_UMUM_CORE_SUBJECTS = ["Matematika", "Bahasa Inggris"] as const;
export const STUDI_UMUM_PBL_SUBJECTS = ["IPS", "IPA", "Bahasa Indonesia", "TIK"] as const;

export type StudiUmumSubject = (typeof CANONICAL_STUDI_UMUM_SUBJECTS)[number];
export type StudiUmumCoreSubject = (typeof STUDI_UMUM_CORE_SUBJECTS)[number];
export type StudiUmumPblSubject = (typeof STUDI_UMUM_PBL_SUBJECTS)[number];

export interface StudiUmumMapelOption {
  readonly id: string;
  readonly nama: StudiUmumSubject;
  readonly kategori: string;
  readonly guru: string;
}

export const STUDI_UMUM_MAPEL_OPTIONS: readonly StudiUmumMapelOption[] = [
  { id: "MP-SU-01", nama: "Matematika", kategori: "Studi Umum", guru: "Belum ditetapkan" },
  { id: "MP-SU-02", nama: "Bahasa Inggris", kategori: "Studi Umum", guru: "Belum ditetapkan" },
  { id: "MP-SU-03", nama: "IPS", kategori: "Studi Umum (PBL)", guru: "Belum ditetapkan" },
  { id: "MP-SU-04", nama: "IPA", kategori: "Studi Umum (PBL)", guru: "Belum ditetapkan" },
  { id: "MP-SU-05", nama: "Bahasa Indonesia", kategori: "Studi Umum (PBL)", guru: "Belum ditetapkan" },
  { id: "MP-SU-06", nama: "TIK", kategori: "Studi Umum (PBL)", guru: "Belum ditetapkan" },
] as const;

export const MAPEL_OPTIONS = STUDI_UMUM_MAPEL_OPTIONS;

/**
 * Kepesantrenan exact 5 subjects:
 * 1. Bahasa Arab (KPS-ARB)
 * 2. Fikih (KPS-FQH)
 * 3. Tafsir (KPS-TFS)
 * 4. Aqidah (KPS-AQD)
 * 5. Tajwid (KPS-TJW)
 */
export const CANONICAL_KEPESANTRENAN_SUBJECTS = [
  "Bahasa Arab",
  "Fikih",
  "Tafsir",
  "Aqidah",
  "Tajwid",
] as const;

export type KepesantrenanSubject = (typeof CANONICAL_KEPESANTRENAN_SUBJECTS)[number];

export interface KepesantrenanSubjectDefinition {
  code: string;
  name: KepesantrenanSubject;
  dayOfWeek: "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday";
  dayNameId: "Senin" | "Selasa" | "Rabu" | "Kamis" | "Jumat";
  scheduledWindowWita: string;
}

export const CANONICAL_KEPESANTRENAN_SUBJECT_DEFINITIONS: readonly KepesantrenanSubjectDefinition[] = [
  {
    code: "KPS-ARB",
    name: "Bahasa Arab",
    dayOfWeek: "Monday",
    dayNameId: "Senin",
    scheduledWindowWita: "18:30–19:30 WITA",
  },
  {
    code: "KPS-FQH",
    name: "Fikih",
    dayOfWeek: "Tuesday",
    dayNameId: "Selasa",
    scheduledWindowWita: "18:30–19:30 WITA",
  },
  {
    code: "KPS-TFS",
    name: "Tafsir",
    dayOfWeek: "Wednesday",
    dayNameId: "Rabu",
    scheduledWindowWita: "18:30–19:30 WITA",
  },
  {
    code: "KPS-AQD",
    name: "Aqidah",
    dayOfWeek: "Thursday",
    dayNameId: "Kamis",
    scheduledWindowWita: "18:30–19:30 WITA",
  },
  {
    code: "KPS-TJW",
    name: "Tajwid",
    dayOfWeek: "Friday",
    dayNameId: "Jumat",
    scheduledWindowWita: "18:30–19:30 WITA",
  },
] as const;

export function isStudiUmumSubject(nameOrId: string): boolean {
  if (!nameOrId || typeof nameOrId !== "string") return false;
  const trimmed = nameOrId.trim();
  return (
    (CANONICAL_STUDI_UMUM_SUBJECTS as readonly string[]).includes(trimmed) ||
    /^MP-SU-0[1-6]$/.test(trimmed)
  );
}

export function isKepesantrenanSubject(nameOrCode: string): boolean {
  if (!nameOrCode || typeof nameOrCode !== "string") return false;
  const trimmed = nameOrCode.trim();
  return (
    (CANONICAL_KEPESANTRENAN_SUBJECTS as readonly string[]).includes(trimmed) ||
    /^MP-KP-0[1-5]$/.test(trimmed) ||
    CANONICAL_KEPESANTRENAN_SUBJECT_DEFINITIONS.some(
      (k) => k.name.toLowerCase() === trimmed.toLowerCase() || k.code === trimmed
    )
  );
}

// ====================================================
// 2. COHORT / ANGKATAN & PROGRAM LEVEL DERIVATION
// ====================================================

export interface ProgramLevelResult {
  success: boolean;
  level?: number;
  error?: string;
}

/**
 * Derive active program level from active academic year and cohort start year.
 * Examples:
 * - Cohort 2026/2027 (startYear 2026) during TA 2026/2027 => Tingkat 1
 * - Cohort 2026/2027 during TA 2027/2028 => Tingkat 2
 * - Cohort 2026/2027 during TA 2028/2029 => Tingkat 3
 *
 * Supports both function signatures:
 * 1. deriveProgramLevel(cohortStartYear: number, activeStartYear: number): number
 * 2. deriveProgramLevel({ startYear, activeAcademicYear }): ProgramLevelResult
 */
export function deriveProgramLevel(cohortStartYear: number, activeStartYear: number): number;
export function deriveProgramLevel(cohortStartYear: number, activeAcademicYear: string): number;
export function deriveProgramLevel(params: {
  startYear: number | null | undefined;
  activeAcademicYear: string | null | undefined;
}): ProgramLevelResult;
export function deriveProgramLevel(
  startYearOrParams:
    | { startYear: number | null | undefined; activeAcademicYear: string | null | undefined }
    | number
    | null
    | undefined,
  maybeActiveYear?: string | number | null
): number | ProgramLevelResult {
  if (
    typeof startYearOrParams === "number" &&
    (typeof maybeActiveYear === "number" || typeof maybeActiveYear === "string")
  ) {
    let activeStartYear: number;
    if (typeof maybeActiveYear === "number") {
      activeStartYear = maybeActiveYear;
    } else {
      const match = maybeActiveYear.match(/^(\d{4})\/(\d{4})$/);
      if (!match) {
        throw new Error(
          `INVALID_ACADEMIC_YEAR_FORMAT: Format tahun ajaran '${maybeActiveYear}' harus YYYY/YYYY (misal 2026/2027)`
        );
      }
      activeStartYear = parseInt(match[1], 10);
    }
    const level = activeStartYear - startYearOrParams + 1;
    if (level < 1 || level > 3) {
      throw new Error(
        `COHORT_OUT_OF_PROGRAM_BOUNDS: Angkatan tahun ${startYearOrParams} berada di luar rentang aktif program 3 tahun (Tingkat terhitung: ${level})`
      );
    }
    return level;
  }

  const params =
    startYearOrParams && typeof startYearOrParams === "object"
      ? startYearOrParams
      : {
          startYear: startYearOrParams as number | null | undefined,
          activeAcademicYear: maybeActiveYear as string | null | undefined,
        };

  const { startYear, activeAcademicYear } = params;

  if (!startYear || typeof startYear !== "number" || startYear < 2000 || startYear > 2100) {
    return {
      success: false,
      error: "COHORT_START_YEAR_INVALID: Tahun masuk angkatan tidak valid atau belum diisi",
    };
  }

  if (!activeAcademicYear || typeof activeAcademicYear !== "string") {
    return {
      success: false,
      error: "ACTIVE_ACADEMIC_YEAR_REQUIRED: Tahun ajaran aktif wajib ditentukan",
    };
  }

  const match = activeAcademicYear.match(/^(\d{4})\/(\d{4})$/);
  if (!match) {
    return {
      success: false,
      error: `INVALID_ACADEMIC_YEAR_FORMAT: Format tahun ajaran '${activeAcademicYear}' harus YYYY/YYYY (misal 2026/2027)`,
    };
  }

  const activeStartYear = parseInt(match[1], 10);
  const diff = activeStartYear - startYear;
  const level = diff + 1;

  if (level < 1 || level > 3) {
    return {
      success: false,
      error: `COHORT_OUT_OF_PROGRAM_BOUNDS: Angkatan tahun ${startYear} berada di luar rentang aktif program 3 tahun untuk TA ${activeAcademicYear} (Tingkat terhitung: ${level})`,
    };
  }

  return {
    success: true,
    level,
  };
}

// ====================================================
// 3. STUDI UMUM — SATURDAY SCHEDULE & JP MATRIX
// ====================================================

export interface StudiUmumJpSlot {
  jp: 1 | 2 | 3;
  timeRangeWita: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
}

const JP_SLOTS_DATA: StudiUmumJpSlot[] = [
  {
    jp: 1,
    timeRangeWita: "08:00–09:50 WITA",
    startTime: "08:00",
    endTime: "09:50",
    durationMinutes: 110,
  },
  {
    jp: 2,
    timeRangeWita: "10:00–11:50 WITA",
    startTime: "10:00",
    endTime: "11:50",
    durationMinutes: 110,
  },
  {
    jp: 3,
    timeRangeWita: "13:30–15:20 WITA",
    startTime: "13:30",
    endTime: "15:20",
    durationMinutes: 110,
  },
];

export const STUDI_UMUM_JP_SLOTS: StudiUmumJpSlot[] & {
  JP1: StudiUmumJpSlot;
  JP2: StudiUmumJpSlot;
  JP3: StudiUmumJpSlot;
} = Object.assign([...JP_SLOTS_DATA], {
  JP1: JP_SLOTS_DATA[0],
  JP2: JP_SLOTS_DATA[1],
  JP3: JP_SLOTS_DATA[2],
});

export type StudiUmumSlotSubject = "Matematika" | "Bahasa Inggris" | "PBL";

export const STUDI_UMUM_SCHEDULE_MATRIX: Record<1 | 2 | 3, Record<1 | 2 | 3, StudiUmumSlotSubject>> = {
  1: {
    1: "Bahasa Inggris",
    2: "Matematika",
    3: "PBL",
  },
  2: {
    1: "Matematika",
    2: "PBL",
    3: "Bahasa Inggris",
  },
  3: {
    1: "PBL",
    2: "Bahasa Inggris",
    3: "Matematika",
  },
};

export const STUDI_UMUM_JP_MATRIX = STUDI_UMUM_SCHEDULE_MATRIX;

// ====================================================
// 4. STUDI UMUM — PBL 20-WEEK ROTATION
// ====================================================

export const TOTAL_SEMESTER_SATURDAYS = 20;

export interface PblMeetingResolution {
  subject: StudiUmumPblSubject;
  blockNumber: 1 | 2 | 3 | 4;
  weekInBlock: 1 | 2 | 3 | 4 | 5;
}

export function resolvePblMeeting(meetingNumber: number): PblMeetingResolution {
  if (
    typeof meetingNumber !== "number" ||
    !Number.isInteger(meetingNumber) ||
    meetingNumber < 1 ||
    meetingNumber > TOTAL_SEMESTER_SATURDAYS
  ) {
    throw new Error(
      `INVALID_PBL_MEETING_NUMBER: Nomor pertemuan semester (${meetingNumber}) tidak valid. Harus berada di rentang 1 sampai 20.`
    );
  }

  let subject: StudiUmumPblSubject;
  let blockNumber: 1 | 2 | 3 | 4;

  if (meetingNumber >= 1 && meetingNumber <= 5) {
    subject = "IPS";
    blockNumber = 1;
  } else if (meetingNumber >= 6 && meetingNumber <= 10) {
    subject = "IPA";
    blockNumber = 2;
  } else if (meetingNumber >= 11 && meetingNumber <= 15) {
    subject = "Bahasa Indonesia";
    blockNumber = 3;
  } else {
    subject = "TIK";
    blockNumber = 4;
  }

  const weekInBlock = (((meetingNumber - 1) % 5) + 1) as 1 | 2 | 3 | 4 | 5;

  return {
    subject,
    blockNumber,
    weekInBlock,
  };
}

export interface StudiUmumScheduleResult {
  track: "STUDI_UMUM";
  jp: 1 | 2 | 3;
  programLevel: 1 | 2 | 3;
  semesterMeetingNumber: number;
  timeSlot: string;
  startTime: string;
  endTime: string;
  type: "CORE" | "PBL";
  subject: StudiUmumSubject;
  pblBlockNumber?: 1 | 2 | 3 | 4;
  pblWeekInBlock?: 1 | 2 | 3 | 4 | 5;
}

export function resolveStudiUmumSchedule(level: number, jp: number): StudiUmumSlotSubject;
export function resolveStudiUmumSchedule(params: {
  programLevel: number;
  jp: number;
  semesterMeetingNumber: number;
}): StudiUmumScheduleResult;
export function resolveStudiUmumSchedule(
  paramsOrLevel: { programLevel: number; jp: number; semesterMeetingNumber: number } | number,
  maybeJp?: number
): StudiUmumSlotSubject | StudiUmumScheduleResult {
  if (typeof paramsOrLevel === "number" && typeof maybeJp === "number") {
    if (![1, 2, 3].includes(paramsOrLevel)) {
      throw new Error(`INVALID_PROGRAM_LEVEL: Tingkat program (${paramsOrLevel}) harus 1, 2, atau 3.`);
    }
    if (![1, 2, 3].includes(maybeJp)) {
      throw new Error(`INVALID_JP_SLOT: Jam Pelajaran (${maybeJp}) harus 1, 2, atau 3.`);
    }
    return STUDI_UMUM_SCHEDULE_MATRIX[paramsOrLevel as 1 | 2 | 3][maybeJp as 1 | 2 | 3];
  }

  const params = paramsOrLevel as { programLevel: number; jp: number; semesterMeetingNumber: number };
  const { programLevel, jp, semesterMeetingNumber } = params;

  if (![1, 2, 3].includes(programLevel)) {
    throw new Error(`INVALID_PROGRAM_LEVEL: Tingkat program (${programLevel}) harus 1, 2, atau 3.`);
  }

  if (![1, 2, 3].includes(jp)) {
    throw new Error(`INVALID_JP_SLOT: Jam Pelajaran (${jp}) harus 1, 2, atau 3.`);
  }

  if (
    typeof semesterMeetingNumber !== "number" ||
    !Number.isInteger(semesterMeetingNumber) ||
    semesterMeetingNumber < 1 ||
    semesterMeetingNumber > TOTAL_SEMESTER_SATURDAYS
  ) {
    throw new Error(
      `INVALID_SEMESTER_MEETING_NUMBER: Nomor pertemuan semester (${semesterMeetingNumber}) harus antara 1 dan 20.`
    );
  }

  const jpInfo =
    jp === 1
      ? STUDI_UMUM_JP_SLOTS.JP1
      : jp === 2
      ? STUDI_UMUM_JP_SLOTS.JP2
      : STUDI_UMUM_JP_SLOTS.JP3;

  const slotSubject = STUDI_UMUM_SCHEDULE_MATRIX[programLevel as 1 | 2 | 3][jp as 1 | 2 | 3];

  if (slotSubject === "PBL") {
    const pbl = resolvePblMeeting(semesterMeetingNumber);
    return {
      track: "STUDI_UMUM",
      jp: jp as 1 | 2 | 3,
      programLevel: programLevel as 1 | 2 | 3,
      semesterMeetingNumber,
      timeSlot: jpInfo.timeRangeWita,
      startTime: jpInfo.startTime,
      endTime: jpInfo.endTime,
      type: "PBL",
      subject: pbl.subject,
      pblBlockNumber: pbl.blockNumber,
      pblWeekInBlock: pbl.weekInBlock,
    };
  }

  return {
    track: "STUDI_UMUM",
    jp: jp as 1 | 2 | 3,
    programLevel: programLevel as 1 | 2 | 3,
    semesterMeetingNumber,
    timeSlot: jpInfo.timeRangeWita,
    startTime: jpInfo.startTime,
    endTime: jpInfo.endTime,
    type: "CORE",
    subject: slotSubject as StudiUmumSubject,
  };
}

// ====================================================
// 5. KEPESANTRENAN — PEDAGOGICAL LEVELS & FACTS
// ====================================================

export const KEPESANTRENAN_ARABIC_LEVELS = [
  "TINGKAT_1",
  "TINGKAT_2",
  "TINGKAT_3",
] as const;

export type KepesantrenanArabicLevel = (typeof KEPESANTRENAN_ARABIC_LEVELS)[number];

export const KEPESANTRENAN_DAILY_SCHEDULE: Record<
  1 | 2 | 3 | 4 | 5,
  { subject: KepesantrenanSubject; timeRange: string; dayName: string }
> = {
  1: { subject: "Bahasa Arab", timeRange: "18:30 - 19:30 WITA", dayName: "Senin" },
  2: { subject: "Fikih", timeRange: "18:30 - 19:30 WITA", dayName: "Selasa" },
  3: { subject: "Tafsir", timeRange: "18:30 - 19:30 WITA", dayName: "Rabu" },
  4: { subject: "Aqidah", timeRange: "18:30 - 19:30 WITA", dayName: "Kamis" },
  5: { subject: "Tajwid", timeRange: "18:30 - 19:30 WITA", dayName: "Jumat" },
};

/**
 * Current Scheduling Facts (Putra & Putri)
 * IMPORTANT: These are business facts for schedule planning, NOT authorization keys.
 * Authorization is strictly relational via Staff, TeachingAssignment, Capability, Scope.
 * Single canonical representation without contradictory duplicate mappings.
 */
export const KEPESANTRENAN_SCHEDULED_FACTS = {
  PUTRA: {
    "KPS-ARB": {
      code: "KPS-ARB",
      subject: "Bahasa Arab",
      levels: {
        TINGKAT_1: {
          teacherName: "Ust. Abi Hudzaifah",
          referenceBook: "Durus al-Lughah",
        },
        TINGKAT_2: {
          teacherName: "Ust. Kamal Mukhtar",
          referenceBook: "Durus al-Lughah",
        },
        TINGKAT_3: {
          teacherName: "Ust. Andi Quarzy Ayatullah",
          referenceBook: "Durus al-Lughah",
        },
      },
    },
    "KPS-FQH": {
      code: "KPS-FQH",
      subject: "Fikih",
      teacherName: "Ust. Razan",
      referenceBook: null,
    },
    "KPS-TFS": {
      code: "KPS-TFS",
      subject: "Tafsir",
      teacherName: "Ust. Mujaddid",
      referenceBooks: ["Tafsir Terjemahan Per Kata", "Tafsir Jalalain"],
    },
    "KPS-AQD": {
      code: "KPS-AQD",
      subject: "Aqidah",
      teacherName: "Ust. Alwan",
      referenceBook: null,
    },
    "KPS-TJW": {
      code: "KPS-TJW",
      subject: "Tajwid",
      teacherName: "Ust. Mujaddid",
      referenceBook: "Matan Tuhfatul Athfal",
    },
  },
  PUTRI: {
    teacherName: "Ustazah Lisa Dwina Fitri",
    "KPS-ARB": {
      code: "KPS-ARB",
      subject: "Bahasa Arab",
      teacherName: "Ustazah Lisa Dwina Fitri",
      referenceBook: "Durus al-Lughah",
    },
    "KPS-FQH": {
      code: "KPS-FQH",
      subject: "Fikih",
      teacherName: "Ustazah Lisa Dwina Fitri",
      referenceBook: null,
    },
    "KPS-TFS": {
      code: "KPS-TFS",
      subject: "Tafsir",
      teacherName: "Ustazah Lisa Dwina Fitri",
      referenceBooks: ["Tafsir Terjemahan Per Kata", "Tafsir Jalalain"],
    },
    "KPS-AQD": {
      code: "KPS-AQD",
      subject: "Aqidah",
      teacherName: "Ustazah Lisa Dwina Fitri",
      referenceBook: null,
    },
    "KPS-TJW": {
      code: "KPS-TJW",
      subject: "Tajwid",
      teacherName: "Ustazah Lisa Dwina Fitri",
      referenceBook: "Matan Tuhfatul Athfal",
    },
  },
} as const;

/**
 * Deterministic check whether a given date or timestamp falls on Saturday in WITA (Asia/Makassar, UTC+8).
 * Ensures UTC date rollover boundaries are handled accurately and does NOT rely on server local timezone or getUTCDay().
 */
export function isWitaSaturday(date: Date | string | number): boolean {
  const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
  if (isNaN(d.getTime())) return false;
  const dayName = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Makassar",
    weekday: "long",
  }).format(d);
  return dayName === "Saturday";
}

export function resolveKepesantrenanDaySubject(day: number | string): string | null {
  if (typeof day === "number") {
    return KEPESANTRENAN_DAILY_SCHEDULE[day as 1 | 2 | 3 | 4 | 5]?.subject || null;
  }
  const norm = day.trim().toLowerCase();
  if (norm === "1" || norm === "monday" || norm === "senin") return "Bahasa Arab";
  if (norm === "2" || norm === "tuesday" || norm === "selasa") return "Fikih";
  if (norm === "3" || norm === "wednesday" || norm === "rabu") return "Tafsir";
  if (norm === "4" || norm === "thursday" || norm === "kamis") return "Aqidah";
  if (norm === "5" || norm === "friday" || norm === "jumat") return "Tajwid";
  return null;
}

// ====================================================
// 6. KEPESANTRENAN STUDENT ATTENDANCE STATUSES
// ====================================================

export const KEPESANTRENAN_APPROVED_ATTENDANCE_STATUSES = [
  "HADIR",
  "IZIN",
  "SAKIT",
  "ALFA",
] as const;

export const APPROVED_KEPESANTRENAN_ATTENDANCE_STATUSES = KEPESANTRENAN_APPROVED_ATTENDANCE_STATUSES;
export const KEPESANTRENAN_FORBIDDEN_ATTENDANCE_STATUSES = ["MASBUK"] as const;

export type ApprovedKepesantrenanAttendanceStatus =
  (typeof KEPESANTRENAN_APPROVED_ATTENDANCE_STATUSES)[number];

export function isApprovedKepesantrenanAttendanceStatus(status: string): boolean {
  return (KEPESANTRENAN_APPROVED_ATTENDANCE_STATUSES as readonly string[]).includes(status);
}

// ====================================================
// 7. TEACHER ACCOUNT NAMING CONVENTION
// ====================================================

export const TEACHER_ACCOUNT_PREFIX = "guru.";
export function getExpectedTeacherUsername(subjectSlug: string): string {
  return `${TEACHER_ACCOUNT_PREFIX}${subjectSlug.toLowerCase().replace(/\s+/g, "")}`;
}

// ====================================================
// 8. SERVER-AUTHORITATIVE READ DTO FOR PENDIDIKAN UI
// ====================================================

export interface EducationSessionReadDTO {
  sessionId: string;
  educationTrack: EducationTrackType;
  subject: string;
  subjectId: string;
  subjectCode?: string | null;
  subjectName?: string | null;
  scheduledDate: string; // YYYY-MM-DD WITA
  plannedStart: string | null; // HH:mm
  plannedEnd: string | null; // HH:mm
  plannedStartTime?: string | null;
  plannedEndTime?: string | null;
  programLevel: number | null;
  cohortId?: string | null;
  cohortCode?: string | null;
  cohortLabel?: string | null;
  cohortTahunAjaran?: string | null;
  genderGroup: "PUTRA" | "PUTRI" | null;
  jp?: number | null;
  semesterMeetingNumber?: number | null;
  pblPhase?: string | null;
  pblBlockNumber?: number | null;
  pblMetadata?: {
    blockNumber: number;
    weekInBlock: number;
  } | null;
  pedagogicalLevel?: "TINGKAT_1" | "TINGKAT_2" | "TINGKAT_3" | null;
  scheduledTeacherAssignmentId?: string | null;
  scheduledStaffId?: string | null;
  scheduledTeacherDisplay: string | null;
  actualTeacherUserId?: string | null;
  actualTeacherStaffId?: string | null;
  actualTeacherName?: string | null;
  actualTeacherDisplay?: string | null;
  status: "SCHEDULED" | "STARTED" | "COMPLETED" | "CANCELLED";
  startedAt?: string | null;
  materi?: string | null;
  attendanceAvailable: boolean;
  attendanceDeniedReason?: string | null;
  materialAvailable: boolean;
  materialDeniedReason?: string | null;
  mutationAvailable: boolean;
  mutationDeniedReason?: string | null;
}

/**
 * Match Studi Umum session by full authoritative identity:
 * - educationTrack = STUDI_UMUM
 * - scheduledDate
 * - subjectId / subjectCode / subjectName
 * - cohortId / programLevel
 * - jp
 * - semesterMeetingNumber
 *
 * Strict fail-closed: If a criterion is provided, session field MUST exactly equal the criterion.
 */
export function matchStudiUmumSession(
  sessions: EducationSessionReadDTO[],
  criteria: {
    scheduledDate?: string;
    subjectId?: string;
    subjectCode?: string;
    subjectName?: string;
    cohortId?: string;
    programLevel?: number;
    jp?: number;
    semesterMeetingNumber?: number;
  }
): EducationSessionReadDTO | undefined {
  return sessions.find((s) => {
    if (s.educationTrack !== "STUDI_UMUM") return false;
    if (criteria.scheduledDate !== undefined && s.scheduledDate !== criteria.scheduledDate) return false;
    if (criteria.programLevel !== undefined && s.programLevel !== criteria.programLevel) return false;
    if (criteria.cohortId !== undefined && s.cohortId !== criteria.cohortId) return false;
    if (criteria.jp !== undefined && s.jp !== criteria.jp) return false;
    if (
      criteria.semesterMeetingNumber !== undefined &&
      s.semesterMeetingNumber !== criteria.semesterMeetingNumber
    ) {
      return false;
    }
    if (criteria.subjectId !== undefined && s.subjectId !== criteria.subjectId) return false;
    if (criteria.subjectCode !== undefined && s.subjectCode !== criteria.subjectCode) return false;
    if (
      criteria.subjectName !== undefined &&
      s.subjectName !== criteria.subjectName &&
      s.subject !== criteria.subjectName
    ) {
      return false;
    }
    return true;
  });
}

/**
 * Match Kepesantrenan session by full authoritative identity:
 * - educationTrack = KEPESANTRENAN
 * - scheduledDate
 * - subjectId / subjectCode / subjectName
 * - genderGroup
 * - pedagogicalLevel / programLevel
 *
 * Strict fail-closed: If a criterion is provided, session field MUST exactly equal the criterion.
 */
export function matchKepesantrenanSession(
  sessions: EducationSessionReadDTO[],
  criteria: {
    scheduledDate?: string;
    subjectId?: string;
    subjectCode?: string;
    subjectName?: string;
    genderGroup?: "PUTRA" | "PUTRI";
    pedagogicalLevel?: "TINGKAT_1" | "TINGKAT_2" | "TINGKAT_3";
    programLevel?: number;
    cohortId?: string;
  }
): EducationSessionReadDTO | undefined {
  return sessions.find((s) => {
    if (s.educationTrack !== "KEPESANTRENAN") return false;
    if (criteria.scheduledDate !== undefined && s.scheduledDate !== criteria.scheduledDate) return false;
    if (criteria.genderGroup !== undefined && s.genderGroup !== criteria.genderGroup) return false;
    if (
      criteria.pedagogicalLevel !== undefined &&
      s.pedagogicalLevel !== criteria.pedagogicalLevel
    ) {
      return false;
    }
    if (criteria.programLevel !== undefined && s.programLevel !== criteria.programLevel) return false;
    if (criteria.cohortId !== undefined && s.cohortId !== criteria.cohortId) return false;
    if (criteria.subjectId !== undefined && s.subjectId !== criteria.subjectId) return false;
    if (criteria.subjectCode !== undefined && s.subjectCode !== criteria.subjectCode) return false;
    if (
      criteria.subjectName !== undefined &&
      s.subjectName !== criteria.subjectName &&
      s.subject !== criteria.subjectName
    ) {
      return false;
    }
    return true;
  });
}

