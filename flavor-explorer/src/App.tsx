import { useEffect, useState } from 'react';
import styled from 'styled-components';
import rawIngredients from './data/ingredients.json';
import rawCompounds from './data/compounds.json';
import type { Ingredient, Compound } from './types';
import { IngredientList } from './components/IngredientList';
import { DetailView } from './components/DetailView';
import { CompareView } from './components/CompareView';

const ingredients = (Object.values(rawIngredients.ingredients) as Ingredient[]).sort((a, b) =>
  a.name.localeCompare(b.name),
);
const compounds = rawCompounds.compounds as Record<string, Compound>;

const Layout = styled.div`
  display: flex;
  height: 100%;
  overflow: hidden;
`;

const Panel = styled.div`
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
`;

const Empty = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  opacity: 0.3;
  font-size: 13px;
`;

export function App() {
  const [selectedIds, setSelectedIds] = useState<string[]>(() => {
    const param = new URLSearchParams(window.location.search).get('i');
    return param ? param.split(',').filter(Boolean) : [];
  });

  useEffect(() => {
    const url = new URL(window.location.href);
    if (selectedIds.length > 0) {
      url.searchParams.set('i', selectedIds.join(','));
    } else {
      url.searchParams.delete('i');
    }
    history.replaceState(null, '', url);
  }, [selectedIds]);

  const toggle = (id: string) =>
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const selected = selectedIds
    .map((id) => ingredients.find((ing) => ing.id === id))
    .filter((ing): ing is Ingredient => ing !== undefined);

  return (
    <Layout>
      <IngredientList
        ingredients={ingredients}
        selectedIds={selectedIds}
        onToggle={toggle}
        onSelectOnly={(id) => setSelectedIds([id])}
        onClear={() => setSelectedIds([])}
      />
      <Panel>
        {selected.length === 0 && <Empty>Select an ingredient to begin.</Empty>}
        {selected.length === 1 && (
          <DetailView
            ingredient={selected[0]}
            compounds={compounds}
            allIngredients={ingredients}
            selectedIds={selectedIds}
            onToggle={toggle}
          />
        )}
        {selected.length >= 2 && (
          <CompareView
            ingredients={selected}
            allIngredients={ingredients}
            compounds={compounds}
            onRemove={toggle}
            onAdd={toggle}
          />
        )}
      </Panel>
    </Layout>
  );
}
