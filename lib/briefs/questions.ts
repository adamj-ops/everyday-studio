import type { SpaceType } from "./space-types";

export interface CreativeQuestion {
  key: string;
  prompt: string;
  placeholder: string;
}

const BATH_QUESTIONS: CreativeQuestion[] = [
  {
    key: "vibe",
    prompt: "Describe the overall vibe — is this a spa retreat, a functional morning space, something else?",
    placeholder: "e.g., hotel-like calm, lots of natural light, a place to wind down...",
  },
  {
    key: "hero_moment",
    prompt: "What should be the hero moment?",
    placeholder: "e.g., a beautiful stone wall in the shower, or the vanity area...",
  },
  {
    key: "morning_ritual",
    prompt: "How is this bathroom used — morning routine, evening unwind, both?",
    placeholder: "e.g., quick mornings but long baths on weekends...",
  },
  {
    key: "materials_excitement",
    prompt: "What materials or finishes are you most excited about?",
    placeholder: "e.g., zellige tile with visible imperfection, aged brass...",
  },
  {
    key: "avoid",
    prompt: "What should this bathroom NOT feel like?",
    placeholder: "e.g., not cold and hotel-generic, not all white, not over-designed...",
  },
  {
    key: "references",
    prompt: "Any projects, designers, or references that inspire this direction?",
    placeholder: "e.g., something from Studio McGee, a specific European hotel...",
  },
  {
    key: "walking_in_feeling",
    prompt: "What should someone feel walking in?",
    placeholder: "e.g., exhale and relax...",
  },
];

const BEDROOM_QUESTIONS: CreativeQuestion[] = [
  {
    key: "vibe",
    prompt: "Describe the vibe of this bedroom — restful, romantic, elegant, casual?",
    placeholder: "",
  },
  {
    key: "hero_moment",
    prompt: "What should be the hero moment?",
    placeholder: "e.g., the bed as a statement, a window with a view, moody paint color...",
  },
  {
    key: "who_sleeps_here",
    prompt: "Who sleeps here and how do they use this space beyond sleeping?",
    placeholder: "e.g., couple who reads in bed, parents who need a retreat from kids...",
  },
  {
    key: "materials_excitement",
    prompt: "What materials, textiles, or finishes excite you?",
    placeholder: "e.g., linen everything, warm wood, layered textiles...",
  },
  {
    key: "avoid",
    prompt: "What should this bedroom NOT feel like?",
    placeholder: "e.g., not hotel-bland, not overly feminine, not cluttered...",
  },
  {
    key: "references",
    prompt: "Any references that inspire this direction?",
    placeholder: "",
  },
  {
    key: "morning_light",
    prompt: "How does this room feel in morning light vs evening?",
    placeholder: "e.g., sun-drenched mornings, candlelit evenings...",
  },
];

const LIVING_QUESTIONS: CreativeQuestion[] = [
  { key: "vibe", prompt: "Describe the overall vibe of the living room.", placeholder: "" },
  {
    key: "hero_moment",
    prompt: "What should be the hero moment — fireplace, art wall, something else?",
    placeholder: "",
  },
  {
    key: "how_people_live_here",
    prompt: "How do people actually use this room? TV nights, reading, entertaining?",
    placeholder: "",
  },
  {
    key: "materials_excitement",
    prompt: "What materials, textiles, or furniture excite you?",
    placeholder: "",
  },
  { key: "avoid", prompt: "What should this living room NOT feel like?", placeholder: "" },
  { key: "references", prompt: "Any references that inspire this direction?", placeholder: "" },
  { key: "walking_in_feeling", prompt: "What should someone feel walking in?", placeholder: "" },
];

const DINING_QUESTIONS: CreativeQuestion[] = [
  { key: "vibe", prompt: "Describe the vibe of this dining room.", placeholder: "" },
  {
    key: "hero_moment",
    prompt: "What should be the hero moment — the table, the chandelier, a statement wall?",
    placeholder: "",
  },
  {
    key: "how_people_dine",
    prompt: "How is this room used — formal dinners, everyday family meals, homework and puzzles?",
    placeholder: "",
  },
  { key: "materials_excitement", prompt: "What materials or pieces excite you?", placeholder: "" },
  { key: "avoid", prompt: "What should this dining room NOT feel like?", placeholder: "" },
  { key: "references", prompt: "Any references that inspire this direction?", placeholder: "" },
];

