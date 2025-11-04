# Developer Documentation

This document provides technical details for developers working on the graph-editor web component.

## Architecture Overview

The graph editor is built as a Lit web component with a modular architecture:

```
graph-editor/
├── src/
│   ├── graph-editor.ts       # Main Lit component & public API
│   ├── renderer.ts            # Canvas rendering engine
│   ├── mouse-handler.ts       # Mouse/keyboard event handling
│   ├── codegen.ts             # Code generation from graphs
│   ├── store.ts               # Centralized state management
│   ├── types.ts               # TypeScript type definitions
│   ├── models/
│   │   ├── GraphNode.ts       # Node model & logic
│   │   └── GraphLink.ts       # Connection model & logic
│   └── utils/
│       ├── camera.ts          # Pan/zoom camera controller
│       └── helpers.ts         # Utility functions
├── public/
│   └── node-registry.json     # Example node registry
└── demo.html                  # Development demo page
```

## Core Components

### 1. GraphEditor (graph-editor.ts)

The main web component that orchestrates all subsystems.

**Responsibilities:**
- Public API surface (`addRegistry`, `loadGraph`, `exportGraph`, etc.)
- Component lifecycle management
- Event dispatching (`graph-changed`, `code-generated`)
- UI layer management (HTML input fields overlay)
- Context menu logic
- Keyboard shortcuts (Delete, Ctrl+A)

**Key Methods:**
```typescript
// Public API
addRegistry(registry: NodeRegistry): void
loadGraph(graph: GraphData): void
exportGraph(): GraphData
exportCode(): string
clearGraph(): void
addNode(category, type, x, y): string

// Internal
_showContextMenu(worldX, worldY, screenX, screenY, sourcePort?)
_deleteSelectedNodes()
_selectAllNodes()
_syncValueInputs() // Updates HTML input positions
```

**State Management:**
- Uses `EditorStore` for all graph state
- Maintains references to renderer, mouse handler, camera, codegen
- Manages animation frame loop for continuous rendering

### 2. GraphRenderer (renderer.ts)

Handles all canvas drawing operations.

**Responsibilities:**
- Drawing nodes with dynamic width calculation
- Drawing connections (links) with data type colors
- Drawing ports (filled when connected, empty when not)
- Drawing selection boxes
- Grid rendering

**Key Methods:**
```typescript
render(): void                    // Main render loop
_drawNode(node: GraphNode): void
_drawLink(from, to, selected, temporary): void
_drawPort(port, isHovered, isConnected, isInput, execOutPortCount): void
_drawGrid(): void
_isPortConnected(portInfo): boolean // Checks if port has connections
```

**Rendering Details:**
- Applies camera transforms (translate/scale)
- Calculates node widths dynamically based on text content
- Uses data type colors for connections and ports
- Exec ports: Triangles (filled when connected)
- Data ports: Circles (filled when connected, outline when not)

### 3. MouseHandler (mouse-handler.ts)

Manages all mouse and touch interactions.

**Responsibilities:**
- Node dragging (single and multi-select)
- Connection creation (drag from port)
- Selection box (drag on empty space)
- Pan/zoom (middle-click drag, mouse wheel)
- Context menu (right-click, connection release in empty space)
- Port hover detection

**Key Methods:**
```typescript
_onMouseMove(e): void  // Handles dragging, hover, connection preview
_onMouseDown(e): void  // Initiates drag/select/connect/pan
_onMouseUp(e): void    // Completes connections, opens context menu
_onWheel(e): void      // Zoom and pan
_showContextMenu(worldX, worldY, sourcePort?): void
```

**Event Flow:**
```
MouseDown -> Check: Port? Node? Empty?
  Port    -> Start connection
  Node    -> Start drag / Add to selection
  Empty   -> Start selection box

MouseMove -> Update: Drag positions / Connection preview / Hover state

MouseUp   -> Complete: Connection / Selection / Show context menu
```

**Custom Events Emitted:**
- `'context-menu'`: { x, y, screenX, screenY, sourcePort }
- `'hide-context'`: Signals context menu should close

### 4. EditorStore (store.ts)

Centralized state container for all graph data.

