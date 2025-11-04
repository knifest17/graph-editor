# Graph Editor Web Component

A standalone, framework-agnostic graph editor built with Lit and TypeScript. Rewritten from the legacy ModGraph codebase as a reusable web component.

## Features

- ✅ **Web Component**: Drop into any HTML page or framework (React, Vue, Angular, vanilla JS)
- ✅ **Visual Node Editor**: Drag-and-drop nodes, connect ports, visual programming
- ✅ **Code Generation**: Generate code from node graphs based on registry templates
- ✅ **Type-Safe**: Written in TypeScript with full type definitions
- ✅ **Customizable**: Load custom node registries to define your own node types
- ✅ **Canvas Rendering**: High-performance canvas-based rendering
- ✅ **Camera Controls**: Pan, zoom, multi-select
- ✅ **Event System**: Listen for graph changes, code generation, node selection

## Installation

```bash
npm install @modeditor/graph-editor
```

Or use directly in browser:

```html
<script type="module" src="./dist/graph-editor.js"></script>
```

## Quick Start

### HTML

```html
<!DOCTYPE html>
<html>
<head>
  <script type="module" src="./dist/graph-editor.js"></script>
</head>
<body>
  <graph-editor id="editor" style="width: 100vw; height: 100vh;"></graph-editor>
  
  <script type="module">
    const editor = document.querySelector('#editor');
    
    // Load node registry
    const registry = await fetch('./node-registry.json').then(r => r.json());
    editor.addRegistry(registry);
    
    // Listen for changes
    editor.addEventListener('graph-changed', (e) => {
      console.log('Graph:', e.detail.graph);
    });
    
    // Generate code
    const code = editor.exportCode();
    console.log(code);
  </script>
</body>
</html>
```

### JavaScript API

```javascript
const editor = document.querySelector('graph-editor');

// Add node registry
editor.addRegistry({
  version: '1.0',
  dataTypes: {
    bool: { name: 'Boolean', color: '#ff0000' },
    int: { name: 'Integer', color: '#00ff00' }
  },
  nodeCategories: {
    values: {
      color: '#808080',
      nodes: {
        bool: {
          title: 'Boolean',
          category: 'values',
          value: { type: 'bool', default: false },
          outputs: [{ type: 'bool', code: '${value}' }]
        }
      }
    }
  }
});

// Load a graph
editor.loadGraph({
  version: '1.0',
  nodes: [
    { id: 1, type: 'bool', category: 'values', x: 100, y: 100 }
  ],
  connections: []
});

// Export graph
const graph = editor.exportGraph();

// Generate code
try {
  const code = editor.exportCode();
  console.log(code);
} catch (e) {
  console.error('Generation failed:', e);
}

// Add node programmatically
const nodeId = editor.addNode('values', 'bool', 200, 200);

// Clear graph
editor.clearGraph();
```

### React Example

```tsx
import { useEffect, useRef } from 'react';
import '@modeditor/graph-editor';

function GraphEditorComponent() {
  const editorRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const editor = editorRef.current as any;
    if (!editor) return;

    // Load registry
    fetch('./registry.json')
      .then(r => r.json())
      .then(registry => editor.addRegistry(registry));

    // Listen for changes
    const handleChange = (e: CustomEvent) => {
      console.log('Graph changed:', e.detail.graph);
    };
    editor.addEventListener('graph-changed', handleChange);

    return () => {
      editor.removeEventListener('graph-changed', handleChange);
    };
  }, []);

  const handleExport = () => {
    const editor = editorRef.current as any;
    const graph = editor.exportGraph();
    console.log(graph);
  };

  return (
    <div>
      <graph-editor ref={editorRef} style={{ width: '100%', height: '600px' }}></graph-editor>
      <button onClick={handleExport}>Export</button>
    </div>
  );
}
```

## API Reference

### Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `readonly` | `boolean` | `false` | Make editor read-only (no editing) |

### Methods

#### `addRegistry(registry: NodeRegistry): void`
Add or merge a node registry. Defines available node types and data types.

#### `loadGraph(graph: GraphData): void`
Load a graph from serialized JSON data.

#### `exportGraph(): GraphData`
Export the current graph as serialized JSON.

#### `exportCode(): string`
Generate code from the current graph. Throws error if generation fails.

#### `clearGraph(): void`
Clear all nodes and connections.

#### `addNode(category: string, type: string, x: number, y: number): string`
Programmatically add a node. Returns the node ID.

### Events

#### `graph-changed`
Fired when the graph is modified (nodes added/removed/moved, connections changed).

```javascript
editor.addEventListener('graph-changed', (e) => {
  console.log(e.detail.graph); // GraphData
});
```

#### `code-generated`
Fired when code is successfully generated.

```javascript
editor.addEventListener('code-generated', (e) => {
  console.log(e.detail.code); // string
});
```

#### `node-selected`
Fired when a node is selected or deselected.

```javascript
editor.addEventListener('node-selected', (e) => {
  console.log(e.detail.node); // GraphNode | null
});
```

## Node Registry Format

See `docs/node-registry-schema.md` for full schema documentation.

Example:

```json
{
  "version": "1.0",
  "dataTypes": {
    "bool": { "name": "Boolean", "color": "#ff0000" }
  },
  "nodeCategories": {
    "values": {
      "color": "#808080",
      "nodes": {
        "bool": {
          "title": "Boolean",
          "category": "values",
          "value": { "type": "bool", "default": false },
          "outputs": [
            { "type": "bool", "code": "${value}" }
          ]
        }
      }
    }
  }
}
```

## Development

```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Build for production
npm run build

# Preview build
npm run preview
```

## Controls

- **Left Click + Drag**: Move nodes / Create selection box
- **Middle Click / Alt + Left Click**: Pan canvas
- **Mouse Wheel**: Zoom in/out
- **Ctrl + Click**: Multi-select nodes
- **Click Port**: Start connection
- **Click Port (while connecting)**: Complete connection

## Migration from Legacy ModGraph

This component is a complete rewrite of the legacy ModGraph editor. Key differences:

- ✅ Web component instead of global scripts
- ✅ TypeScript instead of vanilla JavaScript
- ✅ Lit framework for reactive rendering
- ✅ Modular architecture (separate renderer, mouse handler, code generator)
- ✅ No backend dependency (all code generation client-side)
- ✅ Framework-agnostic (works in any environment)

The node registry format is backward compatible with the legacy format.

## License

MIT
