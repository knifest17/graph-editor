import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type {
  NodeRegistry,
  GraphData,
  SerializedNode,
  SerializedConnection,
  PortInfo,
  GraphNode,
} from "./types";
import { EditorStore } from "./store";
import { GraphNodeImpl } from "./models/GraphNode";
import { GraphLinkImpl } from "./models/GraphLink";
import { CodeGenerator } from "./codegen";
import { CameraController } from "./utils/camera";
import { GraphRenderer } from "./renderer";
import { MouseHandler } from "./mouse-handler";

/**
 * Standalone graph editor web component
 *
 * @fires graph-changed - Fired when the graph is modified
 * @fires code-generated - Fired when code is generated
 * @fires node-selected - Fired when a node is selected
 *
 * @example
 * ```html
 * <graph-editor></graph-editor>
 * ```
 *
 * @example
 * ```js
 * const editor = document.querySelector('graph-editor');
 * editor.addRegistry(myRegistry);
 * editor.loadGraph(myGraph);
 * const code = editor.exportCode();
 * ```
 */
@customElement("graph-editor")
export class GraphEditor extends LitElement {
  @property({ type: Boolean }) readonly = false;

  @state() private initialized = false;

  private store: EditorStore;
  private codeGenerator: CodeGenerator;
  private camera: CameraController;
  private renderer!: GraphRenderer;
  private mouseHandler!: MouseHandler;
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private animationFrameId: number | null = null;

  static styles = css`
    :host {
      display: block;
      width: 100%;
      height: 100%;
      position: relative;
      background: #1e1e1e;
      overflow: hidden;
    }

    canvas {
      display: block;
      width: 100%;
      height: 100%;
      cursor: crosshair;
    }

    .ui-layer {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 1;
    }

    .ui-layer input {
      pointer-events: auto;
      background: linear-gradient(
        to bottom,
        rgba(50, 50, 50, 1),
        rgba(0, 0, 0, 0.5)
      );
      border: 1px solid #999;
      border-radius: 3px;
      color: #fff;
      font-family: Arial;
      padding: 2px 5px;
      outline: none;
      box-sizing: border-box;
    }

    .ui-layer input:focus {
      border-color: #ffd700;
    }

    /* Context Menu Styles */
    .context-menu {
      position: absolute;
      background: #2d2d2d;
      border: 1px solid #555;
      border-radius: 4px;
      padding: 4px 0;
      min-width: 180px;
      max-height: 400px;
      overflow-y: auto;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
      z-index: 1000;
      font-size: 12px;
      display: none;
      pointer-events: auto;
    }

    .context-menu-category {
      margin-bottom: 5px;
    }

    .category-header {
      cursor: pointer;
      padding: 5px;
      background: rgba(0, 0, 0, 0.1);
      border-radius: 3px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .category-header:hover {
      background: rgba(0, 0, 0, 0.2);
    }

    .category-items {
      padding-left: 10px;
    }

    .toggle-icon {
      font-size: 10px;
      transition: transform 0.2s;
    }

    .context-menu-item {
      padding: 6px 12px;
      cursor: pointer;
      color: #fff;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .context-menu-item:hover {
      background: #0078d4;
    }

    .context-menu-item.selected {
      background-color: rgba(0, 123, 255, 0.2);
      border-left: 3px solid #007bff;
    }

    .context-menu-item.disabled {
      color: #666;
      cursor: not-allowed;
    }

    .context-menu-item.disabled:hover {
      background: transparent;
    }

    .node-color {
      width: 12px;
      height: 12px;
      border-radius: 2px;
      margin-left: 8px;
    }

    .context-menu-search {
      padding: 8px;
      border-bottom: 1px solid #444;
      background: #333;
    }

    .context-menu-search input {
      width: 100%;
      padding: 4px 8px;
      background: #222;
      border: 1px solid #555;
      color: white;
      border-radius: 3px;
      font-size: 12px;
    }

    .context-menu-search input:focus {
      outline: none;
      border-color: #0078d4;
    }

    .toolbar {
      position: absolute;
      top: 10px;
      right: 10px;
      display: flex;
      gap: 8px;
      z-index: 10;
      pointer-events: auto;
    }

    button {
      padding: 8px 16px;
      background: #333;
      color: #fff;
      border: 1px solid #555;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
    }

    button:hover {
      background: #444;
    }

    button:active {
      background: #222;
    }
  `;

