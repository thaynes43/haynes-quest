# AppDaemon Immich integration reference

Reviewed `thaynes43/hass-sandbox` at `3cb60b7` on 2026-09-11 without reading live credentials, person records, or photos. This is source evidence; compatibility with the deployed Immich version still needs validation.

## Reuse points

- `appdaemon/providers/photo_providers/immich_client.py`: `x-api-key` authentication, URL normalization, REST calls and metadata-search pagination.
- `immich_data_provider.py` in that directory: environment-secret resolution and people lookup; `immich_selectors.py`: request filters; `types.py`: data contracts.
- `appdaemon/apps/immich_fetcher/immich_fetcher_app.py`: orchestration. `appdaemon/apps/apps-prod.yaml` configures `immich_url_env` and `immich_api_key_env` with environment names `IMMICH_URL` and `IMMICH_API_KEY`.
- Tests under `appdaemon/tests/`: `test_immich_client.py`, `test_immich_selectors.py`, `test_immich_data_provider.py`, `test_photo_providers_types.py`, and `test_immich_fetcher.py`.

`GET /api/people` returns people and pagination state. Resolve the entered name explicitly, handle ambiguity, and retain the chosen upstream ID privately. For a bounded chronological candidate set, use paginated `POST /api/search/metadata` with the required person filter on every request. The reference's album fallback demonstrates `assets.items` and numeric/string `assets.nextPage`; validate the actual server's schema. `GET /api/assets/{id}/thumbnail?size=preview` provides preview bytes.

## Quest-specific corrections

- Fail closed for unresolved/ambiguous names. The reference can omit `personIds` when lookup fails, broadening the search; duplicate display names overwrite each other in its lookup map.
- Do not copy its album selector unchanged: it ignores common person/date/type filters. Random/smart searches also do not establish exhaustive chronological coverage.
- Bound pagination, dates, response sizes, candidate counts, and timeouts. Reject malformed pagination instead of silently reporting a complete result. Parse actual dates; the reference's shape check permits impossible dates.
- Explicitly filter to supported, accessible, non-trashed/non-archived images and the selected person/date window. Confirm hidden/locked-media handling against the deployed API. Do not fall back to unrelated assets when coverage is sparse.
- Validate returned media type/bytes; the reference always downloads a preview and writes a `.jpg` regardless of its quality configuration.
- Do not copy metadata logging or HA sensor publication. Names, source IDs, request/response bodies, EXIF, private media and credentials stay out of logs, git, build artifacts, screenshots and public test reports. Repository tests use fictional subjects and synthetic images.

Tom authorizes the family PoC to reuse AppDaemon's Immich URL/API key. Deliver them through ExternalSecrets from 1Password in `haynes-ops`; never commit secret values. The game resolves entered names and stores subject configuration on the server, with authenticated authorization for setup, saves and every media request. A shared upstream key does not by itself grant an application user access to every person in that library.
