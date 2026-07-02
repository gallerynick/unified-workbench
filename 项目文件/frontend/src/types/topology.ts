export type TopologyNodeType = 'router' | 'switch' | 'server' | 'computer' | 'smartphone' | 'headphone' | 'internet' | 'keyboard' | 'mouse' | 'printer' | 'projector' | 'speaker' | 'television' | 'custom';
export type TopologyNodeStatus = 'online' | 'offline' | 'warning';
export type TopologyShape = 'circle' | 'rectangle' | 'diamond' | 'hexagon' | 'triangle';

export interface TopologyNode {
  id: string;
  x: number;
  y: number;
  label: string;
  type: TopologyNodeType;
  shape?: TopologyShape;
  customColor?: string;
  ip?: string;
  status?: TopologyNodeStatus;
}

export interface TopologyEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface Topology {
  id: string;
  name: string;
  description: string | null;
  category: string;
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface TopologyCreate {
  name: string;
  description?: string;
  category?: string;
  nodes?: TopologyNode[];
  edges?: TopologyEdge[];
}

export interface TopologyUpdate {
  name?: string;
  description?: string;
  category?: string;
  nodes?: TopologyNode[];
  edges?: TopologyEdge[];
}

export interface TopologyListResponse {
  items: Topology[];
  total: number;
}