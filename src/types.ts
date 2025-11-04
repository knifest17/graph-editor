// Core types for the graph editor

export interface Vec2 {
  x: number;
  y: number;
}

export interface Port {
  type: string;
  name?: string;
  x: number;
  y: number;
  implicit?: boolean;
  code?: string; // Code template for generation
  dynamic?: {
    naming: 'numeric' | 'abc';
    delimiter: string;
  };
}

export interface PortInfo {
  node: GraphNode;
  index: number;
  type: 'input' | 'output';
  port: Port;
}

export interface GraphNode {
  id: number;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  category: string;
  type: string;
  selected: boolean;
  color: string;
  inputs?: Port[];
  outputs?: Port[];
  execOutPortCount: number;
  hasValue?: boolean;
  valueType?: string;
  value?: unknown;
  
  // Methods
  updatePortPositions(): void;
  containsPoint(x: number, y: number): boolean;
  portAt(x: number, y: number): PortInfo | null;
}

export interface GraphLink {
  id: number;
  fromPort: PortInfo;
  toPort: PortInfo;
  selected: boolean;
}

export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

export interface NodeTypeDefinition {
  title: string;
  category: string;
  description?: string;
  color?: string;
  inputs?: Port[];
  outputs?: Port[];
  value?: {
    type: 'bool' | 'int' | 'float' | 'string' | 'color' | 'float3';
    default?: unknown;
  };
  style?: {
    minWidth?: number;
  };
  [key: string]: unknown;
}

export interface DataTypeDefinition {
  name: string;
  color: string;
}

export interface CategoryDefinition {
  color: string;
  nodes?: Record<string, NodeTypeDefinition>;
}

export interface CodeGenerationConfig {
  language: string;
  indentation: string;
  variablePrefix: string;
  resultPrefix: string;
  commentStyle: string;
}

export interface NodeRegistry {
  version?: string;
  codeGeneration?: CodeGenerationConfig;
  dataTypes?: Record<string, DataTypeDefinition>;
  nodeCategories?: Record<string, CategoryDefinition>;
  nodeTypes?: Record<string, NodeTypeDefinition>;
  ports?: Record<string, Record<string, unknown>>;
}

export interface GraphData {
  version?: string;
  name?: string;
  description?: string;
  author?: string;
  nodes: SerializedNode[];
  connections: SerializedConnection[];
}

export interface SerializedNode {
  id: number;
  type: string;
  category: string;
  x: number;
  y: number;
  value?: unknown;
}

export interface SerializedConnection {
  id: number;
  from: {
    nodeId: number;
    portIndex: number;
    portType: 'input' | 'output';
  };
  to: {
    nodeId: number;
    portIndex: number;
    portType: 'input' | 'output';
  };
}

export interface InteractionState {
  isDragging: boolean;
  dragOffsets: Map<GraphNode, Vec2>;
  isConnecting: boolean;
  connectionStart: PortInfo | null;
  connectionEnd: Vec2;
  selection: {
    active: boolean;
    start: Vec2;
    end: Vec2;
  };
  hoveredPort: PortInfo | null;
  mouse: Vec2;
  selectedNodes: Set<GraphNode>;
}

export interface GraphEditorState {
  registryLoaded: boolean;
  codeGeneration: CodeGenerationConfig;
  dataTypes: Record<string, DataTypeDefinition>;
  nodeCategories: Record<string, CategoryDefinition>;
  nodes: GraphNode[];
  links: GraphLink[];
  nodeIdCounter: number;
  linkIdCounter: number;
  camera: Camera;
  viewport: { w: number; h: number };
  interaction: InteractionState;
}
