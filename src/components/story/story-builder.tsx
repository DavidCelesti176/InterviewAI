"use client";

import { useEffect, useState } from "react";

import { PageShell } from "@/components/interview/page-shell";
import { StoryRail, railStep } from "@/components/story/story-rail";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, TextArea, TextInput } from "@/components/ui/field";
import { UploadZone } from "@/components/ui/upload-zone";
import { useAuth } from "@/contexts/auth-context";
import { authorizedFetch } from "@/lib/account/client";
import type { ResumeCard } from "@/lib/account/types";
import { readSavedStory, saveSavedStory } from "@/lib/story/client";
import type { ProfessionalStory, StoryAnalysis, StoryDraft, StoryIdentityOption, StoryProof, TailoredStory } from "@/lib/story/types";

const resumeInputId = "story-resume-pdf";

type Stage = "loading" | "resume" | "identity" | "pattern" | "evidence" | "direction" | "answer" | "saved";

type ProofDraft = {
  key: string;
  title: string;
  sourceExperience: string;
  proof: string;
  included: boolean;
};

type ChosenIdentity = {
  id: string;
  label: string;
  statement: string;
};

export function StoryBuilder() {
  const { user } = useAuth();
  const [stage, setStage] = useState<Stage>("loading");
  const [resumes, setResumes] = useState<ResumeCard[]>([]);
  const [selectedResumeId, setSelectedResumeId] = useState("");
  const [resumeName, setResumeName] = useState<string | null>(null);
  const [resumeId, setResumeId] = useState("");
  const [analysis, setAnalysis] = useState<StoryAnalysis | null>(null);
  const [chosen, setChosen] = useState<ChosenIdentity | null>(null);
  const [custom, setCustom] = useState(false);
  const [pattern, setPattern] = useState("");
  const [patterns, setPatterns] = useState<string[]>([]);
  const [proofs, setProofs] = useState<ProofDraft[]>([]);
  const [interests, setInterests] = useState("");
  const [direction, setDirection] = useState("");
  const [standardAnswer, setStandardAnswer] = useState("");
  const [shortAnswer, setShortAnswer] = useState("");
  const [memorability, setMemorability] = useState("");
  const [saved, setSaved] = useState<ProfessionalStory | null>(null);
  const [tailored, setTailored] = useState<TailoredStory | null>(null);
  const [roleCompany, setRoleCompany] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [roleDescription, setRoleDescription] = useState("");
  const [showRole, setShowRole] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void Promise.all([readSavedStory(user.uid), loadResumes()])
      .then(([story, items]) => {
        if (cancelled) return;
        setResumes(items);
        const preferred = preferredResume(items);
        if (preferred) {
          setSelectedResumeId(preferred.id);
          setResumeName(preferred.originalFileName);
        }
        if (story) {
          setSaved(story);
          applyStory(story);
          setStage("saved");
        } else {
          setStage("resume");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("Your story could not be loaded.");
          setStage("resume");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  function applyStory(story: ProfessionalStory) {
    setResumeId(story.resumeId);
    setChosen({ id: "saved", label: story.identity.label, statement: story.identity.statement });
    setPattern(story.pattern);
    setDirection(story.direction);
    setStandardAnswer(story.generalTellMeAboutYourself);
    setShortAnswer(story.shortTellMeAboutYourself);
    setMemorability(story.memorability);
    setProofs(
      story.evidence.map((item) => ({
        key: item.sourceExperience.toLowerCase(),
        title: item.title,
        sourceExperience: item.sourceExperience,
        proof: item.proof,
        included: true,
      })),
    );
  }

  async function analyze(file?: File) {
    setBusy("Reading your resume");
    setError("");
    try {
      const form = new FormData();
      if (file) form.set("resume", file);
      else form.set("resumeId", selectedResumeId);
      const response = await authorizedFetch("/api/story/analyze", { method: "POST", body: form });
      const body = (await response.json()) as { error?: string; resumeId?: string; analysis?: StoryAnalysis };
      if (!response.ok || !body.analysis || !body.resumeId) throw new Error(body.error || "The resume could not be read for a story yet.");
      setResumeId(body.resumeId);
      setAnalysis(body.analysis);
      setPatterns(body.analysis.recurringPatterns);
      setPattern(body.analysis.recurringPatterns[0] ?? "");
      setChosen(null);
      setCustom(false);
      setStage("identity");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The resume could not be read for a story yet.");
    } finally {
      setBusy("");
    }
  }

  function chooseIdentity(option: StoryIdentityOption) {
    setCustom(false);
    setChosen({ id: option.id, label: option.label, statement: option.statement });
    setProofs(proofPool(analysis, option));
  }

  function continueIdentity() {
    if (!chosen?.label.trim() || !chosen.statement.trim()) {
      setError("Add the identity in your own words, or pick one that fits.");
      return;
    }
    setError("");
    if (proofs.length === 0 && analysis) setProofs(proofPool(analysis, null));
    setStage("pattern");
  }

  function continueEvidence() {
    const included = proofs.filter((item) => item.included);
    if (included.length === 0) {
      setError("Keep at least one experience that proves the pattern.");
      return;
    }
    setError("");
    setStage("direction");
  }

  async function writeStory() {
    if (!chosen) return;
    setBusy("Writing your story");
    setError("");
    try {
      const response = await authorizedFetch("/api/story/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resumeId,
          identity: { label: chosen.label, statement: chosen.statement },
          pattern,
          evidence: selectedProof(),
          interests: interests || direction,
        }),
      });
      const body = (await response.json()) as { error?: string; draft?: StoryDraft };
      if (!response.ok || !body.draft) throw new Error(body.error || "The story could not be written yet.");
      if (stage !== "saved") setDirection(body.draft.direction);
      setStandardAnswer(body.draft.standardAnswer);
      setShortAnswer(body.draft.shortAnswer);
      setMemorability(body.draft.memorability);
      setStage("answer");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The story could not be written yet.");
    } finally {
      setBusy("");
    }
  }

  function selectedProof(): StoryProof[] {
    return proofs
      .filter((item) => item.included)
      .slice(0, 3)
      .map((item) => ({
        title: item.title.trim() || item.sourceExperience,
        sourceExperience: item.sourceExperience,
        proof: item.proof,
      }));
  }

  async function persist() {
    if (!user || !chosen) return;
    const evidence = selectedProof();
    if (!chosen.label.trim() || !chosen.statement.trim() || !pattern.trim() || !direction.trim() || !standardAnswer.trim() || evidence.length === 0) {
      setError("The story needs an identity, a pattern, proof, a direction, and the spoken answer.");
      return;
    }
    setBusy("Saving");
    setError("");
    const now = Date.now();
    const next: ProfessionalStory = {
      identity: { label: chosen.label.trim(), statement: chosen.statement.trim() },
      pattern: pattern.trim(),
      evidence,
      direction: direction.trim(),
      generalTellMeAboutYourself: standardAnswer.trim(),
      shortTellMeAboutYourself: shortAnswer.trim(),
      memorability: memorability.trim(),
      resumeId,
      createdAt: saved?.createdAt ?? now,
      updatedAt: now,
    };
    try {
      await saveSavedStory(user.uid, next);
      setSaved(next);
      setStage("saved");
      void authorizedFetch("/api/progress/story", { method: "POST" }).catch(() => undefined);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The story could not be saved.");
    } finally {
      setBusy("");
    }
  }

  async function tailor() {
    setBusy("Shaping this role");
    setError("");
    setTailored(null);
    try {
      const response = await authorizedFetch("/api/story/tailor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company: roleCompany, jobTitle: roleTitle, jobDescription: roleDescription }),
      });
      const body = (await response.json()) as { error?: string; tailored?: TailoredStory };
      if (!response.ok || !body.tailored) throw new Error(body.error || "That role version could not be written yet.");
      setTailored(body.tailored);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "That role version could not be written yet.");
    } finally {
      setBusy("");
    }
  }

  function moveProof(index: number, delta: number) {
    setProofs((current) => {
      const next = current.slice();
      const target = index + delta;
      if (target < 0 || target >= next.length) return current;
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return next;
    });
  }

  return (
    <PageShell width="wide">
      <header className="flex flex-col gap-3">
        <p className="text-sm font-medium text-accent">Your story</p>
        <h1 className="text-4xl font-semibold tracking-tight">Build your story</h1>
        <p className="max-w-2xl text-lg text-muted">Who you are professionally, what proves it, and where that points next.</p>
      </header>
      <StoryRail step={railStep(stage)} />
      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}

      {stage === "loading" ? <div className="h-40" aria-hidden="true" /> : null}

      {stage === "resume" ? (
        <section className="step-enter flex flex-col gap-5">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Start from your resume</h2>
            <p className="mt-2 max-w-2xl text-muted">
              A saved resume is enough. We look for the pattern across your experience, not a summary of every job.
            </p>
          </div>
          {resumes.length > 0 ? (
            <div className="grid gap-2">
              {resumes.map((resume) => (
                <button
                  key={resume.id}
                  type="button"
                  aria-pressed={selectedResumeId === resume.id}
                  className={`rounded-[16px] border px-4 py-3 text-left ${selectedResumeId === resume.id ? "border-accent bg-accent/5" : "border-line bg-card"}`}
                  onClick={() => {
                    setSelectedResumeId(resume.id);
                    setResumeName(resume.originalFileName);
                    setError("");
                  }}
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="font-medium">{resume.originalFileName}</span>
                    {selectedResumeId === resume.id ? <span className="text-xs font-medium text-accent">Selected</span> : null}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted">No saved resume yet. Upload the one you want this story to come from.</p>
          )}
          <input
            id={resumeInputId}
            type="file"
            accept="application/pdf,.pdf"
            className="sr-only"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              if (!file) return;
              setSelectedResumeId("");
              setResumeName(file.name);
              void analyze(file);
            }}
          />
          <UploadZone
            fileName={selectedResumeId ? null : resumeName}
            inputId={resumeInputId}
            onFile={(file) => {
              setSelectedResumeId("");
              setResumeName(file.name);
              void analyze(file);
            }}
          />
          <div className="flex flex-wrap gap-3">
            <Button type="button" disabled={!selectedResumeId || busy.length > 0} onClick={() => void analyze()}>
              {busy ? "Reading your resume…" : "Find the pattern"}
            </Button>
            {saved ? (
              <Button type="button" variant="secondary" onClick={() => setStage("saved")}>
                Back to my story
              </Button>
            ) : null}
          </div>
        </section>
      ) : null}

      {stage === "identity" && analysis ? (
        <section className="step-enter flex flex-col gap-5">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">What sounds most like you?</h2>
            <p className="mt-2 max-w-2xl text-muted">
              We found a few patterns across your experience. Pick the one that feels most true, or make it your own.
            </p>
            {analysis.note ? <p className="mt-2 text-sm text-muted">{analysis.note}</p> : null}
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {analysis.identityOptions.map((option) => {
              const selected = chosen?.id === option.id && !custom;
              return (
                <Card key={option.id} className={`flex flex-col gap-3 p-5 ${selected ? "border-accent" : ""}`}>
                  <button type="button" className="text-left" onClick={() => chooseIdentity(option)}>
                    <span className="text-xs font-semibold tracking-[0.16em] text-accent">{option.label.toUpperCase()}</span>
                    <span className="mt-2 block text-lg font-medium leading-snug">“{selected && chosen ? chosen.statement : option.statement}”</span>
                  </button>
                  <ul className="flex flex-col gap-2">
                    {option.evidence.slice(0, 3).map((item) => (
                      <li key={item.experience}>
                        <p className="text-sm font-medium">{item.experience}</p>
                        <p className="text-sm text-muted">{item.evidence}</p>
                      </li>
                    ))}
                  </ul>
                  {option.confidence === "low" ? <p className="text-xs text-muted">The evidence for this one is thinner.</p> : null}
                  {selected ? (
                    <Field label="Edit the wording">
                      <TextArea
                        value={chosen?.statement ?? ""}
                        className="min-h-24"
                        onChange={(event) => setChosen((current) => (current ? { ...current, statement: event.target.value } : current))}
                      />
                    </Field>
                  ) : null}
                  <Button type="button" variant={selected ? "primary" : "secondary"} onClick={() => chooseIdentity(option)}>
                    {selected ? "Selected" : "This sounds like me"}
                  </Button>
                </Card>
              );
            })}
            <Card className={`flex flex-col gap-3 p-5 ${custom ? "border-accent" : ""}`}>
              <h3 className="text-lg font-medium">Make it your own</h3>
              <p className="text-sm text-muted">If none of these fit, write the identity yourself. You have the last word.</p>
              {custom ? (
                <>
                  <Field label="Identity">
                    <TextInput
                      value={chosen?.label ?? ""}
                      maxLength={40}
                      onChange={(event) => setChosen((current) => ({ id: "custom", label: event.target.value, statement: current?.statement ?? "" }))}
                    />
                  </Field>
                  <Field label="In one sentence">
                    <TextArea
                      className="min-h-24"
                      value={chosen?.statement ?? ""}
                      maxLength={280}
                      onChange={(event) => setChosen((current) => ({ id: "custom", label: current?.label ?? "", statement: event.target.value }))}
                    />
                  </Field>
                </>
              ) : null}
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setCustom(true);
                  setChosen({ id: "custom", label: "", statement: "" });
                  if (analysis) setProofs(proofPool(analysis, null));
                }}
              >
                Create my own
              </Button>
            </Card>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="secondary" onClick={() => setStage("resume")}>
              Back
            </Button>
            <Button type="button" onClick={continueIdentity}>
              Continue
            </Button>
          </div>
        </section>
      ) : null}

      {stage === "pattern" ? (
        <section className="step-enter flex flex-col gap-5">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Name the pattern</h2>
            <p className="mt-2 text-muted">A pattern throughout my experiences has been ______.</p>
          </div>
          <div className="grid gap-2">
            {patterns.map((item) => (
              <button
                key={item}
                type="button"
                aria-pressed={pattern === item}
                className={`rounded-[16px] border px-4 py-3 text-left ${pattern === item ? "border-accent bg-accent/5" : "border-line bg-card"}`}
                onClick={() => setPattern(item)}
              >
                {item}
              </button>
            ))}
          </div>
          <Field label="Your wording">
            <TextArea value={pattern} maxLength={400} className="min-h-28" onChange={(event) => setPattern(event.target.value)} />
          </Field>
          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="secondary" onClick={() => setStage("identity")}>
              Back
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (!pattern.trim()) {
                  setError("Write the pattern in a sentence you would actually say.");
                  return;
                }
                setError("");
                setStage("evidence");
              }}
            >
              Continue
            </Button>
          </div>
        </section>
      ) : null}

      {stage === "evidence" ? (
        <section className="step-enter flex flex-col gap-5">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Choose the proof</h2>
            <p className="mt-2 max-w-2xl text-muted">
              The identity is the claim. These experiences are the proof. Together they show the pattern. Two or three, from different parts of your experience, is enough.
            </p>
          </div>
          <div className="grid gap-3">
            {proofs.map((item, index) => (
              <Card key={item.key} className={`flex flex-col gap-3 p-5 ${item.included ? "border-accent" : ""}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{item.sourceExperience}</p>
                    <p className="mt-1 text-sm text-muted">{item.proof}</p>
                  </div>
                  <Button
                    type="button"
                    variant={item.included ? "primary" : "secondary"}
                    onClick={() =>
                      setProofs((current) =>
                        current.map((proof, proofIndex) => {
                          if (proofIndex !== index) return proof;
                          const includedCount = current.filter((row) => row.included).length;
                          if (!proof.included && includedCount >= 3) return proof;
                          return { ...proof, included: !proof.included };
                        }),
                      )
                    }
                  >
                    {item.included ? "Included" : "Include"}
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="ghost" disabled={index === 0} onClick={() => moveProof(index, -1)}>
                    Move up
                  </Button>
                  <Button type="button" variant="ghost" disabled={index === proofs.length - 1} onClick={() => moveProof(index, 1)}>
                    Move down
                  </Button>
                </div>
              </Card>
            ))}
          </div>
          {proofs.length === 0 ? <p className="text-sm text-muted">No supported experiences came back. Go back and write your own identity, or try the resume again.</p> : null}
          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="secondary" onClick={() => setStage("pattern")}>
              Back
            </Button>
            <Button type="button" onClick={continueEvidence}>
              Continue
            </Button>
          </div>
        </section>
      ) : null}

      {stage === "direction" ? (
        <section className="step-enter flex flex-col gap-5">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Where does this lead next?</h2>
            <p className="mt-2 max-w-2xl text-muted">What kinds of work are you interested in? The direction stays general unless you name something specific.</p>
          </div>
          <Field label="Work you’re drawn to">
            <TextArea
              value={interests}
              maxLength={400}
              placeholder="Roles where business, analytics, and operations meet"
              onChange={(event) => setInterests(event.target.value)}
            />
          </Field>
          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="secondary" onClick={() => setStage("evidence")}>
              Back
            </Button>
            <Button type="button" disabled={busy.length > 0} onClick={() => void writeStory()}>
              {busy ? "Writing your story…" : "Write the story"}
            </Button>
          </div>
        </section>
      ) : null}

      {stage === "answer" ? (
        <AnswerStep
          chosen={chosen}
          pattern={pattern}
          direction={direction}
          standardAnswer={standardAnswer}
          shortAnswer={shortAnswer}
          memorability={memorability}
          busy={busy}
          onPattern={setPattern}
          onDirection={setDirection}
          onStandard={setStandardAnswer}
          onShort={setShortAnswer}
          onBack={() => setStage("direction")}
          onSave={() => void persist()}
        />
      ) : null}

      {stage === "saved" && saved && chosen ? (
        <SavedStory
          story={saved}
          chosen={chosen}
          pattern={pattern}
          proofs={proofs}
          direction={direction}
          standardAnswer={standardAnswer}
          shortAnswer={shortAnswer}
          memorability={memorability}
          showRole={showRole}
          roleCompany={roleCompany}
          roleTitle={roleTitle}
          roleDescription={roleDescription}
          tailored={tailored}
          busy={busy}
          onChosen={setChosen}
          onPattern={setPattern}
          onProofs={setProofs}
          onDirection={setDirection}
          onStandard={setStandardAnswer}
          onShort={setShortAnswer}
          onSave={() => void persist()}
          onRewrite={() => void writeStory()}
          onResume={() => setStage("resume")}
          onToggleRole={() => setShowRole((current) => !current)}
          onCompany={setRoleCompany}
          onTitle={setRoleTitle}
          onDescription={setRoleDescription}
          onTailor={() => void tailor()}
          onMove={moveProof}
        />
      ) : null}
    </PageShell>
  );
}

function AnswerStep({
  chosen,
  pattern,
  direction,
  standardAnswer,
  shortAnswer,
  memorability,
  busy,
  onPattern,
  onDirection,
  onStandard,
  onShort,
  onBack,
  onSave,
}: {
  chosen: ChosenIdentity | null;
  pattern: string;
  direction: string;
  standardAnswer: string;
  shortAnswer: string;
  memorability: string;
  busy: string;
  onPattern: (value: string) => void;
  onDirection: (value: string) => void;
  onStandard: (value: string) => void;
  onShort: (value: string) => void;
  onBack: () => void;
  onSave: () => void;
}) {
  const [version, setVersion] = useState<"standard" | "short">("standard");
  return (
    <section className="step-enter flex flex-col gap-5">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Tell me about yourself</h2>
        <p className="mt-2 max-w-2xl text-muted">This is a way to say it, not a script. Change any line that doesn’t sound like you.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <Card className="p-5">
          <p className="text-xs font-semibold tracking-[0.16em] text-accent">WHO</p>
          <p className="mt-2 font-medium">{chosen?.label}</p>
          <p className="mt-1 text-sm text-muted">{chosen?.statement}</p>
        </Card>
        <Card className="p-5 md:col-span-2">
          <p className="text-xs font-semibold tracking-[0.16em] text-accent">HOW AN INTERVIEWER MAY REMEMBER YOU</p>
          <p className="mt-2 text-lg font-medium leading-snug">{memorability}</p>
        </Card>
      </div>
      <div className="flex gap-2">
        <Button type="button" variant={version === "standard" ? "primary" : "secondary"} onClick={() => setVersion("standard")}>
          Standard
        </Button>
        <Button type="button" variant={version === "short" ? "primary" : "secondary"} onClick={() => setVersion("short")}>
          Short
        </Button>
      </div>
      <Field label={version === "standard" ? "About 60–90 seconds" : "About 45 seconds"}>
        <TextArea
          className="min-h-56"
          value={version === "standard" ? standardAnswer : shortAnswer}
          onChange={(event) => (version === "standard" ? onStandard(event.target.value) : onShort(event.target.value))}
        />
      </Field>
      <Field label="Pattern">
        <TextArea className="min-h-24" value={pattern} onChange={(event) => onPattern(event.target.value)} />
      </Field>
      <Field label="Direction">
        <TextArea className="min-h-24" value={direction} onChange={(event) => onDirection(event.target.value)} />
      </Field>
      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="secondary" onClick={onBack}>
          Back
        </Button>
        <Button type="button" disabled={busy.length > 0} onClick={onSave}>
          {busy ? "Saving…" : "Save my story"}
        </Button>
      </div>
    </section>
  );
}

function SavedStory({
  story,
  chosen,
  pattern,
  proofs,
  direction,
  standardAnswer,
  shortAnswer,
  memorability,
  showRole,
  roleCompany,
  roleTitle,
  roleDescription,
  tailored,
  busy,
  onChosen,
  onPattern,
  onProofs,
  onDirection,
  onStandard,
  onShort,
  onSave,
  onRewrite,
  onResume,
  onToggleRole,
  onCompany,
  onTitle,
  onDescription,
  onTailor,
  onMove,
}: {
  story: ProfessionalStory;
  chosen: ChosenIdentity;
  pattern: string;
  proofs: ProofDraft[];
  direction: string;
  standardAnswer: string;
  shortAnswer: string;
  memorability: string;
  showRole: boolean;
  roleCompany: string;
  roleTitle: string;
  roleDescription: string;
  tailored: TailoredStory | null;
  busy: string;
  onChosen: (value: ChosenIdentity) => void;
  onPattern: (value: string) => void;
  onProofs: (value: ProofDraft[]) => void;
  onDirection: (value: string) => void;
  onStandard: (value: string) => void;
  onShort: (value: string) => void;
  onSave: () => void;
  onRewrite: () => void;
  onResume: () => void;
  onToggleRole: () => void;
  onCompany: (value: string) => void;
  onTitle: (value: string) => void;
  onDescription: (value: string) => void;
  onTailor: () => void;
  onMove: (index: number, delta: number) => void;
}) {
  return (
    <section className="step-enter flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">{chosen.label || story.identity.label}</h2>
          <p className="mt-2 max-w-2xl text-muted">{chosen.statement}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/story-builder/practice">Practice my story</ButtonLink>
          <Button type="button" variant="secondary" onClick={onResume}>
            Look at my resume again
          </Button>
        </div>
      </div>
      {memorability ? (
        <Card className="p-5">
          <p className="text-xs font-semibold tracking-[0.16em] text-accent">HOW AN INTERVIEWER MAY REMEMBER YOU</p>
          <p className="mt-2 text-lg font-medium leading-snug">{memorability}</p>
        </Card>
      ) : null}
      <div className="grid gap-3 lg:grid-cols-3">
        <Card className="flex flex-col gap-3 p-5">
          <p className="text-xs font-semibold tracking-[0.16em] text-accent">WHO</p>
          <Field label="Identity">
            <TextInput value={chosen.label} maxLength={40} onChange={(event) => onChosen({ ...chosen, label: event.target.value })} />
          </Field>
          <Field label="Statement">
            <TextArea className="min-h-28" value={chosen.statement} maxLength={280} onChange={(event) => onChosen({ ...chosen, statement: event.target.value })} />
          </Field>
        </Card>
        <Card className="flex flex-col gap-3 p-5">
          <p className="text-xs font-semibold tracking-[0.16em] text-accent">PROOF</p>
          {proofs.map((item, index) => (
            <div key={`${item.key}-${index}`} className="rounded-[14px] border border-line p-3">
              <p className="text-sm font-medium">{item.sourceExperience}</p>
              <p className="mt-1 text-sm text-muted">{item.proof}</p>
              <div className="mt-2 flex gap-2">
                <Button type="button" variant="ghost" disabled={index === 0} onClick={() => onMove(index, -1)}>
                  Up
                </Button>
                <Button type="button" variant="ghost" disabled={index === proofs.length - 1} onClick={() => onMove(index, 1)}>
                  Down
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => onProofs(proofs.filter((_, proofIndex) => proofIndex !== index))}
                >
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </Card>
        <Card className="flex flex-col gap-3 p-5">
          <p className="text-xs font-semibold tracking-[0.16em] text-accent">NEXT</p>
          <Field label="Pattern">
            <TextArea className="min-h-28" value={pattern} onChange={(event) => onPattern(event.target.value)} />
          </Field>
          <Field label="Direction">
            <TextArea className="min-h-28" value={direction} onChange={(event) => onDirection(event.target.value)} />
          </Field>
        </Card>
      </div>
      <Field label="Tell me about yourself">
        <TextArea className="min-h-48" value={standardAnswer} onChange={(event) => onStandard(event.target.value)} />
      </Field>
      <details className="rounded-[16px] border border-line bg-card px-4 py-3">
        <summary className="cursor-pointer text-sm font-medium">Short version</summary>
        <TextArea className="mt-3 min-h-32" value={shortAnswer} onChange={(event) => onShort(event.target.value)} />
      </details>
      <div className="flex flex-wrap gap-3">
        <Button type="button" disabled={busy.length > 0} onClick={onSave}>
          {busy === "Saving" ? "Saving…" : "Save changes"}
        </Button>
        <Button type="button" variant="secondary" disabled={busy.length > 0} onClick={onRewrite}>
          {busy === "Writing your story" ? "Rewriting…" : "Rewrite the spoken answer"}
        </Button>
        <Button type="button" variant="ghost" onClick={onToggleRole}>
          Shape this for a role
        </Button>
      </div>
      {showRole ? (
        <Card className="flex flex-col gap-4 p-5">
          <div>
            <h3 className="text-lg font-medium">A version for one role</h3>
            <p className="mt-1 text-sm text-muted">Your saved story stays the same. This only changes the emphasis and the direction.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Company">
              <TextInput value={roleCompany} onChange={(event) => onCompany(event.target.value)} />
            </Field>
            <Field label="Role">
              <TextInput value={roleTitle} onChange={(event) => onTitle(event.target.value)} />
            </Field>
          </div>
          <Field label="What the role is about">
            <TextArea value={roleDescription} className="min-h-28" onChange={(event) => onDescription(event.target.value)} />
          </Field>
          <Button type="button" disabled={busy.length > 0} onClick={onTailor}>
            {busy === "Shaping this role" ? "Shaping…" : "Write the role version"}
          </Button>
          {tailored ? (
            <div className="flex flex-col gap-3 border-t border-line pt-4">
              <p className="text-sm font-medium">Your identity stays {tailored.identity.label}.</p>
              <p className="text-sm text-muted">{tailored.direction}</p>
              <ul className="flex flex-col gap-2">
                {tailored.evidence.map((item) => (
                  <li key={item.sourceExperience}>
                    <p className="text-sm font-medium">{item.sourceExperience}</p>
                    <p className="text-sm text-muted">{item.proof}</p>
                  </li>
                ))}
              </ul>
              <p className="text-sm leading-6">{tailored.tellMeAboutYourself}</p>
              <p className="text-sm font-medium">{tailored.memorability}</p>
            </div>
          ) : null}
        </Card>
      ) : null}
    </section>
  );
}

function proofPool(analysis: StoryAnalysis | null, option: StoryIdentityOption | null): ProofDraft[] {
  const rows: ProofDraft[] = [];
  const push = (experience: string, proof: string, included: boolean) => {
    const key = experience.trim().toLowerCase();
    if (!key || rows.some((row) => row.key === key)) return;
    rows.push({ key, title: experience, sourceExperience: experience, proof, included });
  };
  option?.evidence.forEach((item, index) => push(item.experience, item.evidence, index < 3));
  analysis?.suggestedEvidence.forEach((item) => push(item.experience, item.proof, false));
  return rows;
}

function preferredResume(items: ResumeCard[]): ResumeCard | undefined {
  return [...items].sort((a, b) => (b.lastUsedAt ?? b.updatedAt) - (a.lastUsedAt ?? a.updatedAt))[0];
}

async function loadResumes(): Promise<ResumeCard[]> {
  const response = await authorizedFetch("/api/account/resumes");
  if (!response.ok) return [];
  const body = (await response.json()) as { resumes?: ResumeCard[] };
  return body.resumes ?? [];
}
