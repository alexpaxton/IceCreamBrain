import type { ChangeEvent } from 'react';
import { Handle, Position, useNodeConnections, type Node, type NodeProps } from '@xyflow/react';
import type { NodeData } from '../../../lib/composer/types';
import { useComposer } from '../ComposerContext';
import { NodeShell, Row, Input } from './NodeShell';
import { IngredientPicker } from './IngredientPicker';

type FlavoringData = Extract<NodeData, { kind: 'flavoring' }>;
export type FlavoringFlowNode = Node<FlavoringData, 'flavoring'>;

export function FlavoringNode({ id, data }: NodeProps<FlavoringFlowNode>) {
  const { updateNodeData } = useComposer();
  const outgoing = useNodeConnections({ handleType: 'source' });
  const dimmed = outgoing.length === 0;

  function handleIngredientChange(ingredientId: string) {
    updateNodeData<FlavoringData>(id, { ingredientId });
  }

  function handlePctChange(e: ChangeEvent<HTMLInputElement>) {
    const pct = e.target.valueAsNumber;
    updateNodeData<FlavoringData>(id, { pct: Number.isFinite(pct) ? pct : 0 });
  }

  return (
    <>
      <NodeShell title="Flavoring" dimmed={dimmed} footer={dimmed ? 'not connected' : undefined}>
        <Row>
          <IngredientPicker value={data.ingredientId} onChange={handleIngredientChange} />
        </Row>
        <Row>
          <Input type="number" value={data.pct} onChange={handlePctChange} placeholder="% of recipe" />
        </Row>
      </NodeShell>
      <Handle type="source" position={Position.Right} />
    </>
  );
}
