import { api, apiRequest, friendlyError } from "../api";
import type {
  AdminChildSummary,
  AdminDraftResponse,
  ChildView,
  CreateChildInput,
  DraftEditRequest,
  FamilyJourneysResponse,
  FamilyPlayResponse,
  PersonChoice,
  PublicationSummary,
  SuggestionPageView,
  TemplateOffer,
} from "../../shared/family-api";
import type { FamilyMemorySlot } from "../../shared/family-plan";

/** DESIGN-024 D-08 calls. Photos are addressed by opaque tokens only. */
export const familyApi = {
  journeys: () => api<FamilyJourneysResponse>("/children"),
  play: (childId: string, fresh = false) =>
    api<FamilyPlayResponse>(`/children/${encodeURIComponent(childId)}/play`, fresh ? { fresh: true } : {}),
  adminChildren: () => api<{ children: AdminChildSummary[] }>("/admin/children"),
  people: (name: string) =>
    api<{ people: PersonChoice[] }>(`/admin/immich/people?name=${encodeURIComponent(name)}`),
  templates: (birthDate: string) =>
    api<{ templates: TemplateOffer[] }>(`/admin/templates?birthDate=${encodeURIComponent(birthDate)}`),
  createChild: (input: CreateChildInput) => api<ChildView>("/admin/children", input),
  draft: (childId: string) =>
    api<AdminDraftResponse>(`/admin/children/${encodeURIComponent(childId)}/draft`),
  editDraft: (childId: string, request: DraftEditRequest) =>
    apiRequest<AdminDraftResponse>(`/admin/children/${encodeURIComponent(childId)}/draft`, {
      method: "PUT",
      body: request,
    }),
  suggestions: (childId: string, chapterId: string, slot: FamilyMemorySlot, cursor: number) =>
    api<SuggestionPageView>(
      `/admin/children/${encodeURIComponent(childId)}/draft/slots/${encodeURIComponent(chapterId)}/${slot}/suggestions?cursor=${cursor}`,
    ),
  publish: (childId: string, expectedRevision: number, requestId: string) =>
    api<PublicationSummary>(`/admin/children/${encodeURIComponent(childId)}/publish`, {
      expectedRevision,
      requestId,
    }),
  thumbnailUrl: (token: string) => `/api/admin/candidates/${encodeURIComponent(token)}/image`,
};

/** Friendly wording for family setup and journey errors. */
export function familyErrorText(error: unknown): string {
  const code = error instanceof Error ? error.message : "";
  const text: Record<string, string> = {
    FAMILY_SETUP_UNAVAILABLE: "Immich isn't connected right now, so photos can't be changed.",
    IMMICH_UNAVAILABLE: "Immich didn't answer. Try again in a moment.",
    IMMICH_RESPONSE_INVALID: "Immich sent something unexpected. Try again in a moment.",
    DRAFT_CONFLICT: "Someone else changed these memories. The latest version is loaded.",
    DRAFT_STALE: "The birthday or world changed. Pick the photos again.",
    AUTO_PICK_RUNNING: "Photos are still being picked.",
    SLOTS_INCOMPLETE: "Every memory needs a photo before publishing.",
    CANDIDATE_INVALID: "That suggestion expired. Show the suggestions again.",
    CANDIDATE_OUT_OF_RANGE: "That photo's date doesn't fit this memory.",
    PHOTO_ALREADY_USED: "That photo is already used for another memory.",
    CAPTION_EMPTY: "Write a caption first.",
    CAPTION_TOO_LONG: "Keep captions to 60 characters.",
    CAPTION_INVALID: "Use plain text for captions.",
    TEMPLATE_NOT_OFFERED: "That world doesn't fit this birthday.",
    SUBJECT_UNRESOLVED: "Choose the person again.",
    CHILD_EXISTS: "This person already has a quest.",
    INVALID_DISPLAY_NAME: "Enter the name the game should use.",
    INVALID_BIRTH_DATE: "Enter a birthday that has already happened.",
    JOURNEY_NOT_PUBLISHED: "This quest isn't ready yet.",
    ADMIN_REQUIRED: "Only a family admin can do that.",
  };
  return text[code] ?? friendlyError(error);
}
