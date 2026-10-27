import type { ChangeEvent } from 'react';
import { Handle, Position, useNodeConnections, type Node, type NodeProps } from '@xyflow/react';
import type { NodeData } from '../../../lib/composer/types';
import { useComposer } from '../ComposerContext';
import { NodeShell, Row, Input } from './NodeShell';
import { IngredientPicker } from './IngredientPicker';

type IngredientData = Extract<NodeData, { kind: 'ingredient' }>;
export type IngredientFlowNode = Node<IngredientData, 'ingredient'>;

export function IngredientNode({ id, data }: NodeProps<IngredientFlowNode>) {
  const { updateNodeData } = useComposer();
  const outgoing = useNodeConnections({ handleType: 'source' });
  const dimmed = outgoing.length === 0;

  function handleIngredientChange(ingredientId: string) {
    updateNodeData<IngredientData>(id, { ingredientId });
  }

  function handlePctChange(e: ChangeEvent<HTMLInputElement>) {
    const pct = e.target.valueAsNumber;
    updateNodeData<IngredientData>(id, { pct: Number.isFinite(pct) ? pct : 0 });
  }

  return (
    <>
      <NodeShell title="Ingredient" dimmed={dimmed} footer={dimmed ? 'not connected' : undefined}>
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
