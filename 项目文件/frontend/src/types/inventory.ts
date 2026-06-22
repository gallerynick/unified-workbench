export type InventoryStatus = 'available' | 'in_use' | 'maintenance' | 'retired';

export interface Inventory {
  id: string;
  name: string;
  category: string | null;
  quantity: number;
  location: string | null;
  description: string | null;
  status: InventoryStatus;
  tags: string[] | null;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface InventoryCreate {
  name: string;
  category?: string;
  quantity?: number;
  location?: string;
  description?: string;
  status?: InventoryStatus;
  tags?: string[];
}

export interface InventoryUpdate {
  name?: string;
  category?: string;
  quantity?: number;
  location?: string;
  description?: string;
  status?: InventoryStatus;
  tags?: string[];
}

export interface InventoryListResponse {
  items: Inventory[];
  total: number;
}
