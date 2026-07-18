import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.error(
      '✗ ADMIN_EMAIL et ADMIN_PASSWORD doivent être définis (dans .env ou en ligne de ' +
        'commande) pour créer le premier compte admin.\n' +
        '  Exemple : ADMIN_EMAIL=admin@nexa.tn ADMIN_PASSWORD=change-moi npx prisma db seed',
    );
    process.exit(1);
  }

  if (password.length < 8) {
    console.error('✗ ADMIN_PASSWORD doit contenir au moins 8 caractères.');
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const existing = await prisma.user.findUnique({ where: { email } });

  const admin = await prisma.user.upsert({
    where: { email },
    // If the account already exists, we only touch its role/verification
    // status — we never silently overwrite an existing password here.
    update: {
      role: 'ADMIN',
      status: 'ACTIVE',
      emailVerified: true,
    },
    create: {
      email,
      passwordHash,
      nom: process.env.ADMIN_NOM || 'Admin',
      prenom: process.env.ADMIN_PRENOM || 'NEXA',
      role: 'ADMIN',
      status: 'ACTIVE',
      emailVerified: true,
    },
    select: { id: true, email: true, role: true, createdAt: true },
  });

  if (existing) {
    console.log(`✓ Utilisateur existant promu ADMIN : ${admin.email}`);
    if (existing.role === 'ADMIN') {
      console.log('  (était déjà admin — aucun changement de mot de passe)');
    }
  } else {
    console.log(`✓ Compte admin créé : ${admin.email}`);
  }
}

main()
  .catch((e) => {
    console.error('✗ Échec du seed :', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
