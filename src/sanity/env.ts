export const sanityProjectId = import.meta.env.PUBLIC_SANITY_PROJECT_ID;
export const sanityDataset = import.meta.env.PUBLIC_SANITY_DATASET || "production";
export const sanityApiVersion = "2026-05-25";
export const sanityEnabled = Boolean(sanityProjectId && sanityProjectId !== "replace-with-sanity-project-id");
