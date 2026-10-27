import type { ChangeEvent } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { NodeData, StyleId } from '../../../lib/composer/types';
import { useComposer } from '../ComposerContext';
import { NodeShell, Row, Select } from './NodeShell';

type StyleData = Extract<NodeData, { kind: 'style' }>;
export type StyleFlowNode = Node<StyleData, 'style'>;

const STYLE_OPTIONS: { id: StyleId; label: string }[] = [
  { id: 'philadelphia', label: 'Philadelphia' },
  { id: 'custard', label: 'Custard' },
  { id: 'sherbet', label: 'Sherbet' },
  { id: 'sorbet', label: 'Sorbet' },
];

export function StyleNode({ id, data }: NodeProps<StyleFlowNode>) {
  const { updateNodeData } = useComposer();

  function handleChange(e: ChangeEvent<HTMLSelectElement>) {
    updateNodeData<StyleData>(id, { style: e.target.value as StyleId });
  }

  return (
    <>
      <NodeShell title="Style">
        <Row>
          <Select value={data.style} onChange={handleChange}>
            {STYLE_OPTIONS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </Select>
        </Row>
      </NodeShell>
      <Handle type="source" position={Position.Right} />
    </>
  );
}
