import type {
  GraphNode,
  GraphLink,
  Vec2,
  PortInfo,
  CodeGenerationConfig,
  DataTypeDefinition,
  CategoryDefinition,
} from "./types";

/**
 * Central state store for the graph editor
 */
export class EditorStore {
  registryLoaded = false;
  codeGeneration: CodeGenerationConfig = {
    language: "flex",
    indentation: "    ",
    variablePrefix: "var_",
    resultPrefix: "result_",
    commentStyle: "//",
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

  /**
   * Check if two port types are compatible for connection
   * @param fromType The output port type
   * @param toType The input port type
   * @returns true if the connection is valid
   */
  canConnectTypes(fromType: string, toType: string): boolean {
    // Exec ports can always connect to exec ports
    if (fromType === "exec" && toType === "exec") {
      return true;
    }

    // Exec ports cannot connect to data ports
    if (fromType === "exec" || toType === "exec") {
      return false;
    }

    // Same types can always connect
    if (fromType === toType) {
      return true;
    }

    // 'data' input type can accept any output type
    if (toType === "data") {
      return true;
    }

    // 'data' output type cannot connect to specific typed inputs
    // (only specific types or data can connect to specific inputs)
    if (fromType === "data" && toType !== "data") {
      return false;
    }

    // For other types, they must match exactly
    // (Could be extended with a type compatibility matrix from registry)
    return false;
  }

  /**
   * Validate if a connection can be created between two ports
   * This is the single source of truth for connection validation
   * @param from Source port (can be input or output)
   * @param to Target port (can be input or output)
   * @returns true if the connection is valid, false otherwise
   */
  canConnect(from: PortInfo, to: PortInfo): boolean {
    // Can't connect to same node
    if (from.node === to.node) return false;

    // Must be different port types (input to output or vice versa)
    if (from.type === to.type) return false;

    // Ensure from is output and to is input for validation
    const outputPort = from.type === "output" ? from : to;
    const inputPort = from.type === "input" ? from : to;

    // Check type compatibility
    if (!this.canConnectTypes(outputPort.port.type, inputPort.port.type)) {
      return false;
    }

    // Check if exact connection already exists
    const exactConnectionExists = this.links.some(
      (l) =>
        (l.fromPort.node === outputPort.node &&
          l.fromPort.index === outputPort.index &&
          l.toPort.node === inputPort.node &&
          l.toPort.index === inputPort.index) ||
        (l.fromPort.node === inputPort.node &&
          l.fromPort.index === inputPort.index &&
          l.toPort.node === outputPort.node &&
          l.toPort.index === outputPort.index)
    );
    if (exactConnectionExists) return false;

    // For exec output ports: allow connections (replacement handled in connection creation)
    // For non-exec input ports: only allow one connection per input allowed
    // (exec inputs can have multiple connections)
    if (inputPort.port.type !== "exec") {
      const hasExistingInputConnection = this.links.some(
        (l) =>
          l.toPort.node === inputPort.node &&
          l.toPort.index === inputPort.index &&
          l.toPort.type === "input"
      );
      if (hasExistingInputConnection) return false;
    }

    return true;
  }

  /**
   * Validate all connections in the graph
   * Removes invalid connections and returns the list of removed links
   * @returns Array of removed invalid links
   */
  validateConnections(): GraphLink[] {
    const invalidLinks: GraphLink[] = [];

    // Track connections per port to detect duplicates
    const execOutputConnections = new Map<string, GraphLink[]>();
    const dataInputConnections = new Map<string, GraphLink[]>();

    for (const link of this.links) {
      let isValid = true;

      // Check if nodes still exist
      const fromNodeExists = this.nodes.some((n) => n === link.fromPort.node);
      const toNodeExists = this.nodes.some((n) => n === link.toPort.node);
      if (!fromNodeExists || !toNodeExists) {
        isValid = false;
      }

      // Check type compatibility
      if (
        isValid &&
        !this.canConnectTypes(link.fromPort.port.type, link.toPort.port.type)
      ) {
        isValid = false;
      }

      // Track exec output connections (only one allowed per output)
      if (isValid && link.fromPort.port.type === "exec") {
        const key = `${link.fromPort.node.id}-${link.fromPort.index}`;
        if (!execOutputConnections.has(key)) {
          execOutputConnections.set(key, []);
        }
        execOutputConnections.get(key)!.push(link);
      }

      // Track data input connections (only one allowed per input)
      if (isValid && link.toPort.port.type !== "exec") {
        const key = `${link.toPort.node.id}-${link.toPort.index}`;
        if (!dataInputConnections.has(key)) {
          dataInputConnections.set(key, []);
        }
        dataInputConnections.get(key)!.push(link);
      }

      if (!isValid) {
        invalidLinks.push(link);
      }
    }

    // Check for multiple exec output connections (keep only the first one)
    for (const [key, links] of execOutputConnections) {
      if (links.length > 1) {
        // Keep the first link, mark rest as invalid
        for (let i = 1; i < links.length; i++) {
          if (!invalidLinks.includes(links[i])) {
            invalidLinks.push(links[i]);
          }
        }
      }
    }

    // Check for multiple data input connections (keep only the first one)
    for (const [key, links] of dataInputConnections) {
      if (links.length > 1) {
        // Keep the first link, mark rest as invalid
        for (let i = 1; i < links.length; i++) {
          if (!invalidLinks.includes(links[i])) {
            invalidLinks.push(links[i]);
          }
        }
      }
    }

    // Remove invalid links
    if (invalidLinks.length > 0) {
      this.links = this.links.filter((link) => !invalidLinks.includes(link));
    }

    return invalidLinks;
  }
}
