export const buildCreateTagLinks = (tagIds: number[]) => ({
  createMany: {
    data: tagIds.map((tagId) => ({ tag_id: tagId })),
  },
});

export const buildReplaceTagLinks = (tagIds: number[]) => ({
  deleteMany: {},
  createMany: {
    data: tagIds.map((tagId) => ({ tag_id: tagId })),
  },
});
