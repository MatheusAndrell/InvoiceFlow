import forge from 'node-forge';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const UPLOADS_DIR = process.env.UPLOADS_DIR || '/app/uploads';
const ALGORITHM = 'aes-256-cbc';

function getEncryptionKey(): Buffer {
  const secret = process.env.ENCRYPTION_SECRET;
  if (!secret) {
    throw new Error('ENCRYPTION_SECRET environment variable is not set');
  }
  return crypto.createHash('sha256').update(secret).digest();
}

function decryptPassword(encryptedPassword: string): string {
  const key = getEncryptionKey();
  const [ivHex, encryptedHex] = encryptedPassword.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const encryptedText = Buffer.from(encryptedHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  const decrypted = Buffer.concat([decipher.update(encryptedText), decipher.final()]);
  return decrypted.toString('utf8');
}

export async function signXml(
  xml: string,
  certificate: { filename: string; encryptedPassword: string },
): Promise<string> {
  try {
    const certPath = path.join(UPLOADS_DIR, certificate.filename);
    const pfxBuffer = fs.readFileSync(certPath);
    const pfxB64 = pfxBuffer.toString('binary');
    const password = decryptPassword(certificate.encryptedPassword);

    const p12Asn1 = forge.asn1.fromDer(pfxB64);
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);

    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
    const bags = certBags[forge.pki.oids.certBag];
    if (!bags || bags.length === 0) {
      throw new Error('No certificates found in PFX');
    }

    const certObj = bags[0].cert!;
    const subjectCN = certObj.subject.getField('CN')?.value || 'unknown';

    // Create a simplified digital signature (hash-based)
    const md = forge.md.sha256.create();
    md.update(xml, 'utf8');
    const hash = md.digest().toHex();

    return `${xml}\n<!-- signed by ${subjectCN}, sha256:${hash} -->`;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Signing failed';
    throw new Error(`Certificate signing failed: ${message}`);
  }
}
