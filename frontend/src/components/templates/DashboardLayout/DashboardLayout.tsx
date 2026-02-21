import AppHeader from '../../organisms/AppHeader/AppHeader';
import styles from './DashboardLayout.module.css';

interface NavItem {
  label: string;
  to: string;
}

interface DashboardLayoutProps {
  nav: NavItem[];
  onLogout?: () => void;
  children: React.ReactNode;
}

export default function DashboardLayout({ nav, onLogout, children }: DashboardLayoutProps) {
  return (
    <div className={styles.container}>
      <AppHeader nav={nav} onLogout={onLogout} />
      <main className={styles.main}>{children}</main>
    </div>
  );
}