**State Structure:**
```typescript
{
  registryLoaded: boolean
  codeGeneration: CodeGenerationConfig
  dataTypes: Record<string, DataTypeDefinition>
  nodeCategories: Record<string, CategoryDefinition>
  nodes: GraphNode[]
  links: GraphLink[]
  nodeIdCounter: number
  linkIdCounter: number
  camera: { x, y, zoom }
  viewport: { w, h }
  interaction: {
    isDragging: boolean
    dragOffsets: Map<GraphNode, Vec2>
    isConnecting: boolean
    connectionStart: PortInfo | null
    connectionEnd: { x, y }
    selection: { active, start, end }
    hoveredPort: PortInfo | null
    mouse: { x, y }
    selectedNodes: Set<GraphNode>
  }
  ui: {
    contextMenu: {
      visible: boolean
      worldX: number
      worldY: number
      pendingSource: PortInfo | null
    }
  }
}
```

**Methods:**
```typescript
nextNodeId(): number   // Auto-increment ID generator
nextLinkId(): number
clear(): void          // Reset to initial state
```

### 5. CodeGenerator (codegen.ts)

Generates code from graph data using template-based approach.

**Responsibilities:**
- Traverses graph starting from exec-in ports
- Expands node templates with variable substitutions
- Handles node code generation order
- Template variable replacement (`${varName}`, `${port:0}`, `${value}`)

**Key Methods:**
```typescript
generate(): string                    // Main entry point
generateNodeCode(node, varCounter): string
getNodeOutputCode(node, portIndex): string
```

**Template Variables:**
- `${varName}`: Auto-generated variable name
- `${port:N}`: Code from input port N
- `${value}`: Node's value property
- `${indent}`: Current indentation level

### 6. CameraController (utils/camera.ts)

Manages viewport transformation (pan and zoom).

**Coordinate Systems:**
- **World Space**: Absolute coordinates where nodes exist
- **Screen Space**: Canvas pixel coordinates

**Key Methods:**
```typescript
getWorldFromScreen(screenX, screenY): Vec2
getScreenFromWorld(worldX, worldY): Vec2
pan(dx, dy): void
zoom(factor, screenX, screenY): void
reset(): void
```

**Transform Formulas:**
```typescript
// World to Screen
screenX = (worldX - camera.x) * camera.zoom
screenY = (worldY - camera.y) * camera.zoom

// Screen to World
worldX = screenX / camera.zoom + camera.x
worldY = screenY / camera.zoom + camera.y
```

**Canvas Transform:**
```typescript
ctx.translate(-camera.x * camera.zoom, -camera.y * camera.zoom)
ctx.scale(camera.zoom, camera.zoom)
```

### 7. GraphNode (models/GraphNode.ts)

Node model with port management and hit detection.

**Responsibilities:**
- Stores node data (position, type, category, value)
- Manages input/output ports
- Dynamic width calculation based on text
- Port position updates
- Hit detection (containsPoint, portAt)

**Key Methods:**
```typescript
calculateWidth(ctx: CanvasRenderingContext2D): void
updatePortPositions(): void
containsPoint(x, y): boolean
portAt(x, y): PortInfo | null
```

**Width Calculation:**
```typescript
width = max(
  minWidth,
  titleWidth + padding,
  maxInputLabelWidth + maxOutputLabelWidth + gaps + padding
)
```

### 8. GraphLink (models/GraphLink.ts)

Connection model between ports.

**Properties:**
```typescript
{
  id: number
  fromPort: PortInfo  // Source port
  toPort: PortInfo    // Destination port
  selected: boolean
}
```

## Data Flow

### Graph Modification Flow
```
User Action (MouseHandler)
  ↓
State Update (EditorStore)
  ↓
Emit Event ('graph-changed')
  ↓
Render Loop (GraphRenderer)
```

### Connection Creation Flow
```
1. Click on source port (MouseHandler._onMouseDown)
   → Set store.interaction.isConnecting = true
   → Store sourcePort in store.interaction.connectionStart

2. Move mouse (MouseHandler._onMouseMove)
   → Update store.interaction.connectionEnd with cursor position
   → Renderer draws temporary connection

3. Release on target port (MouseHandler._onMouseUp)
   → Check compatibility (_canConnect)
   → Create GraphLinkImpl
   → Add to store.links
   → Emit 'graph-changed'

4. Release in empty space (MouseHandler._onMouseUp)
   → Show context menu with filtered compatible nodes
   → User selects node type
   → Create node at cursor position
   → Auto-connect to new node
```

### Context Menu Flow
```
1. Right-click or release connection (MouseHandler)
   → Emit 'context-menu' event with { worldX, worldY, screenX, screenY, sourcePort }

2. GraphEditor receives event
   → Build node list (filtered by sourcePort compatibility if present)
   → Render menu HTML with categories and search
   → Position at screenX/screenY
   → Setup event listeners (search, keyboard nav, click)

3. User navigates (arrow keys, search)
   → Filter visible items
   → Update selection

4. User selects node (Enter or click)
   → Create node at worldX/worldY
   → Auto-connect if sourcePort exists
   → Hide menu
```

