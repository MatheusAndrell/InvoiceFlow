import styles from './Logo.module.css';

interface LogoProps {
  size?: 'sm' | 'lg';
}

export default function Logo({ size = 'sm' }: LogoProps) {
  return (
    <h1 className={`${styles.logo} ${styles[size]}`}>InvoiceFlow</h1>
  );
}
