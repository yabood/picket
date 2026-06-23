// Both pipeline stages (relevance gate + fact extraction) run on Haiku 4.5 in v1.
// Gateway slug uses DOTS, not dashes. If extraction accuracy on dense PDFs
// proves shaky, bump only EXTRACT_MODEL_ID to a stronger model — one-line change.
export const GATE_MODEL_ID = 'anthropic/claude-haiku-4.5';
export const EXTRACT_MODEL_ID = 'anthropic/claude-haiku-4.5';
