import styles from './LoginShowcase.module.css';

const MILK_BARS = [
  22.1, 22.8, 22.4, 23.0, 23.4, 23.1, 23.6, 24.0, 23.7, 24.3, 24.6, 24.4, 25.2, 24.3,
];
const HIGHLIGHT = 12;
const BAR_SCALE = 28;

function Icon({ d }: { d: string }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={d} />
    </svg>
  );
}

/** The decorative panel beside the sign-in form. Fixed sample figures, as in the design. */
export function LoginShowcase() {
  return (
    <section className={styles.wrap} aria-hidden="true">
      <div className={styles.panel}>
        <svg className={styles.rings} width="520" height="520" viewBox="0 0 520 520">
          <circle cx="260" cy="260" r="250" />
          <circle cx="260" cy="260" r="190" />
          <circle cx="260" cy="260" r="130" className={styles.ringGreen} />
          <circle cx="260" cy="260" r="70" />
        </svg>
        <div>
          <span className={styles.eyebrow}>Every WeSTOCK farm, in one place</span>
          <p className={styles.headline}>
            See and look after farmers’ records: farms, animals, milk, feed, health and breeding.
          </p>
        </div>
        <div className={styles.kpis}>
          <div className={styles.kpi}>
            <div className={styles.kpiHead}>
              <span className={styles.iconBox}>
                <Icon d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v1" />
              </span>
              <span className={styles.kpiLabel}>Farmers</span>
            </div>
            <span className={styles.big}>1,284</span>
            <span className={styles.note}>Registered in the app</span>
          </div>
          <div className={styles.kpi}>
            <div className={styles.kpiHead}>
              <span className={styles.iconBox}>
                <Icon d="M3 12V4h8l10 10-8 8L3 12zM7.5 7.5h.01" />
              </span>
              <span className={styles.kpiLabel}>Active animals</span>
            </div>
            <span className={styles.big}>18,960</span>
            <span className={styles.note}>On 1,412 farms</span>
          </div>
        </div>
        <div className={styles.chartCard}>
          <div className={styles.chartHead}>
            <span className={styles.chartLabel}>Milk collected per day</span>
            <span className={styles.chartRange}>last 14 days</span>
          </div>
          <div className={styles.chart}>
            <div className={styles.gridLines}>
              <div />
              <div />
              <div />
            </div>
            <div className={styles.bars}>
              {MILK_BARS.map((litres, index) => (
                <div key={index} className={styles.barSlot}>
                  <span
                    className={styles.bar}
                    data-highlight={index === HIGHLIGHT}
                    style={{ height: `${((litres / BAR_SCALE) * 100).toFixed(1)}%` }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className={styles.floating}>
          <span className={`${styles.iconBox} ${styles.iconPink}`}>
            <Icon d="M12 7v5l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z" />
          </span>
          <span className={styles.floatingText}>
            <span className={styles.floatingTitle}>Golden periods ending soon</span>
            <span className={styles.note}>Within the next 6 hours</span>
          </span>
          <span className={styles.floatingValue}>23</span>
        </div>
      </div>
    </section>
  );
}
