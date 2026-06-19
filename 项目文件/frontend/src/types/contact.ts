export type ContactType = 'customer' | 'supplier' | 'partner' | 'other';

export interface Contact {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  contact_type: ContactType;
  tags: string[] | null;
  notes: string | null;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface ContactCreate {
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  address?: string;
  contact_type?: ContactType;
  tags?: string[];
  notes?: string;
}

export interface ContactUpdate {
  name?: string;
  company?: string;
  email?: string;
  phone?: string;
  address?: string;
  contact_type?: ContactType;
  tags?: string[];
  notes?: string;
}

export interface ContactListResponse {
  items: Contact[];
  total: number;
}
