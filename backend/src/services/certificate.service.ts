import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import forge from 'node-forge';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();
const UPLOADS_DIR = process.env.UPLOADS_DIR || '/app/uploads';

const ALGORITHM = 'aes-256-cbc';

function getEncryptionKey(): Buffer {
  const secret = process.env.ENCRYPTION_SECRET as string;
  return crypto.createHash('sha256').update(secret).digest();
}

function encryptPassword(password: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(password, 'utf8'), cipher.final()]);
  return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptPassword(encryptedPassword: string): string {
  const key = getEncryptionKey();
  const [ivHex, encryptedHex] = encryptedPassword.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const encryptedText = Buffer.from(encryptedHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  const decrypted = Buffer.concat([decipher.update(encryptedText), decipher.final()]);
  return decrypted.toString('utf8');
}

function validatePfx(filename: string, password: string): void {
  const certPath = path.join(UPLOADS_DIR, filename);
  const pfxBuffer = fs.readFileSync(certPath);
  const pfxB64 = pfxBuffer.toString('binary');

  try {
    const p12Asn1 = forge.asn1.fromDer(pfxB64);
    forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);
  } catch {
    // Remove the uploaded file since the password is wrong
    fs.unlinkSync(certPath);
    throw new Error('Invalid certificate password or corrupted PFX file');
  }
}

export class CertificateService {
  async upload(userId: string, filename: string, password: string) {
    // Validate that the password actually opens the PFX before saving
    validatePfx(filename, password);

    const encryptedPassword = encryptPassword(password);

    const certificate = await prisma.certificate.create({
      data: {
        userId,
        filename,
        encryptedPassword,
      },
    });

    return {
      id: certificate.id,
      filename: certificate.filename,
      createdAt: certificate.createdAt,
    };
  }

  async listByUser(userId: string) {
    return prisma.certificate.findMany({
      where: { userId },
      select: {
        id: true,
        filename: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getLatestByUser(userId: string) {
    return prisma.certificate.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
