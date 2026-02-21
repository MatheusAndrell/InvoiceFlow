import { Link } from 'react-router-dom';
import Logo from '../../atoms/Logo/Logo';
import Button from '../../atoms/Button/Button';
import styles from './AppHeader.module.css';

interface NavItem {
  label: string;
  to: string;
}

interface AppHeaderProps {
  nav: NavItem[];
  onLogout?: () => void;
}

export default function AppHeader({ nav, onLogout }: AppHeaderProps) {
  return (
    <header className={styles.header}>
      <Logo size="sm" />
      <nav className={styles.nav}>
        {nav.map((item) => (
          <Link key={item.to} to={item.to}>
            {item.label}
          </Link>
        ))}
        {onLogout && (
          <Button variant="outline" onClick={onLogout}>
            Logout
          </Button>
        )}
      </nav>
    </header>
  );
}
