// A character's hidden story truth, told in stages (constants/storyArcs.js → `character.truthStages`).
// The app, not the model, decides when the next stage is due: after enough of the player's turns since the last
// one (sooner when trust is high). The model is told only the stages already told plus the one that is due, and
// reports that it told it with `; เฉลย=<n>` in the scene tag (lib/scene.js), stored on that reply as `reveal`.
// The stage is derived from the messages, like the relationship meters: swipes, edits and a cleared chat stay right.
import { levelOf } from './relation';
import { isStoryChat } from './story';

// Player turns that must pass after a stage (or from the start) before the next is due, by trust level
const TURNS_BY_TRUST = { base: 24, level3: 16, level4: 10 };
// Turns past due after which the model is told the stage is overdue
const OVERDUE_AFTER = 6;
const MAX_STAGE_CHARS = 1800;

/** Highest stage already told in these messages, and how many player turns have passed since it was told. */
export function truthProgress(messages) {
  let stage = 0;
  let at = -1;
  messages.forEach((m, i) => {
    if (m.role === 'model' && Number.isInteger(m.reveal) && m.reveal >= stage) {
      stage = m.reveal;
      at = i;
    }
  });
  const sinceUser = messages.slice(at + 1).filter((m) => m.role === 'user').length;
  return { stage, sinceUser };
}

/** Player turns needed before the next stage is due, for this trust (points). */
export function turnsNeeded(trustPoints) {
  const level = levelOf(trustPoints).level;
  if (level >= 4) return TURNS_BY_TRUST.level4;
  if (level >= 3) return TURNS_BY_TRUST.level3;
  return TURNS_BY_TRUST.base;
}

/**
 * What to send the model: { revealed: string[], due: { number, text, overdue } | null, hasMore, complete } — or null when the
 * character has no hidden truth or the chat did not begin with the story setup. Later stages are never included.
 */
export function truthFor(persona, messages, relation) {
  const stages = Array.isArray(persona?.truthStages)
    ? persona.truthStages.filter((s) => typeof s === 'string' && s.trim()).map((s) => s.trim().slice(0, MAX_STAGE_CHARS))
    : [];
  if (stages.length === 0 || !isStoryChat(messages)) return null;
  const { stage, sinceUser } = truthProgress(messages);
  const need = turnsNeeded(relation?.trust);
  const isDue = stage < stages.length && sinceUser >= need;
  return {
    revealed: stages.slice(0, stage),
    due: isDue ? { number: stage + 1, text: stages[stage], overdue: sinceUser >= need + OVERDUE_AFTER } : null,
    hasMore: stage + (isDue ? 1 : 0) < stages.length,
    // Every stage told: the prompt then treats the situation's open questions as answered (lib/prompt.js)
    complete: stage >= stages.length,
  };
}

/** How many stages are told out of how many, for the memory panel (a count only, never the texts); null when none. */
export function truthCount(persona, messages) {
  const total = Array.isArray(persona?.truthStages) ? persona.truthStages.filter((s) => typeof s === 'string' && s.trim()).length : 0;
  if (total === 0 || !isStoryChat(messages)) return null;
  return { told: Math.min(truthProgress(messages).stage, total), total };
}

/** The stage number the model may claim in its reply: the due one, or null. */
export function acceptedReveal(reported, truth) {
  return truth?.due && Number.isInteger(reported) && reported === truth.due.number ? reported : null;
}
