export const ICONS = {
  person: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  pin: 'M12 21s7-6 7-11a7 7 0 0 0-14 0c0 5 7 11 7 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  language: 'M4 5h9M8.5 3v2M6 5c1 4 4 7 7 8M11 5c-1 4-4 7-7 8M13 21l4-9 4 9M14.5 18h5',
  plus: 'M12 5v14M5 12h14',
  tag: 'M3 12V4h8l10 10-8 8L3 12zM7.5 7.5h.01',
  milk: 'M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z',
  heart: 'M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.5-7 10-7 10z',
  vaccine: 'M18 2l4 4M15 5l4 4M7 13l4 4M4 20l3-3M8 10l6 6 5-5-6-6z',
  health: 'M9 3h6v6h6v6h-6v6H9v-6H3V9h6z',
  people:
    'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v1M16 3.5a4 4 0 0 1 0 7.5M22 21v-1a6 6 0 0 0-4-5.6',
  open: 'M7 17L17 7M9 7h8v8',
  download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  collar: 'M5 12a7 7 0 0 1 14 0M8.5 12a3.5 3.5 0 0 1 7 0M12 12v8',
  thermometer: 'M14 14.8V4a2 2 0 0 0-4 0v10.8a4 4 0 1 0 4 0z',
  noSignal:
    'M2 8.8a15 15 0 0 1 4-2.5M22 8.8a15 15 0 0 0-9-3.7M5 12.5a10 10 0 0 1 3-1.8M19 12.5a10 10 0 0 0-3.5-2M8.5 16a5 5 0 0 1 7 0M12 20h.01M3 3l18 18',
  pencil: 'M4 20h4L19 9l-4-4L4 16z',
  calendar: 'M4 6h16v14H4zM4 10h16M9 3v4M15 3v4',
  calendarCheck: 'M4 6h16v14H4zM4 10h16M9 3v4M15 3v4M9 15l2 2 4-4',
  flame: 'M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-3 2-4 2-7 2 1 3 3 3 5',
};

export function Icon({ d, size = 18 }: { d: string; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={size < 16 ? 1.9 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={d} />
    </svg>
  );
}
