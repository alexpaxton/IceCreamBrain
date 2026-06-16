import { Fragment, useEffect, useRef, useState } from 'react';
import { createPopper } from '@popperjs/core';
import styled from 'styled-components';
import type { Compound, Ingredient } from '../types';

const Wrap = styled.div`
  padding: 24px 28px;
  overflow-y: auto;
  height: 100%;
`;

const Header = styled.div`
  margin-bottom: 20px;
  border-bottom: 1px solid #000;
  padding-bottom: 12px;
`;

const Title = styled.h1`
  font-size: 28px;
  font-weight: bold;
`;

const PillRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
`;

const Pill = styled.button`
  font-family: inherit;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px 4px 14px;
  border: 1px solid #000;
  border-width: 1px 3px 3px 1px;
  background: transparent;
  font-size: 16px;
  cursor: pointer;
  line-height: 1.6;

  &:hover {
    background: #000;
    color: #fff;
  }
`;

const Section = styled.section`
  margin-bottom: 24px;
`;

const GroupHeaderCell = styled.td`
  font-size: 11px;
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  padding-top: 16px;
  padding-bottom: 4px;
  background-color: #eee;
`;

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

interface AddIngredientButtonProps {
  candidates: Ingredient[];
  onAdd: (id: string) => void;
}

function AddIngredientButton({ candidates, onAdd }: AddIngredientButtonProps) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!open || !btnRef.current || !dropRef.current) return;
    const popper = createPopper(btnRef.current, dropRef.current, {
      placement: 'bottom-start',
      modifiers: [{ name: 'offset', options: { offset: [0, 4] } }],
    });
    return () => popper.destroy();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        !btnRef.current?.contains(e.target as Node) &&
        !dropRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (candidates.length === 0) return <AddCell />

  return (
    <AddCell>
      <AddButton ref={btnRef} onClick={() => setOpen((v) => !v)}>+</AddButton>
      {open && (
        <Dropdown ref={dropRef}>
          {candidates.map((ing) => (
            <DropdownItem
              key={ing.id}
              onMouseDown={() => {
                onAdd(ing.id);
                setOpen(false);
              }}
            >
              {ing.name}
            </DropdownItem>
          ))}
        </Dropdown>
      )}
    </AddCell>
  );
}

interface Props {
  ingredients: Ingredient[];
  allIngredients: Ingredient[];
  compounds: Record<string, Compound>;
  onRemove: (id: string) => void;
  onAdd: (id: string) => void;
}

export function CompareView({ ingredients, allIngredients, compounds, onRemove, onAdd }: Props) {
  const selectedIds = new Set(ingredients.map((i) => i.id));

  const allCompoundIds = Array.from(
    new Set(ingredients.flatMap((ing) => ing.compounds.map((c) => c.compound_id))),
  );

  const groups = new Map<string, { label: string; ownerCount: number; cids: string[] }>();

  for (const cid of allCompoundIds) {
    const owners = ingredients.filter((ing) => ing.compounds.some((c) => c.compound_id === cid));
    const key = owners
      .map((o) => o.id)
      .sort()
      .join(',');

    if (!groups.has(key)) {
      const ownerCount = owners.length;
      const label =
        ownerCount === ingredients.length
          ? 'Shared by all ingredients'
          : owners.map((o) => o.name).join(' + ');
      groups.set(key, { label, ownerCount, cids: [] });
    }
    groups.get(key)!.cids.push(cid);
  }

  const sortedGroups = [...groups.values()].sort((a, b) => b.ownerCount - a.ownerCount);

  const getCandidates = (cid: string) =>
    allIngredients.filter(
      (ing) => !selectedIds.has(ing.id) && ing.compounds.some((c) => c.compound_id === cid),
    );

  return (
    <Wrap>
      <Header>
        <Title>Comparing {ingredients.length} ingredients</Title>
        <PillRow>
          {ingredients.map((i) => (
            <Pill key={i.id} onClick={() => onRemove(i.id)}>
              {i.name} ×
            </Pill>
          ))}
        </PillRow>
      </Header>

      <Section>
        <table>
          <thead>
            <tr>
              <th>Volatile organic compound</th>
              <th>Flavor / smell</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {sortedGroups.map((group) => (
              <Fragment key={group.label}>
                <tr>
                  <GroupHeaderCell colSpan={3}>{group.label}</GroupHeaderCell>
                </tr>
                {group.cids.map((cid) => {
                  const c = compounds[cid];
                  const candidates = getCandidates(cid);
                  return (
                    <tr key={cid}>
                      <td>{c?.name ?? cid}</td>
                      <td>{c?.flavor_smell ?? '—'}</td>
                      <AddIngredientButton candidates={candidates} onAdd={onAdd} />
                    </tr>
                  );
                })}
              </Fragment>
            ))}
          </tbody>
        </table>
      </Section>
    </Wrap>
  );
}
