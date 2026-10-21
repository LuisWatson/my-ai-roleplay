// Tried in this order when a reply fails (quota, overload, timeout); each model has its own free quota.
// Free tier on this key (checked 2026-10-21): 3.7/3.8 Flash allow only 20 requests per day each, so the list is
// long on purpose — the server skips a model for the rest of the day once its daily quota is used up.
// Pro models have no free quota (429). Gemma 4 works but took ~35 s to answer, too slow to include.
export const AVAILABLE_MODELS = [
  { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash (เก่งสุด)' },
  { id: 'gemini-3.7-flash', label: 'Gemini 3.7 Flash' },
  { id: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash' },
  { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash' },
  { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash Lite' },
  { id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash Lite' },
];

export const DEFAULT_MODEL = AVAILABLE_MODELS[0].id;
