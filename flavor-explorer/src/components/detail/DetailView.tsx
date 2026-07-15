import styled from 'styled-components';
import type { Compound, Ingredient } from '../../lib/types';
import { RelatedCard } from './RelatedCard';

interface Props {
  ingredient: Ingredient;
  compounds: Record<string, Compound>;
  allIngredients: Ingredient[];
}

interface RelatedIngredient {
  ingredient: Ingredient;
  sharedCompounds: Compound[];
  score: number;
}

export function DetailView({ ingredient, compounds, allIngredients }: Props) {
  const related = getRelatedIngredients(ingredient, allIngredients, compounds);

  return (
    <Wrap>
      <Header>
        <Name>{ingredient.name}</Name>
        {(ingredient.scientific_name || ingredient.variety) && (
          <Meta>
            {[ingredient.scientific_name, ingredient.variety].filter(Boolean).join(' — ')}
          </Meta>
        )}
      </Header>

      {ingredient.warnings && (
        <Section>
          <SectionLabel>Warnings</SectionLabel>
          <Warning>{ingredient.warnings}</Warning>
        </Section>
      )}

      <Section>
        <SectionLabel>GC-MS Profile</SectionLabel>
        <Summary>{ingredient.gcms_summary}</Summary>
      </Section>

      <Section>
        <SectionLabel>Volatile Compounds</SectionLabel>
        <table>
          <thead>
            <tr>
              <th>Compound</th>
              <th>Flavor / smell</th>
              <th>Water</th>
              <th>Alcohol</th>
              <th>Fat (LogP)</th>
              <th>Temp notes</th>
              <th>%</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {ingredient.compounds.map((ic) => {
              const c = compounds[ic.compound_id];
              if (!c) return null;
              return (
                <tr key={ic.compound_id}>
                  <td>{c.name}</td>
                  <td>{c.flavor_smell}</td>
                  <td>{c.solubility.water}</td>
                  <td>{c.solubility.alcohol}</td>
                  <td>{c.solubility.fat_logp}</td>
                  <td>{c.temp_notes}</td>
                  <td>{ic.percentage ?? '—'}</td>
                  <td>{ic.notes ?? '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Section>

      {related.length > 0 && (
        <Section>
          <SectionLabel>Ingredients sharing VOCs</SectionLabel>
          <CardGrid>
            {related.map(({ ingredient: ing, sharedCompounds, score }) => (
              <RelatedCard key={ing.id} ingredient={ing} sharedCompounds={sharedCompounds} score={score} />
            ))}
          </CardGrid>
        </Section>
      )}

      {ingredient.sources.length > 0 && (
        <Section>
          <SectionLabel>Sources</SectionLabel>
          <SourceList>
            {ingredient.sources.map((url, i) => (
              <span key={url}>
                {i > 0 && ' · '}
                <a href={url} target="_blank" rel="noreferrer">
                  [{i + 1}]
                </a>
              </span>
            ))}
          </SourceList>
        </Section>
      )}
    </Wrap>
  );
}

function getRelatedIngredients(
  ingredient: Ingredient,
  allIngredients: Ingredient[],
  compounds: Record<string, Compound>,
): RelatedIngredient[] {
  const myCompoundIds = new Set(ingredient.compounds.map((c) => c.compound_id));

  return allIngredients
    .filter((ing) => ing.id !== ingredient.id)
    .flatMap((ing) => {
      const shared = ing.compounds
        .filter((c) => myCompoundIds.has(c.compound_id))
        .map((c) => compounds[c.compound_id])
        .filter((c): c is Compound => Boolean(c));
      if (shared.length === 0) return [];
      return [{ ingredient: ing, sharedCompounds: shared, score: shared.length }];
    })
    .sort((a, b) => b.score - a.score);
}

const Wrap = styled.div`
  padding: 28px;
  overflow-y: auto;
  height: 100%;
`;

const Header = styled.div`
  margin-bottom: 28px;
  border-bottom: 4px solid #000;
  padding-bottom: 16px;
`;

const Name = styled.h1`
  font-size: 28px;
  font-weight: bold;
  line-height: 1.2;
`;

const Meta = styled.p`
  font-style: italic;
  margin-top: 16px;
  opacity: 0.7;
  font-size: 12px;
`;

const Section = styled.section`
  margin-bottom: 24px;
`;

const SectionLabel = styled.h2`
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 8px;
  opacity: 0.5;
`;

const Warning = styled.div`
  border: 1px solid #000;
  border-bottom-width: 4px;
  padding: 8px 12px;
  font-size: 12px;
  line-height: 1.5;
`;

const Summary = styled.p`
  line-height: 1.6;
  font-size: 12px;
`;

const CardGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: 8px;
`;

const SourceList = styled.p`
  font-size: 11px;
  line-height: 1.8;
`;
