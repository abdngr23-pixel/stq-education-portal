-- Gate 2 schema drift remediation:
-- NilaiAkademik.guruId is nullable and canonical deletion behavior is SET NULL.

ALTER TABLE "nilai_akademik"
DROP CONSTRAINT "nilai_akademik_guru_id_fkey";

ALTER TABLE "nilai_akademik"
ADD CONSTRAINT "nilai_akademik_guru_id_fkey"
FOREIGN KEY ("guru_id")
REFERENCES "staff"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
