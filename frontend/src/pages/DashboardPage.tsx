import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSales, createSale, type Sale } from '../api/sales';
import { useAuth } from '../hooks/useAuth';
import DashboardLayout from '../components/templates/DashboardLayout/DashboardLayout';
import SaleForm from '../components/organisms/SaleForm/SaleForm';
import SalesTable from '../components/organisms/SalesTable/SalesTable';
import SaleDetailModal from '../components/organisms/SaleDetailModal/SaleDetailModal';

const TOKEN_KEY = 'invoiceflow_token';

export default function DashboardPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [live, setLive] = useState(false);
  const { logout } = useAuth();
  const navigate = useNavigate();
  const eventSourceRef = useRef<EventSource | null>(null);

  const fetchSales = useCallback(async () => {
    try {
      const data = await getSales();
      setSales(data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchSales();
  }, [fetchSales]);

  // SSE real-time updates
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;

    const baseUrl = import.meta.env.VITE_API_URL || '';
    const url = `${baseUrl}/sales/events?token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onopen = () => setLive(true);

    es.addEventListener('sale-update', (e) => {
      try {
        const updated: Sale = JSON.parse(e.data);
        setSales((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      } catch {
        // ignore parsing errors
      }
    });

    es.onerror = () => setLive(false);

    return () => {
      es.close();
      eventSourceRef.current = null;
      setLive(false);
    };
  }, []);

  async function handleCreateSale(data: { amount: number; description: string }) {
    const sale = await createSale(data);
    setSales((prev) => [sale, ...prev]);
  }

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <DashboardLayout
      nav={[{ label: 'Certificates', to: '/certificates' }]}
      onLogout={handleLogout}
    >
      <SaleForm onSubmit={handleCreateSale} />
      <SalesTable
        sales={sales}
        loading={loading}
        live={live}
        onViewDetails={setSelectedSale}
      />
      {selectedSale && (
        <SaleDetailModal sale={selectedSale} onClose={() => setSelectedSale(null)} />
      )}
    </DashboardLayout>
  );
}
