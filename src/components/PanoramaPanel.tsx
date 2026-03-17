import { useEffect, useMemo, useState } from 'react';
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

interface SubFunction {
  name: string;
  shouldDrillDown: number;
  possibleFile: string;
  description: string;
  url?: string;
  depth?: number;
  moduleId?: string;
  moduleName?: string;
  subFunctions?: SubFunction[];
}

interface AnalyzedFunction {
  name: string;
  file: string;
  description: string;
  moduleId?: string;
  moduleName?: string;
  subFunctions?: SubFunction[];
}

interface FunctionModule {
  id: string;
  name: string;
  description: string;
  color: string;
  functionNames: string[];
}

interface PanoramaPanelProps {
  analyzedFunctions: AnalyzedFunction[];
  functionModules: FunctionModule[];
  activeModuleId: string | null;
  onNodeOpenSource?: (filePath: string, functionName: string) => void;
  onManualDrillNode?: (payload: { nodeId: string; functionName: string; filePath: string; depth: number }) => void;
}

interface GraphNodeMeta {
  id: string;
  parentId: string | null;
  childrenIds: string[];
  depth: number;
  name: string;
  file: string;
  description: string;
  url?: string;
  isRoot?: boolean;
  shouldDrillDown?: number;
  headerColor: string;
  visibleByModule: boolean;
}

const CustomNode = ({
  data,
}: {
  data: {
    nodeId: string;
    name: string;
    file: string;
    description: string;
    url?: string;
    isRoot?: boolean;
    dimmed?: boolean;
    headerColor: string;
    hasChildren: boolean;
    isExpanded: boolean;
    canManualDrill: boolean;
    depth: number;
    onToggle: (nodeId: string) => void;
    onManualDrill: (nodeId: string, name: string, file: string, depth: number) => void;
  };
}) => {
  return (
    <div className={`relative w-64 overflow-visible transition-all ${data.dimmed ? 'opacity-30 grayscale' : 'opacity-100'}`}>
      <div
        className={`rounded-xl border-2 bg-white flex flex-col overflow-hidden ${
          data.isRoot ? 'border-indigo-500 shadow-lg' : 'border-slate-700 shadow-md'
        }`}
      >
      <Handle type="target" position={Position.Top} className="w-2 h-2 !bg-slate-400" />
      <div
        className="border-b border-slate-700 px-4 py-2 flex items-center justify-center"
        style={{ backgroundColor: data.headerColor }}
      >
        <span className="font-mono text-[11px] font-bold text-white truncate" title={data.file}>
          {data.file || 'Unknown File'}
        </span>
      </div>
      <div className="p-4 pb-8 flex flex-col items-center justify-center bg-white">
        <span className="max-w-full truncate font-bold text-sm text-slate-900 mb-1 text-center" title={data.name}>
          {data.name}
        </span>
        <span className="text-xs text-slate-500 text-center line-clamp-2" title={data.description}>
          {data.description}
        </span>
        {data.url && (
          <span className="mt-2 rounded bg-slate-100 px-2 py-0.5 font-mono text-[10px] text-slate-700" title={data.url}>
            {data.url}
          </span>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="w-2 h-2 !bg-slate-400" />
      </div>

      {data.hasChildren && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            data.onToggle(data.nodeId);
          }}
          className="absolute left-1/2 bottom-0 z-20 h-7 w-7 -translate-x-1/2 translate-y-1/2 rounded-full border border-slate-300 bg-white text-slate-700 shadow hover:bg-slate-50"
          title={data.isExpanded ? '收起子节点' : '展开子节点'}
        >
          {data.isExpanded ? '-' : '+'}
        </button>
      )}

      {!data.hasChildren && data.canManualDrill && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            data.onManualDrill(data.nodeId, data.name, data.file, data.depth);
          }}
          className="absolute left-1/2 bottom-0 z-20 -translate-x-1/2 translate-y-1/2 rounded-full border border-indigo-300 bg-indigo-50 px-3 py-1 text-[10px] font-medium text-indigo-700 shadow hover:bg-indigo-100"
          title="继续下钻一层"
        >
          继续下钻
        </button>
      )}
    </div>
  );
};

