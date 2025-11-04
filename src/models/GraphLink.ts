import type { GraphLink, PortInfo } from '../types';
import { EditorStore } from '../store';

/**
 * Implementation of GraphLink
 */
export class GraphLinkImpl implements GraphLink {
  id: number;
  fromPort: PortInfo;
  toPort: PortInfo;
  selected = false;

  constructor(fromPortInfo: PortInfo, toPortInfo: PortInfo, store: EditorStore) {
    this.id = store.nextLinkId();
    this.fromPort = fromPortInfo;
    this.toPort = toPortInfo;
  }
}
