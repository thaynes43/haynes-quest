/** Request the smaller authorized variant only for the in-world keepsake. */
export function photoTextureUrl(mediaUrl: string): string {
  const fragmentAt = mediaUrl.indexOf("#");
  const withoutFragment = fragmentAt < 0 ? mediaUrl : mediaUrl.slice(0, fragmentAt);
  const fragment = fragmentAt < 0 ? "" : mediaUrl.slice(fragmentAt);
  const queryAt = withoutFragment.indexOf("?");
  const path = queryAt < 0 ? withoutFragment : withoutFragment.slice(0, queryAt);
  const query = new URLSearchParams(queryAt < 0 ? "" : withoutFragment.slice(queryAt + 1));
  query.set("size", "texture");
  return `${path}?${query}${fragment}`;
}
