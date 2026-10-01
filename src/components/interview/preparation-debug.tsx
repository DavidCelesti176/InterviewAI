"use client";

import { useEffect, useState } from "react";

import { readInterviewSetup, readPreparationDebug } from "@/lib/interview/browser-state";
import type { ExperienceCalibration, PreparationDebug } from "@/lib/interview/types";

export function PreparationDebugPanel({ inverted = false }: { inverted?: boolean }) {
  const [debug, setDebug] = useState<PreparationDebug | null>(null);
  const [jobTitle, setJobTitle] = useState("");

  useEffect(() => {
    setDebug(readPreparationDebug());
    setJobTitle(readInterviewSetup()?.jobTitle ?? "");
  }, []);

  if (!debug) return null;

  const tone = inverted ? "border-white/15 text-white/70" : "border-line text-muted";
  const pre = inverted ? "bg-black/30 text-white/80" : "bg-canvas text-foreground";

  return (
    <details className={`rounded-[14px] border border-dashed px-4 py-3 text-sm ${tone}`}>
      <summary className="cursor-pointer font-medium">Preparation debug</summary>
      <div className="mt-4 flex flex-col gap-4">
        <p>
          Company research {debug.cacheHit ? "cache hit" : "cache miss"} · researched {debug.companyProfile.researchedAt}
        </p>
        {debug.blueprint.experienceCalibration ? (
          <CalibrationSummary
            title={jobTitle}
            calibration={debug.blueprint.experienceCalibration}
            reason={debug.roleAnalysis.reasoningSummary}
            companyConfidence={debug.companyProfile.confidence}
          />
        ) : null}
        <DebugBlock title="Role analysis" value={debug.roleAnalysis} preClass={pre} />
        <DebugBlock title="Company interview profile" value={debug.companyProfile} preClass={pre} />
        <DebugBlock title="Interview blueprint" value={debug.blueprint} preClass={pre} />
        <div>
          <p className="mb-1 font-medium">Research sources</p>
          <ul className="flex flex-col gap-1">
            {debug.companyProfile.sources.length === 0 ? <li>None</li> : null}
            {debug.companyProfile.sources.map((source) => (
              <li key={source.url}>
                <a className="underline" href={source.url} target="_blank" rel="noreferrer">
                  {source.title || source.url}
                </a>{" "}
                ({source.sourceType}
                {source.publishedAt ? `, ${source.publishedAt}` : ""})
              </li>
            ))}
          </ul>
        </div>
      </div>
    </details>
  );
}

function CalibrationSummary({
  title,
  calibration,
  reason,
  companyConfidence,
}: {
  title: string;
  calibration: ExperienceCalibration;
  reason: string;
  companyConfidence: string;
}) {
  const rows = [
    ["Job title", title || "Unavailable"],
    ["Detected job level", calibration.jobSeniority.replaceAll("_", " ")],
    ["Candidate", calibration.careerStage.replaceAll("_", " ")],
    ["Leadership authority", calibration.leadershipAuthority],
    ["Stakeholder influence", calibration.stakeholderInfluence],
    ["Strategic decision authority", calibration.strategicDecisionAuthority],
    ["People management", calibration.peopleManagement],
    ["Project ownership", calibration.independentProjectOwnership],
    ["Role complexity", `${calibration.roleComplexity} of 5`],
    ["Interview difficulty", `${calibration.interviewDifficulty} of 5`],
    ["Company style confidence", companyConfidence],
  ];
  return (
    <div className="flex flex-col gap-2">
      <p className="font-medium">Experience calibration</p>
      <dl className="grid gap-1">
        {rows.map(([label, value]) => (
          <div key={label} className="grid grid-cols-[11rem_1fr] gap-2">
            <dt>{label}</dt>
            <dd className="capitalize">{value}</dd>
          </div>
        ))}
      </dl>
      <p>{reason}</p>
      {calibration.screenedThemes.length > 0 ? (
        <p>Screened out: {calibration.screenedThemes.join("; ")}</p>
      ) : null}
    </div>
  );
}

function DebugBlock({ title, value, preClass }: { title: string; value: unknown; preClass: string }) {
  return (
    <div>
      <p className="mb-1 font-medium">{title}</p>
      <pre className={`max-h-72 overflow-auto whitespace-pre-wrap rounded-lg p-3 text-xs ${preClass}`}>
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}
