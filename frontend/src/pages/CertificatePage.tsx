import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getCertificates, uploadCertificate, type Certificate } from '../api/certificates';
import styles from './CertificatePage.module.css';

export default function CertificatePage() {
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    getCertificates().then(setCertificates).catch(console.error);
  }, []);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!file) {
      setError('Please select a .pfx or .p12 file');
      return;
    }
    if (!password) {
      setError('Certificate password is required');
      return;
    }
    setUploading(true);
    try {
      const cert = await uploadCertificate(file, password);
      setCertificates((prev) => [cert, ...prev]);
      setFile(null);
      setPassword('');
      setSuccess('Certificate uploaded successfully!');
    } catch {
      setError('Upload failed. Check your file and password.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.logo}>InvoiceFlow</h1>
        <nav className={styles.nav}>
          <Link to="/">Dashboard</Link>
        </nav>
      </header>

      <main className={styles.main}>
        <section className={styles.card}>
          <h2>Upload Digital Certificate</h2>
          <p className={styles.hint}>Upload your PFX/P12 digital certificate to sign invoices.</p>
          <form onSubmit={handleUpload} className={styles.form}>
            <div className={styles.field}>
              <label htmlFor="cert-file">Certificate File (.pfx / .p12)</label>
              <input
                id="cert-file"
                type="file"
                accept=".pfx,.p12"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                required
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="cert-password">Certificate Password</label>
              <input
                id="cert-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter certificate password"
                required
                autoComplete="new-password"
              />
            </div>
            {error && <p className={styles.error}>{error}</p>}
            {success && <p className={styles.success}>{success}</p>}
            <button type="submit" disabled={uploading} className={styles.button}>
              {uploading ? 'Uploading...' : 'Upload Certificate'}
            </button>
          </form>
        </section>

        <section className={styles.card}>
          <h2>Uploaded Certificates</h2>
          {certificates.length === 0 ? (
            <p className={styles.empty}>No certificates uploaded yet.</p>
          ) : (
            <ul className={styles.certList}>
              {certificates.map((cert) => (
                <li key={cert.id} className={styles.certItem}>
                  <span className={styles.certIcon}>🔐</span>
                  <div>
                    <div className={styles.certName}>{cert.filename}</div>
                    <div className={styles.certDate}>
                      {new Date(cert.createdAt).toLocaleString()}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
