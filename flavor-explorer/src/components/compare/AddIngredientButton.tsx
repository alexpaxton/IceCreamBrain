import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { createPopper } from '@popperjs/core';
import styled from 'styled-components';
import type { Ingredient } from '../../lib/types';
import { useSelection } from '../../lib/SelectionContext';

interface Props {
  candidates: Ingredient[];
}

export function AddIngredientButton({ candidates }: Props) {
  const { toggleSelection } = useSelection();
  const [isOpen, setIsOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!isOpen || !btnRef.current || !dropRef.current) return;
    const popper = createPopper(btnRef.current, dropRef.current, {
      placement: 'bottom-start',
      modifiers: [{ name: 'offset', options: { offset: [0, 4] } }],
    });
    return () => popper.destroy();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideMouseDown = (e: MouseEvent) => {
      if (
        !btnRef.current?.contains(e.target as Node) &&
        !dropRef.current?.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideMouseDown);
    return () => document.removeEventListener('mousedown', handleOutsideMouseDown);
  }, [isOpen]);

  function handleToggleOpen() {
    setIsOpen((v) => !v);
  }

  function handleCandidateMouseDown(e: ReactMouseEvent<HTMLLIElement>) {
    const id = e.currentTarget.dataset.id!;
    toggleSelection(id);
    setIsOpen(false);
  }

  if (candidates.length === 0) return <AddCell />;

  return (
    <AddCell>
      <AddButton ref={btnRef} onClick={handleToggleOpen}>+</AddButton>
      {isOpen && (
        <Dropdown ref={dropRef}>
          {candidates.map((ing) => (
            <DropdownItem key={ing.id} data-id={ing.id} onMouseDown={handleCandidateMouseDown}>
              {ing.name}
            </DropdownItem>
          ))}
        </Dropdown>
      )}
    </AddCell>
  );
}

const AddCell = styled.td`
  padding-left: 8px;
  width: 28px;
`;

const AddButton = styled.button`
  font-family: inherit;
  font-size: 14px;
  line-height: 1;
  padding: 2px 6px;
  border: 1px solid #000;
  border-width: 1px 2px 2px 1px;
  background: transparent;
  cursor: pointer;

  &:hover {
    background: #000;
    color: #fff;
  }
`;

const Dropdown = styled.ul`
  list-style: none;
  margin: 0;
  padding: 2px 0;
  background: #fff;
  border: 1px solid #000;
  border-width: 1px 3px 3px 1px;
  min-width: 160px;
  z-index: 100;
  max-height: 189px;
  overflow-y: auto;

  &::-webkit-scrollbar {
    width: 6px;
  }
  &::-webkit-scrollbar-track {
    background: #fff;
  }
  &::-webkit-scrollbar-thumb {
    background: #000;
  }
`;

const DropdownItem = styled.li`
  padding: 6px 12px;
  font-size: 13px;
  cursor: pointer;

  &:hover {
    background: #000;
    color: #fff;
  }
`;
