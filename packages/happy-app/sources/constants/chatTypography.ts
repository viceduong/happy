/**
 * Chat text (messages, code blocks, tool rows) is drawn at 80% of the sizes
 * its components were designed at, for a denser session screen.
 */
export const CHAT_FONT_SCALE = 0.8;

/** A designed font size or line height, scaled for chat text. */
export function chatFont(size: number): number {
    return Math.round(size * CHAT_FONT_SCALE);
}
