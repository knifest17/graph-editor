import type { GraphNode, PortInfo } from "./types";
import { EditorStore } from "./store";
import { CameraController } from "./utils/camera";
import { GraphLinkImpl } from "./models/GraphLink";

/**
 * Handles mouse interactions with the graph
 */
export class MouseHandler {
  private canvas: HTMLCanvasElement;
  private store: EditorStore;
  private camera: CameraController;
  private onGraphChanged: () => void;
  private isPanning = false;
  private lastMousePos = { x: 0, y: 0 };
  private lastScreenPos = { x: 0, y: 0 };

  constructor(
    canvas: HTMLCanvasElement,
    store: EditorStore,
    camera: CameraController,
    onGraphChanged: () => void
  ) {
    this.canvas = canvas;
    this.store = store;
    this.camera = camera;
    this.onGraphChanged = onGraphChanged;

    this._setupEventListeners();
  }

  private _setupEventListeners(): void {
    this.canvas.addEventListener("mousemove", (e) => this._onMouseMove(e));
    this.canvas.addEventListener("mousedown", (e) => this._onMouseDown(e));
    this.canvas.addEventListener("mouseup", (e) => this._onMouseUp(e));
    this.canvas.addEventListener("wheel", (e) => this._onWheel(e));
    this.canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  private _getWorldPos(e: MouseEvent): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    return this.camera.getWorldFromScreen(screenX, screenY);
  }

  private _onMouseMove(e: MouseEvent): void {
    const worldPos = this._getWorldPos(e);
    this.store.interaction.mouse.x = worldPos.x;
    this.store.interaction.mouse.y = worldPos.y;
    this.lastScreenPos = { x: e.clientX, y: e.clientY };

    // Handle panning
    if (this.isPanning) {
      const dx = e.clientX - this.lastMousePos.x;
      const dy = e.clientY - this.lastMousePos.y;
      this.camera.pan(dx, dy);
      this.lastMousePos = { x: e.clientX, y: e.clientY };
      return;
    }

    // Handle selection box
    if (this.store.interaction.selection.active) {
      this.store.interaction.selection.end.x = worldPos.x;
      this.store.interaction.selection.end.y = worldPos.y;
      this._updateSelectionBox();
      return;
    }

    // Handle multi-drag
    if (this.store.interaction.isDragging) {
      for (const node of this.store.interaction.selectedNodes) {
        const offset = this.store.interaction.dragOffsets.get(node);
        if (offset) {
          node.x = worldPos.x - offset.x;
          node.y = worldPos.y - offset.y;
        }
      }
    } else if (this.store.interaction.isConnecting) {
      // Handle connection dragging
      this.store.interaction.connectionEnd.x = worldPos.x;
      this.store.interaction.connectionEnd.y = worldPos.y;
    } else {
      // Check for port hover
      this.store.interaction.hoveredPort = null;
      for (const node of this.store.nodes) {
        const portInfo = node.portAt(worldPos.x, worldPos.y);
        if (portInfo) {
          this.store.interaction.hoveredPort = portInfo;
          break;
        }
      }

      this.canvas.style.cursor = this.store.interaction.hoveredPort
        ? "pointer"
        : "crosshair";
    }
  }

  private _onMouseDown(e: MouseEvent): void {
    const worldPos = this._getWorldPos(e);

    // Right click - context menu
    if (e.button === 2) {
      e.preventDefault();
      this._showContextMenu(worldPos.x, worldPos.y);
      return;
    }

    if (this.store.ui.contextMenu.visible) {
      this._hideContextMenu();
    }

    // Middle mouse button or space+left click - start panning
    if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
      this.isPanning = true;
      this.lastMousePos = { x: e.clientX, y: e.clientY };
      e.preventDefault();
      return;
    }

