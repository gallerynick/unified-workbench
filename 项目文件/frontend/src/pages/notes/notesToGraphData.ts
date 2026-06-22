import type { Note } from '../../types/note';

export interface GraphNodeData {
  id: string;
  name: string;
  val: number;
  category: string | null;
  isPinned: boolean;
  degree: number;
  note: Note;
}

export interface GraphLinkData {
  source: string;
  target: string;
}

export interface GraphData {
  nodes: GraphNodeData[];
  links: GraphLinkData[];
}

export function notesToGraphData(notes: Note[]): GraphData {
  const degreeMap = new Map<string, number>();

  // 初始化所有度数为 0
  for (const note of notes) {
    degreeMap.set(note.id, 0);
  }

  // 计算度数：父子关系双向计算
  for (const note of notes) {
    if (note.parent_id && degreeMap.has(note.parent_id)) {
      degreeMap.set(note.id, (degreeMap.get(note.id) ?? 0) + 1);
      degreeMap.set(note.parent_id, (degreeMap.get(note.parent_id) ?? 0) + 1);
    }
  }

  const nodes: GraphNodeData[] = notes.map((note) => ({
    id: note.id,
    name: note.title,
    val: (degreeMap.get(note.id) ?? 0) + 1,
    category: note.category,
    isPinned: note.is_pinned,
    degree: degreeMap.get(note.id) ?? 0,
    note,
  }));

  const links: GraphLinkData[] = notes
    .filter((note) => note.parent_id !== null && degreeMap.has(note.parent_id as string))
    .map((note) => ({
      source: note.parent_id as string,
      target: note.id,
    }));

  return { nodes, links };
}
