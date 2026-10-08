"use client";

import { useEffect, useState } from "react";

import { PageShell } from "@/components/interview/page-shell";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { authorizedFetch } from "@/lib/account/client";
import { competencies } from "@/lib/interview/competencies";
import { readinessLabel, type InterviewStory, type StoryReadiness } from "@/lib/interview/stories";

const storyCompetencies = competencies.filter((item) => item.id !== "motivation");

type Draft = {
  title: string;
  sourceExperience: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  learning: string;
  competencies: string[];
};

const emptyDraft: Draft = {
  title: "",
  sourceExperience: "",
  situation: "",
  task: "",
  action: "",
  result: "",
  learning: "",
  competencies: [],
};

export function InterviewStories() {
  const [stories, setStories] = useState<InterviewStory[]>([]);
  const [readiness, setReadiness] = useState<Array<{ competencyId: string; state: StoryReadiness }>>([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function load() {
    const response = await authorizedFetch("/api/account/stories");
    const body = (await response.json().catch(() => null)) as { stories?: InterviewStory[]; readiness?: Array<{ competencyId: string; state: StoryReadiness }>; error?: string } | null;
    if (!response.ok) throw new Error(body?.error || "Your stories could not be loaded.");
    setStories(body?.stories ?? []);
    setReadiness(body?.readiness ?? []);
  }

  useEffect(() => {
    let cancelled = false;
    void load().catch((reason: unknown) => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : "Your stories could not be loaded.");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function edit(story: InterviewStory) {
    setEditing(story.storyId);
    setDraft({
      title: story.title,
      sourceExperience: story.sourceExperience,
      situation: story.situation,
      task: story.task,
      action: story.action,
      result: story.result,
      learning: story.learning,
      competencies: story.competencies,
    });
  }

  async function save() {
    setPending(true);
    setError("");
    try {
      const response = await authorizedFetch(editing ? `/api/account/stories/${editing}` : "/api/account/stories", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, evidenceGrounding: [{ source: "user", quote: draft.title }] }),
      });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(body?.error || "This story could not be saved.");
      setDraft(emptyDraft);
      setEditing(null);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "This story could not be saved.");
    } finally {
      setPending(false);
    }
  }

  async function remove(storyId: string) {
    setPending(true);
    setError("");
    try {
      const response = await authorizedFetch(`/api/account/stories/${storyId}`, { method: "DELETE" });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(body?.error || "This story could not be removed.");
      if (editing === storyId) {
        setEditing(null);
        setDraft(emptyDraft);
      }
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "This story could not be removed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <PageShell>
      <header className="flex flex-col gap-3">
        <h1 className="text-4xl font-semibold tracking-tight">Your Interview Stories</h1>
        <p className="max-w-2xl text-lg text-muted">Save up to six real examples. Leave a result or a lesson blank if you do not have it yet.</p>
        <ButtonLink href="/story-builder" variant="secondary">
          Professional story
        </ButtonLink>
      </header>
      {error ? <p className="text-sm text-danger" role="alert">{error}</p> : null}
      <ul className="flex flex-col gap-3">
        {stories.map((story) => (
          <li key={story.storyId}>
            <Card className="flex flex-col gap-2 p-5">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-lg font-semibold">{story.title}</h2>
                <span className="text-sm text-muted">{story.confidence}</span>
              </div>
              <p className="text-sm text-muted">{story.sourceExperience}</p>
              <ul className="flex flex-wrap gap-2">
                {story.competencies.map((id) => {
                  const state = readiness.find((item) => item.competencyId === id)?.state;
                  return (
                    <li key={id} className="rounded-full border border-line px-2 py-1 text-xs">
                      {storyCompetencies.find((item) => item.id === id)?.label ?? id}
                      {state ? ` · ${readinessLabel(state)}` : ""}
                    </li>
                  );
                })}
              </ul>
              <div className="flex gap-2">
                <Button type="button" variant="secondary" disabled={pending} onClick={() => edit(story)}>
                  Edit
                </Button>
                <Button type="button" variant="danger" disabled={pending} onClick={() => void remove(story.storyId)}>
                  Delete
                </Button>
              </div>
            </Card>
          </li>
        ))}
      </ul>
      <Card className="flex flex-col gap-3 p-5">
        <h2 className="text-lg font-semibold">{editing ? "Edit story" : "Add a story"}</h2>
        <Field label="Title" value={draft.title} onChange={(title) => setDraft({ ...draft, title })} />
        <Field label="Where this happened" value={draft.sourceExperience} onChange={(sourceExperience) => setDraft({ ...draft, sourceExperience })} />
        <Field label="Situation" value={draft.situation} onChange={(situation) => setDraft({ ...draft, situation })} />
        <Field label="Your responsibility" value={draft.task} onChange={(task) => setDraft({ ...draft, task })} />
        <Field label="What you did" value={draft.action} onChange={(action) => setDraft({ ...draft, action })} />
        <Field label="Result" value={draft.result} onChange={(result) => setDraft({ ...draft, result })} />
        <Field label="What you learned" value={draft.learning} onChange={(learning) => setDraft({ ...draft, learning })} />
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium">Competencies this story can support</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {storyCompetencies.map((item) => (
              <label key={item.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft.competencies.includes(item.id)}
                  onChange={() => {
                    const selected = draft.competencies.includes(item.id)
                      ? draft.competencies.filter((id) => id !== item.id)
                      : [...draft.competencies, item.id].slice(0, 4);
                    setDraft({ ...draft, competencies: selected });
                  }}
                />
                {item.label}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="flex gap-2">
          <Button type="button" disabled={pending || !draft.title.trim() || draft.competencies.length === 0} onClick={() => void save()}>
            {pending ? "Saving…" : "Save story"}
          </Button>
          {editing ? (
            <Button type="button" variant="secondary" disabled={pending} onClick={() => { setEditing(null); setDraft(emptyDraft); }}>
              Cancel
            </Button>
          ) : null}
        </div>
      </Card>
    </PageShell>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      <input className="rounded-[14px] border border-line bg-background px-3 py-2" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}
