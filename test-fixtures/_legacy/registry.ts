import type { RoomSpec, PropertyContext, ReferenceMaterial } from "../lib/specs/schema";

import {
  vincentAveContext,
  vincentAveKitchenSpec,
  vincentAveKitchenBasePhotoDescription,
} from "./vincent-ave-kitchen";
import {
  vincentAvePrimaryBathSpec,
  vincentAvePrimaryBathBasePhotoDescription,
} from "./vincent-ave-primary-bath";
import {
  luxuryKitchenContext,
  luxuryKitchenSpec,
  luxuryKitchenBasePhotoDescription,
} from "./luxury-kitchen";
import {
  builderBedroomContext,
  builderBedroomSpec,
  builderBedroomBasePhotoDescription,
} from "./builder-bedroom";
import { vincentAveKitchenWithRefsReferences } from "./vincent-ave-kitchen-with-refs";

export interface FixtureRecord {
  name: string;
  spec: RoomSpec;
  context: PropertyContext;
  basePhotoDescription: string;
  references?: ReferenceMaterial[];
}

export const FIXTURES: Record<string, FixtureRecord> = {
  "vincent-ave-kitchen": {
    name: "vincent-ave-kitchen",
    spec: vincentAveKitchenSpec,
    context: vincentAveContext,
    basePhotoDescription: vincentAveKitchenBasePhotoDescription,
  },
  "vincent-ave-primary-bath": {
    name: "vincent-ave-primary-bath",
    spec: vincentAvePrimaryBathSpec,
    context: vincentAveContext,
    basePhotoDescription: vincentAvePrimaryBathBasePhotoDescription,
  },
  "luxury-kitchen": {
    name: "luxury-kitchen",
    spec: luxuryKitchenSpec,
    context: luxuryKitchenContext,
    basePhotoDescription: luxuryKitchenBasePhotoDescription,
  },
  "builder-bedroom": {
    name: "builder-bedroom",
    spec: builderBedroomSpec,
    context: builderBedroomContext,
    basePhotoDescription: builderBedroomBasePhotoDescription,
  },
  "vincent-ave-kitchen-with-refs": {
    name: "vincent-ave-kitchen-with-refs",
    spec: vincentAveKitchenSpec,
    context: vincentAveContext,
    basePhotoDescription: vincentAveKitchenBasePhotoDescription,
    references: vincentAveKitchenWithRefsReferences,
  },
};

export const DEFAULT_FIXTURE = "vincent-ave-kitchen";

export function getFixture(name: string): FixtureRecord {
  const fx = FIXTURES[name];
  if (!fx) {
    const known = Object.keys(FIXTURES).sort().join(", ");
    throw new Error(`Unknown fixture "${name}". Known fixtures: ${known}`);
  }
  return fx;
}
