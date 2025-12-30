import type { Edge, Node } from '@xyflow/svelte';

export const initialNodes: Node[] = [
  {
    id: '1',
    type: 'media',
    data: { name: 'Jane Doe', job: 'CEO', emoji: '😎' },
    position: { x: 0, y: 0 }
  },
  {
    id: '2',
    type: 'media',
    data: { name: 'Tyler Weary', job: 'Designer', emoji: '🤓' },

    position: { x: 500, y: -200 }
  },
  {
    id: '3',
    type: 'media',
    data: { name: 'Kristi Price', job: 'Developer', emoji: '🤩' },
    position: { x: 500, y: 200 }
  }
];

export const initialEdges: Edge[] = [
  {
    id: 'e1-2',
    source: '1',
    sourceHandle: 'correct',
    target: '2'
  },
  {
    id: 'e1-3',
    source: '1',
    target: '3'
  },
  {
    id: 'e1-1',
    source: '1',
    target: '1',
    type: 'selfconnecting',
  },
  {
    id: 'e3-1',
    source: '3',
    target: '1',
  }
];
