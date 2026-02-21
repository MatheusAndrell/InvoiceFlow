import styles from './FeedbackMessage.module.css';

interface FeedbackMessageProps {
  type: 'error' | 'success';
  message: string;
}

export default function FeedbackMessage({ type, message }: FeedbackMessageProps) {
  if (!message) return null;

  return (
    <p className={`${styles.message} ${styles[type]}`}>{message}</p>
  );
}
