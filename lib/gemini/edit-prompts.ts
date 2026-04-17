/**
 * Builds the text prompt for a conversational Gemini edit on a prior render.
 * The "preserve everything else" wrapper is what makes this pattern work —
 * without it, Gemini tends to re-render broadly instead of making a targeted
 * change.
 *
 * When `referenceHints` is provided, a short clause is appended telling
 * Gemini to consult the attached reference images for material character.
 * The actual reference image bytes are attached via buildContentsArray in
 * lib/gemini/prompts.ts — this function only produces the text prompt.
 */
export function buildEditPrompt(args: {
  instruction: string;
  referenceHints?: string[]; // optional labels for attached reference images
}): string {
  const { instruction, referenceHints } = args;

  let prompt = `Apply this specific change to the kitchen image: ${instruction}

Preserve everything else in the image exactly as it is — same cabinets, same counters, same flooring, same walls, same lighting, same window placement, same doorway, same overall composition. Only modify what the instruction specifies. The output should look like the exact same kitchen from the exact same camera angle, with only the requested element changed.`;

  if (referenceHints && referenceHints.length > 0) {
    const hintList = referenceHints.map((h, i) => `Image ${i + 2}: ${h}`).join("; ");
    prompt += `\n\nRefer to the attached reference images for accurate material character (${hintList}). Match the color, texture, and handmade quality of the referenced materials.`;
  }

  prompt += `\n\nReturn the final rendered image only.`;

  return prompt;
}
