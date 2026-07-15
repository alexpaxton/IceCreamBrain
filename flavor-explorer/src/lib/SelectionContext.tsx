import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

interface SelectionContextValue {
  selectedIds: string[];
  toggleSelection: (id: string) => void;
  selectSingle: (id: string) => void;
  clearSelection: () => void;
}

interface Props {
  children: ReactNode;
}

const SelectionContext = createContext<SelectionContextValue | null>(null);

export function SelectionProvider({ children }: Props) {
  const [selectedIds, setSelectedIds] = useState<string[]>(getInitialSelectedIds);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (selectedIds.length > 0) {
      url.searchParams.set('i', selectedIds.join(','));
    } else {
      url.searchParams.delete('i');
    }
    history.replaceState(null, '', url);
  }, [selectedIds]);

  function toggleSelection(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function selectSingle(id: string) {
    setSelectedIds([id]);
  }

  function clearSelection() {
    setSelectedIds([]);
  }

  const value: SelectionContextValue = { selectedIds, toggleSelection, selectSingle, clearSelection };

  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>;
}

function getInitialSelectedIds(): string[] {
  const param = new URLSearchParams(window.location.search).get('i');
  if (!param) return [];
  return param.split(',').filter(Boolean);
}

export function useSelection() {
  const ctx = useContext(SelectionContext);
  if (!ctx) throw new Error('useSelection must be used within a SelectionProvider');
  return ctx;
}
