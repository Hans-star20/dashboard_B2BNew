import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password.mjs";

const emailInput = process.env.B2B_BOOTSTRAP_EMAIL;
const password = process.env.B2B_BOOTSTRAP_PASSWORD;
const nameInput = process.env.B2B_BOOTSTRAP_NAME ?? "Superuser Utama";

if (!emailInput || !password) {
  console.error("Atur B2B_BOOTSTRAP_EMAIL dan B2B_BOOTSTRAP_PASSWORD sebelum menjalankan bootstrap.");
  process.exit(1);
}

const email = emailInput.trim().toLowerCase();
const name = nameInput.trim();
if (
  !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
  email.length > 254 ||
  !name ||
  name.length > 191 ||
  password.length < 12 ||
  password.length > 128
) {
  console.error("Email, nama, atau password bootstrap tidak memenuhi ketentuan.");
  process.exit(1);
}

const permissions = [
  ["users.read", "Melihat akun yang dibuat sendiri"],
  ["users.create", "Membuat akun HELPDESK atau SUPERVISOR"],
  ["users.update", "Memperbarui akun yang dibuat sendiri"],
  ["users.password.reset", "Mereset password akun yang dibuat sendiri"],
  ["users.permissions.manage", "Mengelola permission akun yang dibuat sendiri"],
  ["tickets.sync", "Menjalankan dan melihat sinkronisasi tiket"],
];
const roles = [
  ["SUPERUSER", "Administrator utama sistem"],
  ["HELPDESK", "Pengelola operasional helpdesk"],
  ["SUPERVISOR", "Pengawas operasional"],
];

const prisma = new PrismaClient();

try {
  const passwordHash = await hashPassword(password);
  const user = await prisma.$transaction(async (tx) => {
    let superuserRole = await tx.role.findUnique({ where: { name: "SUPERUSER" } });
    if (!superuserRole) {
      for (const [roleName, description] of roles) {
        await tx.role.upsert({
          where: { name: roleName },
          create: { name: roleName, description, isSystem: true },
          update: {},
        });
      }
      superuserRole = await tx.role.findUniqueOrThrow({ where: { name: "SUPERUSER" } });
    }

    await tx.$queryRaw`SELECT id FROM roles WHERE id = ${superuserRole.id} FOR UPDATE`;
    const existing = await tx.user.findFirst({
      where: {
        OR: [
          { primarySuperuserKey: "PRIMARY" },
          { roleId: superuserRole.id },
        ],
      },
      select: { id: true },
    });
    if (existing) throw new Error("BOOTSTRAP_ALREADY_INITIALIZED");

    for (const [roleName, description] of roles) {
      await tx.role.upsert({
        where: { name: roleName },
        create: { name: roleName, description, isSystem: true },
        update: {},
      });
    }

    for (const [code, description] of permissions) {
      const permission = await tx.permission.upsert({
        where: { code },
        create: { code, description, isSystem: true },
        update: {},
      });
      await tx.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: superuserRole.id,
            permissionId: permission.id,
          },
        },
        create: { roleId: superuserRole.id, permissionId: permission.id },
        update: {},
      });
    }

    return tx.user.create({
      data: {
        email,
        name,
        passwordHash,
        roleId: superuserRole.id,
        primarySuperuserKey: "PRIMARY",
      },
      select: { id: true },
    });
  });
  console.log("Bootstrap Superuser berhasil. Simpan kredensial secara aman dan hapus variabel lingkungan bootstrap.");
  console.log(`User ID: ${user.id}`);
} catch (error) {
  if (error instanceof Error && error.message === "BOOTSTRAP_ALREADY_INITIALIZED") {
    console.error("Bootstrap ditolak: akun Superuser sudah tersedia.");
  } else {
    console.error("Bootstrap Superuser gagal.");
    console.error(error instanceof Error ? error.message : "Kesalahan tidak diketahui.");
  }
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
