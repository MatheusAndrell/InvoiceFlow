import api from './client';

export interface Certificate {
  id: string;
  filename: string;
  createdAt: string;
}

export async function getCertificates(): Promise<Certificate[]> {
  const res = await api.get('/certificates');
  return res.data as Certificate[];
}

export async function uploadCertificate(file: File, password: string): Promise<Certificate> {
  const formData = new FormData();
  formData.append('certificate', file);
  formData.append('password', password);
  const res = await api.post('/certificates', formData);
  return res.data as Certificate;
}
