# Legacy fixtures

These fixtures describe the retired `RoomSpec` discriminated union and are
preserved for historical reference only. They are excluded from the
TypeScript project (`tsconfig.json#exclude`) and are not imported by any
live code paths.

Everyday Studio's current brief-driven flow lives in `../vincent-ave-kitchen.ts`
and is typed against `RoomBrief` + `ProjectTheme` (see `lib/briefs/schema.ts`).
