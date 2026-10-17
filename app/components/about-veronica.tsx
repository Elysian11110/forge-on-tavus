"use client";

import { useRef, useState } from "react";

/** The blinking "Click me!" chip in the landing header, and the note it opens on why Veronica exists. It blinks on every visit until it is clicked. */
export function AboutVeronica() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [seen, setSeen] = useState(false);

  function open() {
    setSeen(true);
    dialog.current?.showModal();
  }

  return (
    <>
      <button
        type="button"
        onClick={open}
        aria-haspopup="dialog"
        className={`type-label inline-flex h-9 items-center gap-2.5 border border-rule px-3 text-ink transition-colors hover:border-ember focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember ${seen ? "" : "animate-blink"}`}
      >
        <span aria-hidden className={`size-1.5 bg-ember ${seen ? "" : "animate-breathe"}`} />
        Click me!
      </button>

      <dialog
        ref={dialog}
        aria-labelledby="about-veronica-title"
        onClick={(event) => {
          // A click on the backdrop lands on the dialog itself, not on the panel inside it.
          if (event.target === event.currentTarget) event.currentTarget.close();
        }}
        className="m-auto w-[min(100%-2rem,40rem)] border border-rule bg-surface p-0 text-ink backdrop:bg-black/70"
      >
        <div className="p-6 sm:p-10">
          <p className="stamp">Why I built Veronica</p>
          <h2 id="about-veronica-title" className="mt-5 text-3xl font-medium leading-[1.1] tracking-[-0.03em] sm:text-4xl">
            Hi Tavus team!
          </h2>
          <div className="mt-6 space-y-4 text-ink-body">
            <p>
              As you probably know, people all over the internet try to understand themselves through personality types:
              MBTI, the Enneagram, Socionics and a few more. I built Forge, one unified system that gives you a complete
              rundown of your personality across seven of them, so you can see your strengths, your weaknesses, and what to
              do with that to become a better version of yourself.
            </p>
            <p>
              Typology is huge online. Whole subreddits, Discords and TikTok comment sections are full of people trying to
              work out if they&apos;re an INTJ or an INFJ, a 5 or a 6. Most start with a free quiz, get a label, and then
              argue about it with strangers for weeks, because a quiz only knows what you clicked. Getting typed properly
              means someone listening to your real stories for an hour, and the people who do that well are usually some
              kind of therapist or coach, and they charge like one.
            </p>
            <p>
              Veronica gives you that conversation without the price tag. She&apos;s the friend who knows way too much about
              personality types: she asks about your day, then about real moments, and maps how you take things in and how
              you decide with Forge, the typing method I built. Tavus is what makes it feel like a person and not a form.
              She sees you light up or go quiet and adjusts, she lets you finish your story, and people tell a face things
              they&apos;d never type into a quiz.
            </p>
            <p>
              She&apos;s a friend, not a therapist: no diagnoses, and a real crisis line if something heavy comes up.
            </p>
            <p>
              Feel free to talk to her about whatever is on your mind. Just don&apos;t give her any private information{" "}
              <span aria-hidden>😆</span>
            </p>
          </div>
          <form method="dialog" className="mt-8">
            <button type="submit" className="line-btn">
              Got it
            </button>
          </form>
        </div>
      </dialog>
    </>
  );
}
