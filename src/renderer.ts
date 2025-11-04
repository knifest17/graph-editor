import type { GraphNode, Port, PortInfo } from "./types";
import { EditorStore } from "./store";
import { CameraController } from "./utils/camera";
import { roundRect, lightenColor } from "./utils/helpers";
import { GraphNodeImpl } from "./models/GraphNode";

/**
 * Renders the graph to canvas
 */
export class GraphRenderer {
  private ctx: CanvasRenderingContext2D;
  private store: EditorStore;
  private camera: CameraController;

  constructor(
    ctx: CanvasRenderingContext2D,
    store: EditorStore,
    camera: CameraController
  ) {
    this.ctx = ctx;
    this.store = store;
    this.camera = camera;
  }

  render(): void {
    const ctx = this.ctx;
    const { w, h } = this.store.viewport;

    // Clear canvas
    ctx.clearRect(0, 0, w, h);

    // Save state and apply camera transform
    ctx.save();
    ctx.translate(
      -this.store.camera.x * this.store.camera.zoom,
      -this.store.camera.y * this.store.camera.zoom
    );
    ctx.scale(this.store.camera.zoom, this.store.camera.zoom);

    // Calculate node widths based on content (before drawing)
    for (const node of this.store.nodes) {
      const nodeImpl = node as GraphNodeImpl;
      if (nodeImpl.calculateWidth) {
        nodeImpl.calculateWidth(ctx);
        nodeImpl.updatePortPositions();
      }
    }

    // Draw grid
    this._drawGrid();

    // Draw links
    for (const link of this.store.links) {
      this._drawLink(link.fromPort, link.toPort, link.selected);
    }

    // Draw connection in progress
    if (
      this.store.interaction.isConnecting &&
      this.store.interaction.connectionStart
    ) {
      const start = this.store.interaction.connectionStart;
      const end = this.store.interaction.connectionEnd;
      this._drawLink(start, { x: end.x, y: end.y }, false, true);
    }

    // Draw nodes
    for (const node of this.store.nodes) {
      this._drawNode(node);
    }

    // Draw selection box
    if (this.store.interaction.selection.active) {
      this._drawSelectionBox();
    }

    ctx.restore();
  }

  private _drawGrid(): void {
    const ctx = this.ctx;
    const gridSize = 50;
    const { w, h } = this.store.viewport;
    const zoom = this.store.camera.zoom;
    const offsetX = this.store.camera.x % (gridSize * zoom);
    const offsetY = this.store.camera.y % (gridSize * zoom);

    ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
    ctx.lineWidth = 1 / zoom;

    // Vertical lines
    for (let x = offsetX; x < w; x += gridSize * zoom) {
      ctx.beginPath();
      ctx.moveTo((x - this.store.camera.x) / zoom, -this.store.camera.y / zoom);
      ctx.lineTo(
        (x - this.store.camera.x) / zoom,
        (h - this.store.camera.y) / zoom
      );
      ctx.stroke();
    }

    // Horizontal lines
    for (let y = offsetY; y < h; y += gridSize * zoom) {
      ctx.beginPath();
      ctx.moveTo(-this.store.camera.x / zoom, (y - this.store.camera.y) / zoom);
      ctx.lineTo(
        (w - this.store.camera.x) / zoom,
        (y - this.store.camera.y) / zoom
      );
      ctx.stroke();
    }
  }

