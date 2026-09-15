import { PrismaClient, type Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';

/**
 * Seed do Celebrai.
 *
 * Cria:
 *  - 1 SUPER_ADMIN (gerencia a plataforma)
 *  - 1 ADMIN (noiva/noivo) com evento de exemplo completo
 *  - 1 RECEPTIONIST vinculado ao evento (portaria)
 *  - Evento "Casamento de João & Maria" (20/12/2026)
 *  - Local completo com endereço e links de mapa
 *  - Grupos (famílias) e convidados com convites individuais
 *  - Respostas de RSVP variadas (confirmado, pendente, recusado)
 *  - Check-ins de exemplo para o dashboard
 *  - Trilha de auditoria
 *
 * Uso: npm run db:seed (dentro de packages/api)
 */

const prisma = new PrismaClient();

const ROUNDS = 10;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function invitationToken(): string {
  return randomBytes(24).toString('base64url');
}

function qrCode(prefix: string): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const block = (n: number) =>
    Array.from({ length: n }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
  return `${prefix}-${block(8)}-${block(4)}`;
}

function maskCpf(cpf: string): string {
  return `***.***.***-${cpf.slice(-2)}`;
}

/**
 * O ambiente de desenvolvimento local pode rodar em SQLite, onde `String[]` e
 * `Json` são armazenados como texto. Enquanto em PostgreSQL os valores são
 * nativos, aqui serializamos para manter o seed portável entre os dois bancos.
 */
const IS_SQLITE = (process.env.DATABASE_PROVIDER ?? 'postgresql') === 'sqlite';

/** Arrays de string: nativo no Postgres, JSON em SQLite. */
function asStringList(values: string[]): string[] | string | null {
  if (values.length === 0) return IS_SQLITE ? null : [];
  return IS_SQLITE ? JSON.stringify(values) : values;
}

/** JSON: nativo no Postgres, texto em SQLite. */
function asJson(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return JSON.stringify(value);
}

async function main(): Promise<void> {
  console.log('🌱 Iniciando seed do Celebrai...');

  // -------------------------------------------------------------------------
  // Limpeza (ordem reversa das dependências)
  // -------------------------------------------------------------------------
  await prisma.checkIn.deleteMany();
  await prisma.invitationResponse.deleteMany();
  await prisma.invitation.deleteMany();
  await prisma.dataConsent.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.guest.deleteMany();
  await prisma.party.deleteMany();
  await prisma.venue.deleteMany();
  await prisma.eventMember.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.event.deleteMany();
  await prisma.user.deleteMany();

  // -------------------------------------------------------------------------
  // Usuários
  // -------------------------------------------------------------------------
  const superAdminPassword = await bcrypt.hash('SuperAdmin@123', ROUNDS);
  const adminPassword = await bcrypt.hash('Admin@12345', ROUNDS);
  const receptionPassword = await bcrypt.hash('Recepcao@123', ROUNDS);

  const superAdmin = await prisma.user.create({
    data: {
      name: 'Super Admin',
      email: 'super@celebrai.app',
      passwordHash: superAdminPassword,
      role: 'SUPER_ADMIN' as Role,
    },
  });

  const admin = await prisma.user.create({
    data: {
      name: 'Maria Oliveira',
      email: 'admin@celebrai.app',
      passwordHash: adminPassword,
      role: 'ADMIN' as Role,
      phone: '+5521999990000',
    },
  });

  const receptionist = await prisma.user.create({
    data: {
      name: 'Recepção 01',
      email: 'recepcao@celebrai.app',
      passwordHash: receptionPassword,
      role: 'RECEPTIONIST' as Role,
    },
  });

  console.log('  ✓ Usuários criados');

  // -------------------------------------------------------------------------
  // Evento
  // -------------------------------------------------------------------------
  const event = await prisma.event.create({
    data: {
      slug: 'casamento-joao-maria-demo',
      ownerId: admin.id,
      status: 'PUBLISHED',
      title: 'Casamento de João & Maria',
      hostsName: 'João & Maria',
      coupleNameA: 'João',
      coupleNameB: 'Maria',
      coverImageUrl: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=1200',
      galleryImages: JSON.stringify([
        "https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=800",
        "https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6?w=800",
        "https://images.unsplash.com/photo-1519225421980-715cb0215aed?w=800",
        "https://images.unsplash.com/photo-1522673607200-164d1b6ce486?w=800"
      ]),
      welcomeMessage: 'Estamos muito felizes em compartilhar esse momento especial com você.',
      inviteMessage:
        'Será uma honra ter você ao nosso lado neste dia tão importante. Sua presença tornará tudo ainda mais especial.',
      couplesMessage:
        'Nos conhecemos há 8 anos e, desde então, construímos uma história de amor, parceria e cumplicidade. Agora, queremos celebrar esse novo capítulo com as pessoas que amamos. Obrigado por fazer parte da nossa vida!',
      dressCode: 'Traje esporte fino. Evite branco, off-white e nude.',
      giftListUrl: 'https://www.exemplo.com/lista-de-presentes',
      giftListNotes: 'Sua presença já é o nosso maior presente. Caso deseje nos presentear, deixamos uma lista de sugestões.',
      ceremonyInfo:
        'A cerimônia religiosa acontecerá às 19:00, com duração aproximada de 45 minutos. Pedimos gentilmente que cheguem com 20 minutos de antecedência.',
      receptionInfo:
        'Após a cerimônia, a recepção terá início às 20:00 no mesmo local, com jantar, música ao vivo e pista de dança até 02:00.',
      eventDate: new Date('2026-12-20T19:00:00-03:00'),
      startTime: '19:00',
      endTime: '02:00',
      rsvpDeadline: new Date('2026-11-30T23:59:59-03:00'),
      allowCompanions: true,
      allowShareInvite: false,
    },
  });

  // Vincula a recepcionista ao evento.
  await prisma.eventMember.create({
    data: { eventId: event.id, userId: receptionist.id, role: 'RECEPTIONIST' },
  });

  // -------------------------------------------------------------------------
  // Local
  // -------------------------------------------------------------------------
  const venue = await prisma.venue.create({
    data: {
      eventId: event.id,
      name: 'Espaço Jardim Imperial',
      type: 'Salão de festas',
      address: 'Estrada da Gávea',
      number: '1200',
      complement: 'Portão principal',
      neighborhood: 'São Conrado',
      city: 'Rio de Janeiro',
      state: 'RJ',
      zipCode: '22610-001',
      country: 'Brasil',
      referencePoint: 'Próximo ao Hotel Nacional, entrada pela Estrada da Gávea.',
      googleMapsUrl: 'https://maps.google.com/?q=Espaco+Jardim+Imperial+Rio+de+Janeiro',
      wazeUrl: 'https://waze.com/ul?q=Espaco+Jardim+Imperial+Rio+de+Janeiro',
      latitude: -22.9997,
      longitude: -43.2669,
      parkingInfo:
        'Estacionamento próprio gratuito para até 200 veículos, com manobrista disponível das 18:00 às 02:30.',
      extraInfo:
        'O espaço possui acesso para cadeirantes e área externa coberta. Não é permitido fumar nas áreas internas.',
    },
  });

  console.log('  ✓ Evento e local criados');

  // -------------------------------------------------------------------------
  // Grupos (famílias)
  // -------------------------------------------------------------------------
  const familyParty = await prisma.party.create({
    data: { eventId: event.id, name: 'Família Oliveira' },
  });
  const friendParty = await prisma.party.create({
    data: { eventId: event.id, name: 'Amigos da Faculdade' },
  });
  const workParty = await prisma.party.create({
    data: { eventId: event.id, name: 'Trabalho' },
  });

  // -------------------------------------------------------------------------
  // Convidados + convites
  // -------------------------------------------------------------------------
  const guestsSeed: Array<{
    fullName: string;
    email: string;
    whatsapp: string;
    allowedCompanions: number;
    partyId: string;
    status: 'PENDING' | 'CONFIRMED' | 'DECLINED' | 'CHECKED_IN';
    notes?: string;
    attendingCount?: number;
    checkInAt?: string;
  }> = [
      {
        fullName: 'João da Silva',
        email: 'joao.silva@email.com',
        whatsapp: '+5521999999',
        allowedCompanions: 2,
        partyId: friendParty.id,
        status: 'CHECKED_IN',
        attendingCount: 2,
        checkInAt: '19:42',
        notes: 'Amigo do noivo desde a faculdade.',
      },
      {
        fullName: 'Ana Beatriz Souza',
        email: 'ana.souza@email.com',
        whatsapp: '+5521988888',
        allowedCompanions: 1,
        partyId: friendParty.id,
        status: 'CONFIRMED',
        attendingCount: 1,
      },
      {
        fullName: 'Carlos Eduardo Lima',
        email: 'carlos.lima@email.com',
        whatsapp: '+5521977777',
        allowedCompanions: 4,
        partyId: familyParty.id,
        status: 'CONFIRMED',
        attendingCount: 4,
        notes: 'Família: esposa e dois filhos.',
      },
      {
        fullName: 'Mariana Ferreira',
        email: 'mariana.ferreira@email.com',
        whatsapp: '+5521966666',
        allowedCompanions: 2,
        partyId: workParty.id,
        status: 'PENDING',
      },
      {
        fullName: 'Roberto Almeida',
        email: 'roberto.almeida@email.com',
        whatsapp: '+5521955555',
        allowedCompanions: 2,
        partyId: familyParty.id,
        status: 'DECLINED',
        notes: 'Informou que estará viajando.',
      },
      {
        fullName: 'Patrícia Nogueira',
        email: 'patricia.nogueira@email.com',
        whatsapp: '+5521944444',
        allowedCompanions: 1,
        partyId: workParty.id,
        status: 'PENDING',
      },
      {
        fullName: 'Fernando Costa',
        email: 'fernando.costa@email.com',
        whatsapp: '+5521933333',
        allowedCompanions: 3,
        partyId: friendParty.id,
        status: 'CHECKED_IN',
        attendingCount: 3,
        checkInAt: '19:58',
      },
      {
        fullName: 'Juliana Martins',
        email: 'juliana.martins@email.com',
        whatsapp: '+5521922222',
        allowedCompanions: 2,
        partyId: familyParty.id,
        status: 'CONFIRMED',
        attendingCount: 2,
      },
      {
        fullName: 'Lucas Pereira',
        email: 'lucas.pereira@email.com',
        whatsapp: '+5521911111',
        allowedCompanions: 1,
        partyId: workParty.id,
        status: 'PENDING',
      },
      {
        fullName: 'Beatriz Rocha',
        email: 'beatriz.rocha@email.com',
        whatsapp: '+5521900000',
        allowedCompanions: 2,
        partyId: friendParty.id,
        status: 'CHECKED_IN',
        attendingCount: 2,
        checkInAt: '20:15',
      },
    ];

  const createdGuests = [];

  for (const seed of guestsSeed) {
    const guest = await prisma.guest.create({
      data: {
        eventId: event.id,
        partyId: seed.partyId,
        fullName: seed.fullName,
        email: seed.email,
        whatsapp: seed.whatsapp,
        allowedCompanions: seed.allowedCompanions,
        notes: seed.notes ?? null,
      },
    });

    const token = invitationToken();
    const invitation = await prisma.invitation.create({
      data: {
        guestId: guest.id,
        tokenHash: hashToken(token),
        tokenPrefix: token.slice(0, 8),
        status: seed.status,
        sentAt: new Date(),
        sentVia: 'WHATSAPP',
        respondedAt: seed.status === 'PENDING' ? null : new Date(),
      },
    });

    // Resposta de RSVP.
    if (seed.status === 'CONFIRMED' || seed.status === 'CHECKED_IN') {
      const cpf = '12345678909';
      await prisma.invitationResponse.create({
        data: {
          invitationId: invitation.id,
          fullName: seed.fullName,
          cpfHash: createHash('sha256').update(`seed:${cpf}`).digest('hex'),
          cpfMasked: maskCpf(cpf),
          email: seed.email,
          phone: seed.whatsapp,
          attendingCount: seed.attendingCount ?? 1,
          companions: asJson([]) as never,
          message: 'Mal podemos esperar por esse dia!',
          ip: '189.0.0.1',
        },
      });
    }

    // QR Code para convites confirmados / com check-in.
    if (seed.status === 'CONFIRMED' || seed.status === 'CHECKED_IN') {
      const code = qrCode('CASAMENTO');
      await prisma.invitation.update({
        where: { id: invitation.id },
        data: {
          qrCodeHash: hashToken(code),
          qrCodePrefix: code,
          qrCodeIssuedAt: new Date(),
        },
      });

      if (seed.status === 'CHECKED_IN' && seed.checkInAt) {
        const [hours, minutes] = seed.checkInAt.split(':').map(Number);
        const checkInDate = new Date('2026-12-20T00:00:00-03:00');
        checkInDate.setHours(hours ?? 19, minutes ?? 0, 0, 0);

        await prisma.checkIn.create({
          data: {
            eventId: event.id,
            invitationId: invitation.id,
            guestId: guest.id,
            method: 'QR_CODE',
            peopleCount: seed.attendingCount ?? 1,
            operatorId: receptionist.id,
            operatorLabel: 'Recepção 01',
            tokenPrefix: code.slice(0, 8),
            ip: '189.0.0.10',
          },
        });
      }
    }

    createdGuests.push({ guest, invitation, token });

    // Log de auditoria de exemplo.
    await prisma.auditLog.create({
      data: {
        action: seed.status === 'CHECKED_IN' ? 'checkin.validated' : 'invitation.sent',
        userId: admin.id,
        eventId: event.id,
        actorRole: 'ADMIN',
        actorName: admin.name,
        entity: 'Invitation',
        entityId: invitation.id,
        description:
          seed.status === 'CHECKED_IN'
            ? `Entrada autorizada para "${seed.fullName}"`
            : `Convite enviado para "${seed.fullName}"`,
        ip: '189.0.0.1',
      },
    });
  }

  console.log(`  ✓ ${createdGuests.length} convidados e convites criados`);

  // -------------------------------------------------------------------------
  // Resumo
  // -------------------------------------------------------------------------
  console.log('');
  console.log('🎉 Seed concluído com sucesso!');
  console.log('');
  console.log('👤 Credenciais de acesso:');
  console.log('   Super Admin   → super@celebrai.app     / SuperAdmin@123');
  console.log('   Administrador → admin@celebrai.app     / Admin@12345');
  console.log('   Recepção      → recepcao@celebrai.app  / Recepcao@123');
  console.log('');
  console.log(`📅 Evento: ${event.title} — ${event.eventDate.toLocaleDateString('pt-BR')}`);
  console.log(`📍 Local: ${venue.name} — ${venue.city}/${venue.state}`);
  console.log('');
  console.log('🔗 Link de convite de exemplo (convidado João da Silva):');
  console.log(`   ${process.env.APP_URL ?? 'http://localhost:5173'}/convite/${createdGuests[0]?.token}`);
  console.log('');
}

main()
  .catch((error) => {
    console.error('❌ Falha no seed:', error);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
