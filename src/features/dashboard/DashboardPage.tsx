import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CAN_ADMINISTER, RoleGate, useHasRole } from '../../app/RoleGate';
import { Button, buttonClass } from '../../components/Button';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { errorMessage } from '../../lib/errors';
import { useUrlState } from '../../lib/url-state';
import { useStaff } from '../auth/queries';
import { InviteStaffDialog } from '../staff/InviteStaffDialog';
import {
  FarmersByLanguage,
  FarmsNeedingAttention,
  HerdBySpecies,
  MilkPerDay,
  NeedsAttention,
  PeriodTotals,
  RecentStaffChanges,
  Totals,
} from './DashboardSections';
import { firstName, greeting, parseIssue, parsePeriod } from './helpers';
import { useDashboardOverview } from './queries';
import styles from './DashboardPage.module.css';

export function DashboardPage() {
  const [values, setValues] = useUrlState({ days: '30', issue: 'all' });
  const days = parsePeriod(values.days);
  const issue = parseIssue(values.issue);
  const [inviting, setInviting] = useState(false);
  const canInvite = useHasRole(CAN_ADMINISTER);
  const name = firstName(useStaff()?.full_name);

  const overview = useDashboardOverview(days);
  const data = overview.data;
  const failed = overview.isError && !data;

  return (
    <>
      <header className={styles.head}>
        <div>
          <span className={styles.eyebrow}>{greeting()}</span>
          <h1 className={styles.title}>
            {name ? `${name}, here is every farm` : 'Here is every farm'}
          </h1>
          <p className={styles.sub}>
            Today at a glance, and how the last {days} days have gone across WeSTOCK.
          </p>
        </div>
        <div className={styles.actions}>
          <Link to="/analytics" className={buttonClass('secondary')}>
            Analytics
          </Link>
          <RoleGate allow={CAN_ADMINISTER}>
            <Button variant="primary" onClick={() => setInviting(true)}>
              Invite staff
            </Button>
          </RoleGate>
        </div>
      </header>

      {failed ? (
        <Card>
          <EmptyState
            title="The dashboard couldn’t load"
            note={errorMessage(overview.error)}
            actionLabel="Try again"
            onAction={() => void overview.refetch()}
          />
        </Card>
      ) : (
        <>
          <Totals data={data} />
          <PeriodTotals
            days={days}
            onDaysChange={(next) => setValues({ days: String(next) })}
            data={data}
          />
          <MilkPerDay data={data} />
          <div className={styles.split}>
            <NeedsAttention data={data} />
            <HerdBySpecies data={data} />
          </div>
          <FarmsNeedingAttention
            data={data}
            failed={failed}
            onRetry={() => void overview.refetch()}
            issue={issue}
            onIssueChange={(next) => setValues({ issue: next })}
          />
          <div className={styles.splitWide}>
            <RecentStaffChanges data={data} />
            <FarmersByLanguage data={data} />
          </div>
        </>
      )}

      {inviting && canInvite && <InviteStaffDialog onClose={() => setInviting(false)} />}
    </>
  );
}
