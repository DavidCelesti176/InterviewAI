import type { Metadata } from "next";

import { HomeEntry } from "@/components/account/home-entry";

export const metadata: Metadata = {
  title: "InterviewAI — Practice the exact interview before it happens",
  description:
    "Paste the job, upload your resume, and practice a live voice interview tailored to the role, the company, and your experience.",
};

export default function Home() {
  return <HomeEntry />;
}
