export const buildCreateImageLinks = (imageIds: number[]) => ({
  createMany: {
    data: imageIds.map((imageId) => ({ image_id: imageId })),
  },
});

export const buildReplaceImageLinks = (imageIds: number[]) => ({
  deleteMany: {},
  createMany: {
    data: imageIds.map((imageId) => ({ image_id: imageId })),
  },
});
