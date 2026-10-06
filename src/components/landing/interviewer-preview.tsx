import { AnimatedInterviewer } from "@/components/interview/avatar/animated-interviewer";
import { interviewerProfiles } from "@/components/interview/avatar/profile";

export function InterviewerPreview() {
  return (
    <section className="mx-auto grid w-full max-w-6xl items-center gap-8 px-5 py-12 sm:px-8 sm:py-14 lg:grid-cols-[1fr_auto]" aria-labelledby="interviewers-title">
      <div className="max-w-md">
        <p className="text-sm font-medium tracking-[0.16em] text-accent uppercase">The room</p>
        <h2 id="interviewers-title" className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          Pick who’s across the table.
        </h2>
        <p className="mt-3 text-base leading-relaxed text-muted">
          Choose an interviewer style that helps you practice in a way that feels useful.
        </p>
      </div>
      <ul className="grid w-full max-w-md grid-cols-2 gap-3">
        {interviewerProfiles.map((profile) => (
          <li key={profile.id}>
            <figure className="overflow-hidden rounded-[20px] border border-line bg-card">
              <div
                className="avatar-stage aspect-[4/5] bg-[radial-gradient(circle_at_50%_18%,#f7f4ef,#d5deea)]"
                data-avatar-state="idle"
              >
                <div className="avatar-figure h-full">
                  <AnimatedInterviewer id={`landing-${profile.id}`} look={profile.look} label={profile.name} />
                </div>
              </div>
              <figcaption className="px-3 py-3">
                <p className="font-semibold">{profile.name}</p>
                <p className="text-xs font-medium tracking-wide text-accent uppercase">{profile.styleLabel}</p>
                <p className="mt-1 text-sm text-muted">{profile.shortDescription}</p>
              </figcaption>
            </figure>
          </li>
        ))}
      </ul>
    </section>
  );
}
