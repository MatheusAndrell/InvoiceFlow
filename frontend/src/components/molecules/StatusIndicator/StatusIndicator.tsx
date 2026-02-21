import styles from './StatusIndicator.module.css';

interface StatusIndicatorProps {
  live: boolean;
}

export default function StatusIndicator({ live }: StatusIndicatorProps) {
  return (
    <span className={styles.indicator}>
      {live ? '🟢 Live updates' : '⏳ Connecting...'}
    </span>
  );
}
