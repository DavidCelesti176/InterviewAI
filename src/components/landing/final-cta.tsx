import { ButtonLink } from "@/components/ui/button";
import { priceLabel, products } from "@/lib/billing/products";

export function FinalCta({ practiceHref }: { practiceHref: string }) {
  return (
    <section className="bg-room text-white" aria-labelledby="final-title">
      <div className="mx-auto flex w-full max-w-3xl flex-col items-start px-5 py-14 sm:items-center sm:px-8 sm:py-16 sm:text-center">
        <h2 id="final-title" className="text-4xl leading-[1.05] font-semibold tracking-tight sm:text-5xl">
          Your real interview shouldn’t be your first practice run.
        </h2>
        <p className="mt-4 max-w-xl text-lg leading-relaxed text-white/75">Walk in having already answered the hard questions.</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <ButtonLink href={practiceHref} className="px-6 py-3 text-base">
            Start practicing free
          </ButtonLink>
          <ButtonLink href={practiceHref} variant="room" className="px-6 py-3 text-base">
            Create an account
          </ButtonLink>
        </div>
        <p className="mt-4 text-sm text-white/60">
          One 10-minute practice is free, with no credit card. A full interview is {priceLabel(products.fullInterview.priceCents)}. Plus is {priceLabel(products.plus.priceCents)} a month.
        </p>
      </div>
    </section>
  );
}
