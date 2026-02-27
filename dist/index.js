"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = exports.app = void 0;
exports.identify = identify;
const express_1 = __importDefault(require("express"));
const client_1 = require("@prisma/client");
const app = (0, express_1.default)();
exports.app = app;
const prisma = new client_1.PrismaClient();
exports.prisma = prisma;
app.use(express_1.default.json());
async function findContactsByEmailOrPhone(email, phoneNumber) {
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
    }
    else if (email) {
        return prisma.contact.findMany({
            where: { email: email, deletedAt: null },
            orderBy: { createdAt: 'asc' },
        });
    }
    else if (phoneNumber) {
        return prisma.contact.findMany({
            where: { phoneNumber: phoneNumber, deletedAt: null },
            orderBy: { createdAt: 'asc' },
        });
    }
    return [];
}
async function getAllLinkedContacts(primaryId) {
    const primaryContact = await prisma.contact.findUnique({
        where: { id: primaryId },
    });
    if (!primaryContact)
        return [];
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
function buildContactResponse(contacts) {
    const primaryContact = contacts.find(c => c.linkPrecedence === 'primary') || contacts[0];
    const emails = contacts
        .map(c => c.email)
        .filter((e) => e !== null && e !== undefined);
    const phoneNumbers = contacts
        .map(c => c.phoneNumber)
        .filter((p) => p !== null && p !== undefined);
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
async function identify(req, res) {
    try {
        const { email, phoneNumber } = req.body;
        const normalizedEmail = email?.trim() || null;
        const normalizedPhone = phoneNumber?.trim() || null;
        if (!normalizedEmail && !normalizedPhone) {
            return res.status(400).json({
                contact: {
                    primaryContatctId: 0,
                    emails: [],
                    phoneNumbers: [],
                    secondaryContactIds: [],
                },
            });
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
            return res.json({
                contact: {
                    primaryContatctId: newContact.id,
                    emails: normalizedEmail ? [normalizedEmail] : [],
                    phoneNumbers: normalizedPhone ? [normalizedPhone] : [],
                    secondaryContactIds: [],
                },
            });
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
            const hasNewInfo = (normalizedEmail && normalizedEmail !== primaryContact.email) ||
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
            return res.json({ contact: buildContactResponse(allContacts) });
        }
        const sortedPrimaries = primaryContacts.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
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
        return res.json({ contact: buildContactResponse(allContacts) });
    }
    catch (error) {
        console.error('Error in identify:', error);
        return res.status(500).json({
            contact: {
                primaryContatctId: 0,
                emails: [],
                phoneNumbers: [],
                secondaryContactIds: [],
            },
        });
    }
}
app.post('/identify', identify);
app.get('/', (req, res) => {
    res.send('Bitespeed Identity Reconciliation API - Use POST /identify');
});
app.get('/identify', (req, res) => {
    res.send('Bitespeed Identity Reconciliation API - Use POST /identify with email/phoneNumber');
});
const PORT = process.env.PORT || 3000;
async function main() {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}
main()
    .catch(console.error)
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=index.js.map