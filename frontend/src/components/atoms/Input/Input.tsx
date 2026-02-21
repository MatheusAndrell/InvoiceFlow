import styles from './Input.module.css';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export default function Input({ className, ...rest }: InputProps) {
  return (
    <input className={`${styles.input} ${className ?? ''}`} {...rest} />
  );
}