  constructor() {
    super();
    this.store = new EditorStore();
    this.codeGenerator = new CodeGenerator(this.store);
    this.camera = new CameraController(this.store.camera);
  }

  render() {
    return html`
      <canvas></canvas>
      <div class="ui-layer">
        <div class="context-menu" id="contextMenu"></div>
      </div>
      ${!this.readonly
        ? html`
            <div class="toolbar">
              <button @click=${this._onGenerateCode}>Generate Code</button>
              <button @click=${this._onClear}>Clear</button>
            </div>
          `
        : ""}
    `;
  }

  firstUpdated() {
    this.canvas = this.shadowRoot!.querySelector("canvas")!;
    const ctx = this.canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Failed to get 2D context");
    }
    this.ctx = ctx;

    this.renderer = new GraphRenderer(this.ctx, this.store, this.camera);
    this.mouseHandler = new MouseHandler(
      this.canvas,
      this.store,
      this.camera,
      () => this._emitGraphChanged()
    );

    // Setup context menu event handler
    this.canvas.addEventListener("context-menu", ((e: CustomEvent) => {
      // console.log('context-menu');
      this._showContextMenu(
        e.detail.x,
        e.detail.y,
        e.detail.screenX,
        e.detail.screenY,
        e.detail.sourcePort
      );
    }) as EventListener);

    this.canvas.addEventListener("hide-context", ((_e: CustomEvent) => {
      this._hideContextMenu();
    }) as EventListener);

    // Click outside to hide context menu
    // this.shadowRoot!.addEventListener('click', (e) => {
    //   const menu = this.shadowRoot!.querySelector('.context-menu') as HTMLElement;
    //   if (menu && !menu.contains(e.target as Node)) {
    //     // console.log("this.shadowRoot!.addEventListener('click'");
    //     this._hideContextMenu();
    //   }
    // });

    // Setup keyboard event handler for deleting nodes and selecting all
    document.addEventListener("keydown", (e) => {
      // Only handle keyboard shortcuts when canvas has focus or is active
      const isCanvasFocused =
        document.activeElement === this.canvas ||
        this.shadowRoot?.activeElement === this.canvas ||
        document.activeElement === document.body;

      if (!isCanvasFocused) {
        return; // Don't interfere with input fields or other elements
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault(); // Prevent browser navigation on Backspace
        this._deleteSelectedNodes();
        this._deleteSelectedLinks();
      } else if (e.key === "a" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault(); // Prevent default "Select All" behavior
        this._selectAllNodes();
      }
    });

    this._resize();
    globalThis.addEventListener("resize", () => this._resize());

