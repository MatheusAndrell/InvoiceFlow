import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

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

export class CertificateService {
  async upload(userId: string, filePath: string, filename: string, password: string) {
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
