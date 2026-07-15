import { useMemo, useState, type MouseEvent } from 'react';
import Fuse from 'fuse.js';
import styled from 'styled-components';
import { SearchInput } from './SearchInput';
import type { Ingredient } from '../../lib/types';
import { useSelection } from '../../lib/SelectionContext';

interface Props {
  ingredients: Ingredient[];
}

export function IngredientList({ ingredients }: Props) {
  const { selectedIds, toggleSelection, selectSingle, clearSelection } = useSelection();
  const [query, setQuery] = useState('');

  const fuse = useMemo(
    () => new Fuse(ingredients, { keys: ['name'], threshold: 0.3, minMatchCharLength: 2 }),
    [ingredients],
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return ingredients;
    return fuse.search(query).map((r) => r.item);
  }, [query, fuse, ingredients]);

  function handleCheckboxClick(e: MouseEvent<HTMLInputElement>) {
    e.stopPropagation();
    toggleSelection(e.currentTarget.dataset.id!);
  }

  function handleCheckboxChange() {
    // Selection state is driven by the click handler; the checkbox itself
    // stays controlled without reacting to native change events.
  }

  function handleLabelClick(e: MouseEvent<HTMLSpanElement>) {
    e.stopPropagation();
    const id = e.currentTarget.dataset.id!;
    if (selectedIds.length === 0) {
      toggleSelection(id);
    } else {
      selectSingle(id);
    }
  }

  return (
    <Sidebar>
      <SearchWrap>
        <SearchInput value={query} onChange={setQuery} />
      </SearchWrap>
      <List>
        {filtered.map((ing) => {
          const isSelected = selectedIds.includes(ing.id);
          return (
            <Row key={ing.id} $isSelected={isSelected}>
              <Checkbox
                type="checkbox"
                checked={isSelected}
                data-id={ing.id}
                onChange={handleCheckboxChange}
                onClick={handleCheckboxClick}
              />
              <Label data-id={ing.id} onClick={handleLabelClick}>
                {ing.name}
              </Label>
            </Row>
          );
        })}
      </List>
      {selectedIds.length > 0 && (
        <Footer>
          <ClearButton onClick={clearSelection}>Clear ({selectedIds.length})</ClearButton>
        </Footer>
      )}
    </Sidebar>
  );
}

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

const Row = styled.li<{ $isSelected: boolean }>`
  padding: 7px 10px;
  background: ${(p) => (p.$isSelected ? '#000' : '#fff')};
  color: ${(p) => (p.$isSelected ? '#fff' : '#000')};
  border-bottom: 1px solid ${(p) => (p.$isSelected ? '#000' : '#e8e8e8')};
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
