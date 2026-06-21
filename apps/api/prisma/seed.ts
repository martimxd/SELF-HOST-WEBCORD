import argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const superAdmin = await prisma.user.findFirst({ where: { isSuperAdmin: true } });
  if (!superAdmin) {
    await prisma.user.create({
      data: {
        username: 'admin',
        passwordHash: await argon2.hash('admin'),
        isSuperAdmin: true,
        mustChangePassword: true,
      },
    });
    console.log('Created initial super-admin: admin/admin');
  }
  await prisma.setting.upsert({
    where: { key: 'publicRegistration' },
    update: {},
    create: { key: 'publicRegistration', value: 'false' },
  });
  await prisma.setting.upsert({
    where: { key: 'maxUploadBytes' },
    update: {},
    create: { key: 'maxUploadBytes', value: String(2 * 1024 ** 3) },
  });
}

main().finally(() => prisma.$disconnect());