const OTHER_QUESTIONS: CreativeQuestion[] = [
  { key: "vibe", prompt: "Describe the overall vibe.", placeholder: "" },
  { key: "hero_moment", prompt: "What's the hero moment?", placeholder: "" },
  { key: "materials_excitement", prompt: "What materials or finishes excite you?", placeholder: "" },
  { key: "avoid", prompt: "What should this NOT feel like?", placeholder: "" },
  { key: "references", prompt: "Any references?", placeholder: "" },
];

const EXTERIOR_SURFACE_QUESTIONS: CreativeQuestion[] = [
  { key: "creative_direction", prompt: "Describe the overall direction for this exterior surface.", placeholder: "" },
  { key: "hero_moment", prompt: "What should be the hero moment?", placeholder: "" },
  { key: "materials_excitement", prompt: "What materials, plantings, or finishes are most important?", placeholder: "" },
  { key: "avoid", prompt: "What should this exterior NOT feel like?", placeholder: "" },
  { key: "references", prompt: "Any designers, landscapes, projects, or references?", placeholder: "" },
];

export const QUESTIONS_BY_SPACE: Record<SpaceType, CreativeQuestion[]> = {
  kitchen: [
    {
      key: "vibe",
      prompt: "Describe the overall vibe of this kitchen in a few sentences.",
      placeholder: "e.g., warm and lived-in, like a family that cooks every Sunday...",
    },
    {
      key: "hero_moment",
      prompt: "What should be the hero moment — the thing you want someone to notice first?",
      placeholder: "e.g., the range and hood as the visual anchor, or the large island...",
    },
    {
      key: "cooking_style",
      prompt: "How do the people who live here cook and gather?",
      placeholder: "e.g., serious home cooks, big family dinners, mostly takeout and wine...",
    },
    {
      key: "materials_excitement",
      prompt: "What materials or finishes are you most excited about?",
      placeholder: "e.g., unlacquered brass that will patina, honed soapstone counters...",
    },
    {
      key: "avoid",
      prompt: "What should this kitchen NOT feel like?",
      placeholder: "e.g., not builder-grade, not too gray, not trying too hard...",
    },
    {
      key: "references",
      prompt: "Any projects, designers, or references that inspire this direction?",
      placeholder: "e.g., deVOL kitchens, Plain English, something from Heidi Caillier...",
    },
    {
      key: "walking_in_feeling",
      prompt: "What should someone feel walking into this kitchen?",
      placeholder: "e.g., instantly want to pour a glass of wine and start cooking...",
    },
  ],
  primary_bath: BATH_QUESTIONS,
  secondary_bath: BATH_QUESTIONS,
  powder: [
    {
      key: "vibe",
      prompt: "Powder spaces are the best place to have fun. What vibe?",
      placeholder: "e.g., dark and moody, a jewel box, a bold wallpaper moment...",
    },
    { key: "hero_moment", prompt: "What should be the hero moment?", placeholder: "" },
    {
      key: "materials_excitement",
      prompt: "What materials, wallpaper, or finishes excite you?",
      placeholder: "",
    },
    { key: "avoid", prompt: "What should this powder room NOT feel like?", placeholder: "" },
    { key: "references", prompt: "Any references that inspire this direction?", placeholder: "" },
  ],
  primary_bedroom: BEDROOM_QUESTIONS,
  secondary_bedroom: BEDROOM_QUESTIONS,
  living_room: LIVING_QUESTIONS,
  family_room: LIVING_QUESTIONS,
  dining_room: DINING_QUESTIONS,
  foyer: OTHER_QUESTIONS,
  hallway: OTHER_QUESTIONS,
  laundry: OTHER_QUESTIONS,
  office: OTHER_QUESTIONS,
  facade: EXTERIOR_SURFACE_QUESTIONS,
  hardscape: EXTERIOR_SURFACE_QUESTIONS,
  landscape: EXTERIOR_SURFACE_QUESTIONS,
  garden: EXTERIOR_SURFACE_QUESTIONS,
};

export function questionsForSpace(spaceType: string): CreativeQuestion[] {
  if (spaceType in QUESTIONS_BY_SPACE) {
    return QUESTIONS_BY_SPACE[spaceType as SpaceType];
  }
  return OTHER_QUESTIONS;
}
