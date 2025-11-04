import type { GraphNode, GraphLink, Vec2, PortInfo, CodeGenerationConfig, DataTypeDefinition, CategoryDefinition } from './types';

/**
 * Central state store for the graph editor
 */
export class EditorStore {
  registryLoaded = false;
  codeGeneration: CodeGenerationConfig = {
    language: 'flex',
    indentation: '    ',
    variablePrefix: 'var_',
    resultPrefix: 'result_',
    commentStyle: '//'
  };
  
  dataTypes: Record<string, DataTypeDefinition> = {};
  nodeCategories: Record<string, CategoryDefinition> = {};
  nodes: GraphNode[] = [];
  links: GraphLink[] = [];
  nodeIdCounter = 0;
  linkIdCounter = 0;

  camera = { x: 0, y: 0, zoom: 1 };
  viewport = { w: 0, h: 0 };

  interaction = {
    isDragging: false,
    dragOffsets: new Map<GraphNode, Vec2>(),
    isConnecting: false,
    connectionStart: null as PortInfo | null,
    connectionEnd: { x: 0, y: 0 },
    selection: { active: false, start: { x: 0, y: 0 }, end: { x: 0, y: 0 } },
    hoveredPort: null as PortInfo | null,
    mouse: { x: 0, y: 0 },
    selectedNodes: new Set<GraphNode>(),
  };

  ui = {
    contextMenu: {
      visible: false,
      worldX: 0,
      worldY: 0,
      pendingSource: null as PortInfo | null,
    },
  };

  nextNodeId(): number {
    return this.nodeIdCounter++;
  }

  nextLinkId(): number {
    return this.linkIdCounter++;
  }

  clear(): void {
    this.nodes = [];
    this.links = [];
    this.nodeIdCounter = 0;
    this.linkIdCounter = 0;
    this.interaction.selectedNodes.clear();
    this.interaction.dragOffsets.clear();
  }
}
