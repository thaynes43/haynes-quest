export type Ability = 'move' | 'interact' | 'jump';
export type AppearanceStage = 'infant' | 'child';
export interface SubjectOption { id: string; label: string }
export interface MemoryPreview { id: string; date: string; ageYears: number; label: string; mediaUrl?: string }
export interface MemoryView extends MemoryPreview { mediaUrl: string }
export interface Appearance { contractVersion: string; subjectAppearanceId: string; stage: AppearanceStage }
export interface RuleVersions { journey: string; age: string; progression: string; appearance: string }
export interface SaveView {
 id: string; title: string; subject: SubjectOption; memories: MemoryView[]; recoveredIds: string[];
 ageYears: number; abilities: Ability[]; appearance: Appearance; completed: boolean; revision: number;
 createdAt: string; updatedAt: string; versions: RuleVersions;
}
export interface SaveSummary {
 id: string; title: string; subject: SubjectOption; ageYears: number; recoveredCount: number; memoryCount: number;
 completed: boolean; createdAt: string; updatedAt: string;
}
export interface PreviewRequest { name: string; birthDate: string; fromDate?: string; toDate?: string; limit?: number; subjectId?: string }
export interface PreviewResponse {
 previewId: string; subjects: SubjectOption[]; candidates: MemoryPreview[];
 coverage: {fromDate: string | null; toDate: string | null; incomplete: boolean; scanned: number}; selectedIds: string[];
}
export interface SessionView { player: {id: string; label: string}; mode: 'fixture'; csrfHeader: 'X-Quest-Request' }
export interface ApiError {error: {code: string; message: string}}
