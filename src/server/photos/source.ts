import type { PreviewRequest, SubjectOption } from '../../shared/contracts.js';
import type { FrozenMemory } from '../domain.js';

export interface ResolvedSubject {
  option: SubjectOption;
  sourceId: string;
}

export type SubjectResolution =
  | { kind: 'missing'; subjects: [] }
  | { kind: 'exact'; subjects: [ResolvedSubject] }
  | { kind: 'ambiguous'; subjects: ResolvedSubject[] };

export interface DiscoveryResult {
  memories: FrozenMemory[];
  scanned: number;
  incomplete: boolean;
}

export interface JourneyPhotoSource {
  resolveName(name: string): Promise<SubjectResolution>;
  discover(subject: ResolvedSubject, request: PreviewRequest): Promise<DiscoveryResult>;
}
