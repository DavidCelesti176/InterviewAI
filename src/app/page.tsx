import type { Metadata } from "next";

import { HomeEntry } from "@/components/account/home-entry";

export const metadata: Metadata = {
  title: "InterviewAI — Practice the interview before it counts",
  description: "A live voice interview for the job you want. It reads your resume, asks like a person, and keeps the transcript and the feedback.",
};

export default function Home() {
  return <HomeEntry />;
}
