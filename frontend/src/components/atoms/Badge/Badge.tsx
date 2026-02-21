import styles from './Badge.module.css';

type BadgeStatus = 'PROCESSING' | 'SUCCESS' | 'ERROR';

interface BadgeProps {
  status: BadgeStatus;
}

const statusClass: Record<BadgeStatus, string> = {
  PROCESSING: styles.processing,
  SUCCESS: styles.success,
  ERROR: styles.error,
};

export default function Badge({ status }: BadgeProps) {
  return (
    <span className={`${styles.badge} ${statusClass[status]}`}>
      {status}
    </span>
  );
}