const nodeTypes = {
  custom: CustomNode,
};

const getNodeId = (parentPath: string, index: number) => (parentPath ? `${parentPath}-${index}` : `root-${index}`);

export default function PanoramaPanel({
  analyzedFunctions,
  functionModules,
  activeModuleId,
  onNodeOpenSource,
  onManualDrillNode,
}: PanoramaPanelProps) {
  const moduleMap = useMemo(() => {
    const map = new Map<string, FunctionModule>();
    functionModules.forEach((module) => map.set(module.id, module));
    return map;
  }, [functionModules]);

  const graph = useMemo(() => {
    if (!analyzedFunctions || analyzedFunctions.length === 0) {
      return { nodes: new Map<string, GraphNodeMeta>(), rootId: null as string | null };
    }

    const root = analyzedFunctions[0];
    const nodes = new Map<string, GraphNodeMeta>();

    const resolveNodeVisual = (moduleId?: string) => {
      const moduleColor = moduleId ? moduleMap.get(moduleId)?.color : undefined;
      const visible = !activeModuleId || !!(moduleId && moduleId === activeModuleId);
      return {
        headerColor: moduleColor || '#334155',
        visible,
      };
    };

    const rootVisual = resolveNodeVisual(root.moduleId);
    nodes.set('root', {
      id: 'root',
      parentId: null,
      childrenIds: [],
      depth: 0,
      name: root.name,
      file: root.file,
      description: root.description,
      isRoot: true,
      headerColor: rootVisual.headerColor,
      visibleByModule: rootVisual.visible,
    });

    const walk = (subs: SubFunction[] | undefined, parentId: string, depth: number) => {
      if (!subs || subs.length === 0) {
        return;
      }

      const parentNode = nodes.get(parentId);
      subs.forEach((sub, index) => {
        const nodeId = getNodeId(parentId, index);
        const visual = resolveNodeVisual(sub.moduleId);
        nodes.set(nodeId, {
          id: nodeId,
          parentId,
          childrenIds: [],
          depth,
          name: sub.name,
          file: sub.possibleFile,
          description: sub.description,
          url: sub.url,
          shouldDrillDown: sub.shouldDrillDown,
          headerColor: visual.headerColor,
          visibleByModule: visual.visible,
        });
        if (parentNode) {
          parentNode.childrenIds.push(nodeId);
        }
        walk(sub.subFunctions, nodeId, depth + 1);
      });
    };

    walk(root.subFunctions, 'root', 1);
    return { nodes, rootId: 'root' };
  }, [analyzedFunctions, moduleMap, activeModuleId]);

  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const nextExpanded = new Set<string>();
    graph.nodes.forEach((node) => {
      if (node.childrenIds.length > 0) {
        nextExpanded.add(node.id);
      }
    });
    setExpandedNodeIds(nextExpanded);
  }, [graph]);

  const visibleNodeIds = useMemo(() => {
    const visible = new Set<string>();
    if (!graph.rootId || !graph.nodes.has(graph.rootId)) {
      return visible;
    }

    const dfs = (nodeId: string) => {
      visible.add(nodeId);
      if (!expandedNodeIds.has(nodeId)) {
        return;
      }
      const node = graph.nodes.get(nodeId);
      if (!node) {
        return;
      }
      node.childrenIds.forEach((childId) => dfs(childId));
    };

    dfs(graph.rootId);
    return visible;
  }, [graph, expandedNodeIds]);

  const initialNodes = useMemo(() => {
    if (!graph.rootId || graph.nodes.size === 0) {
      return [];
    }

    const layoutByDepth = new Map<number, string[]>();
    visibleNodeIds.forEach((nodeId) => {
      const node = graph.nodes.get(nodeId);
      if (!node) return;
      if (!layoutByDepth.has(node.depth)) {
        layoutByDepth.set(node.depth, []);
      }
      layoutByDepth.get(node.depth)!.push(nodeId);
    });

    const positioned: any[] = [];
    Array.from(layoutByDepth.keys())
      .sort((a, b) => a - b)
      .forEach((depth) => {
        const ids = layoutByDepth.get(depth) || [];
        ids.forEach((nodeId, index) => {
          const node = graph.nodes.get(nodeId);
          if (!node) return;
          const x = 80 + depth * 360;
          const y = 60 + index * 220;
          const hasChildren = node.childrenIds.length > 0;
          const canManualDrill = !hasChildren && (node.shouldDrillDown === 0 || node.shouldDrillDown === 1);
          positioned.push({
            id: nodeId,
            type: 'custom',
            position: { x, y },
            data: {
              nodeId,
              name: node.name,
              file: node.file,
              description: node.description,
              url: node.url,
              isRoot: node.isRoot,
              dimmed: !node.visibleByModule,
              headerColor: node.headerColor,
              hasChildren,
              isExpanded: expandedNodeIds.has(nodeId),
              canManualDrill,
              depth: node.depth,
              onToggle: (targetId: string) => {
                setExpandedNodeIds((prev) => {
                  const next = new Set(prev);
                  if (next.has(targetId)) {
                    next.delete(targetId);
                  } else {
                    next.add(targetId);
                  }
                  return next;
                });
              },
              onManualDrill: (targetId: string, name: string, file: string, depthValue: number) => {
                if (onManualDrillNode) {
                  onManualDrillNode({ nodeId: targetId, functionName: name, filePath: file, depth: depthValue });
                }
              },
            },
          });
        });
      });

    return positioned;
  }, [graph, visibleNodeIds, expandedNodeIds, onManualDrillNode]);

  const initialEdges = useMemo(() => {
    if (graph.nodes.size === 0) {
      return [];
    }
    const edges: any[] = [];
    let edgeCounter = 0;
    graph.nodes.forEach((node) => {
      node.childrenIds.forEach((childId) => {
        if (!visibleNodeIds.has(node.id) || !visibleNodeIds.has(childId)) {
          return;
        }
        const sourceVisible = graph.nodes.get(node.id)?.visibleByModule ?? true;
        const targetVisible = graph.nodes.get(childId)?.visibleByModule ?? true;
        const visible = sourceVisible && targetVisible;
        edges.push({
          id: `e-${edgeCounter++}`,
          source: node.id,
          target: childId,
          type: 'smoothstep',
          animated: visible,
          style: {
            stroke: visible ? '#1e293b' : '#cbd5e1',
            strokeWidth: 2,
            strokeDasharray: '5,5',
            opacity: visible ? 1 : 0.45,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: visible ? '#1e293b' : '#cbd5e1',
          },
        });
      });
    });
    return edges;
  }, [graph, visibleNodeIds]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  if (!analyzedFunctions || analyzedFunctions.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-500 bg-slate-50">
        <p className="text-sm">暂无可视化函数调用链数据</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-slate-50 relative">
      <div className="absolute right-3 top-3 z-20 flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            const allExpandable = new Set<string>();
            graph.nodes.forEach((node) => {
              if (node.childrenIds.length > 0) {
                allExpandable.add(node.id);
              }
            });
            setExpandedNodeIds(allExpandable);
          }}
          className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-700 shadow hover:bg-slate-50"
        >
          全部展开
        </button>
        <button
          type="button"
          onClick={() => setExpandedNodeIds(new Set())}
          className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-700 shadow hover:bg-slate-50"
        >
          全部收起
        </button>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={(_, node) => {
          const filePath = node?.data?.file as string;
          const functionName = node?.data?.name as string;
          if (onNodeOpenSource && filePath && functionName) {
            onNodeOpenSource(filePath, functionName);
          }
        }}
        nodeTypes={nodeTypes}
        fitView
        attributionPosition="bottom-right"
      >
        <Controls />
        <Background color="#cbd5e1" gap={16} />
      </ReactFlow>
    </div>
  );
}
