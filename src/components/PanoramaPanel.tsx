import { useMemo } from 'react';
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
}

const CustomNode = ({
  data,
}: {
  data: {
    name: string;
    file: string;
    description: string;
    isRoot?: boolean;
    dimmed?: boolean;
    headerColor: string;
  };
}) => {
  return (
    <div
      className={`rounded-xl border-2 bg-white flex flex-col w-64 overflow-hidden transition-all ${
        data.isRoot ? 'border-indigo-500 shadow-lg' : 'border-slate-700 shadow-md'
      } ${data.dimmed ? 'opacity-30 grayscale' : 'opacity-100'}`}
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
      <div className="p-4 flex flex-col items-center justify-center bg-white">
        <span className="font-bold text-sm text-slate-900 mb-1 text-center">{data.name}</span>
        <span className="text-xs text-slate-500 text-center line-clamp-2" title={data.description}>
          {data.description}
        </span>
      </div>
      <Handle type="source" position={Position.Bottom} className="w-2 h-2 !bg-slate-400" />
    </div>
  );
};

const nodeTypes = {
  custom: CustomNode,
};

export default function PanoramaPanel({ analyzedFunctions, functionModules, activeModuleId, onNodeOpenSource }: PanoramaPanelProps) {
  const getNodeId = (parentPath: string, index: number) => (parentPath ? `${parentPath}-${index}` : `root-${index}`);

  const moduleMap = useMemo(() => {
    const map = new Map<string, FunctionModule>();
    functionModules.forEach((module) => map.set(module.id, module));
    return map;
  }, [functionModules]);

  const calculateNodePositions = (subFunctions: SubFunction[] | undefined): Map<string, { y: number; height: number }> => {
    const positions = new Map<string, { y: number; height: number }>();
    const nodeHeight = 150;
    const spacing = 30;

    const calculateHeight = (subs: SubFunction[] | undefined): number => {
      if (!subs || subs.length === 0) return nodeHeight;
      let total = 0;
      for (const sub of subs) total += calculateHeight(sub.subFunctions);
      return Math.max(total, nodeHeight);
    };

    let yOffset = 50;
    const assignPositions = (subs: SubFunction[] | undefined, currentDepth = 0): number => {
      if (!subs) return yOffset;
      for (const sub of subs) {
        const subFuncHeight = calculateHeight(sub.subFunctions);
        positions.set(`${currentDepth}-${subs.indexOf(sub)}`, { y: yOffset, height: subFuncHeight });
        yOffset += subFuncHeight + spacing;
        if (sub.subFunctions) assignPositions(sub.subFunctions, currentDepth + 1);
      }
      return yOffset;
    };

    assignPositions(subFunctions);
    return positions;
  };

  const { initialNodes, nodeVisibleMap } = useMemo(() => {
    if (!analyzedFunctions || analyzedFunctions.length === 0) {
      return { initialNodes: [], nodeVisibleMap: new Map<string, boolean>() };
    }

    const nodes: any[] = [];
    const visibleMap = new Map<string, boolean>();
    const root = analyzedFunctions[0];
    const positions = calculateNodePositions(root.subFunctions);

    const resolveNodeVisual = (moduleId?: string) => {
      const moduleColor = moduleId ? moduleMap.get(moduleId)?.color : undefined;
      const visible = !activeModuleId || !!(moduleId && moduleId === activeModuleId);
      return {
        headerColor: moduleColor || '#334155',
        visible,
      };
    };

    const rootVisual = resolveNodeVisual(root.moduleId);
    nodes.push({
      id: 'root',
      type: 'custom',
      position: { x: 50, y: 250 },
      data: {
        name: root.name,
        file: root.file,
        description: root.description,
        isRoot: true,
        dimmed: !rootVisual.visible,
        headerColor: rootVisual.headerColor,
      },
    });
    visibleMap.set('root', rootVisual.visible);

    const generateChildNodes = (subFunctions: SubFunction[] | undefined, parentPath: string, depth: number) => {
      if (!subFunctions) return;
      const xPosition = 350 + depth * 350;

      subFunctions.forEach((sub, index) => {
        const posKey = `${depth}-${index}`;
        const pos = positions.get(posKey);
        const yPosition = pos ? pos.y : 50 + index * 280;
        const nodeId = getNodeId(parentPath, index);
        const visual = resolveNodeVisual(sub.moduleId);

        nodes.push({
          id: nodeId,
          type: 'custom',
          position: { x: xPosition, y: yPosition },
          data: {
            name: sub.name,
            file: sub.possibleFile,
            description: sub.description,
            dimmed: !visual.visible,
            headerColor: visual.headerColor,
          },
        });
        visibleMap.set(nodeId, visual.visible);
        if (sub.subFunctions && sub.subFunctions.length > 0) generateChildNodes(sub.subFunctions, nodeId, depth + 1);
      });
    };

    if (root.subFunctions) generateChildNodes(root.subFunctions, 'root', 0);
    return { initialNodes: nodes, nodeVisibleMap: visibleMap };
  }, [analyzedFunctions, moduleMap, activeModuleId]);

  const initialEdges = useMemo(() => {
    if (!analyzedFunctions || analyzedFunctions.length === 0) return [];
    const edges: any[] = [];
    const root = analyzedFunctions[0];
    let edgeCounter = 0;

    const generateChildEdges = (subFunctions: SubFunction[] | undefined, parentId: string) => {
      if (!subFunctions) return;
      subFunctions.forEach((sub, index) => {
        const nodeId = getNodeId(parentId, index);
        const sourceVisible = nodeVisibleMap.get(parentId) ?? true;
        const targetVisible = nodeVisibleMap.get(nodeId) ?? true;
        const visible = sourceVisible && targetVisible;
        edges.push({
          id: `e-${edgeCounter++}`,
          source: parentId,
          target: nodeId,
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
        if (sub.subFunctions && sub.subFunctions.length > 0) generateChildEdges(sub.subFunctions, nodeId);
      });
    };

    if (root.subFunctions) generateChildEdges(root.subFunctions, 'root');
    return edges;
  }, [analyzedFunctions, activeModuleId, nodeVisibleMap]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useMemo(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  if (!analyzedFunctions || analyzedFunctions.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-500 bg-slate-50">
        <p className="text-sm">绛夊緟鍏ュ彛鏂囦欢鐮斿垽瀹屾垚鍚庯紝灏嗗湪姝ゅ睍绀哄嚱鏁拌皟鐢ㄥ叏鏅浘</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-slate-50">
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
