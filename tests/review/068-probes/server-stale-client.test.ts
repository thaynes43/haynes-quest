import { describe, expect, it } from 'vitest';
import { makeEphemeralApp, mutation, preview, startSession } from './helpers.js';

describe('WO068 probe: stale client selection in ephemeral mode', () => {
  it('rejects a fewer-than-six selection with a client error, not a 5xx', async () => {
    const { app, diagnostics } = makeEphemeralApp();
    const { cookie } = await startSession(app);
    const { body: previewBody } = await preview(app, cookie);
    expect(previewBody.selectedIds).toHaveLength(6);

    const response = await app.request(
      '/api/saves',
      mutation(cookie, {
        previewId: previewBody.previewId,
        selectedIds: previewBody.selectedIds.slice(0, 3),
      }),
    );
    const body = await response.json();
    // Observed values recorded for the report.
    console.log('OBSERVED create-save', response.status, JSON.stringify(body), JSON.stringify(diagnostics));
    expect({ status: response.status, code: body.error?.code, diagnostics }).toEqual({
      status: 422,
      code: 'INVALID_SELECTION',
      diagnostics: [],
    });
  });

  it('does not leak the failed attempt as a permanent preview/save slot', async () => {
    const { app, store } = makeEphemeralApp();
    const { cookie } = await startSession(app);
    const { body: previewBody } = await preview(app, cookie);
    const first = await app.request(
      '/api/saves',
      mutation(cookie, { previewId: previewBody.previewId, selectedIds: previewBody.selectedIds.slice(0, 5) }),
    );
    console.log('OBSERVED five-id create-save', first.status, JSON.stringify(await first.json()));
    // A retry with the full selection must still work after the failed attempt.
    const retry = await app.request(
      '/api/saves',
      mutation(cookie, { previewId: previewBody.previewId, selectedIds: previewBody.selectedIds }),
    );
    expect(retry.status).toBe(201);
    void store;
  });
});
