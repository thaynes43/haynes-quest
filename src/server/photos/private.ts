import {
  ImmichHttpCaller,
  ImmichPhotoSource,
  type ImmichLimits,
} from "./immich.js";
import { SharpImageSanitizer } from "./sanitizer.js";

/** Construct only behind an admitted identity + connection grant. Fixture startup never calls this. */
export function createPrivateImmichAdapter(config: {
  url: string;
  apiKey: string;
  allowedOrigins: readonly string[];
  subjectIdSecret: string;
  connectionId: string;
  limits?: Partial<ImmichLimits>;
}): ImmichPhotoSource {
  return new ImmichPhotoSource(
    new ImmichHttpCaller(config.url, config.apiKey, config.allowedOrigins),
    config.subjectIdSecret,
    config.connectionId,
    config.limits,
    new SharpImageSanitizer(),
  );
}