  private _drawLink(
    from: PortInfo | { x: number; y: number },
    to: PortInfo | { x: number; y: number },
    selected = false,
    temporary = false
  ): void {
    const ctx = this.ctx;
    const fromX = "port" in from ? from.port.x : from.x;
    const fromY = "port" in from ? from.port.y : from.y;
    const toX = "port" in to ? to.port.x : to.x;
    const toY = "port" in to ? to.port.y : to.y;

    const dx = toX - fromX;
    const controlPointOffset = Math.min(Math.abs(dx) / 2, 100);

    // Determine link color based on port type
    let linkColor = "#888"; // Default
    let isExecLink = false;
    if ("port" in from && from.port.type !== "exec") {
      // Use data type color if available
      const dataType = this.store.dataTypes[from.port.type];
      if (dataType && dataType.color) {
        linkColor = dataType.color;
      }
    } else if ("port" in from && from.port.type === "exec") {
      isExecLink = true;
      linkColor = "#ffffff"; // White for exec links
    }

    ctx.strokeStyle = temporary
      ? "rgba(255, 255, 255, 0.5)"
      : selected
      ? "#FFD700"
      : linkColor;
    ctx.lineWidth = selected ? 3 : 2;

    // Animate exec links with moving dashes
    if (isExecLink && !temporary && !selected) {
      const time = performance.now() / 1000; // Convert to seconds
      const dashLength = 8;
      const gapLength = 8;
      const speed = 50; // pixels per second
      const offset = (time * speed) % (dashLength + gapLength);

      ctx.setLineDash([dashLength, gapLength]);
      ctx.lineDashOffset = -offset;
    } else {
      ctx.setLineDash([]);
    }

    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.bezierCurveTo(
      fromX + controlPointOffset,
      fromY,
      toX - controlPointOffset,
      toY,
      toX,
      toY
    );
    ctx.stroke();

    // Reset line dash for other drawings
    ctx.setLineDash([]);
  }

  private _drawNode(node: GraphNode): void {
    const ctx = this.ctx;
    node.updatePortPositions();

    // Node body
    const gradient = ctx.createLinearGradient(
      node.x,
      node.y,
      node.x,
      node.y + node.height
    );
    gradient.addColorStop(0, "rgba(50, 50, 50, 1)");
    gradient.addColorStop(1, "rgba(0, 0, 0, 0.5)");
    ctx.fillStyle = gradient;
    roundRect(ctx, node.x, node.y, node.width, node.height, 5);
    ctx.fill();

    // Border (highlighted if selected)
    if (node.selected) {
      ctx.strokeStyle = "#FFD700";
      ctx.lineWidth = 3;
      roundRect(
        ctx,
        node.x - 2,
        node.y - 2,
        node.width + 4,
        node.height + 4,
        7
      );
      ctx.stroke();
    }

    ctx.strokeStyle = "#999";
    ctx.lineWidth = 1;
    roundRect(ctx, node.x, node.y, node.width, node.height, 5);
    ctx.stroke();

    // Title bar
    const titleGradient = ctx.createLinearGradient(
      node.x,
      node.y,
      node.x + node.width,
      node.y + node.height
    );
    titleGradient.addColorStop(0, node.color);
    titleGradient.addColorStop(1, "rgba(0, 0, 0, 1)");
    ctx.fillStyle = titleGradient;
    roundRect(ctx, node.x, node.y, node.width, 25, 5);
    ctx.fill();
    ctx.fillRect(node.x, node.y + 20, node.width, 5);

    // Title text
    ctx.fillStyle = "#ffffff";
    ctx.font = "12px Arial";
    ctx.textAlign = "left";
    ctx.fillText(node.title, node.x + 10, node.y + 16);

    // Category indicator
    ctx.font = "8px Arial";
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.textAlign = "center";
    ctx.fillText(
      node.category,
      node.x + node.width / 2,
      node.y + node.height - 5
    );

    // Draw ports
    ctx.textAlign = "left";
    ctx.font = "10px Arial";
    if (node.inputs) {
      for (let i = 0; i < node.inputs.length; i++) {
        const port = node.inputs[i];
        const portInfo: PortInfo = { port, type: "input", index: i, node };
        const isHovered = this._isPortHovered(portInfo);
        const isConnected = this._isPortConnected(portInfo);
        this._drawPort(
          port,
          isHovered,
          isConnected,
          true,
          node.execOutPortCount
        );
      }
    }

    ctx.textAlign = "right";
    if (node.outputs) {
      for (let i = 0; i < node.outputs.length; i++) {
        const port = node.outputs[i];
        const portInfo: PortInfo = { port, type: "output", index: i, node };
        const isHovered = this._isPortHovered(portInfo);
        const isConnected = this._isPortConnected(portInfo);
        this._drawPort(
          port,
          isHovered,
          isConnected,
          false,
          node.execOutPortCount
        );
      }
    }
  }

