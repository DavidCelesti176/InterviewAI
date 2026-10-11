export const pauseInstruction =
  "The interview is paused. Stop speaking now. Do not ask another question. Do not coach. Wait until you are told the candidate is ready.";

export const resumeInstruction =
  "The candidate is ready to continue. If you are waiting on an answer, say only \"Whenever you're ready.\" Then wait. Do not mention a pause, help, or coaching. Do not repeat the whole question.";

export const resumeRepeatInstruction =
  "The candidate is ready. Repeat the current interview question once, naturally, then wait. Do not mention a pause, help, or coaching. Do not add a second question.";

export function exactLastQuestion(text: string): string {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (!trimmed) return "";
  const sentences = trimmed.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map((sentence) => sentence.trim()).filter(Boolean) ?? [trimmed];
  const first = sentences.findIndex((sentence) => sentence.includes("?"));
  const last = sentences.findLastIndex((sentence) => sentence.includes("?"));
  if (first < 0 || last < 0) return trimmed;
  const previous = sentences[first - 1];
  const start = previous && previous.split(/\s+/).length >= 5 ? first - 1 : first;
  return sentences.slice(start, last + 1).join(" ");
}

export function restartQuestionInstruction(question: string): string {
  return `The candidate wants to answer again from the start. Stop speaking. Ignore the answer they just gave and do not mention it. Say the following question word for word, then wait. Do not change, shorten, or add any words. Do not greet them, coach, or ask anything else.\n${exactLastQuestion(question)}`;
}