## Node Registry Format

### Complete Schema

```typescript
interface NodeRegistry {
  version: string
  codeGeneration?: {
    language: string
    indentation: string
    variablePrefix: string
    resultPrefix: string
    commentStyle: string
  }
  dataTypes?: Record<string, {
    name: string
    color: string
  }>
  nodeCategories?: Record<string, {
    color: string
    nodes: Record<string, NodeTypeDefinition>
  }>
}

interface NodeTypeDefinition {
  title: string
  category: string
  description?: string
  color?: string
  inputs?: Port[]
  outputs?: Port[]
  value?: {
    type: 'bool' | 'int' | 'float' | 'string' | 'color' | 'float3'
    default?: any
  }
  style?: {
    minWidth?: number
  }
}

interface Port {
  type: string          // Data type or 'exec'
  name?: string         // Label shown in editor
  implicit?: boolean    // Hidden from UI
  code?: string         // Code template for this port
  dynamic?: {
    naming: 'numeric' | 'abc'
    delimiter: string
  }
}
```

### Example Node Definition

```json
{
  "title": "Add",
  "category": "math",
  "color": "#4488ff",
  "inputs": [
    { "type": "exec", "name": "" },
    { "type": "float", "name": "A", "code": "${port:0}" },
    { "type": "float", "name": "B", "code": "${port:1}" }
  ],
  "outputs": [
    { "type": "exec", "name": "" },
    { "type": "float", "name": "Result", "code": "${varName}" }
  ]
}
```

## Key Patterns & Conventions

### 1. Shadow DOM Encapsulation
- All UI is encapsulated in shadow DOM
- Canvas and context menu are inside shadow root
- HTML input fields are in `.ui-layer` div overlay

### 2. Event-Driven Communication
- MouseHandler emits custom events
- GraphEditor listens and coordinates
- Public API emits events for external consumers

### 3. Coordinate Transformation
- Mouse events in screen space
- Store positions in world space
- Camera converts between spaces
- Canvas applies transform via ctx.translate/scale

### 4. Render Loop
- Continuous animation frame loop
- Calculates node widths before each render
- Updates HTML input positions every frame

### 5. Port Connection Rules
- Input ports: Only one connection allowed
- Exec output ports: Only one connection allowed
- Data output ports: Multiple connections allowed
- Type compatibility: exec↔exec, data↔data, type-specific or 'data' wildcard

### 6. HTML Input Field Overlay
- Separate DOM layer positioned absolutely
- Updated every frame to follow nodes
- Uses world→screen coordinate conversion
- Properly scaled with zoom

## Building & Testing

### Development
```bash
npm run dev          # Start Vite dev server on localhost:5173
```

### Production Build
```bash
npm run build        # Compiles to dist/
npm run preview      # Test production build
```

### Type Checking
```bash
npx tsc --noEmit     # Check TypeScript errors
```

## Common Tasks

### Adding a New Node Type Property

1. Update `NodeTypeDefinition` interface in `types.ts`
2. Handle in `GraphNodeImpl` constructor in `models/GraphNode.ts`
3. Update serialization in `graph-editor.ts` (`exportGraph`, `loadGraph`)
4. Update rendering in `renderer.ts` if visual changes needed

### Adding a New Keyboard Shortcut

1. Add to keyboard event listener in `graph-editor.ts` `firstUpdated()`
2. Implement handler method (e.g., `_copyNodes()`)
3. Add `e.preventDefault()` if needed
4. Update README controls section

### Adding a New Context Menu Feature

1. Update HTML generation in `_showContextMenu()` in `graph-editor.ts`
2. Add event listeners in `_setupContextMenuListeners()`
3. Implement handler method
4. Update styles in `graph-editor.ts` static CSS if needed

### Changing Rendering Behavior

1. Modify `renderer.ts` methods (`_drawNode`, `_drawPort`, `_drawLink`)
2. Test with various zoom levels and node configurations
3. Ensure coordinate transformations are correct
4. Check performance with large graphs

## Performance Considerations

### Rendering Optimization
- Canvas clears and redraws every frame (acceptable for typical graph sizes)
- Node width calculation cached via dynamic calculation before render
- Use `requestAnimationFrame` for smooth 60fps
- Consider implementing dirty flags for very large graphs

