import type { Certificate } from '../../../api/certificates';
import styles from './CertificateItem.module.css';

interface CertificateItemProps {
  certificate: Certificate;
}

export default function CertificateItem({ certificate }: CertificateItemProps) {
  return (
    <li className={styles.item}>
      <span className={styles.icon}>🔐</span>
      <div>
        <div className={styles.name}>{certificate.filename}</div>
        <div className={styles.date}>
          {new Date(certificate.createdAt).toLocaleString()}
        </div>
      </div>
    </li>
  );
}