    // Left click
    if (e.button === 0) {
      // Check if clicking on a port
      for (const node of this.store.nodes) {
        const portInfo = node.portAt(worldPos.x, worldPos.y);
        if (portInfo) {
          this._startConnection(portInfo);
          return;
        }
      }

      // Check if clicking on a node
      let clickedNode: GraphNode | null = null;
      for (let i = this.store.nodes.length - 1; i >= 0; i--) {
        if (this.store.nodes[i].containsPoint(worldPos.x, worldPos.y)) {
          clickedNode = this.store.nodes[i];
          break;
        }
      }

      if (clickedNode) {
        if (!e.ctrlKey && !e.shiftKey) {
          // Clear selection if not multi-selecting
          if (!this.store.interaction.selectedNodes.has(clickedNode)) {
            this._clearSelection();
          }
        }

        // Toggle selection
        if (this.store.interaction.selectedNodes.has(clickedNode)) {
          if (e.ctrlKey || e.shiftKey) {
            this.store.interaction.selectedNodes.delete(clickedNode);
            clickedNode.selected = false;
          }
        } else {
          this.store.interaction.selectedNodes.add(clickedNode);
          clickedNode.selected = true;
        }

        // Start dragging
        this.store.interaction.isDragging = true;
        this.store.interaction.dragOffsets.clear();
        for (const node of this.store.interaction.selectedNodes) {
          this.store.interaction.dragOffsets.set(node, {
            x: worldPos.x - node.x,
            y: worldPos.y - node.y,
          });
        }
      } else {
        // Start selection box
        if (!e.ctrlKey && !e.shiftKey) {
          this._clearSelection();
        }
        this.store.interaction.selection.active = true;
        this.store.interaction.selection.start = { ...worldPos };
        this.store.interaction.selection.end = { ...worldPos };
      }
    }
  }

  private _onMouseUp(e: MouseEvent): void {
    const worldPos = this._getWorldPos(e);

    if (this.isPanning) {
      this.isPanning = false;
      return;
    }

    if (this.store.interaction.isConnecting) {
      // Try to complete connection
      let connected = false;
      for (const node of this.store.nodes) {
        const portInfo = node.portAt(worldPos.x, worldPos.y);
        if (
          portInfo &&
          this._canConnect(this.store.interaction.connectionStart!, portInfo)
        ) {
          this._createConnection(
            this.store.interaction.connectionStart!,
            portInfo
          );
          connected = true;
          break;
        }
      }

      // If not connected, show context menu for creating nodes
      if (!connected) {
        const sourcePort = this.store.interaction.connectionStart;
        // e.preventDefault();
        this._showContextMenu(worldPos.x, worldPos.y, sourcePort!);
        // this._showContextMenu(worldPos.x, worldPos.y);
      }

      this.store.interaction.isConnecting = false;
      this.store.interaction.connectionStart = null;
    }

    if (this.store.interaction.isDragging) {
      this.store.interaction.isDragging = false;
      this.onGraphChanged();
    }

    if (this.store.interaction.selection.active) {
      this.store.interaction.selection.active = false;
      this.onGraphChanged();
    }
  }

  private _onWheel(e: WheelEvent): void {
    e.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    if (e.ctrlKey) {
      // Zoom
      const factor = 1 - e.deltaY * 0.001;
      this.camera.zoom(factor, screenX, screenY);
    } else {
      // Pan
      this.camera.pan(e.deltaX, e.deltaY);
    }
  }

  private _startConnection(portInfo: PortInfo): void {
    this.store.interaction.isConnecting = true;
    this.store.interaction.connectionStart = portInfo;
    this.store.interaction.connectionEnd = {
      x: portInfo.port.x,
      y: portInfo.port.y,
    };
  }

  private _canConnect(from: PortInfo, to: PortInfo): boolean {
    // Can't connect to same node
    if (from.node === to.node) return false;

    // Must be different port types (input to output or vice versa)
    if (from.type === to.type) return false;

    // Check if connection already exists
    const exists = this.store.links.some(
      (l) =>
        (l.fromPort === from && l.toPort === to) ||
        (l.fromPort === to && l.toPort === from)
    );
    if (exists) return false;

    return true;
  }

  private _createConnection(from: PortInfo, to: PortInfo): void {
    // Ensure from is output and to is input
    if (from.type === "input") {
      [from, to] = [to, from];
    }

    const link = new GraphLinkImpl(from, to, this.store);
    this.store.links.push(link);
    this.onGraphChanged();
  }

  private _clearSelection(): void {
    for (const node of this.store.interaction.selectedNodes) {
      node.selected = false;
    }
    this.store.interaction.selectedNodes.clear();
  }

  private _updateSelectionBox(): void {
    const { start, end } = this.store.interaction.selection;
    const minX = Math.min(start.x, end.x);
    const maxX = Math.max(start.x, end.x);
    const minY = Math.min(start.y, end.y);
    const maxY = Math.max(start.y, end.y);

    for (const node of this.store.nodes) {
      const inBox =
        node.x + node.width >= minX &&
        node.x <= maxX &&
        node.y + node.height >= minY &&
        node.y <= maxY;

      if (inBox) {
        if (!this.store.interaction.selectedNodes.has(node)) {
          this.store.interaction.selectedNodes.add(node);
          node.selected = true;
        }
      } else {
        if (this.store.interaction.selectedNodes.has(node)) {
          this.store.interaction.selectedNodes.delete(node);
          node.selected = false;
        }
      }
    }
  }

  private _showContextMenu(
    worldX: number,
    worldY: number,
    sourcePort?: PortInfo
  ): void {
    // Emit event for context menu
    const event = new CustomEvent("context-menu", {
      detail: {
        x: worldX,
        y: worldY,
        screenX: this.lastScreenPos.x,
        screenY: this.lastScreenPos.y,
        sourcePort: sourcePort || null,
      },
      bubbles: true,
      composed: true,
    });
    this.canvas.dispatchEvent(event);
  }

  private _hideContextMenu() {
    const event = new CustomEvent("hide-context");
    this.canvas.dispatchEvent(event);
  }
}
