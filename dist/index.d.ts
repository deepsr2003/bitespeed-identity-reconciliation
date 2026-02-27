import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
declare const app: import("express-serve-static-core").Express;
declare const prisma: PrismaClient<import(".prisma/client").Prisma.PrismaClientOptions, never, import("@prisma/client/runtime/library").DefaultArgs>;
interface ContactResponse {
    primaryContatctId: number;
    emails: string[];
    phoneNumbers: string[];
    secondaryContactIds: number[];
}
interface ConsolidatedContact {
    contact: ContactResponse;
}
declare function identify(req: Request, res: Response<ConsolidatedContact>): Promise<express.Response<ConsolidatedContact, Record<string, any>>>;
export { app, prisma, identify };
//# sourceMappingURL=index.d.ts.map