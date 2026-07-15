import styled from 'styled-components';
import { VennDiagram, VennSeries, VennArc, VennLabel } from 'reaviz';
import type { Ingredient } from '../../lib/types';
import { buildCompareGroups } from '../../lib/compareGroups';

interface Props {
  ingredients: Ingredient[];
  onHoverRegion: (cids: string[] | null) => void;
}

export function CompareVisualization({ ingredients, onHoverRegion }: Props) {
  const groups = buildCompareGroups(ingredients);
  const names = new Map(ingredients.map((ing) => [ing.id, ing.name]));
  const cidsBySetsKey = new Map(groups.map((g) => [g.ids.join(','), g.cids]));

  // Larger (fewer-set) regions must render first so smaller overlap regions
  // stack on top of them in the DOM — otherwise a singleton circle's
  // transparent fill still intercepts hover and swallows the overlaps nested inside it.
  const data = [...groups]
    .sort((a, b) => a.ids.length - b.ids.length)
    .map((g) => ({ key: g.ids, data: g.cids.length }));

  function handleArcMouseEnter(event: any) {
    const sets: string[] = event.value.sets;
    onHoverRegion(cidsBySetsKey.get(sets.join(',')) ?? []);
  }

  function handleArcMouseLeave() {
    onHoverRegion(null);
  }

  function formatLabel(d: any) {
    const sets: string[] = d.data.sets;
    const count = d.data.size;
    if (sets.length === 1) {
      return (
        <>
          <tspan x={d.text.x} dy="-8">{names.get(sets[0]) ?? sets[0]}</tspan>
          <tspan x={d.text.x} dy="16">{count}</tspan>
        </>
      );
    }
    return count;
  }

  return (
    <ChartArea>
      <VennDiagram
        id="compare-venn"
        height={380}
        data={data}
        series={
          <VennSeries
            colorScheme={['#000']}
            arc={
              <VennArc
                fill="transparent"
                stroke="#000"
                strokeWidth={2}
                gradient={null}
                tooltip={null}
                onMouseEnter={handleArcMouseEnter}
                onMouseLeave={handleArcMouseLeave}
              />
            }
            label={
              <VennLabel showAll fill="#000" fontFamily="inherit" fontSize={13} format={formatLabel} />
            }
          />
        }
      />
    </ChartArea>
  );
}

const ChartArea = styled.div`
  width: 100%;
  height: 380px;
`;