  private _drawPort(
    port: Port,
    isHovered: boolean,
    isConnected: boolean,
    isInput: boolean,
    execOutPortCount: number
  ): void {
    const ctx = this.ctx;

    if (isHovered) {
      ctx.shadowColor = "#ffffff";
      ctx.shadowBlur = 8;
    }

    if (port.type === "exec") {
      // Draw white triangle for exec port
      ctx.strokeStyle = isHovered ? "#ffff99" : "#ffffff";
      ctx.lineWidth = isHovered ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(port.x - 4, port.y - 5);
      ctx.lineTo(port.x + 4, port.y);
      ctx.lineTo(port.x - 4, port.y + 5);
      ctx.closePath();

      // Fill if connected
      if (isConnected) {
        ctx.fillStyle = isHovered ? "#ffff99" : "#ffffff";
        ctx.fill();
      }
      ctx.stroke();

      // Port label for exec ports (only outputs if multiple)
      if (!isInput && execOutPortCount > 1 && port.name?.trim()) {
        ctx.fillStyle = "#ffffff";
        ctx.fillText(port.name, port.x - 12, port.y + 3);
      }
    } else {
      // Draw colored circle for data port
      const baseColor = this.store.dataTypes[port.type]?.color || "#6699ff";
      const portColor = isHovered ? lightenColor(baseColor, 0.3) : baseColor;
      const portRadius = 4;
      const outlineWidth = 2;

      if (isConnected) {
        // Filled circle when connected
        ctx.fillStyle = portColor;
        ctx.beginPath();
        ctx.arc(
          port.x,
          port.y,
          portRadius + (isHovered ? 1 : 0),
          0,
          Math.PI * 2
        );
        ctx.fill();
      } else {
        // Empty circle when not connected (outline only)
        ctx.strokeStyle = portColor;
        ctx.lineWidth = outlineWidth + (isHovered ? 1 : 0);
        ctx.beginPath();
        const r = portRadius - 0.5 * outlineWidth;
        ctx.arc(port.x, port.y, r + (isHovered ? 1 : 0), 0, Math.PI * 2);
        ctx.stroke();
      }

      // Port label for data ports
      if (port.name?.trim()) {
        ctx.fillStyle = "#ffffff";
        const labelX = isInput ? port.x + 12 : port.x - 12;
        ctx.fillText(port.name, labelX, port.y + 3);
      }
    }

    ctx.shadowBlur = 0;
  }

  private _isPortHovered(portInfo: PortInfo): boolean {
    const hovered = this.store.interaction.hoveredPort;
    return !!(
      hovered &&
      hovered.node === portInfo.node &&
      hovered.type === portInfo.type &&
      hovered.index === portInfo.index
    );
  }

  private _isPortConnected(portInfo: PortInfo): boolean {
    // Check if any link connects to or from this port
    for (const link of this.store.links) {
      if (portInfo.type === "input") {
        // Check if this is the destination of the link
        if (
          link.toPort.node === portInfo.node &&
          link.toPort.index === portInfo.index &&
          link.toPort.type === "input"
        ) {
          return true;
        }
      } else {
        // Check if this is the source of the link
        if (
          link.fromPort.node === portInfo.node &&
          link.fromPort.index === portInfo.index &&
          link.fromPort.type === "output"
        ) {
          return true;
        }
      }
    }
    return false;
  }

  private _drawSelectionBox(): void {
    const ctx = this.ctx;
    const { start, end } = this.store.interaction.selection;
    const startX = Math.min(start.x, end.x);
    const startY = Math.min(start.y, end.y);
    const width = Math.abs(end.x - start.x);
    const height = Math.abs(end.y - start.y);

    ctx.strokeStyle = "#FFD700";
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(startX, startY, width, height);
    ctx.setLineDash([]);
  }
}
