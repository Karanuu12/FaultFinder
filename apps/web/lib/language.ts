/**
 * Answer-language selection for a multilingual shop floor.
 *
 * The manuals are English. The technicians often are not. Jina v3 embeds 89
 * languages into one space, so a Hindi or Marathi question already retrieves
 * correctly against English manual text -- the only missing piece is answering
 * in the language the question was asked in.
 *
 * Hindi and Marathi share the Devanagari script, and telling them apart by
 * character range is impossible. Rather than guess with a brittle wordlist,
 * script detection narrows it to "Devanagari" and the model is asked to reply
 * in whichever of the two the technician actually used -- something an LLM does
 * reliably and a regex does not. An explicit choice from the UI always wins,
 * so a demo is never at the mercy of detection.
 */
export type AnswerLanguage = "auto" | "en" | "hi" | "mr";

export const LANGUAGE_OPTIONS: { value: AnswerLanguage; label: string; hint: string }[] = [
  { value: "auto", label: "Auto", hint: "Match the question" },
  { value: "en", label: "English", hint: "English" },
  { value: "hi", label: "हिन्दी", hint: "Hindi" },
  { value: "mr", label: "मराठी", hint: "Marathi" },
];

/** BCP-47 tags for the Web Speech APIs (recognition input and spoken output). */
export const SPEECH_TAG: Record<Exclude<AnswerLanguage, "auto">, string> = {
  en: "en-US",
  hi: "hi-IN",
  mr: "mr-IN",
};

const DEVANAGARI = /[ऀ-ॿ]/;

/** True when the text contains Devanagari, i.e. is plausibly Hindi or Marathi. */
export function hasDevanagari(text: string): boolean {
  return DEVANAGARI.test(text);
}

/**
 * The instruction appended to the generation request.
 *
 * Two rules, and the second matters more than the first: identifiers are NOT
 * translated. A technician hunting `[Fault Reset Assign]` on an English keypad
 * cannot find a Hindi rendering of it, and a translated error code is simply
 * wrong. Prose is translated; anything printed on the machine or in the manual
 * stays exactly as printed.
 */
export function languageInstruction(requested: AnswerLanguage, question: string): string | null {
  const target =
    requested === "auto"
      ? hasDevanagari(question)
        ? "the same language the QUESTION is written in (Hindi or Marathi — match whichever the technician used)"
        : null
      : requested === "hi"
        ? "Hindi (हिन्दी), in Devanagari script"
        : requested === "mr"
          ? "Marathi (मराठी), in Devanagari script"
          : "English";

  if (!target) return null; // English question, English answer — nothing to say.

  // Phrased as an override, and delivered in the SYSTEM message. The first
  // version of this sat in the user turn ahead of the output schema and was
  // simply ignored -- the excerpts are English, so the model kept answering in
  // English. It needs to be stated as outranking the source language, not as a
  // preference.
  return [
    `# Answer language — this OVERRIDES the language of the source excerpts`,
    ``,
    `The source manual is in English. The technician is not reading English.`,
    `Write the values of "meaning", "probable_causes", "corrective_action" and`,
    `"refusals" in ${target}. Do not answer in English. Do not append an English`,
    `translation.`,
    ``,
    `Reproduce these EXACTLY as printed in the excerpts — never translated,`,
    `never transliterated into Devanagari:`,
    `- error codes: OCF, F0001, E101`,
    `- parameter and menu names with their brackets: [Settings], [Fault Reset Assign], SET-, DRC-`,
    `- model numbers: ATV320, ACS150`,
    `- units and values: 400 V, 50 Hz, 75 °C, 100 %`,
    ``,
    `A technician reads those strings off an English keypad. A translated`,
    `identifier cannot be found on the machine, so translating one is an error,`,
    `not a courtesy. Surrounding prose is translated; the identifier is not.`,
    ``,
    `The JSON keys stay in English. "error_code" and "confidence" keep their`,
    `original values.`,
  ].join("\n");
}

/** Short label for the query trace, so the chosen language is visible. */
export function languageLabel(requested: AnswerLanguage, question: string): string {
  if (requested !== "auto") {
    return LANGUAGE_OPTIONS.find((o) => o.value === requested)?.hint ?? requested;
  }
  return hasDevanagari(question) ? "Devanagari detected (Hindi/Marathi)" : "English";
}