### Memory Management
- Clean up HTML input elements when nodes deleted
- Remove event listeners in `disconnectedCallback`
- Cancel animation frame on disconnect

### Large Graph Handling
- Current implementation renders all nodes every frame
- For >1000 nodes, consider:
  - Viewport culling (only render visible nodes)
  - Virtualization
  - Level-of-detail rendering
  - Batch updates instead of per-frame calculation

## Debugging Tips

### Enable Debug Logging
Add `console.log` statements in:
- `MouseHandler._onMouseDown/Move/Up` for interaction debugging
- `GraphRenderer.render` for render cycle debugging
- `EditorStore` state updates to track state changes

### Inspect State
Access store from browser console:
```javascript
const editor = document.querySelector('graph-editor');
// Access internals (for debugging only)
editor.store.nodes        // Array of nodes
editor.store.links        // Array of connections
editor.store.interaction  // Current interaction state
```

### Common Issues

**Context menu doesn't appear:**
- Check if `display` is set to `block` in `_showContextMenu`
- Verify event listener for `'context-menu'` event is attached
- Check if click event is hiding menu immediately (flag issue)

**Nodes move in wrong direction:**
- Check camera transform formula in `renderer.ts`
- Verify `getWorldFromScreen` calculation in `camera.ts`
- Ensure mouse position is correctly converted to world space

**Ports not connecting:**
- Check `_canConnect` logic in `mouse-handler.ts`
- Verify port type compatibility rules
- Ensure port positions are updated (`updatePortPositions()`)

**Input fields not following nodes:**
- Check `_syncValueInputs()` is called in render loop
- Verify `getScreenFromWorld` calculation
- Ensure `.ui-layer` is positioned correctly

## Extension Points

### Custom Renderers
Extend `GraphRenderer` to customize drawing:
```typescript
class CustomRenderer extends GraphRenderer {
  _drawNode(node: GraphNode): void {
    // Custom node rendering
    super._drawNode(node);
    // Additional decorations
  }
}
```

### Custom Mouse Behavior
Extend `MouseHandler` for custom interactions:
```typescript
class CustomMouseHandler extends MouseHandler {
  _onMouseDown(e: MouseEvent): void {
    // Custom click behavior
    super._onMouseDown(e);
  }
}
```

### Custom Code Generation
Extend `CodeGenerator` for different output formats:
```typescript
class PythonCodeGenerator extends CodeGenerator {
  generate(): string {
    // Generate Python instead of default language
  }
}
```

## Contributing Guidelines

1. **Code Style**
   - Use TypeScript strict mode
   - Follow existing naming conventions (private methods prefixed with `_`)
   - Add JSDoc comments for public APIs
   - Use meaningful variable names

2. **Testing**
   - Test with sample node registry in `demo.html`
   - Verify all keyboard shortcuts work
   - Test pan/zoom at various scales
   - Check connection creation in all scenarios

3. **Documentation**
   - Update README for API changes
   - Update this file for architecture changes
   - Add inline comments for complex logic
   - Document breaking changes clearly

4. **Commits**
   - Use descriptive commit messages
   - Group related changes together
   - Reference issues if applicable

## Architecture Decisions

### Why Lit?
- Lightweight (~5KB)
- Native web components
- TypeScript support
- Reactive properties
- Shadow DOM encapsulation

### Why Canvas instead of SVG?
- Better performance for frequent updates
- Simpler coordinate transformations
- Lower memory footprint for large graphs
- Easier custom rendering

### Why Event-Based Architecture?
- Decouples subsystems
- Easier testing
- Clear communication boundaries
- Extensible without modification

### Why Centralized Store?
- Single source of truth
- Predictable state updates
- Easier debugging
- Simpler state synchronization

## Future Enhancements

**Potential Features:**
- [ ] Undo/Redo system
- [ ] Minimap navigator
- [ ] Node search/filter
- [ ] Graph validation
- [ ] Connection bend points
- [ ] Node grouping/comments
- [ ] Export to image (PNG/SVG)
- [ ] Collaborative editing
- [ ] Accessibility improvements (keyboard-only navigation)
- [ ] Touch device support

**Performance:**
- [ ] Viewport culling for large graphs
- [ ] Virtual scrolling for node list
- [ ] WebGL renderer option
- [ ] Worker-based code generation

## Resources

- [Lit Documentation](https://lit.dev/)
- [Web Components Spec](https://www.webcomponents.org/)
- [Canvas API Reference](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

## License

MIT - See LICENSE file for details.
