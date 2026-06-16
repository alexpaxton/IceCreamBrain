import { useMemo, useState } from 'react';
import Fuse from 'fuse.js';
import styled from 'styled-components';
import { SearchInput } from './SearchInput';
import type { Ingredient } from '../types';

const Sidebar = styled.div`
  width: 280px;
  flex-shrink: 0;
  border-right: 1px solid #000;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
`;

const SearchWrap = styled.div`
  padding: 8px;
  border-bottom: 1px solid #000;
`;

const List = styled.ul`
  list-style: none;
  overflow-y: auto;
  flex: 1;
`;

const Row = styled.li<{ $selected: boolean }>`
  padding: 7px 10px;
  background: ${(p) => (p.$selected ? '#000' : '#fff')};
  color: ${(p) => (p.$selected ? '#fff' : '#000')};
  border-bottom: 1px solid ${(p) => (p.$selected ? '#000' : '#e8e8e8')};
  user-select: none;
  display: flex;
  align-items: center;
  gap: 8px;

  &:last-child {
    border-bottom: none;
  }
`;

const Checkbox = styled.input`
  appearance: none;
  width: 12px;
  height: 12px;
  border: 1.5px solid currentColor;
  flex-shrink: 0;
  cursor: pointer;

  &:checked {
    background: currentColor;
  }
`;

const Label = styled.span`
  flex: 1;
  cursor: pointer;
`;

const Footer = styled.div`
  border-top: 1px solid #000;
  padding: 6px 8px;
`;

const ClearButton = styled.button`
  background: none;
  border: 1px solid #000;
  font-family: inherit;
  font-size: 12px;
  padding: 3px 8px;
  cursor: pointer;
  width: 100%;

  &:hover {
    background: #000;
    color: #fff;
  }
`;

interface Props {
  ingredients: Ingredient[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onSelectOnly: (id: string) => void;
  onClear: () => void;
}

export function IngredientList({ ingredients, selectedIds, onToggle, onSelectOnly, onClear }: Props) {
  const [query, setQuery] = useState('');

  const fuse = useMemo(
    () => new Fuse(ingredients, { keys: ['name'], threshold: 0.3, minMatchCharLength: 2 }),
    [ingredients],
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return ingredients;
    return fuse.search(query).map((r) => r.item);
  }, [query, fuse, ingredients]);

  return (
    <Sidebar>
      <SearchWrap>
        <SearchInput value={query} onChange={setQuery} />
      </SearchWrap>
      <List>
        {filtered.map((ing) => {
          const selected = selectedIds.includes(ing.id);
          return (
            <Row key={ing.id} $selected={selected}>
              <Checkbox
                type="checkbox"
                checked={selected}
                onChange={() => {}}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggle(ing.id);
                }}
              />
              <Label
                onClick={(e) => {
                  e.stopPropagation();
                  if (selectedIds.length === 0) {
                    onToggle(ing.id);
                  } else {
                    onSelectOnly(ing.id);
                  }
                }}
              >
                {ing.name}
              </Label>
            </Row>
          );
        })}
      </List>
      {selectedIds.length > 0 && (
        <Footer>
          <ClearButton onClick={onClear}>Clear ({selectedIds.length})</ClearButton>
        </Footer>
      )}
    </Sidebar>
  );
}
