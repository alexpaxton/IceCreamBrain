import type { ChangeEvent } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { NodeData } from '../../../lib/composer/types';
import { useComposer } from '../ComposerContext';
import { NodeShell, Row, Label, Input } from './NodeShell';

type OutputData = Extract<NodeData, { kind: 'output' }>;
export type OutputFlowNode = Node<OutputData, 'output'>;

export function OutputNode({ id, data }: NodeProps<OutputFlowNode>) {
  const { updateNodeData } = useComposer();

  function handleNameChange(e: ChangeEvent<HTMLInputElement>) {
    updateNodeData<OutputData>(id, { recipeName: e.target.value });
  }

  function handleGramsChange(e: ChangeEvent<HTMLInputElement>) {
    const grams = e.target.valueAsNumber;
    updateNodeData<OutputData>(id, { grams: Number.isFinite(grams) ? grams : 0 });
  }

  return (
    <>
      <Handle type="target" position={Position.Left} id="mix" />
      <NodeShell title="Recipe Output">
        <Row>
          <Label htmlFor={`${id}-name`}>Name</Label>
          <Input id={`${id}-name`} type="text" value={data.recipeName} onChange={handleNameChange} />
        </Row>
        <Row>
          <Label htmlFor={`${id}-grams`}>Grams</Label>
          <Input id={`${id}-grams`} type="number" value={data.grams} onChange={handleGramsChange} />
        </Row>
      </NodeShell>
      <Handle type="source" position={Position.Right} />
    </>
  );
}
