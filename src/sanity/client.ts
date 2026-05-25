import { createClient } from "@sanity/client";
import { sanityApiVersion, sanityDataset, sanityEnabled, sanityProjectId } from "./env";

export const sanityClient = sanityEnabled
  ? createClient({
      projectId: sanityProjectId,
      dataset: sanityDataset,
      apiVersion: sanityApiVersion,
      useCdn: true
    })
  : null;
