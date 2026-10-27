import { useEffect, useRef, useState, type ChangeEvent, type MouseEvent as ReactMouseEvent } from 'react';
import styled from 'styled-components';
import { useComposer } from '../ComposerContext';
import { Input } from './NodeShell';
import { ManualIngredientForm } from './ManualIngredientForm';

interface Props {
  value: string | null;
  onChange: (ingredientId: string) => void;
  placeholder?: string;
}

/** Text input that filters the ingredient db by substring, with an inline "new ingredient" flow. */
export function IngredientPicker({ value, onChange, placeholder }: Props) {
  const { db } = useComposer();
  const selected = value ? db.byId.get(value) : undefined;

  const [query, setQuery] = useState(selected?.name ?? '');
  const [isOpen, setIsOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(selected?.name ?? '');
  }, [selected?.name]);

  useEffect(() => {
    if (!isOpen) return;
    function handleOutsideMouseDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutsideMouseDown);
    return () => document.removeEventListener('mousedown', handleOutsideMouseDown);
  }, [isOpen]);

  function handleQueryChange(e: ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value);
    setIsOpen(true);
  }

  function handleFocus() {
    setIsOpen(true);
  }

  function handlePick(e: ReactMouseEvent<HTMLLIElement>) {
    const id = e.currentTarget.dataset.id!;
    onChange(id);
    setIsOpen(false);
  }

  function handleNewIngredientClick() {
    setShowForm(true);
    setIsOpen(false);
  }

  function handleCreated(id: string) {
    setShowForm(false);
    onChange(id);
  }

  function handleCancel() {
    setShowForm(false);
  }

  const q = query.trim().toLowerCase();
  const matches = q ? db.all.filter((ing) => ing.name.toLowerCase().includes(q)) : db.all;

  return (
    <Wrap ref={wrapRef}>
      <Input
        type="text"
        value={query}
        onChange={handleQueryChange}
        onFocus={handleFocus}
        placeholder={placeholder ?? 'Search ingredients…'}
      />
      {isOpen && !showForm && (
        <Dropdown className="nodrag">
          <DropdownItem data-id="__new__" onMouseDown={handleNewIngredientClick}>
            New ingredient…
          </DropdownItem>
          {matches.map((ing) => (
            <DropdownItem key={ing.id} data-id={ing.id} onMouseDown={handlePick}>
              {ing.name}
            </DropdownItem>
          ))}
          {matches.length === 0 && <DropdownEmpty>No matches</DropdownEmpty>}
        </Dropdown>
      )}
      {showForm && <ManualIngredientForm initialName={query} onCreated={handleCreated} onCancel={handleCancel} />}
    </Wrap>
  );
}

const Wrap = styled.div`
  position: relative;
  width: 100%;
`;

const Dropdown = styled.ul`
  list-style: none;
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin: 2px 0 0;
  padding: 2px 0;
  background: #fff;
  border: 1px solid #000;
  border-width: 1px 2px 2px 1px;
  max-height: 160px;
  overflow-y: auto;
  z-index: 20;
`;

const DropdownItem = styled.li`
  padding: 4px 8px;
  font-size: 12px;
  cursor: pointer;

  &:hover {
    background: #000;
    color: #fff;
  }
`;

const DropdownEmpty = styled.li`
  padding: 4px 8px;
  font-size: 12px;
  opacity: 0.5;
`;
