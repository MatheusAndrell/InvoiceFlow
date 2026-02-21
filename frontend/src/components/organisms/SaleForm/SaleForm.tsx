import { useState } from 'react';
import Input from '../../atoms/Input/Input';
import Button from '../../atoms/Button/Button';
import FeedbackMessage from '../../atoms/FeedbackMessage/FeedbackMessage';
import styles from './SaleForm.module.css';

interface SaleFormProps {
  onSubmit: (data: { amount: number; description: string }) => Promise<void>;
}

export default function SaleForm({ onSubmit }: SaleFormProps) {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Amount must be a positive number');
      return;
    }
    if (!description.trim()) {
      setError('Description is required');
      return;
    }

    setCreating(true);
    try {
      await onSubmit({ amount: amountNum, description });
      setAmount('');
      setDescription('');
    } catch {
      setError('Failed to create sale. Please try again.');
    } finally {
      setCreating(false);
    }
  }

  return (
    <section className={styles.section}>
      <h2>New Sale</h2>
      <form onSubmit={handleSubmit} className={styles.form}>
        <Input
          type="number"
          step="0.01"
          min="0.01"
          placeholder="Amount (R$)"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
        <Input
          type="text"
          placeholder="Service description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
        />
        {error && <FeedbackMessage type="error" message={error} />}
        <Button type="submit" loading={creating}>
          {creating ? 'Submitting...' : 'Submit NFS-e'}
        </Button>
      </form>
    </section>
  );
}
