import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  const org = await prisma.organization.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Demo Orchards Ltd',
    },
  });

  const admin = await prisma.user.upsert({
    where: { email: 'admin@demo.fieldlog.local' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000011',
      orgId: org.id,
      email: 'admin@demo.fieldlog.local',
      name: 'Admin User',
      role: 'ADMIN',
    },
  });

  const supervisor = await prisma.user.upsert({
    where: { email: 'supervisor@demo.fieldlog.local' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000012',
      orgId: org.id,
      email: 'supervisor@demo.fieldlog.local',
      name: 'Supervisor User',
      role: 'SUPERVISOR',
    },
  });

  const inspector = await prisma.user.upsert({
    where: { email: 'inspector@demo.fieldlog.local' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000013',
      orgId: org.id,
      email: 'inspector@demo.fieldlog.local',
      name: 'Inspector User',
      role: 'INSPECTOR',
    },
  });

  const farm = await prisma.farm.upsert({
    where: { id: '00000000-0000-0000-0000-000000000021' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000021',
      orgId: org.id,
      name: 'Sunrise Orchard',
      centroid: {
        lat: 13.7563,
        lng: 100.5018,
      },
    },
  });

  const block1 = await prisma.block.upsert({
    where: { id: '00000000-0000-0000-0000-000000000031' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000031',
      farmId: farm.id,
      name: 'Block A - Durian North',
      crop: 'DURIAN',
      variety: 'Monthong',
      areaHa: 2.5,
      polygon: {
        type: 'Polygon',
        coordinates: [
          [
            [100.501, 13.757],
            [100.503, 13.757],
            [100.503, 13.755],
            [100.501, 13.755],
            [100.501, 13.757],
          ],
        ],
      },
    },
  });

  const block2 = await prisma.block.upsert({
    where: { id: '00000000-0000-0000-0000-000000000032' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000032',
      farmId: farm.id,
      name: 'Block B - Mango South',
      crop: 'MANGO',
      variety: 'Nam Dok Mai',
      areaHa: 1.8,
      polygon: {
        type: 'Polygon',
        coordinates: [
          [
            [100.501, 13.755],
            [100.503, 13.755],
            [100.503, 13.753],
            [100.501, 13.753],
            [100.501, 13.755],
          ],
        ],
      },
    },
  });

  const block3 = await prisma.block.upsert({
    where: { id: '00000000-0000-0000-0000-000000000033' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000033',
      farmId: farm.id,
      name: 'Block C - Dragon Fruit West',
      crop: 'DRAGON_FRUIT',
      variety: 'White Flesh',
      areaHa: 1.2,
      polygon: {
        type: 'Polygon',
        coordinates: [
          [
            [100.499, 13.757],
            [100.501, 13.757],
            [100.501, 13.755],
            [100.499, 13.755],
            [100.499, 13.757],
          ],
        ],
      },
    },
  });

  console.log('✅ Seeded:');
  console.log('  - Organization:', org.name);
  console.log('  - Users: admin, supervisor, inspector');
  console.log('  - Farm:', farm.name);
  console.log('  - Blocks:', block1.name, ',', block2.name, ',', block3.name);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
