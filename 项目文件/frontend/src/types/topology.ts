export type TopologyNodeType = 'router' | 'switch' | 'server' | 'firewall' | 'device' | 'cloud';
export type TopologyNodeStatus = 'online' | 'offline' | 'warning';
export type TopologyType = 'device' | 'network' | 'custom';

export interface TopologyNode {
  id: string;
  x: number;
  y: number;
  label: string;
  type: TopologyNodeType;
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
  topology_type: TopologyType;
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface TopologyCreate {
  name: string;
  description?: string;
  topology_type: TopologyType;
  nodes?: TopologyNode[];
  edges?: TopologyEdge[];
}

export interface TopologyUpdate {
  name?: string;
  description?: string;
  topology_type?: TopologyType;
  nodes?: TopologyNode[];
  edges?: TopologyEdge[];
}

export interface TopologyListResponse {
  items: Topology[];
  total: number;
}