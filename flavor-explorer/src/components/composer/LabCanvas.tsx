import '@xyflow/react/dist/style.css';
import {
  ReactFlow,
  Panel,
  type Connection,
  type Edge,
  type Node,
  type NodeTypes,
  type OnConnect,
  type OnEdgesChange,
  type OnNodesChange,
} from '@xyflow/react';
import styled from 'styled-components';
import type { NodeData } from '../../lib/composer/types';
import { StyleNode } from './nodes/StyleNode';
import { BaseNode } from './nodes/BaseNode';
import { SweetenerNode } from './nodes/SweetenerNode';
import { ServingTempNode } from './nodes/ServingTempNode';
import { OutputNode } from './nodes/OutputNode';
import { FlavoringNode } from './nodes/FlavoringNode';
import { IngredientNode } from './nodes/IngredientNode';
import { PacCheckNode } from './nodes/checks/PacCheckNode';
import { MacroCheckNode } from './nodes/checks/MacroCheckNode';

export type ComposerFlowNode = Node<NodeData>;

const nodeTypes: NodeTypes = {
  style: StyleNode,
  base: BaseNode,
  sweetener: SweetenerNode,
  servingTemp: ServingTempNode,
  output: OutputNode,
  flavoring: FlavoringNode,
  ingredient: IngredientNode,
  pacCheck: PacCheckNode,
  macroCheck: MacroCheckNode,
};

const CONNECTABLE_SOURCE_KINDS = new Set<NodeData['kind']>(['flavoring', 'ingredient']);
const CONNECTABLE_TARGET_KINDS = new Set<NodeData['kind']>(['output', 'macroCheck']);

interface Props {
  nodes: ComposerFlowNode[];
  edges: Edge[];
  onNodesChange: OnNodesChange<ComposerFlowNode>;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  onAddNode: (kind: 'flavoring' | 'ingredient' | 'macroCheck') => void;
}

export function LabCanvas({ nodes, edges, onNodesChange, onEdgesChange, onConnect, onAddNode }: Props) {
  function isValidConnection(edgeOrConnection: Edge | Connection): boolean {
    const { source, target } = edgeOrConnection;
    if (source === target) return false;

    const sourceNode = nodes.find((n) => n.id === source);
    const targetNode = nodes.find((n) => n.id === target);
    if (!sourceNode || !targetNode) return false;
    if (!CONNECTABLE_SOURCE_KINDS.has(sourceNode.data.kind)) return false;
    if (!CONNECTABLE_TARGET_KINDS.has(targetNode.data.kind)) return false;

    const isDuplicate = edges.some((e) => e.source === source && e.target === target);
    if (isDuplicate) return false;

    return true;
  }

  return (
    <Wrap>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        isValidConnection={isValidConnection}
        defaultEdgeOptions={{ style: { stroke: '#000', strokeWidth: 1 }, deletable: true }}
        minZoom={1}
        maxZoom={1}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
        panOnDrag
        nodesDraggable
        proOptions={{ hideAttribution: true }}
      >
        <Panel position="top-left">
          <Toolbar>
            <ToolbarButton onClick={() => onAddNode('flavoring')}>+ flavoring</ToolbarButton>
            <ToolbarButton onClick={() => onAddNode('ingredient')}>+ ingredient</ToolbarButton>
            <ToolbarButton onClick={() => onAddNode('macroCheck')}>+ macro check</ToolbarButton>
          </Toolbar>
        </Panel>
      </ReactFlow>
    </Wrap>
  );
}

const Wrap = styled.div`
  flex: 1;
  height: 100%;
  min-width: 0;

  .react-flow {
    background: #fff;
  }

  .react-flow__edge-path {
    stroke: #000;
  }

  .react-flow__attribution {
    display: none;
  }
`;

const Toolbar = styled.div`
  display: flex;
  gap: 6px;
`;

const ToolbarButton = styled.button`
  font-family: inherit;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 6px 10px;
  border: 1px solid #000;
  background: #fff;
  color: #000;
  cursor: pointer;

  &:hover {
    background: #000;
    color: #fff;
  }
`;
