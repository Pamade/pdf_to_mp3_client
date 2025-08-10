import styles from './TextDisplay.module.scss';

interface TextDisplayProps {
  text: string;
}

export const TextDisplay = ({ text }: TextDisplayProps) => {
  return (
    <div className={styles.container}>
      <pre className={styles.text}>{text}</pre>
    </div>
  );
};

export default TextDisplay; 