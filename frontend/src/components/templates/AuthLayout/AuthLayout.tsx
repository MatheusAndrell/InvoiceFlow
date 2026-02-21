import Logo from '../../atoms/Logo/Logo';
import styles from './AuthLayout.module.css';

interface AuthLayoutProps {
  subtitle?: string;
  children: React.ReactNode;
}

export default function AuthLayout({ subtitle, children }: AuthLayoutProps) {
  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <Logo size="lg" />
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        {children}
      </div>
    </div>
  );
}
