/** Model IDs accepted by OpenAI's audio/transcriptions endpoint. Keep this allowlist aligned
 * with the provider's current speech-to-text documentation; chat capability alone is not enough.
 */
export const SPEECH_TO_TEXT_MODELS = [
  "gpt-transcribe",
  "gpt-4o-transcribe",
  "gpt-4o-mini-transcribe",
  "whisper-1",
] as const;

export function isSpeechToTextModel(model: string): boolean {
  return (SPEECH_TO_TEXT_MODELS as readonly string[]).includes(model.trim());
}

export function assertSpeechToTextModel(model: string): void {
  if (!isSpeechToTextModel(model)) {
    throw new Error(
      "This model does not support speech-to-text. Choose a supported speech model in Settings → LLM.",
    );
  }
}
