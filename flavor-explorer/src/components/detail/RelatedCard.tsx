import { Fragment } from 'react';
import styled from 'styled-components';
import type { Compound, Ingredient } from '../../lib/types';
import { useSelection } from '../../lib/SelectionContext';
import { CompoundPopover } from './CompoundPopover';

interface Props {
  ingredient: Ingredient;
  sharedCompounds: Compound[];
  score: number;
}

export function RelatedCard({ ingredient, sharedCompounds, score }: Props) {
  const { selectedIds, toggleSelection } = useSelection();
  const isSelected = selectedIds.includes(ingredient.id);

  function handleToggleClick() {
    toggleSelection(ingredient.id);
  }

  return (
    <Card>
      <CardHeader>
        <CardName>{ingredient.name}</CardName>
        <AddButton
          $isSelected={isSelected}
          onClick={handleToggleClick}
          title={getToggleTitle(isSelected)}
        >
          {getToggleIcon(isSelected)}
        </AddButton>
      </CardHeader>
      <ScoreBadge>{score} shared</ScoreBadge>
      <CardCompounds>
        {sharedCompounds.map((c, i) => (
          <Fragment key={c.id}>
            {i > 0 && ', '}
            <CompoundPopover compound={c} />
          </Fragment>
        ))}
      </CardCompounds>
    </Card>
  );
}

function getToggleTitle(isSelected: boolean): string {
  if (isSelected) return 'Remove from selection';
  return 'Add to selection';
}

function getToggleIcon(isSelected: boolean): string {
  if (isSelected) return '✓';
  return '+';
}

const Card = styled.div`
  border: 1px solid #000;
  border-bottom-width: 4px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const CardHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
`;

const CardName = styled.span`
  font-weight: bold;
  font-size: 13px;
  line-height: 1.3;
`;

const AddButton = styled.button<{ $isSelected: boolean }>`
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  border: 1px solid #000;
  background: ${(p) => (p.$isSelected ? '#000' : '#fff')};
  color: ${(p) => (p.$isSelected ? '#fff' : '#000')};
  font-family: inherit;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;

  &:hover {
    background: #000;
    color: #fff;
  }
`;

const ScoreBadge = styled.span`
  font-size: 11px;
  font-weight: bold;
  letter-spacing: 0.03em;
`;

const CardCompounds = styled.div`
  font-size: 11px;
  line-height: 1.4;
`;
