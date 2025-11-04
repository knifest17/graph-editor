import type { GraphNode, Port, NodeTypeDefinition } from './types';
import { EditorStore } from './store';
import { escapeRegExp } from './utils/helpers';

/**
 * Code generation from node graph
 */
export class CodeGenerator {
  private store: EditorStore;

  constructor(store: EditorStore) {
    this.store = store;
  }

  /**
   * Generate code for the entire graph
   */
  generate(): string {
    const processed = new Set<number>();
    const entries = this.store.nodes.filter((n: GraphNode) => {
      const def = this.findNodeType(n.type);
      if (!def?.inputs) return false;
      const hasExecIn = def.inputs.some((i: Port) => i.type === 'exec');
      if (!hasExecIn) return false;
      const incoming = this.store.links.some(
        (l) => l.toPort.node === n && l.toPort.port.type === 'exec'
      );
      return !incoming;
    });

    if (!entries.length) {
      throw new Error(
        'No entry point nodes (exec input without incoming exec).'
      );
    }

    let buf = `// Generated Code from Node Graph\n// Generated on: ${new Date().toISOString()}\n\n`;
    buf += entries
      .map((e: GraphNode) => this.generateNodeCode(e, processed))
      .filter(Boolean)
      .join('\n\n');
    return buf;
  }

  /**
   * Find node type definition
   */
  private findNodeType(type: string): NodeTypeDefinition | null {
    for (const c in this.store.nodeCategories) {
      const category = this.store.nodeCategories[c];
      if (category.nodes) {
        const t = category.nodes[type];
        if (t) return t;
      }
    }
    return null;
  }

  /**
   * Get code output for a specific node and port
   */
  getNodeOutputCode(node: GraphNode, port: Port): string {
    const def = this.findNodeType(node.type);
    if (!def) return '';
    const outDef = def.outputs?.find(
      (o: Port) => o.name === port.name || o.type === port.type
    );
    if (!outDef || typeof outDef.code !== 'string') return '';
    
    let code = outDef.code;

    if (node.hasValue && node.value !== undefined) {
      const v =
        typeof node.value === 'object'
          ? JSON.stringify(node.value)
          : String(node.value);
      code = code.replace(/\$\{value\}/g, v);
    }

    for (const l of this.store.links.filter(
      (l) => l.toPort.node === node && l.toPort.port.type !== 'exec'
    )) {
      const inputVal = this.getNodeOutputCode(l.fromPort.node, l.fromPort.port);
      const ph = `\${${l.toPort.port.name}}`;
      code = code.replace(new RegExp(escapeRegExp(ph), 'g'), inputVal);
    }
    return code.replace(/\$\{nodeId\}/g, String(node.id));
  }

  /**
   * Generate code for a single node
   */
  generateNodeCode(node: GraphNode, processed: Set<number>): string {
    if (processed.has(node.id)) return '';
    processed.add(node.id);

    const def = this.findNodeType(node.type);
    if (!def) return '';
    const execIn = def.inputs?.find((i: Port) => i.type === 'exec');
    if (!execIn || typeof execIn.code !== 'string') return '';

    let code = execIn.code;

    if (node.hasValue && node.value !== undefined) {
      const v =
        typeof node.value === 'object'
          ? JSON.stringify(node.value)
          : String(node.value);
      code = code.replace(/\$\{value\}/g, v);
    }

    // data inputs
    for (const l of this.store.links.filter(
      (link) => link.toPort.node === node && link.toPort.port.type !== 'exec'
    )) {
      const inputVal = this.getNodeOutputCode(l.fromPort.node, l.fromPort.port);
      const ph = `\${${l.toPort.port.name}}`;
      code = code.replace(new RegExp(escapeRegExp(ph), 'g'), inputVal);
    }

    // exec outputs
    for (const l of this.store.links.filter(
      (link) => link.fromPort.node === node && link.fromPort.port.type === 'exec'
    )) {
      const next = this.generateNodeCode(l.toPort.node, processed);
      const ph = `\${${l.fromPort.port.name}}`;
      code = code.replace(
        new RegExp(`(\\n)?([\\t ]*)${escapeRegExp(ph)}`, 'g'),
        (_: string, nl: string, ind: string) => {
          if (!next) return '';
          return (
            (nl || '') +
            next
              .split('\n')
              .map((line: string) => ind + line)
              .join('\n')
          );
        }
      );
    }

    code = code.replace(/\$\{nodeId\}/g, String(node.id));
    code = code.replace(/\n[ \t]*\$\{[^}]+\}/g, '').replace(/\$\{[^}]+\}/g, '');
    return code;
  }
}
