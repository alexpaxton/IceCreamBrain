import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import styled from 'styled-components';
import type { NodeData, Range } from '../../../../lib/composer/types';
import { celsiusToFahrenheit } from '../../../../lib/composer/pac/pac';
import { useComposer } from '../../ComposerContext';
import { NodeShell, Warning } from '../NodeShell';

type PacCheckData = Extract<NodeData, { kind: 'pacCheck' }>;
export type PacCheckFlowNode = Node<PacCheckData, 'pacCheck'>;

function fmtCF(c: number): string {
  return `${c.toFixed(1)}°C / ${celsiusToFahrenheit(c).toFixed(1)}°F`;
}

function rangeText([low, high]: Range): string {
  return `${low}–${high}`;
}

/** Range flag suffix: '' when in range (or unknown), '↑ above X–Y' / '↓ below X–Y' otherwise. */
function flagFor(value: number | null, inRange: boolean | null, target: Range): string {
  if (value === null || inRange === null || inRange) return '';
  if (value > target[1]) return ` ↑ above ${rangeText(target)}`;
  return ` ↓ below ${rangeText(target)}`;
}

export function PacCheckNode(_props: NodeProps<PacCheckFlowNode>) {
  const { derived } = useComposer();
  const errorIssues = derived.issues.filter((i) => i.severity === 'error');

  return (
    <>
      <Handle type="target" position={Position.Left} />
      <NodeShell
        title="PAC Check"
        footer="non-sweetener sugars assumed sucrose-equivalent"
      >
        {derived.pac === null ? (
          <Placeholder>connect a complete recipe</Placeholder>
        ) : (
          (() => {
            const pac = derived.pac;
            const pacFlag = flagFor(pac.pac, pac.inRange.pac, pac.targets.pac);
            const fpFlag = flagFor(pac.freezingPointC, pac.inRange.freezingPointC, pac.targets.freezingPointC);
            const wfFlag = flagFor(pac.pctWaterFrozen, pac.inRange.pctWaterFrozen, pac.targets.pctWaterFrozen);

            return (
              <List>
                <KV $flagged={pacFlag !== ''}>
                  <span>PAC</span>
                  <span>
                    {pac.pac.toFixed(2)}
                    {pacFlag}
                  </span>
                </KV>
                <KV $flagged={false}>
                  <span>Normalised PAC</span>
                  <span>{pac.pacn.toFixed(2)}</span>
                </KV>
                <KV $flagged={fpFlag !== ''}>
                  <span>Freezing point (~approx)</span>
                  <span>{pac.freezingPointC === null ? 'n/a' : `${fmtCF(pac.freezingPointC)}${fpFlag}`}</span>
                </KV>
                <KV $flagged={wfFlag !== ''}>
                  <span>% water frozen @ serve temp</span>
                  <span>{pac.pctWaterFrozen === null ? 'n/a above FP' : `${pac.pctWaterFrozen.toFixed(1)}%${wfFlag}`}</span>
                </KV>
                <KV $flagged={false}>
                  <span>Serving temp estimate</span>
                  <span>{fmtCF(pac.servingTempEstC)}</span>
                </KV>
                <KV $flagged={false}>
                  <span>Serve temp used</span>
                  <span>{fmtCF(pac.serveTempC)}</span>
                </KV>
              </List>
            );
          })()
        )}
        {errorIssues.length > 0 && (
          <Warning>
            {errorIssues.map((issue, i) => (
              <div key={i}>{issue.message}</div>
            ))}
          </Warning>
        )}
      </NodeShell>
    </>
  );
}

const Placeholder = styled.div`
  opacity: 0.5;
  font-size: 11px;
`;

const List = styled.div`
  display: flex;
  flex-direction: column;
  gap: 3px;
`;

const KV = styled.div<{ $flagged: boolean }>`
  display: flex;
  justify-content: space-between;
  gap: 10px;
  font-size: 11px;
  font-weight: ${(p) => (p.$flagged ? 'bold' : 'normal')};

  span:first-child {
    opacity: 0.7;
  }
`;
