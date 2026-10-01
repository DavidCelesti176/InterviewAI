export type PracticeQuestion = {
  id: string;
  question: string;
  answerSummary: string;
  whatHeldItBack: string[];
  betterApproach: string;
};

export type PracticeFocus = {
  questions: PracticeQuestion[];
};
