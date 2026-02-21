import { useState, useEffect } from 'react';
import { getCertificates, uploadCertificate, type Certificate } from '../api/certificates';
import DashboardLayout from '../components/templates/DashboardLayout/DashboardLayout';
import CertificateUploadForm from '../components/organisms/CertificateUploadForm/CertificateUploadForm';
import CertificateList from '../components/organisms/CertificateList/CertificateList';

export default function CertificatePage() {
  const [certificates, setCertificates] = useState<Certificate[]>([]);

  useEffect(() => {
    getCertificates().then(setCertificates).catch(console.error);
  }, []);

  async function handleUpload(file: File, password: string) {
    const cert = await uploadCertificate(file, password);
    setCertificates((prev) => [cert, ...prev]);
  }

  return (
    <DashboardLayout nav={[{ label: 'Dashboard', to: '/' }]}>
      <CertificateUploadForm onUpload={handleUpload} />
      <CertificateList certificates={certificates} />
    </DashboardLayout>
  );
}
