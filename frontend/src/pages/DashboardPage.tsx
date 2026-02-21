import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getSales, createSale, type Sale } from '../api/sales';
import { useAuth } from '../hooks/useAuth';
import SaleModal from '../components/SaleModal';
import styles from './DashboardPage.module.css';

const POLL_INTERVAL = 5000;

export default function DashboardPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [formError, setFormError] = useState('');
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const { logout } = useAuth();
  const navigate = useNavigate();

  const fetchSales = useCallback(async () => {
    try {
      const data = await getSales();
      setSales(data);
    } catch {
      // silently fail on polling
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSales();
    const interval = setInterval(fetchSales, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchSales]);

  async function handleCreateSale(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setFormError('Amount must be a positive number');
      return;
    }
    if (!description.trim()) {
      setFormError('Description is required');
      return;
    }
    setCreating(true);
    try {
      const sale = await createSale({ amount: amountNum, description });
      setSales((prev) => [sale, ...prev]);
      setAmount('');
      setDescription('');
    } catch {
      setFormError('Failed to create sale. Please try again.');
    } finally {
      setCreating(false);
    }
  }

  function handleLogout() {
    logout();
    navigate('/login');
  }

  function getStatusBadge(status: Sale['status']) {
    const classes: Record<Sale['status'], string> = {
      PROCESSING: styles.badgeProcessing,
      SUCCESS: styles.badgeSuccess,
      ERROR: styles.badgeError,
    };
    return <span className={`${styles.badge} ${classes[status]}`}>{status}</span>;
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.logo}>InvoiceFlow</h1>
        <nav className={styles.nav}>
          <Link to="/certificates">Certificates</Link>
          <button onClick={handleLogout} className={styles.logoutBtn}>Logout</button>
        </nav>
      </header>

      <main className={styles.main}>
        <section className={styles.formSection}>
          <h2>New Sale</h2>
          <form onSubmit={handleCreateSale} className={styles.saleForm}>
            <input
              type="number"
              step="0.01"
              min="0.01"
              placeholder="Amount (R$)"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              className={styles.input}
            />
            <input
              type="text"
              placeholder="Service description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              className={styles.input}
            />
            {formError && <p className={styles.error}>{formError}</p>}
            <button type="submit" disabled={creating} className={styles.button}>
              {creating ? 'Submitting...' : 'Submit NFS-e'}
            </button>
          </form>
        </section>

        <section className={styles.tableSection}>
          <div className={styles.tableHeader}>
            <h2>Sales</h2>
            <span className={styles.pollNote}>Auto-refreshing every 5s</span>
          </div>

          {loading ? (
            <p className={styles.loading}>Loading...</p>
          ) : sales.length === 0 ? (
            <p className={styles.empty}>No sales yet. Create one above.</p>
          ) : (
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map((sale) => (
                    <tr key={sale.id}>
                      <td>{new Date(sale.createdAt).toLocaleString()}</td>
                      <td>{sale.description}</td>
                      <td>R$ {sale.amount.toFixed(2)}</td>
                      <td>{getStatusBadge(sale.status)}</td>
                      <td>
                        <button
                          onClick={() => setSelectedSale(sale)}
                          className={styles.detailsBtn}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      {selectedSale && (
        <SaleModal sale={selectedSale} onClose={() => setSelectedSale(null)} />
      )}
    </div>
  );
}
