import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function resetDatabase() {
  await prisma.contact.deleteMany();
  await prisma.$executeRaw`DELETE FROM sqlite_sequence WHERE name = 'Contact'`;
}

async function createContact(data: {
  phoneNumber?: string;
  email?: string;
  linkedId?: number;
  linkPrecedence: string;
}) {
  return prisma.contact.create({ data });
}

async function getAllContacts() {
  return prisma.contact.findMany({
    orderBy: { id: 'asc' },
  });
}

async function findContactsByEmailOrPhone(email: string | null, phoneNumber: string | null) {
  if (email && phoneNumber) {
    return prisma.contact.findMany({
      where: {
        OR: [
          { email: email },
          { phoneNumber: phoneNumber },
        ],
        deletedAt: null,
      },
      orderBy: { createdAt: 'asc' },
    });
  } else if (email) {
    return prisma.contact.findMany({
      where: { email: email, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
  } else if (phoneNumber) {
    return prisma.contact.findMany({
      where: { phoneNumber: phoneNumber, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
  }
  return [];
}

async function getAllLinkedContacts(primaryId: number) {
  const primaryContact = await prisma.contact.findUnique({
    where: { id: primaryId },
  });

  if (!primaryContact) return [];

  if (primaryContact.linkPrecedence === 'secondary' && primaryContact.linkedId) {
    return getAllLinkedContacts(primaryContact.linkedId);
  }

  const linkedContacts = await prisma.contact.findMany({
    where: {
      OR: [
        { id: primaryId },
        { linkedId: primaryId },
      ],
      deletedAt: null,
    },
    orderBy: { createdAt: 'asc' },
  });

  return linkedContacts;
}

function buildContactResponse(contacts: any[]) {
  const primaryContact = contacts.find(c => c.linkPrecedence === 'primary') || contacts[0];
  
  const emails = contacts
    .map(c => c.email)
    .filter((e): e is string => e !== null && e !== undefined);
  
  const phoneNumbers = contacts
    .map(c => c.phoneNumber)
    .filter((p): p is string => p !== null && p !== undefined);
  
  const secondaryContactIds = contacts
    .filter(c => c.linkPrecedence === 'secondary')
    .map(c => c.id);

  return {
    primaryContatctId: primaryContact.id,
    emails: [...new Set(emails)],
    phoneNumbers: [...new Set(phoneNumbers)],
    secondaryContactIds,
  };
}

async function identify(email: string | null, phoneNumber: string | null) {
  const normalizedEmail = email?.trim() || null;
  const normalizedPhone = phoneNumber?.trim() || null;

  if (!normalizedEmail && !normalizedPhone) {
    return {
      contact: {
        primaryContatctId: 0,
        emails: [],
        phoneNumbers: [],
        secondaryContactIds: [],
      },
    };
  }

  const existingContacts = await findContactsByEmailOrPhone(normalizedEmail, normalizedPhone);

  if (existingContacts.length === 0) {
    const newContact = await prisma.contact.create({
      data: {
        email: normalizedEmail,
        phoneNumber: normalizedPhone,
        linkPrecedence: 'primary',
      },
    });

    return {
      contact: {
        primaryContatctId: newContact.id,
        emails: normalizedEmail ? [normalizedEmail] : [],
        phoneNumbers: normalizedPhone ? [normalizedPhone] : [],
        secondaryContactIds: [],
      },
    };
  }

  let primaryContacts = existingContacts.filter(c => c.linkPrecedence === 'primary');
  
  if (primaryContacts.length === 0) {
    const secondaryContact = existingContacts.find(c => c.linkPrecedence === 'secondary');
    if (secondaryContact?.linkedId) {
      const primaryContact = await prisma.contact.findUnique({
        where: { id: secondaryContact.linkedId },
      });
      if (primaryContact) {
        primaryContacts = [primaryContact];
      }
    }
  }

  if (primaryContacts.length === 1) {
    const primaryContact = primaryContacts[0];
    
    const hasNewInfo = 
      (normalizedEmail && normalizedEmail !== primaryContact.email) ||
      (normalizedPhone && normalizedPhone !== primaryContact.phoneNumber);

    if (hasNewInfo) {
      await prisma.contact.create({
        data: {
          email: normalizedEmail,
          phoneNumber: normalizedPhone,
          linkedId: primaryContact.id,
          linkPrecedence: 'secondary',
        },
      });
    }

    const allContacts = await getAllLinkedContacts(primaryContact.id);
    return { contact: buildContactResponse(allContacts) };
  }

  const sortedPrimaries = primaryContacts.sort((a: any, b: any) => 
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
  const mainPrimary = sortedPrimaries[0];
  const otherPrimaries = sortedPrimaries.slice(1);

  for (const otherPrimary of otherPrimaries) {
    await prisma.contact.update({
      where: { id: otherPrimary.id },
      data: {
        linkPrecedence: 'secondary',
        linkedId: mainPrimary.id,
      },
    });

    const secondariesOfOther = await prisma.contact.findMany({
      where: { linkedId: otherPrimary.id, deletedAt: null },
    });

    for (const secondary of secondariesOfOther) {
      await prisma.contact.update({
        where: { id: secondary.id },
        data: { linkedId: mainPrimary.id },
      });
    }
  }

  await prisma.contact.create({
    data: {
      email: normalizedEmail,
      phoneNumber: normalizedPhone,
      linkedId: mainPrimary.id,
      linkPrecedence: 'secondary',
    },
  });

  const allContacts = await getAllLinkedContacts(mainPrimary.id);
  return { contact: buildContactResponse(allContacts) };
}

describe('Identity Reconciliation', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  test('should create new primary contact when no matches exist', async () => {
    const result = await identify('lorraine@hillvalley.edu', '123456');
    
    expect(result.contact.primaryContatctId).toBe(1);
    expect(result.contact.emails).toContain('lorraine@hillvalley.edu');
    expect(result.contact.phoneNumbers).toContain('123456');
    expect(result.contact.secondaryContactIds).toHaveLength(0);
  });

  test('should create secondary contact when partial match found', async () => {
    await createContact({
      phoneNumber: '123456',
      email: 'lorraine@hillvalley.edu',
      linkPrecedence: 'primary',
    });

    const result = await identify('mcfly@hillvalley.edu', '123456');
    
    expect(result.contact.primaryContatctId).toBe(1);
    expect(result.contact.emails).toContain('lorraine@hillvalley.edu');
    expect(result.contact.emails).toContain('mcfly@hillvalley.edu');
    expect(result.contact.phoneNumbers).toContain('123456');
    expect(result.contact.secondaryContactIds).toHaveLength(1);
  });

  test('should merge multiple primary contacts when linked', async () => {
    await createContact({
      phoneNumber: '919191',
      email: 'george@hillvalley.edu',
      linkPrecedence: 'primary',
    });

    await createContact({
      phoneNumber: '717171',
      email: 'biffsucks@hillvalley.edu',
      linkPrecedence: 'primary',
    });

    const result = await identify('george@hillvalley.edu', '717171');
    
    const contacts = await getAllContacts();
    const primaryContacts = contacts.filter(c => c.linkPrecedence === 'primary');
    
    expect(primaryContacts).toHaveLength(1);
    expect(result.contact.emails).toContain('george@hillvalley.edu');
    expect(result.contact.emails).toContain('biffsucks@hillvalley.edu');
    expect(result.contact.phoneNumbers).toContain('919191');
    expect(result.contact.phoneNumbers).toContain('717171');
    expect(result.contact.secondaryContactIds).toHaveLength(2);
  });

  test('should return same result for different queries within same contact group', async () => {
    await createContact({
      phoneNumber: '123456',
      email: 'lorraine@hillvalley.edu',
      linkPrecedence: 'primary',
    });

    await createContact({
      phoneNumber: '123456',
      email: 'mcfly@hillvalley.edu',
      linkedId: 1,
      linkPrecedence: 'secondary',
    });

    const result1 = await identify('mcfly@hillvalley.edu', '123456');
    const result2 = await identify(null, '123456');
    const result3 = await identify('lorraine@hillvalley.edu', null);
    const result4 = await identify('mcfly@hillvalley.edu', null);

    expect(result1.contact.primaryContatctId).toBe(1);
    expect(result2.contact.primaryContatctId).toBe(1);
    expect(result3.contact.primaryContatctId).toBe(1);
    expect(result4.contact.primaryContatctId).toBe(1);
    
    expect(result1.contact.emails).toEqual(['lorraine@hillvalley.edu', 'mcfly@hillvalley.edu']);
    expect(result2.contact.emails).toEqual(['lorraine@hillvalley.edu', 'mcfly@hillvalley.edu']);
    expect(result3.contact.emails).toEqual(['lorraine@hillvalley.edu', 'mcfly@hillvalley.edu']);
    expect(result4.contact.emails).toEqual(['lorraine@hillvalley.edu', 'mcfly@hillvalley.edu']);
  });

  test('should handle both email and phone being null', async () => {
    const result = await identify(null, null);
    
    expect(result.contact.primaryContatctId).toBe(0);
    expect(result.contact.emails).toHaveLength(0);
    expect(result.contact.phoneNumbers).toHaveLength(0);
    expect(result.contact.secondaryContactIds).toHaveLength(0);
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});
