import type { KpiTone } from '../../components/KpiCard';
import type { Overview } from '../../data/types';

export type AttentionKey = keyof Overview['needs_attention'];

export interface AttentionGroup {
  key: AttentionKey;
  title: string;
  note: string;
  /** The screen, filtered to these records. */
  to: string;
  icon: string;
  tone: KpiTone;
}

export const ATTENTION_ICONS = {
  clock: 'M12 7v5l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z',
  vaccine: 'M18 2l4 4M15 5l4 4M7 13l4 4M4 20l3-3M8 10l6 6 5-5-6-6z',
  health: 'M9 3h6v6h6v6h-6v6H9v-6H3V9h6z',
  heart: 'M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.5-7 10-7 10z',
  noMilk: 'M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11zM4 4l16 16',
};

/**
 * The five "needs attention" groups, shared by the Dashboard and the alerts bell so both open the
 * same filtered screens. Notes the Overview has no figures for say "Across all farms".
 */
export const ATTENTION_GROUPS: readonly AttentionGroup[] = [
  {
    key: 'golden_ending_6h',
    title: 'Golden periods ending soon',
    note: 'Best time to inseminate ends within 6 hours',
    to: '/reproduction',
    icon: ATTENTION_ICONS.clock,
    tone: 'pink',
  },
  {
    key: 'vaccines_overdue',
    title: 'Vaccines overdue',
    note: 'Across all farms',
    to: '/health',
    icon: ATTENTION_ICONS.vaccine,
    tone: 'blue',
  },
  {
    key: 'animals_sick',
    title: 'Animals marked sick',
    note: 'Across all farms',
    to: '/health?tab=issues',
    icon: ATTENTION_ICONS.health,
    tone: 'red',
  },
  {
    key: 'may_deliver_7d',
    title: 'May deliver this week',
    note: 'Pregnant, due in 7 days or less',
    to: '/reproduction?stage=pregnant',
    icon: ATTENTION_ICONS.heart,
    tone: 'pink',
  },
  {
    key: 'farms_quiet_3d',
    title: 'Farms not logging milk',
    note: 'No milk entry for 3 or more days',
    to: '/farmers?view=farms',
    icon: ATTENTION_ICONS.noMilk,
    tone: 'amber',
  },
];
