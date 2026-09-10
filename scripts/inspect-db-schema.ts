import prisma from "../lib/prisma";

async function main() {
  const tables: Array<{ table_name: string }> = await prisma.$queryRaw`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `;
  console.log("Existing tables in PostgreSQL:", tables.map((t) => t.table_name));

  const columns: Array<{ column_name: string; data_type: string }> = await prisma.$queryRaw`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'setoran_tahfizh'
    ORDER BY ordinal_position;
  `;
  console.log("Columns in setoran_tahfizh:", columns);

  const santriColumns: Array<{ column_name: string; data_type: string }> = await prisma.$queryRaw`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'santri'
    ORDER BY ordinal_position;
  `;
  console.log("Columns in santri:", santriColumns.map(c => c.column_name));

  const userColumns: Array<{ column_name: string; data_type: string }> = await prisma.$queryRaw`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'users'
    ORDER BY ordinal_position;
  `;
  console.log("Columns in users:", userColumns.map(c => c.column_name));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
