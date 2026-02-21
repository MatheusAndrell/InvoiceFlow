import styles from './FormField.module.css';

interface FormFieldProps {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}

export default function FormField({ label, htmlFor, children }: FormFieldProps) {
  return (
    <div className={styles.field}>
      <label htmlFor={htmlFor}>{label}</label>
      {children}
    </div>
  );
}
