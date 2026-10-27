import type { ChangeEvent } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { NodeData } from '../../../lib/composer/types';
import { useComposer } from '../ComposerContext';
import { NodeShell, Row, Input, SmallButton } from './NodeShell';

type ServingTempData = Extract<NodeData, { kind: 'servingTemp' }>;
export type ServingTempFlowNode = Node<ServingTempData, 'servingTemp'>;

function toC(value: number, unit: 'C' | 'F'): number {
  return unit === 'C' ? value : ((value - 32) * 5) / 9;
}

function toF(value: number, unit: 'C' | 'F'): number {
  return unit === 'F' ? value : (value * 9) / 5 + 32;
}

export function ServingTempNode({ id, data }: NodeProps<ServingTempFlowNode>) {
  const { updateNodeData } = useComposer();

  function handleValueChange(e: ChangeEvent<HTMLInputElement>) {
    const value = e.target.valueAsNumber;
    updateNodeData<ServingTempData>(id, { value: Number.isFinite(value) ? value : 0 });
  }

  function handleUnitChange(unit: 'C' | 'F') {
    if (unit === data.unit) return;
    updateNodeData<ServingTempData>(id, { unit });
  }

  const c = toC(data.value, data.unit);
  const f = toF(data.value, data.unit);

  return (
    <>
      <NodeShell title="Serving Temp" footer={`${c.toFixed(1)}°C / ${f.toFixed(1)}°F`}>
        <Row>
          <Input type="number" value={data.value} onChange={handleValueChange} />
          <SmallButton onClick={() => handleUnitChange('C')} disabled={data.unit === 'C'}>
            °C
          </SmallButton>
          <SmallButton onClick={() => handleUnitChange('F')} disabled={data.unit === 'F'}>
            °F
          </SmallButton>
        </Row>
      </NodeShell>
      <Handle type="source" position={Position.Right} />
    </>
  );
}
