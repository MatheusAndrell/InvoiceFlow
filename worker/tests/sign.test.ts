import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import forge from 'node-forge';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// ── Helpers to mimic backend encryption ─────────────────────
const ALGORITHM = 'aes-256-cbc';
const ENCRYPTION_SECRET = 'test-secret-for-unit-tests';

function getKey(): Buffer {
  return crypto.createHash('sha256').update(ENCRYPTION_SECRET).digest();
}

function encryptPassword(password: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(password, 'utf8'), cipher.final()]);
  return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
}

// ── Generate a self-signed PFX for tests ────────────────────
function generateTestPfx(password: string): Buffer {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notAfter.getFullYear() + 1);

  const attrs = [{ name: 'commonName', value: 'Test CN' }];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(keys.privateKey, forge.md.sha256.create());

  const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, cert, password, {
    algorithm: '3des',
  });
  const p12Der = forge.asn1.toDer(p12Asn1).getBytes();
  return Buffer.from(p12Der, 'binary');
}

// ── Test setup ──────────────────────────────────────────────
const TMP_DIR = path.join(__dirname, '__tmp_certs__');
const PFX_FILENAME = 'test.pfx';
const CORRECT_PASSWORD = 'senha-correta';
const WRONG_PASSWORD = 'senha-errada';

beforeAll(() => {
  fs.mkdirSync(TMP_DIR, { recursive: true });
  const pfx = generateTestPfx(CORRECT_PASSWORD);
  fs.writeFileSync(path.join(TMP_DIR, PFX_FILENAME), pfx);

  // Set env vars so signXml can find the PFX and decrypt the password
  process.env.UPLOADS_DIR = TMP_DIR;
  process.env.ENCRYPTION_SECRET = ENCRYPTION_SECRET;
});

afterAll(() => {
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
  delete process.env.UPLOADS_DIR;
  delete process.env.ENCRYPTION_SECRET;
});

// ── Import AFTER env vars are set ───────────────────────────
// (dynamic import so UPLOADS_DIR / ENCRYPTION_SECRET are available)
async function getSignXml() {
  const mod = await import('../src/crypto/sign');
  return mod.signXml;
}

describe('signXml – password mismatch', () => {
  it('should sign correctly with the right password', async () => {
    const signXml = await getSignXml();
    const xml = '<NFS-e><test/></NFS-e>';
    const encrypted = encryptPassword(CORRECT_PASSWORD);

    const result = await signXml(xml, {
      filename: PFX_FILENAME,
      encryptedPassword: encrypted,
    });

    expect(result).toContain('signed by Test CN');
    expect(result).toContain('sha256:');
    expect(result).not.toContain('mock-signed');
  });

  it('should throw error with wrong password', async () => {
    const signXml = await getSignXml();
    const xml = '<NFS-e><test/></NFS-e>';
    const encrypted = encryptPassword(WRONG_PASSWORD);

    await expect(
      signXml(xml, {
        filename: PFX_FILENAME,
        encryptedPassword: encrypted,
      }),
    ).rejects.toThrow('Certificate signing failed');
  });

  it('should throw error when PFX file does not exist', async () => {
    const signXml = await getSignXml();
    const xml = '<NFS-e><test/></NFS-e>';
    const encrypted = encryptPassword('qualquer');

    await expect(
      signXml(xml, {
        filename: 'nao-existe.pfx',
        encryptedPassword: encrypted,
      }),
    ).rejects.toThrow('Certificate signing failed');
  });
});
