import { useCallback, useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { addEdge, useEdgesState, useNodesState, type Edge, type OnConnect } from '@xyflow/react';
import type {
  BaseComponent,
  ComposerDoc,
  IngredientMacros,
  NodeData,
  PersistedEdge,
  PersistedNode,
  SavedBase,
} from '../../lib/composer/types';
import {
  debounce,
  loadDoc,
  loadSavedBases,
  loadUserIngredients,
  saveDoc,
  saveSavedBases,
  saveUserIngredients,
} from '../../lib/composer/storage';
import { buildIngredientDb } from '../../lib/composer/ingredientDb';
import { defaultDoc } from './defaultDoc';
import { computeDerived } from './derive';
import { ComposerContext, type ComposerContextValue } from './ComposerContext';
import { LabCanvas, type ComposerFlowNode } from './LabCanvas';
import { RecipePanel } from './RecipePanel';

let nodeIdCounter = 0;
function nextId(prefix: string): string {
  nodeIdCounter += 1;
  return `${prefix}-${Date.now()}-${nodeIdCounter}`;
}

function newNodeData(kind: 'flavoring' | 'ingredient' | 'macroCheck'): NodeData {
  switch (kind) {
    case 'macroCheck':
      return { kind: 'macroCheck' };
    case 'flavoring':
      return { kind: 'flavoring', ingredientId: null, pct: 0 };
    case 'ingredient':
      return { kind: 'ingredient', ingredientId: null, pct: 0 };
  }
}

function toFlowNode(n: PersistedNode): ComposerFlowNode {
  return { id: n.id, type: n.type, position: n.position, data: n.data, deletable: n.deletable, hidden: n.hidden };
}

function toFlowEdge(e: PersistedEdge): Edge {
  return { id: e.id, source: e.source, target: e.target, deletable: e.deletable, hidden: e.hidden };
}

function toPersistedNode(n: ComposerFlowNode): PersistedNode {
  return {
    id: n.id,
    type: n.type ?? n.data.kind,
    position: n.position,
    data: n.data,
    deletable: n.deletable,
    hidden: n.hidden,
  };
}

function toPersistedEdge(e: Edge): PersistedEdge {
  return { id: e.id, source: e.source, target: e.target, deletable: e.deletable, hidden: e.hidden };
}

const debouncedSaveDoc = debounce(saveDoc, 400);

export function ComposerPage() {
  const initialDoc = useMemo(() => loadDoc() ?? defaultDoc(), []);
  const [nodes, setNodes, onNodesChange] = useNodesState<ComposerFlowNode>(initialDoc.nodes.map(toFlowNode));
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initialDoc.edges.map(toFlowEdge));

  const [userIngredients, setUserIngredients] = useState<IngredientMacros[]>(() => loadUserIngredients());
  const [savedBases, setSavedBases] = useState<SavedBase[]>(() => loadSavedBases());

  useEffect(() => {
    saveUserIngredients(userIngredients);
  }, [userIngredients]);

  useEffect(() => {
    saveSavedBases(savedBases);
  }, [savedBases]);

  useEffect(() => {
    debouncedSaveDoc({ nodes: nodes.map(toPersistedNode), edges: edges.map(toPersistedEdge) });
  }, [nodes, edges]);

  // Sorbet has no base: hide (don't delete) the base node and its fixed
  // edges so switching back to another style restores it untouched.
  const styleNodeData = nodes.find((n) => n.id === 'style')?.data as
    | Extract<NodeData, { kind: 'style' }>
    | undefined;
  const styleValue = styleNodeData?.style;

  useEffect(() => {
    const isSorbet = styleValue === 'sorbet';
    setNodes((nds) => nds.map((n) => (n.id === 'base' && n.hidden !== isSorbet ? { ...n, hidden: isSorbet } : n)));
    setEdges((eds) =>
      eds.map((e) =>
        (e.id === 'edge-style-base' || e.id === 'edge-base-output') && e.hidden !== isSorbet
          ? { ...e, hidden: isSorbet }
          : e,
      ),
    );
  }, [styleValue, setNodes, setEdges]);

  const db = useMemo(() => buildIngredientDb(userIngredients), [userIngredients]);

  const derived = useMemo(() => {
    const doc: ComposerDoc = { nodes: nodes.map(toPersistedNode), edges: edges.map(toPersistedEdge) };
    return computeDerived(doc, db);
  }, [nodes, edges, db]);

  const updateNodeData = useCallback(
    <T extends NodeData = NodeData>(id: string, patch: Partial<T>) => {
      setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } as NodeData } : n)));
    },
    [setNodes],
  );

  const saveBase = useCallback((name: string, components: BaseComponent[]) => {
    setSavedBases((prev) => [...prev, { id: nextId('base'), name, components }]);
  }, []);

  const addUserIngredient = useCallback((ingredient: IngredientMacros) => {
    setUserIngredients((prev) => [...prev, ingredient]);
  }, []);

  const onConnect: OnConnect = useCallback(
    (connection) => {
      setEdges((eds) => addEdge({ ...connection, deletable: true }, eds));
    },
    [setEdges],
  );

  const onAddNode = useCallback(
    (kind: 'flavoring' | 'ingredient' | 'macroCheck') => {
      const id = nextId(kind);
      const position = { x: 680, y: 620 + (nodes.length % 6) * 44 };
      setNodes((nds) => [...nds, { id, type: kind, position, data: newNodeData(kind), deletable: true }]);
    },
    [nodes.length, setNodes],
  );

  const contextValue: ComposerContextValue = useMemo(
    () => ({ db, derived, savedBases, updateNodeData, saveBase, addUserIngredient }),
    [db, derived, savedBases, updateNodeData, saveBase, addUserIngredient],
  );

  return (
    <ComposerContext.Provider value={contextValue}>
      <Layout>
        <LabCanvas
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onAddNode={onAddNode}
        />
        <RecipeAside>
          <RecipePanel />
        </RecipeAside>
      </Layout>
    </ComposerContext.Provider>
  );
}

const Layout = styled.div`
  display: flex;
  height: 100%;
  overflow: hidden;
`;

const RecipeAside = styled.div`
  flex: 0 0 420px;
  width: 420px;
  border-left: 1px solid #000;
  overflow: hidden;
`;
