import { useCallback, useState } from 'react';

const KEY = 'westock-admin-sidebar-collapsed-v1';

function read(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

function write(value: boolean): void {
  try {
    localStorage.setItem(KEY, value ? '1' : '0');
  } catch {
    // Remembering the choice is only a convenience.
  }
}

/** Whether the sidebar is collapsed to its icon rail, remembered between visits. */
export function useSidebarCollapsed(): [boolean, () => void] {
  const [collapsed, setCollapsed] = useState(read);
  const toggle = useCallback(() => {
    setCollapsed((current) => {
      write(!current);
      return !current;
    });
  }, []);
  return [collapsed, toggle];
}
