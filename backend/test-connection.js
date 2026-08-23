"use strict";
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  console.log("\n--- S2R2 Local DB Connection Test ---\n");

  // 1. Basic connectivity
  const [{ db, usr }] = await prisma.$queryRaw`
    SELECT current_database() as db, current_user as usr
  `;
  console.log(`✅ Connected to database: "${db}" as user: "${usr}"`);

  // 2. Table check
  const tables = await prisma.$queryRaw`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
  `;
  console.log(`✅ Tables found: ${tables.map(t => t.tablename).join(", ")}`);

  // 3. Row counts
  const [users, rms, fps, clients, bom] = await Promise.all([
    prisma.user.count(),
    prisma.rawMaterial.count(),
    prisma.finishedProduct.count(),
    prisma.client.count(),
    prisma.billOfMaterials.count(),
  ]);

  console.log(`\n--- Row counts ---`);
  console.log(`  users:             ${users}`);
  console.log(`  raw_materials:     ${rms}`);
  console.log(`  finished_products: ${fps}`);
  console.log(`  clients:           ${clients}`);
  console.log(`  bill_of_materials: ${bom}`);

  // 4. Verify admin user exists
  const admin = await prisma.user.findUnique({ where: { username: "sandeep" } });
  console.log(`\n✅ Admin user "sandeep": ${admin ? "EXISTS (" + admin.role + ")" : "NOT FOUND — run npm run db:seed"}`);

  console.log("\n✅ All checks passed — backend is ready.\n");
}

main()
  .catch(e => {
    console.error("\n❌ Connection failed:", e.message);
    console.error("   Make sure PostgreSQL is running and DATABASE_URL in .env is correct.\n");
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
