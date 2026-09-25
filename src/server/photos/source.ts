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

/**
 * Family journeys (DESIGN-024 D-04). Upstream ids appear here because this is
 * the server-side library boundary; they never leave the server.
 */
export interface FamilyPerson {
  /** Opaque, HMAC-derived choice id that is safe to show an administrator. */
  option: SubjectOption;
  sourceId: string;
  /** Immich's explicitly entered person birth date, when present. */
  birthDate: string | null;
}

export interface FamilySearchRequest {
  personId: string;
  /** Smart (CLIP) search when present, otherwise metadata search. */
  query?: string;
  /** Inclusive local calendar dates. */
  fromDate: string;
  toDate: string;
  page: number;
  size: number;
}

export interface FamilyAsset {
  assetId: string;
  /** Local calendar date from `localDateTime`. */
  localDate: string;
  /** Upstream people on the asset, when the endpoint returns them. */
  personIds: string[] | null;
  width: number | null;
  height: number | null;
  likelyScreenshot: boolean;
}

export interface FamilySearchPage {
  assets: FamilyAsset[];
  nextPage: number | null;
}

export interface FamilyFace {
  personId: string | null;
  imageWidth: number;
  imageHeight: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface FamilyPhotoLibrary {
  findPeople(name: string, options: { deadline: number }): Promise<FamilyPerson[]>;
  /** Eligible assets only: images on the timeline, not trashed, archived or offline. */
  search(request: FamilySearchRequest, options: { deadline: number }): Promise<FamilySearchPage>;
  faces(assetId: string, options: { deadline: number }): Promise<FamilyFace[]>;
  /** HMAC-derived asset reference, stable per connection; never the upstream id. */
  opaqueAssetRef(assetId: string): string;
}
