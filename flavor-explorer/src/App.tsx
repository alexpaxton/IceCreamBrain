import styled from 'styled-components';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import rawIngredients from './data/ingredients.json';
import rawCompounds from './data/compounds.json';
import type { Ingredient, Compound } from './lib/types';
import { useSelection } from './lib/SelectionContext';
import { IngredientList } from './components/shared/IngredientList';
import { DetailView } from './components/detail/DetailView';
import { CompareView } from './components/compare/CompareView';
import { ComposerPage } from './components/composer/ComposerPage';

const ingredients = (Object.values(rawIngredients.ingredients) as Ingredient[]).sort((a, b) =>
  a.name.localeCompare(b.name),
);
const compounds = rawCompounds.compounds as Record<string, Compound>;

export function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route path="/" element={<Navigate to="/flavor-explorer" replace />} />
        <Route path="/flavor-explorer" element={<ExplorerPage />} />
        <Route path="/flavor-explorer/composer" element={<ComposerPage />} />
      </Routes>
    </BrowserRouter>
  );
}

function ExplorerPage() {
  const { selectedIds } = useSelection();

  const selected = selectedIds
    .map((id) => ingredients.find((ing) => ing.id === id))
    .filter((ing): ing is Ingredient => ing !== undefined);

  return (
    <Layout>
      <IngredientList ingredients={ingredients} />
      <Panel>
        {selected.length === 0 && <Empty>Select an ingredient to begin.</Empty>}
        {selected.length === 1 && (
          <DetailView ingredient={selected[0]} compounds={compounds} allIngredients={ingredients} />
        )}
        {selected.length >= 2 && (
          <CompareView ingredients={selected} allIngredients={ingredients} compounds={compounds} />
        )}
      </Panel>
    </Layout>
  );
}

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
