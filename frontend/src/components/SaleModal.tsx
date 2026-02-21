import type { Sale } from '../api/sales';
import styles from './SaleModal.module.css';

interface SaleModalProps {
  sale: Sale;
  onClose: () => void;
}

export default function SaleModal({ sale, onClose }: SaleModalProps) {
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3>Sale Details</h3>
          <button onClick={onClose} className={styles.closeBtn} aria-label="Close">✕</button>
        </div>

        <div className={styles.body}>
          <div className={styles.row}>
            <span className={styles.label}>ID</span>
            <span className={styles.value}>{sale.id}</span>
          </div>
          <div className={styles.row}>
            <span className={styles.label}>Description</span>
            <span className={styles.value}>{sale.description}</span>
          </div>
          <div className={styles.row}>
            <span className={styles.label}>Amount</span>
            <span className={styles.value}>R$ {sale.amount.toFixed(2)}</span>
          </div>
          <div className={styles.row}>
            <span className={styles.label}>Date</span>
            <span className={styles.value}>{new Date(sale.createdAt).toLocaleString()}</span>
          </div>
          <div className={styles.row}>
            <span className={styles.label}>Status</span>
            <span className={`${styles.value} ${styles[`status${sale.status}`]}`}>
              {sale.status}
            </span>
          </div>

          {sale.status === 'SUCCESS' && sale.protocol && (
            <div className={styles.protocolBox}>
              <span className={styles.label}>Protocol</span>
              <code className={styles.protocol}>{sale.protocol}</code>
            </div>
          )}

          {sale.status === 'ERROR' && sale.errorMsg && (
            <div className={styles.errorBox}>
              <span className={styles.label}>Error</span>
              <p className={styles.errorMsg}>{sale.errorMsg}</p>
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <button onClick={onClose} className={styles.closeButton}>Close</button>
        </div>
      </div>
    </div>
  );
}
