/** Mirrors STREAMS in @khata/dak-core; one SES configuration set per stream. */
export const STREAMS = ['authentication', 'transactional', 'notifications', 'marketing'] as const
export type Stream = (typeof STREAMS)[number]
