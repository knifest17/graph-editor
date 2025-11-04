import type { GraphNode, Port, PortInfo } from '../types';
import { EditorStore } from '../store';

/**
 * Implementation of GraphNode
 */
export class GraphNodeImpl implements GraphNode {
  id: number;
  x: number;
  y: number;
  category: string;
  type: string;
  selected = false;
  title: string;
  color: string;
  width: number;
  height: number;
  inputs?: Port[];
  outputs?: Port[];
  execOutPortCount: number;
  hasValue?: boolean;
  valueType?: string;
  value?: unknown;

  constructor(
    x: number,
    y: number,
    category: string,
    type: string,
    store: EditorStore
  ) {
    this.id = store.nextNodeId();
    this.x = x;
    this.y = y;
    this.category = category;
    this.type = type;

    // Get node definition from categories
    if (
      !store.registryLoaded ||
      !store.nodeCategories[category] ||
      !store.nodeCategories[category].nodes ||
      !store.nodeCategories[category].nodes![type]
    ) {
      throw new Error(
        `Node registry not loaded or node type not found: ${category}/${type}`
      );
    }

    const def = store.nodeCategories[category].nodes![type];

    this.title = def.title;
    this.color = def.color || store.nodeCategories[category].color;

    const minWidth = def.style?.minWidth || 80;
    // Width will be calculated later in calculateWidth() using canvas context
    this.width = minWidth;

    // Value handling
    this.hasValue = !!def.value;
    if (this.hasValue && def.value) {
      this.valueType = def.value.type;
      this.value = def.value.default;
    }

    // Deep copy inputs and outputs, filtering out implicit ports
    this.inputs = def.inputs
      ?.filter((port: Port) => !port.implicit)
      .map((input: Port) => ({ ...input, x: 0, y: 0 }));
    
    this.outputs = def.outputs
      ?.filter((port: Port) => !port.implicit)
      .map((output: Port) => ({ ...output, x: 0, y: 0 }));

    // Calculate exec-out port count for label logic
    this.execOutPortCount =
      this.outputs?.filter((port) => port.type === 'exec').length || 0;

    // Calculate height based on port count
    const maxPorts = Math.max(
      this.inputs?.length || 0,
      this.outputs?.length || 0
    );
    this.height = Math.max(60, 40 + maxPorts * 25);

    if (this.hasValue) {
      this.height += 30; // Extra space for value input
    }

    this.updatePortPositions();
  }

  /**
   * Calculate and update node width based on text content
   */
  calculateWidth(ctx: CanvasRenderingContext2D): void {
    const minWidth = 80;
    const padding = 20;
    const portLabelGap = 15; // Gap between port circle and label text
    
    // Measure title width
    ctx.font = 'bold 12px Arial';
    const titleWidth = ctx.measureText(this.title).width;
    
    // Measure port labels
    ctx.font = '11px Arial';
    let maxInputWidth = 0;
    let maxOutputWidth = 0;
    
    if (this.inputs) {
      for (const port of this.inputs) {
        if (port.name) {
          const width = ctx.measureText(port.name).width;
          maxInputWidth = Math.max(maxInputWidth, width);
        }
      }
    }
    
    if (this.outputs) {
      for (const port of this.outputs) {
        if (port.name) {
          const width = ctx.measureText(port.name).width;
          maxOutputWidth = Math.max(maxOutputWidth, width);
        }
      }
    }
    
    // Calculate required width
    // Option 1: Title width + padding
    const titleRequiredWidth = titleWidth + padding;
    
    // Option 2: Input labels + output labels + gaps
    const portRequiredWidth = maxInputWidth + maxOutputWidth + portLabelGap * 2 + padding;
    
    // Use the maximum of all requirements
    this.width = Math.max(minWidth, titleRequiredWidth, portRequiredWidth);
  }

  updatePortPositions(): void {
    const portSpacing = 25;
    const offsetY = 40; // Start drawing ports below title bar
    const offsetX = 10;

    // Input ports
    if (this.inputs) {
      for (let i = 0; i < this.inputs.length; i++) {
        this.inputs[i].x = this.x + offsetX;
        this.inputs[i].y = this.y + offsetY + i * portSpacing;
      }
    }

    // Output ports
    if (this.outputs) {
      for (let i = 0; i < this.outputs.length; i++) {
        this.outputs[i].x = this.x + this.width - offsetX;
        this.outputs[i].y = this.y + offsetY + i * portSpacing;
      }
    }
  }

  containsPoint(x: number, y: number): boolean {
    return (
      x >= this.x &&
      x <= this.x + this.width &&
      y >= this.y &&
      y <= this.y + this.height
    );
  }

  portAt(x: number, y: number): PortInfo | null {
    const portRadius = 8;

    // Check input ports
    if (this.inputs) {
      for (let i = 0; i < this.inputs.length; i++) {
        const port = this.inputs[i];
        const dx = x - port.x;
        const dy = y - port.y;
        if (dx * dx + dy * dy <= portRadius * portRadius) {
          return { port, type: 'input', index: i, node: this };
        }
      }
    }

    // Check output ports
    if (this.outputs) {
      for (let i = 0; i < this.outputs.length; i++) {
        const port = this.outputs[i];
        const dx = x - port.x;
        const dy = y - port.y;
        if (dx * dx + dy * dy <= portRadius * portRadius) {
          return { port, type: 'output', index: i, node: this };
        }
      }
    }

    return null;
  }
}
