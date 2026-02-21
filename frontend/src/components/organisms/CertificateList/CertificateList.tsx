import type { Certificate } from '../../../api/certificates';
import CertificateItem from '../../molecules/CertificateItem/CertificateItem';
import styles from './CertificateList.module.css';

interface CertificateListProps {
  certificates: Certificate[];
}

export default function CertificateList({ certificates }: CertificateListProps) {
  return (
    <section className={styles.card}>
      <h2>Uploaded Certificates</h2>
      {certificates.length === 0 ? (
        <p className={styles.empty}>No certificates uploaded yet.</p>
      ) : (
        <ul className={styles.list}>
          {certificates.map((cert) => (
            <CertificateItem key={cert.id} certificate={cert} />
          ))}
        </ul>
      )}
    </section>
  );
}
