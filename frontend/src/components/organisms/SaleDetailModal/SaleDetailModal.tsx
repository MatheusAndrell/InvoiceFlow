import type { Sale } from '../../../api/sales';
import Modal from '../../molecules/Modal/Modal';
import Button from '../../atoms/Button/Button';
import styles from './SaleDetailModal.module.css';

interface SaleDetailModalProps {
  sale: Sale;
  onClose: () => void;
}

export default function SaleDetailModal({ sale, onClose }: SaleDetailModalProps) {
  return (
    <Modal
      title="Sale Details"
      onClose={onClose}
      footer={<Button variant="ghost" onClick={onClose}>Close</Button>}
    >
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
    </Modal>
  );
}