    this.initialized = true;
    this._startRenderLoop();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }

  //
  // PUBLIC API
  //

  /**
   * Add or merge a node registry
   */
  addRegistry(registry: NodeRegistry): void {
    if (registry.codeGeneration) {
      this.store.codeGeneration = {
        ...this.store.codeGeneration,
        ...registry.codeGeneration,
      };
    }
    if (registry.dataTypes) {
      this.store.dataTypes = { ...this.store.dataTypes, ...registry.dataTypes };
    }
    if (registry.nodeCategories) {
      // Merge node categories
      for (const [catKey, catDef] of Object.entries(registry.nodeCategories)) {
        if (!this.store.nodeCategories[catKey]) {
          this.store.nodeCategories[catKey] = catDef;
        } else {
          // Merge nodes within category
          if (catDef.nodes) {
            if (!this.store.nodeCategories[catKey].nodes) {
              this.store.nodeCategories[catKey].nodes = {};
            }
            Object.assign(
              this.store.nodeCategories[catKey].nodes!,
              catDef.nodes
            );
          }
        }
      }
    }
    if (registry.nodeTypes) {
      // Legacy support: move nodeTypes into nodeCategories
      for (const [typeKey, typeDef] of Object.entries(registry.nodeTypes)) {
        const category = typeDef.category || "default";
        if (!this.store.nodeCategories[category]) {
          this.store.nodeCategories[category] = { color: "#808080", nodes: {} };
        }
        if (!this.store.nodeCategories[category].nodes) {
          this.store.nodeCategories[category].nodes = {};
        }
        this.store.nodeCategories[category].nodes![typeKey] = typeDef;
      }
    }
    this.store.registryLoaded = true;
  }

  /**
   * Load a graph from serialized data
   */
  loadGraph(graph: GraphData): void {
    this.store.clear();

    // Recreate nodes
    const nodeMap = new Map<number, import("./types").GraphNode>();
    for (const sNode of graph.nodes) {
      try {
        const node = new GraphNodeImpl(
          sNode.x,
          sNode.y,
          sNode.category,
          sNode.type,
          this.store
        );
        node.id = sNode.id; // Preserve original ID
        if (sNode.value !== undefined) {
          node.value = sNode.value;
        }
        this.store.nodes.push(node);
        nodeMap.set(node.id, node);

        // Update counter to avoid ID conflicts
        if (sNode.id >= this.store.nodeIdCounter) {
          this.store.nodeIdCounter = sNode.id + 1;
        }
      } catch (e) {
        console.warn(`Failed to create node:`, sNode, e);
      }
    }

    // Recreate connections
    for (const sConn of graph.connections) {
      try {
        const fromNode = nodeMap.get(sConn.from.nodeId);
        const toNode = nodeMap.get(sConn.to.nodeId);
        if (!fromNode || !toNode) continue;

        const fromPort =
          sConn.from.portType === "output"
            ? fromNode.outputs?.[sConn.from.portIndex]
            : fromNode.inputs?.[sConn.from.portIndex];
        const toPort =
          sConn.to.portType === "output"
            ? toNode.outputs?.[sConn.to.portIndex]
            : toNode.inputs?.[sConn.to.portIndex];

        if (!fromPort || !toPort) continue;

        const link = new GraphLinkImpl(
          {
            node: fromNode,
            type: sConn.from.portType,
            index: sConn.from.portIndex,
            port: fromPort,
          },
          {
            node: toNode,
            type: sConn.to.portType,
            index: sConn.to.portIndex,
            port: toPort,
          },
          this.store
        );
        link.id = sConn.id;
        this.store.links.push(link);

        // Update counter
        if (sConn.id >= this.store.linkIdCounter) {
          this.store.linkIdCounter = sConn.id + 1;
        }
      } catch (e) {
        console.warn(`Failed to create connection:`, sConn, e);
      }
    }

    this._emitGraphChanged();
  }

  /**
   * Export the current graph as serialized data
   */
  exportGraph(): GraphData {
    const nodes: SerializedNode[] = this.store.nodes.map((n) => ({
      id: n.id,
      type: n.type,
      category: n.category,
      x: n.x,
      y: n.y,
      value: n.value,
    }));

    const connections: SerializedConnection[] = this.store.links.map((l) => ({
      id: l.id,
      from: {
        nodeId: l.fromPort.node.id,
        portIndex: l.fromPort.index,
        portType: l.fromPort.type,
      },
      to: {
        nodeId: l.toPort.node.id,
        portIndex: l.toPort.index,
        portType: l.toPort.type,
      },
    }));

    return {
      version: "1.0",
      nodes,
      connections,
    };
  }

  /**
   * Generate code from the current graph
   */
  exportCode(): string {
    try {
      return this.codeGenerator.generate();
    } catch (e) {
      console.error("Code generation failed:", e);
      throw e;
    }
  }

  /**
   * Clear the graph
   */
  clearGraph(): void {
    this._cleanupInputElements();
    this.store.clear();
    this._emitGraphChanged();
  }

  /**
   * Add a node programmatically
   */
  addNode(category: string, type: string, x: number, y: number): string {
    const node = new GraphNodeImpl(x, y, category, type, this.store);
    this.store.nodes.push(node);
    this._emitGraphChanged();
    return String(node.id);
  }

  //
  // PRIVATE METHODS
  //

  private _resize(): void {
    const dpr = globalThis.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.scale(dpr, dpr);
    this.store.viewport.w = rect.width;
    this.store.viewport.h = rect.height;
  }

  private _startRenderLoop(): void {
    const render = () => {
      this.renderer.render();
      this._syncValueInputs();
      this.animationFrameId = requestAnimationFrame(render);
    };
    render();
  }

  private _onGenerateCode(): void {
    try {
      const code = this.exportCode();
      this.dispatchEvent(
        new CustomEvent("code-generated", {
          detail: { code },
          bubbles: true,
          composed: true,
        })
      );
    } catch (e) {
      alert(
        `Code generation failed: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }

  private _onClear(): void {
    if (confirm("Clear the entire graph?")) {
      this.clearGraph();
    }
  }

  private _emitGraphChanged(): void {
    // Validate all connections before emitting
    const removedLinks = this.store.validateConnections();
    if (removedLinks.length > 0) {
      console.warn(`Removed ${removedLinks.length} invalid connection(s)`);
    }

    this.dispatchEvent(
      new CustomEvent("graph-changed", {
        detail: { graph: this.exportGraph() },
        bubbles: true,
        composed: true,
      })
    );
  }

  private _syncValueInputs(): void {
    const uiLayer = this.shadowRoot!.querySelector(".ui-layer") as HTMLElement;
    if (!uiLayer) return;

    for (const node of this.store.nodes) {
      if (!node.hasValue) continue;
      this._ensureInputElements(node, uiLayer);
      this._layoutInputElements(node, uiLayer);
    }
  }

  private _ensureInputElements(
    node: import("./types").GraphNode,
    uiLayer: HTMLElement
  ): void {
    const nodeImpl = node as GraphNodeImpl & {
      inputElements?: HTMLInputElement[];
    };
    if (nodeImpl.inputElements) return;

    nodeImpl.inputElements = [];

    switch (node.valueType) {
      case "bool": {
        const el = document.createElement("input");
        el.type = "checkbox";
        el.checked = !!node.value;
        el.oninput = () => (node.value = el.checked);
        uiLayer.appendChild(el);
        nodeImpl.inputElements.push(el);
        break;
      }
      case "int":
      case "float": {
        const el = document.createElement("input");
        el.type = "number";
        el.step = node.valueType === "float" ? "0.01" : "1";
        el.value = String(node.value ?? 0);
        el.oninput = () => (node.value = parseFloat(el.value) || 0);
        uiLayer.appendChild(el);
        nodeImpl.inputElements.push(el);
        break;
      }
      case "string": {
        const el = document.createElement("input");
        el.type = "text";
        el.value = (node.value as string) ?? "";
        el.oninput = () => (node.value = el.value);
        uiLayer.appendChild(el);
        nodeImpl.inputElements.push(el);
        break;
      }
      case "color": {
        const el = document.createElement("input");
        el.type = "color";
        el.value = (node.value as string) ?? "#ffffff";
        el.oninput = () => (node.value = el.value);
        uiLayer.appendChild(el);
        nodeImpl.inputElements.push(el);
        break;
      }
      case "float3": {
        const val = node.value as
          | { x?: number; y?: number; z?: number }
          | undefined;
        for (const k of ["x", "y", "z"]) {
          const el = document.createElement("input");
          el.type = "number";
          el.step = "0.01";
          el.value = String(val?.[k as "x" | "y" | "z"] ?? 0);
          el.oninput = () => {
            if (!node.value || typeof node.value !== "object") {
              node.value = { x: 0, y: 0, z: 0 };
            }
            (node.value as Record<string, number>)[k] =
              parseFloat(el.value) || 0;
          };
          uiLayer.appendChild(el);
          nodeImpl.inputElements.push(el);
        }
        break;
      }
    }
  }

  private _layoutInputElements(
    node: import("./types").GraphNode,
    _uiLayer: HTMLElement
  ): void {
    const nodeImpl = node as GraphNodeImpl & {
      inputElements?: HTMLInputElement[];
    };
    if (!nodeImpl.inputElements) return;

    const zoom = this.store.camera.zoom;
    const screen = this.camera.getScreenFromWorld(
      node.x + 10,
      node.y + node.height - 35
    );
    const fieldW = (node.width - 20) * zoom;

    if (node.valueType === "float3") {
      const w = fieldW / 3 - 5;
      nodeImpl.inputElements.forEach((el, i) => {
        el.style.position = "absolute";
        el.style.left = `${screen.x + i * (fieldW / 3)}px`;
        el.style.top = `${screen.y}px`;
        el.style.width = `${w}px`;
        el.style.height = `${20 * zoom}px`;
        el.style.fontSize = `${12 * zoom}px`;
      });
    } else if (nodeImpl.inputElements.length > 0) {
      const el = nodeImpl.inputElements[0];
      el.style.position = "absolute";
      el.style.left = `${screen.x}px`;
      el.style.top = `${screen.y}px`;
      el.style.width = `${fieldW}px`;
      el.style.height = `${20 * zoom}px`;
      el.style.fontSize = `${12 * zoom}px`;
    }
  }

  //
  // CONTEXT MENU
  //

  private _hasCompatiblePort(
    nodeDef: import("./types").NodeTypeDefinition,
    sourcePort: PortInfo
  ): boolean {
    // Determine which ports to check based on source port type
    const targetPorts =
      sourcePort.type === "output" ? nodeDef.inputs : nodeDef.outputs;
    if (!targetPorts) return false;

    // Check if any target port is compatible
    for (const port of targetPorts) {
      // Exec only connects to exec
      if (port.type === "exec" || sourcePort.port.type === "exec") {
        if (port.type === "exec" && sourcePort.port.type === "exec") {
          return true;
        }
      } else if (
        port.type === sourcePort.port.type ||
        port.type === "data" ||
        sourcePort.port.type === "data"
      ) {
        return true;
      }
    }
    return false;
  }

  private _showContextMenu(
    worldX: number,
    worldY: number,
    screenX: number,
    screenY: number,
    sourcePort?: PortInfo | null
  ): void {
    const menu = this.shadowRoot!.querySelector(".context-menu") as HTMLElement;
    if (!menu) return;

    // Store world position for node creation
    this.store.ui.contextMenu.worldX = worldX;
    this.store.ui.contextMenu.worldY = worldY;
    this.store.ui.contextMenu.visible = true;
    this.store.ui.contextMenu.pendingSource = sourcePort || null;

    // Check if registry is loaded
    if (Object.keys(this.store.nodeCategories).length === 0) {
      menu.innerHTML = `
        <div class="context-menu-search">
          <div style="padding: 12px; text-align: center; color: #ff6666;">
            No node registry loaded
          </div>
        </div>
      `;
      menu.style.left = `${screenX}px`;
      menu.style.top = `${screenY}px`;
      menu.style.display = "block";
      return;
    }

    // console.log(sourcePort);

    // Build node list grouped by category
    const categories: Record<
      string,
      Array<{ category: string; type: string; title: string; color: string }>
    > = {};

    for (const [categoryName, categoryDef] of Object.entries(
      this.store.nodeCategories
    )) {
      if (!categoryDef.nodes) continue;

      for (const [typeName, nodeDef] of Object.entries(categoryDef.nodes)) {
        // Filter by compatibility if we have a source port
        if (sourcePort && !this._hasCompatiblePort(nodeDef, sourcePort)) {
          continue;
        }

        if (!categories[categoryName]) {
          categories[categoryName] = [];
        }
        categories[categoryName].push({
          category: categoryName,
          type: typeName,
          title: nodeDef.title || typeName,
          color: nodeDef.color || categoryDef.color || "#808080",
        });
      }
    }

    // Render menu HTML
    let menuHTML = `
      <div class="context-menu-search">
        <input type="text" id="nodeSearch" placeholder="Search nodes..." autocomplete="off">
      </div>
    `;

    for (const [categoryName, nodes] of Object.entries(categories)) {
      menuHTML += `
        <div class="context-menu-category" data-category="${categoryName}">
          <div class="category-header">${categoryName} <span class="toggle-icon">▶</span></div>
          <div class="category-items" style="display: none;">
      `;
      nodes.forEach((node) => {
        menuHTML += `
          <div class="context-menu-item" data-category="${
            node.category
          }" data-type="${node.type}" data-title="${node.title.toLowerCase()}">
            <span>${node.title}</span>
            <div class="node-color" style="background: ${node.color};"></div>
          </div>
        `;
      });
      menuHTML += `
          </div>
        </div>
      `;
    }

    menu.innerHTML = menuHTML;
    menu.style.left = `${screenX}px`;
    menu.style.top = `${screenY}px`;
    menu.style.display = "block";

    // Setup event listeners
    this._setupContextMenuListeners(menu);
  }

  private _setupContextMenuListeners(menu: HTMLElement): void {
    // Focus search input
    const searchInput = menu.querySelector("#nodeSearch") as HTMLInputElement;
    searchInput?.focus();

    // Search filtering
    searchInput?.addEventListener("input", (e) => {
      this._filterContextMenuNodes((e.target as HTMLInputElement).value);
    });

    // Category toggle
    const categoryHeaders = menu.querySelectorAll(".category-header");
    categoryHeaders.forEach((header) => {
      header.addEventListener("click", (e) => {
        const categoryDiv = (e.currentTarget as HTMLElement).parentElement!;
        const itemsDiv = categoryDiv.querySelector(
          ".category-items"
        ) as HTMLElement;
        const toggleIcon = (e.currentTarget as HTMLElement).querySelector(
          ".toggle-icon"
        )!;

        if (itemsDiv.style.display === "none") {
          itemsDiv.style.display = "block";
          toggleIcon.textContent = "▼";
        } else {
          itemsDiv.style.display = "none";
          toggleIcon.textContent = "▶";
        }
        this._updateSelectedMenuItem();
      });
    });

    // Item click
    const menuItems = menu.querySelectorAll(".context-menu-item");
    menuItems.forEach((item) => {
      item.addEventListener("click", (e) => {
        const category = (e.currentTarget as HTMLElement).getAttribute(
          "data-category"
        )!;
        const type = (e.currentTarget as HTMLElement).getAttribute(
          "data-type"
        )!;
        this._createNodeAtContextMenu(category, type);
        this._hideContextMenu();
      });
    });

    // Keyboard navigation
    const handleKeydown = (e: KeyboardEvent) => {
      if (!this.store.ui.contextMenu.visible) return;

      const visibleItems = Array.from(
        menu.querySelectorAll(".context-menu-item")
      ).filter((item) => {
        const el = item as HTMLElement;
        // Check if item itself is visible
        if (el.style.display === "none") return false;

        // Check if parent category items container is visible
        const categoryItems = el.closest(".category-items") as HTMLElement;
        if (categoryItems && categoryItems.style.display === "none")
          return false;

        return true;
      }) as HTMLElement[];

      if (visibleItems.length === 0) return;

      const selectedItem = menu.querySelector(
        ".context-menu-item.selected"
      ) as HTMLElement;
      let currentIndex = selectedItem ? visibleItems.indexOf(selectedItem) : -1;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          currentIndex = (currentIndex + 1) % visibleItems.length;
          this._selectMenuItem(visibleItems[currentIndex]);
          break;
        case "ArrowUp":
          e.preventDefault();
          currentIndex =
            currentIndex <= 0 ? visibleItems.length - 1 : currentIndex - 1;
          this._selectMenuItem(visibleItems[currentIndex]);
          break;
        case "Enter":
          e.preventDefault();
          if (selectedItem) {
            selectedItem.click();
          }
          break;
        case "Escape":
          e.preventDefault();
          this._hideContextMenu();
          break;
      }
    };

    this.shadowRoot!.addEventListener(
      "keydown",
      handleKeydown as EventListener
    );

    // Initialize selection
    this._updateSelectedMenuItem();
  }

  private _filterContextMenuNodes(searchTerm: string): void {
    const menu = this.shadowRoot!.querySelector(".context-menu") as HTMLElement;
    if (!menu) return;

    const items = menu.querySelectorAll(
      ".context-menu-item"
    ) as NodeListOf<HTMLElement>;
    const categories = menu.querySelectorAll(
      ".context-menu-category"
    ) as NodeListOf<HTMLElement>;

    searchTerm = searchTerm.toLowerCase();

    // Hide all first
    items.forEach((item) => (item.style.display = "none"));
    categories.forEach((cat) => {
      const itemsDiv = cat.querySelector(".category-items") as HTMLElement;
      itemsDiv.style.display = "none";
      const toggleIcon = cat.querySelector(".toggle-icon")!;
      toggleIcon.textContent = "▶";
    });

    if (searchTerm === "") {
      // Show all
      items.forEach((item) => (item.style.display = "flex"));
      categories.forEach((cat) => (cat.style.display = "block"));
    } else {
      // Show matching items
      const visibleCategories = new Set<string>();
      items.forEach((item) => {
        const title = item.getAttribute("data-title");
        if (title && title.includes(searchTerm)) {
          item.style.display = "flex";
          visibleCategories.add(item.getAttribute("data-category")!);
        }
      });

      // Show categories with visible items
      categories.forEach((cat) => {
        const catName = cat.getAttribute("data-category");
        if (catName && visibleCategories.has(catName)) {
          cat.style.display = "block";
          const itemsDiv = cat.querySelector(".category-items") as HTMLElement;
          itemsDiv.style.display = "block";
          const toggleIcon = cat.querySelector(".toggle-icon")!;
          toggleIcon.textContent = "▼";
        }
      });
    }

    this._updateSelectedMenuItem();
  }

  private _selectMenuItem(item: HTMLElement): void {
    const menu = this.shadowRoot!.querySelector(".context-menu") as HTMLElement;
    const prevSelected = menu.querySelector(".context-menu-item.selected");
    if (prevSelected) {
      prevSelected.classList.remove("selected");
    }
    item.classList.add("selected");
    item.scrollIntoView({ block: "nearest" });
  }

  private _updateSelectedMenuItem(): void {
    const menu = this.shadowRoot!.querySelector(".context-menu") as HTMLElement;
    if (!menu) return;

    const visibleItems = Array.from(
      menu.querySelectorAll(".context-menu-item")
    ).filter(
      (item) => (item as HTMLElement).style.display !== "none"
    ) as HTMLElement[];

    if (visibleItems.length > 0) {
      this._selectMenuItem(visibleItems[0]);
    }
  }

  private _createNodeAtContextMenu(category: string, type: string): void {
    const offsetX = 60; // Half of typical node width
    const offsetY = 40; // Half of typical node height
    const x = this.store.ui.contextMenu.worldX - offsetX;
    const y = this.store.ui.contextMenu.worldY - offsetY;

    // Create node directly to get reference
    const newNode = new GraphNodeImpl(x, y, category, type, this.store);
    this.store.nodes.push(newNode);
    this._emitGraphChanged();

    // Auto-connect if we have a pending source port
    if (this.store.ui.contextMenu.pendingSource) {
      this._autoConnectToNewNode(
        newNode,
        this.store.ui.contextMenu.pendingSource
      );
    }
  }

  private _autoConnectToNewNode(
    newNode: GraphNode,
    sourcePort: PortInfo
  ): void {
    // Find compatible port on the new node
    const targetPorts =
      sourcePort.type === "output" ? newNode.inputs : newNode.outputs;
    if (!targetPorts) return;

    for (let i = 0; i < targetPorts.length; i++) {
      const targetPort = targetPorts[i];

      // Check compatibility
      let isCompatible = false;
      if (targetPort.type === "exec" || sourcePort.port.type === "exec") {
        isCompatible =
          targetPort.type === "exec" && sourcePort.port.type === "exec";
      } else {
        isCompatible =
          targetPort.type === sourcePort.port.type ||
          targetPort.type === "data" ||
          sourcePort.port.type === "data";
      }

      if (isCompatible) {
        // Create the connection
        let fromPort: PortInfo, toPort: PortInfo;

        if (sourcePort.type === "output") {
          // Source is output, target is input
          fromPort = sourcePort;
          toPort = { port: targetPort, type: "input", index: i, node: newNode };
        } else {
          // Source is input, target is output
          fromPort = {
            port: targetPort,
            type: "output",
            index: i,
            node: newNode,
          };
          toPort = sourcePort;
        }

        // Remove existing connections to input port
        if (toPort.type === "input") {
          this.store.links = this.store.links.filter(
            (link) =>
              !(
                link.toPort.node === toPort.node &&
                link.toPort.index === toPort.index &&
                link.toPort.type === "input"
              )
          );
        }

        // Remove existing connections from exec output port
        if (fromPort.type === "output" && fromPort.port.type === "exec") {
          this.store.links = this.store.links.filter(
            (link) =>
              !(
                link.fromPort.node === fromPort.node &&
                link.fromPort.index === fromPort.index &&
                link.fromPort.type === "output" &&
                link.fromPort.port.type === "exec"
              )
          );
        }

        // Create the new link
        const newLink = new GraphLinkImpl(fromPort, toPort, this.store);
        this.store.links.push(newLink);
        this._emitGraphChanged();
        break; // Connect to first compatible port
      }
    }
  }

  private _hideContextMenu(): void {
    console.log("_hideContextMenu");
    const menu = this.shadowRoot!.querySelector(".context-menu") as HTMLElement;
    if (menu) {
      menu.style.display = "none";
    }
    this.store.ui.contextMenu.visible = false;
    this.store.ui.contextMenu.pendingSource = null;
  }

  private _deleteSelectedNodes(): void {
    const selectedNodes = Array.from(this.store.interaction.selectedNodes);

    if (selectedNodes.length === 0) {
      return; // Nothing to delete
    }

    // Cleanup input elements for nodes being deleted BEFORE removing them
    for (const node of selectedNodes) {
      const nodeImpl = node as GraphNodeImpl & {
        inputElements?: HTMLInputElement[];
      };
      if (nodeImpl.inputElements) {
        nodeImpl.inputElements.forEach((el) => el.remove());
        nodeImpl.inputElements = undefined;
      }
    }

    // Get IDs of nodes to delete
    const nodeIdsToDelete = new Set(selectedNodes.map((node) => node.id));

    // Remove connections related to deleted nodes
    this.store.links = this.store.links.filter(
      (link) =>
        !nodeIdsToDelete.has(link.fromPort.node.id) &&
        !nodeIdsToDelete.has(link.toPort.node.id)
    );

    // Remove nodes
    this.store.nodes = this.store.nodes.filter(
      (node) => !nodeIdsToDelete.has(node.id)
    );

    // Clear selection
    this.store.interaction.selectedNodes.clear();

    // Emit graph changed event
    this._emitGraphChanged();
  }

  private _deleteSelectedLinks(): void {
    const selectedLinks = this.store.links.filter((link) => link.selected);

    if (selectedLinks.length === 0) {
      return; // Nothing to delete
    }

    // Remove selected links
    this.store.links = this.store.links.filter((link) => !link.selected);

    // Emit graph changed event
    this._emitGraphChanged();
  }

  private _selectAllNodes(): void {
    // Clear current selection
    this.store.interaction.selectedNodes.clear();

    // Select all nodes
    for (const node of this.store.nodes) {
      node.selected = true;
      this.store.interaction.selectedNodes.add(node);
    }

    // Emit graph changed event
    this._emitGraphChanged();
  }

  private _cleanupInputElements(): void {
    for (const node of this.store.nodes) {
      const nodeImpl = node as GraphNodeImpl & {
        inputElements?: HTMLInputElement[];
      };
      if (nodeImpl.inputElements) {
        nodeImpl.inputElements.forEach((el) => el.remove());
        nodeImpl.inputElements = undefined;
      }
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "graph-editor": GraphEditor;
  }
}
