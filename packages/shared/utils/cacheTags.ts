export const normalizeEndpointTagPath = (path: string) => {
  const normalizedSegments = path
    .split("/")
    .filter((segment) => segment.length > 0 && !segment.startsWith(":"));

  return `/${normalizedSegments.join("/")}`;
};

export const tagForEndpoint = (path: string, identity?: string | number) => {
  const baseTag = normalizeEndpointTagPath(path);
  return identity === undefined ? baseTag : `${baseTag}:${String(identity)}`;
};
