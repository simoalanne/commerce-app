import { revalidateTag } from "next/cache";

export async function POST(request: Request) {
  const secret = request.headers.get("Authorization");
  const secretKey = process.env.INTERNAL_API_KEY;
  // Just because the route is not "public" per se, does not mean that it is secure.
  // For now simple long token is enough but this can also be replaced with a more
  // traditional webhook signature verification if needed.
  if (!secretKey || secretKey.length < 32) {
    console.warn(
      "INTERNAL_API_KEY is not set in environment variables or is too short. Cache invalidation will not work.",
    );
    return new Response("Internal server error", { status: 500 });
  }
  if (secret !== `Bearer ${secretKey}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const { tags } = (await request.json()) as { tags: string[] };

  if (!tags || !Array.isArray(tags) || !tags.every((tag) => typeof tag === "string")) {
    return new Response("Invalid request body", { status: 400 });
  }

  for (const tag of tags) {
    // For now assume that the old cached data should be invalid immediately.
    // what this means is that if for example a slug changes then old slug will
    // return 404 and new slug will return the same or updated data. This is better
    // default than assuming that old data is still valid. Most pages expect fresh
    // data and if the data is not found then it should be treated as not found.
    revalidateTag(tag, { expire: 0 });
  }

  const auditLog = {
    timestamp: new Date().toISOString(),
    tags,
  };

  console.log("Cache invalidation request:", JSON.stringify(auditLog));
  return new Response("Cache invalidated", { status: 200 });
}
