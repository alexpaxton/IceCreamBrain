import { Fragment, useState, type MouseEvent } from 'react';
import styled from 'styled-components';
import type { Compound, Ingredient } from '../../lib/types';
import { useSelection } from '../../lib/SelectionContext';
import { buildCompareGroups } from '../../lib/compareGroups';
import { CompareVisualization } from './CompareVisualization';
import { AddIngredientButton } from './AddIngredientButton';

interface Props {
  ingredients: Ingredient[];
  allIngredients: Ingredient[];
  compounds: Record<string, Compound>;
}

export function CompareView({ ingredients, allIngredients, compounds }: Props) {
  const { toggleSelection } = useSelection();
  const selectedIds = new Set(ingredients.map((i) => i.id));
  const [hoveredCids, setHoveredCids] = useState<Set<string> | null>(null);

  const groups = buildCompareGroups(ingredients);
  const sortedGroups = groups
    .filter((g) => g.cids.length > 0)
    .sort((a, b) => b.ids.length - a.ids.length);

  function getCandidates(cid: string) {
    return allIngredients.filter(
      (ing) => !selectedIds.has(ing.id) && ing.compounds.some((c) => c.compound_id === cid),
    );
  }

  function handleArcHover(cids: string[] | null) {
    setHoveredCids(cids ? new Set(cids) : null);
  }

  function handlePillClick(e: MouseEvent<HTMLButtonElement>) {
    toggleSelection(e.currentTarget.dataset.id!);
  }

  return (
    <Wrap>
      <Header>
        <Title>Comparing {ingredients.length} ingredients</Title>
        <PillRow>
          {ingredients.map((i) => (
            <Pill key={i.id} data-id={i.id} onClick={handlePillClick}>
              {i.name} ×
            </Pill>
          ))}
        </PillRow>
      </Header>

      <Columns>
        <LeftCol>
          <CompareVisualization ingredients={ingredients} onHoverRegion={handleArcHover} />
        </LeftCol>
        <RightCol>
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
                        <Row key={cid} $isHighlighted={hoveredCids?.has(cid) ?? false}>
                          <td>{c?.name ?? cid}</td>
                          <td>{c?.flavor_smell ?? '—'}</td>
                          <AddIngredientButton candidates={candidates} />
                        </Row>
                      );
                    })}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </Section>
        </RightCol>
      </Columns>
    </Wrap>
  );
}

const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
`;

const Header = styled.div`
  padding: 24px 28px 12px;
  border-bottom: 1px solid #000;
`;

const Columns = styled.div`
  display: flex;
  flex: 1;
  overflow: hidden;
`;

const LeftCol = styled.div`
  flex: 3;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  border-right: 1px solid #000;
  overflow: hidden;
`;

const RightCol = styled.div`
  flex: 5;
  overflow-y: auto;
  padding: 24px 28px;
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

const Row = styled.tr<{ $isHighlighted: boolean }>`
  background: ${(p) => (p.$isHighlighted ? '#eee' : 'transparent')};
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
