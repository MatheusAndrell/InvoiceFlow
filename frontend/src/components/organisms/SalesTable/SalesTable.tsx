import type { Sale } from '../../../api/sales';
import Badge from '../../atoms/Badge/Badge';
import Button from '../../atoms/Button/Button';
import StatusIndicator from '../../molecules/StatusIndicator/StatusIndicator';
import styles from './SalesTable.module.css';

interface SalesTableProps {
  sales: Sale[];
  loading: boolean;
  live: boolean;
  onViewDetails: (sale: Sale) => void;
}

export default function SalesTable({ sales, loading, live, onViewDetails }: SalesTableProps) {
  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <h2>Sales</h2>
        <StatusIndicator live={live} />
      </div>

      {loading ? (
        <p className={styles.placeholder}>Loading...</p>
      ) : sales.length === 0 ? (
        <p className={styles.placeholder}>No sales yet. Create one above.</p>
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
                  <td><Badge status={sale.status} /></td>
                  <td>
                    <Button variant="outline" onClick={() => onViewDetails(sale)}>
                      View
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
