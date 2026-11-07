import styles from './Skeleton.module.css';

interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  radius?: number | string;
}

/** A grey placeholder bar while something loads. Hidden from screen readers. */
export function Skeleton({ width = '100%', height = 14, radius = 6 }: SkeletonProps) {
  return (
    <span
      className={styles.skeleton}
      style={{ width, height, borderRadius: radius }}
      aria-hidden="true"
    />
  );
}
