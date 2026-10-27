import type { ChangeEvent } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { NodeData } from '../../../lib/composer/types';
import { useComposer } from '../ComposerContext';
import { SWEETENER_KEYS, prettifyKey } from '../constants';
import { NodeShell, Row, Select, Input, SmallButton, Label, Warning } from './NodeShell';

type SweetenerData = Extract<NodeData, { kind: 'sweetener' }>;
export type SweetenerFlowNode = Node<SweetenerData, 'sweetener'>;

function sumPct(split: { pacKey: string; pct: number }[]): number {
  return split.reduce((sum, s) => sum + (Number.isFinite(s.pct) ? s.pct : 0), 0);
}

export function SweetenerNode({ id, data }: NodeProps<SweetenerFlowNode>) {
  const { updateNodeData } = useComposer();

  function handleTotalPctChange(e: ChangeEvent<HTMLInputElement>) {
    const value = e.target.valueAsNumber;
    updateNodeData<SweetenerData>(id, { totalPct: Number.isFinite(value) ? value : 0 });
  }

  function handleRowKeyChange(index: number, e: ChangeEvent<HTMLSelectElement>) {
    const next = data.split.map((s, i) => (i === index ? { ...s, pacKey: e.target.value } : s));
    updateNodeData<SweetenerData>(id, { split: next });
  }

  function handleRowPctChange(index: number, e: ChangeEvent<HTMLInputElement>) {
    const pct = e.target.valueAsNumber;
    const next = data.split.map((s, i) => (i === index ? { ...s, pct: Number.isFinite(pct) ? pct : 0 } : s));
    updateNodeData<SweetenerData>(id, { split: next });
  }

  function handleRemoveRow(index: number) {
    updateNodeData<SweetenerData>(id, { split: data.split.filter((_, i) => i !== index) });
  }

  function handleAddRow() {
    updateNodeData<SweetenerData>(id, { split: [...data.split, { pacKey: SWEETENER_KEYS[0], pct: 0 }] });
  }

  const total = sumPct(data.split);
  const isBalanced = Math.abs(total - 100) < 0.5;

  return (
    <>
      <NodeShell
        title="Sweetener"
        footer={!isBalanced ? <Warning>Split sums to {total.toFixed(1)}%, not 100%</Warning> : undefined}
      >
        <Row>
          <Label htmlFor={`${id}-total`}>% of recipe</Label>
          <Input id={`${id}-total`} type="number" value={data.totalPct} onChange={handleTotalPctChange} />
        </Row>

        {data.split.map((row, index) => (
          <Row key={index}>
            <Select value={row.pacKey} onChange={(e) => handleRowKeyChange(index, e)}>
              {SWEETENER_KEYS.map((key) => (
                <option key={key} value={key}>
                  {prettifyKey(key)}
                </option>
              ))}
            </Select>
            <Input
              type="number"
              value={row.pct}
              onChange={(e) => handleRowPctChange(index, e)}
              style={{ width: 64, flex: '0 0 auto' }}
            />
            <SmallButton onClick={() => handleRemoveRow(index)}>×</SmallButton>
          </Row>
        ))}

        <Row>
          <SmallButton onClick={handleAddRow}>+ sweetener</SmallButton>
        </Row>
      </NodeShell>
      <Handle type="source" position={Position.Right} />
    </>
  );
}
