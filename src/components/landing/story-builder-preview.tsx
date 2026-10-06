import { ButtonLink } from "@/components/ui/button";

const beats = [
  {
    kicker: "Who",
    title: "Builder",
    body: "You tend to see something that could work better and build the solution.",
  },
  {
    kicker: "Proof",
    title: "Evidence from the resume",
    body: "Started a service business. Built a software product. Created business reporting tools.",
  },
  {
    kicker: "Next",
    title: "Where you’re headed",
    body: "Roles where business, analytics, technology, and operations come together.",
  },
];

export function StoryBuilderPreview({ storyHref }: { storyHref: string }) {
  return (
    <section className="border-y border-line bg-white" aria-labelledby="story-title">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-8 px-5 py-12 sm:px-8 sm:py-16 lg:grid-cols-[0.85fr_1.15fr]">
        <div>
          <p className="text-sm font-medium tracking-[0.16em] text-accent uppercase">Story Builder</p>
          <h2 id="story-title" className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            Know what you want them to remember about you.
          </h2>
          <p className="mt-3 max-w-md text-base leading-relaxed text-muted">
            InterviewAI turns your resume into a clear professional story for “Tell me about yourself.”
          </p>
          <ButtonLink href={storyHref} className="mt-6">
            Build my story
          </ButtonLink>
        </div>
        <ol className="grid gap-6 md:grid-cols-3 md:gap-5">
          {beats.map((beat, index) => (
            <li key={beat.kicker} className="relative flex">
              <article className="flex flex-1 flex-col rounded-[20px] border border-line bg-background p-4">
                <p className="text-xs font-medium tracking-[0.16em] text-accent uppercase">{beat.kicker}</p>
                <h3 className="mt-3 text-base font-semibold tracking-tight">{beat.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{beat.body}</p>
              </article>
              {index < beats.length - 1 ? <Arrow /> : null}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Arrow() {
  return (
    <span className="absolute top-full left-1/2 z-10 grid size-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-line bg-white text-accent md:top-1/2 md:left-full" aria-hidden="true">
      <svg className="size-3.5 rotate-90 md:rotate-0" viewBox="0 0 20 20" fill="none">
        <path d="M4 10h12M12 6l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}
