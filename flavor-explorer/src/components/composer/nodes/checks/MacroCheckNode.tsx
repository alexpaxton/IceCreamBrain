import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import styled from 'styled-components';
import type { Band, MacroCheckRow, NodeData } from '../../../../lib/composer/types';
import { useComposer } from '../../ComposerContext';
import { NodeShell } from '../NodeShell';

type MacroCheckData = Extract<NodeData, { kind: 'macroCheck' }>;
export type MacroCheckFlowNode = Node<MacroCheckData, 'macroCheck'>;

function bandText(band: Band | null): string {
  if (!band) return '—';
  return `${band.idealLow}–${band.idealHigh}% (${band.min}–${band.max}%)`;
}

function pctText(row: MacroCheckRow): string {
  const glyph = row.status === 'low' ? ' ↓' : row.status === 'high' ? ' ↑' : row.status === 'ok' ? ' ·' : '';
  return `${row.pct.toFixed(1)}%${glyph}`;
}

export function MacroCheckNode({ id }: NodeProps<MacroCheckFlowNode>) {
  const { derived } = useComposer();
  const result = derived.macroChecks[id];

  return (
    <>
      <Handle type="target" position={Position.Left} />
      <NodeShell title="Macro Check" footer={result?.sourceNote}>
        {!result ? (
          <Placeholder>connect ingredients or a complete recipe</Placeholder>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Macro</Th>
                <Th>Standard</Th>
                <Th>%</Th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row) => (
                <Tr key={row.label} $status={row.status}>
                  <Td>{row.label}</Td>
                  <Td>{bandText(row.band)}</Td>
                  <Td>{pctText(row)}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </NodeShell>
    </>
  );
}

const Placeholder = styled.div`
  opacity: 0.5;
  font-size: 11px;
`;

const Table = styled.table`
  border-collapse: collapse;
  width: 100%;
  font-size: 11px;
`;

const Th = styled.th`
  border: 1px solid #000;
  padding: 3px 5px;
  text-align: left;
  font-weight: bold;
  background: #000;
  color: #fff;
`;

const Td = styled.td`
  border: 1px solid #000;
  padding: 3px 5px;
  text-align: left;
  white-space: nowrap;
`;

const Tr = styled.tr<{ $status: MacroCheckRow['status'] }>`
  font-weight: ${(p) => (p.$status === 'low' || p.$status === 'high' ? 'bold' : 'normal')};
  background: ${(p) => (p.$status === 'low' || p.$status === 'high' ? '#eee' : 'transparent')};
  opacity: ${(p) => (p.$status === 'info' ? 0.6 : 1)};
`;
