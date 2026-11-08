import { ApiEnvelope } from '../../../core/auth/auth.models';
import { CommissionRank } from '../../../core/compensation/compensation.models';

/** Directory-safe node — mirrors backend `toNetworkNode` (+ tree fields). */
export type NetworkChain = 'growth' | 'referral' | 'all';
export type NetworkRelationType = 'referral' | 'placement' | null;

export interface NetworkNode {
  id: string;
  username: string;
  name: string;
  surname: string;
  role: string;
  plan: string;
  commissionRank: CommissionRank;
  commissionDepth: number;
  relationType: NetworkRelationType;
  profileImage?: string | null;
  joinedAt?: string;
  children: NetworkNode[];
  childCount: number;
  truncated: boolean;
}

export interface NetworkRoot {
  id: string;
  username: string;
  name: string;
  surname?: string;
  role: 'system';
  systemRoot: true;
  earning: false;
}

export interface NetworkTreeMeta {
  depth: number;
  chain?: NetworkChain;
  total: number;
  perLevel: number[];
  truncated: boolean;
}

export interface NetworkTreeEnvelope extends ApiEnvelope<{ tree: NetworkNode; meta: NetworkTreeMeta; systemRoot?: NetworkRoot }> {
  data: { tree: NetworkNode; meta: NetworkTreeMeta; systemRoot?: NetworkRoot };
}

export interface UplineEnvelope extends ApiEnvelope<{ chain: NetworkNode[]; depth: number; chainMode?: NetworkChain; systemRoot?: NetworkRoot }> {
  data: { chain: NetworkNode[]; depth: number; chainMode?: NetworkChain; systemRoot?: NetworkRoot };
}

/** Positioned node for the SVG tidy-tree layout. */
export interface PositionedNode extends NetworkNode {
  x: number;
  y: number;
  depth: number;
}

export interface TreeEdge {
  d: string;
  relationType: NetworkRelationType;
}
