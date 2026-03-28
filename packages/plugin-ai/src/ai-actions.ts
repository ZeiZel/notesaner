/**
 * ai-actions — Action definitions for AI writing operations.
 *
 * Each action has a stable identifier, a display label, an icon name,
 * and a factory function that builds a prompt from the current context.
 * The prompts instruct the model clearly and concisely.
 */

// ---------------------------------------------------------------------------
// Action identifiers
// ---------------------------------------------------------------------------

export type AIActionId =
  | 'summarize'
  | 'continueWriting'
  | 'rewriteSelection'
  | 'grammarCheck'
  | 'translate'
  | 'suggestLinks'
  | 'autoTag'
  | 'expandIdea'
  | 'makeSimpler';

// ---------------------------------------------------------------------------
// Action context passed to prompt builders
// ---------------------------------------------------------------------------

export interface AIActionContext {
  /** Full content of the current note */
  noteContent: string;
  /** Currently selected text (may be empty) */
  selection?: string;
  /** Note title */
  noteTitle?: string;
  /** Additional action-specific parameters */
  params?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Action definition
// ---------------------------------------------------------------------------

export interface AIActionDefinition {
  id: AIActionId;
  /** Human-readable label shown in the UI */
  label: string;
  /** Icon name from the design system */
  icon: string;
  /** Short description shown as a tooltip */
  description: string;
  /** Whether this action requires a text selection */
  requiresSelection: boolean;
  /** System instruction sent as the `system` role message */
  system: string;
  /** Build the user-facing prompt from context */
  buildPrompt(ctx: AIActionContext): string;
}

// ---------------------------------------------------------------------------
// System prompt base
// ---------------------------------------------------------------------------

const BASE_SYSTEM = `You are an expert writing assistant integrated into a note-taking application.
Be concise, precise, and helpful. Respond only with the requested output — no preamble,
no meta-commentary, no markdown fences unless the output IS markdown.`;

// ---------------------------------------------------------------------------
// Action definitions
// ---------------------------------------------------------------------------

const summarize: AIActionDefinition = {
  id: 'summarize',
  label: 'Summarize',
  icon: 'list-collapse',
  description: 'Generate a concise summary of the current note',
  requiresSelection: false,
  system: `${BASE_SYSTEM}
Your task is to summarize notes. Output a tight, structured summary using bullet points.
Focus on key ideas, decisions, and action items. Keep it under 150 words.`,
  buildPrompt(ctx) {
    const title = ctx.noteTitle ? `Title: ${ctx.noteTitle}\n\n` : '';
    return `${title}Summarize the following note:\n\n${ctx.noteContent}`;
  },
};

const continueWriting: AIActionDefinition = {
  id: 'continueWriting',
  label: 'Continue Writing',
  icon: 'pencil-line',
  description: 'Continue writing from where the note ends',
  requiresSelection: false,
  system: `${BASE_SYSTEM}
Your task is to continue a piece of writing naturally, matching the author's tone and style.
Continue from exactly where the text ends. Output only the continuation text — not the original.`,
  buildPrompt(ctx) {
    const snippet = ctx.noteContent.length > 2000 ? ctx.noteContent.slice(-2000) : ctx.noteContent;
    return `Continue writing the following text naturally:\n\n${snippet}`;
  },
};

const rewriteSelection: AIActionDefinition = {
  id: 'rewriteSelection',
  label: 'Rewrite',
  icon: 'refresh-cw',
  description: 'Rewrite the selected text to improve clarity and flow',
  requiresSelection: true,
  system: `${BASE_SYSTEM}
Your task is to rewrite text to improve clarity, flow, and conciseness while preserving
the original meaning. Match the surrounding document's tone and style.
Output only the rewritten text — nothing else.`,
  buildPrompt(ctx) {
    const selection = ctx.selection ?? ctx.noteContent;
    return `Rewrite the following text to improve clarity and flow:\n\n${selection}`;
  },
};

const grammarCheck: AIActionDefinition = {
  id: 'grammarCheck',
  label: 'Fix Grammar',
  icon: 'spell-check',
  description: 'Correct grammar, spelling, and punctuation errors',
  requiresSelection: true,
  system: `${BASE_SYSTEM}
Your task is to fix grammar, spelling, punctuation, and style issues in text.
Preserve the author's voice — only fix clear errors. If the text is already correct,
return it unchanged. Output only the corrected text.`,
  buildPrompt(ctx) {
    const selection = ctx.selection ?? ctx.noteContent;
    return `Fix any grammar, spelling, and punctuation errors in the following text:\n\n${selection}`;
  },
};

const translate: AIActionDefinition = {
  id: 'translate',
  label: 'Translate',
  icon: 'languages',
  description: 'Translate the selected text to another language',
  requiresSelection: true,
  system: `${BASE_SYSTEM}
Your task is to translate text accurately. Preserve formatting (markdown, lists, headings).
Output only the translated text — no labels, no explanation.`,
  buildPrompt(ctx) {
    const targetLanguage = ctx.params?.['targetLanguage'] ?? 'English';
    const selection = ctx.selection ?? ctx.noteContent;
    return `Translate the following text to ${targetLanguage}:\n\n${selection}`;
  },
};

const suggestLinks: AIActionDefinition = {
  id: 'suggestLinks',
  label: 'Suggest Links',
  icon: 'link',
  description: 'Find potential wiki-links based on the note content',
  requiresSelection: false,
  system: `${BASE_SYSTEM}
Your task is to identify concepts, entities, or topics in a note that might correspond to
other notes in a personal knowledge base. Output a JSON array of strings — each string
is a candidate note title to link to. Max 10 suggestions. Only output valid JSON.`,
  buildPrompt(ctx) {
    const availableTitles = ctx.params?.['availableTitles'] ?? '';
    const titlesSection = availableTitles
      ? `\n\nExisting note titles for reference:\n${availableTitles}`
      : '';
    const snippet = ctx.noteContent.slice(0, 3000);
    return `Identify link candidates in this note.${titlesSection}\n\nNote content:\n${snippet}`;
  },
};

const autoTag: AIActionDefinition = {
  id: 'autoTag',
  label: 'Auto-Tag',
  icon: 'tags',
  description: 'Suggest relevant tags based on the note content',
  requiresSelection: false,
  system: `${BASE_SYSTEM}
Your task is to extract relevant tags from a note. Tags should be:
- lowercase, no spaces (use hyphens instead)
- topical and specific (e.g. machine-learning, project-management)
- 3–8 tags total
Output a JSON array of tag strings only. No explanation.`,
  buildPrompt(ctx) {
    const existingTags = ctx.params?.['existingTags'] ?? '';
    const tagsSection = existingTags
      ? `\n\nExisting tags in this workspace (prefer reusing these):\n${existingTags}`
      : '';
    const snippet = ctx.noteContent.slice(0, 3000);
    return `Suggest tags for this note.${tagsSection}\n\nNote content:\n${snippet}`;
  },
};

const expandIdea: AIActionDefinition = {
  id: 'expandIdea',
  label: 'Expand Idea',
  icon: 'maximize-2',
  description: 'Expand a brief idea or bullet point into a detailed paragraph',
  requiresSelection: true,
  system: `${BASE_SYSTEM}
Your task is to expand a brief idea, sentence, or bullet point into a well-developed paragraph.
Add relevant details, examples, and nuance. Match the document's tone.
Output only the expanded paragraph.`,
  buildPrompt(ctx) {
    const selection = ctx.selection ?? ctx.noteContent;
    return `Expand the following idea into a detailed paragraph:\n\n${selection}`;
  },
};

const makeSimpler: AIActionDefinition = {
  id: 'makeSimpler',
  label: 'Simplify',
  icon: 'minimize-2',
  description: 'Simplify complex text for easier reading',
  requiresSelection: true,
  system: `${BASE_SYSTEM}
Your task is to simplify text without losing key information.
Use plain language, shorter sentences, and avoid jargon.
Output only the simplified text.`,
  buildPrompt(ctx) {
    const selection = ctx.selection ?? ctx.noteContent;
    return `Simplify the following text:\n\n${selection}`;
  },
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const AI_ACTIONS: Record<AIActionId, AIActionDefinition> = {
  summarize,
  continueWriting,
  rewriteSelection,
  grammarCheck,
  translate,
  suggestLinks,
  autoTag,
  expandIdea,
  makeSimpler,
};

/** Ordered list of actions for display in the sidebar */
export const SIDEBAR_ACTIONS: AIActionId[] = [
  'summarize',
  'continueWriting',
  'expandIdea',
  'makeSimpler',
  'grammarCheck',
  'translate',
  'suggestLinks',
  'autoTag',
];

/** Actions that appear in the inline selection popup */
export const INLINE_ACTIONS: AIActionId[] = [
  'rewriteSelection',
  'grammarCheck',
  'translate',
  'expandIdea',
  'makeSimpler',
];

/**
 * Retrieve an action definition by ID.
 * Throws if the ID is not registered (should not happen in well-typed code).
 */
export function getAction(id: AIActionId): AIActionDefinition {
  const action = AI_ACTIONS[id];
  if (!action) {
    throw new Error(`Unknown AI action: ${id}`);
  }
  return action;
}
