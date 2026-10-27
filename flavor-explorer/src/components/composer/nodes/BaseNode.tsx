import type { ChangeEvent } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { BaseComponent, NodeData } from '../../../lib/composer/types';
import { useComposer } from '../ComposerContext';
import { NodeShell, Row, Select, Input, SmallButton, Warning } from './NodeShell';

type BaseData = Extract<NodeData, { kind: 'base' }>;
export type BaseFlowNode = Node<BaseData, 'base'>;

const DAIRY_VALUE = '__dairy__';
const CUSTOM_VALUE = '__custom__';

const DEFAULT_DAIRY_COMPONENTS: BaseComponent[] = [
  { ingredientId: 'milk-whole-3-25-milkfat', pct: 60 },
  { ingredientId: 'cream-fluid-heavy-whipping', pct: 40 },
];

function sumPct(components: BaseComponent[]): number {
  return components.reduce((sum, c) => sum + (Number.isFinite(c.pct) ? c.pct : 0), 0);
}

export function BaseNode({ id, data }: NodeProps<BaseFlowNode>) {
  const { db, savedBases, updateNodeData, saveBase } = useComposer();

  function handleSelectChange(e: ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value;
    if (value === DAIRY_VALUE) {
      updateNodeData<BaseData>(id, { baseId: null, components: DEFAULT_DAIRY_COMPONENTS.map((c) => ({ ...c })) });
      return;
    }
    if (value === CUSTOM_VALUE) {
      updateNodeData<BaseData>(id, { baseId: null });
      return;
    }
    const base = savedBases.find((b) => b.id === value);
    if (base) {
      updateNodeData<BaseData>(id, { baseId: base.id, components: base.components.map((c) => ({ ...c })) });
    }
  }

  function handleComponentIngredientChange(index: number, e: ChangeEvent<HTMLSelectElement>) {
    const next = data.components.map((c, i) => (i === index ? { ...c, ingredientId: e.target.value } : c));
    updateNodeData<BaseData>(id, { components: next, baseId: null });
  }

  function handleComponentPctChange(index: number, e: ChangeEvent<HTMLInputElement>) {
    const pct = e.target.valueAsNumber;
    const next = data.components.map((c, i) => (i === index ? { ...c, pct: Number.isFinite(pct) ? pct : 0 } : c));
    updateNodeData<BaseData>(id, { components: next, baseId: null });
  }

  function handleRemoveComponent(index: number) {
    const next = data.components.filter((_, i) => i !== index);
    updateNodeData<BaseData>(id, { components: next, baseId: null });
  }

  function handleAddComponent() {
    const fallback = db.all[0]?.id ?? '';
    updateNodeData<BaseData>(id, {
      components: [...data.components, { ingredientId: fallback, pct: 0 }],
      baseId: null,
    });
  }

  function handleSaveAs() {
    const name = window.prompt('Name this base:');
    if (!name) return;
    saveBase(
      name,
      data.components.map((c) => ({ ...c })),
    );
  }

  const total = sumPct(data.components);
  const isBalanced = Math.abs(total - 100) < 0.5;
  // Built-in dairy stores baseId null just like custom; recognize it by its components.
  const isDefaultDairy =
    data.baseId === null &&
    data.components.length === DEFAULT_DAIRY_COMPONENTS.length &&
    data.components.every(
      (c, i) =>
        c.ingredientId === DEFAULT_DAIRY_COMPONENTS[i].ingredientId && c.pct === DEFAULT_DAIRY_COMPONENTS[i].pct,
    );
  const selectValue = data.baseId ?? (isDefaultDairy ? DAIRY_VALUE : CUSTOM_VALUE);

  return (
    <>
      <Handle type="target" position={Position.Left} />
      <NodeShell
        title="Base"
        footer={!isBalanced ? <Warning>Components sum to {total.toFixed(1)}%, not 100%</Warning> : undefined}
      >
        <Row>
          <Select value={selectValue} onChange={handleSelectChange}>
            <option value={DAIRY_VALUE}>Dairy (built-in)</option>
            {savedBases.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
            <option value={CUSTOM_VALUE}>Custom</option>
          </Select>
        </Row>

        {data.components.map((component, index) => (
          <Row key={index}>
            <Select value={component.ingredientId} onChange={(e) => handleComponentIngredientChange(index, e)}>
              {db.all.map((ing) => (
                <option key={ing.id} value={ing.id}>
                  {ing.name}
                </option>
              ))}
            </Select>
            <Input
              type="number"
              value={component.pct}
              onChange={(e) => handleComponentPctChange(index, e)}
              style={{ width: 64, flex: '0 0 auto' }}
            />
            <SmallButton onClick={() => handleRemoveComponent(index)}>×</SmallButton>
          </Row>
        ))}

        <Row>
          <SmallButton onClick={handleAddComponent}>+ component</SmallButton>
          <SmallButton onClick={handleSaveAs}>Save as…</SmallButton>
        </Row>
      </NodeShell>
      <Handle type="source" position={Position.Right} />
    </>
  );
}
