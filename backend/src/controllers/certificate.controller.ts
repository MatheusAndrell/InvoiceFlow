import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import { CertificateService } from '../services/certificate.service';

const certificateService = new CertificateService();

export async function uploadCertificate(req: AuthRequest, res: Response): Promise<void> {
  if (!req.file) {
    res.status(400).json({ error: 'Certificate file required' });
    return;
  }

  const { password } = req.body;
  if (!password) {
    res.status(400).json({ error: 'Certificate password required' });
    return;
  }

  try {
    const certificate = await certificateService.upload(req.userId!, req.file.filename, password);
    res.status(201).json(certificate);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed';
    res.status(400).json({ error: message });
  }
}

export async function getCertificates(req: AuthRequest, res: Response): Promise<void> {
  try {
    const certs = await certificateService.listByUser(req.userId!);
    res.json(certs);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to list certificates';
    res.status(500).json({ error: message });
  }
}
