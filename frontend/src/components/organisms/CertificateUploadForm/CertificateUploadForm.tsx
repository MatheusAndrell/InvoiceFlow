import { useState, useRef } from 'react';
import Input from '../../atoms/Input/Input';
import Button from '../../atoms/Button/Button';
import FeedbackMessage from '../../atoms/FeedbackMessage/FeedbackMessage';
import FormField from '../../molecules/FormField/FormField';
import styles from './CertificateUploadForm.module.css';

interface CertificateUploadFormProps {
  onUpload: (file: File, password: string) => Promise<void>;
}

export default function CertificateUploadForm({ onUpload }: CertificateUploadFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
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
      await onUpload(file, password);
      setFile(null);
      setPassword('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      setSuccess('Certificate uploaded successfully!');
    } catch {
      setError('Upload failed. Check your file and password.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <section className={styles.card}>
      <h2>Upload Digital Certificate</h2>
      <p className={styles.hint}>Upload your PFX/P12 digital certificate to sign invoices.</p>
      <form onSubmit={handleSubmit} className={styles.form}>
        <FormField label="Certificate File (.pfx / .p12)" htmlFor="cert-file">
          <input
            id="cert-file"
            ref={fileInputRef}
            type="file"
            accept=".pfx,.p12"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            required
          />
        </FormField>
        <FormField label="Certificate Password" htmlFor="cert-password">
          <Input
            id="cert-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter certificate password"
            required
            autoComplete="new-password"
          />
        </FormField>
        {error && <FeedbackMessage type="error" message={error} />}
        {success && <FeedbackMessage type="success" message={success} />}
        <Button type="submit" loading={uploading}>
          {uploading ? 'Uploading...' : 'Upload Certificate'}
        </Button>
      </form>
    </section>
  );
}
