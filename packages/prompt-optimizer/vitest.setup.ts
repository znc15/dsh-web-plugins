// Vitest setup: jsdom environment already provides DOM globals; React 18
// act() requires the act-environment flag.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

export {}
