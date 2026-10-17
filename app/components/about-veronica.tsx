"use client";

import { createContext, useContext, useRef, useState, type ReactNode } from "react";

// Whether the note has been opened this visit. The chip follows you from the landing into the
// call and onto the result page until it is clicked once, then it is gone.
const AboutContext = createContext<{ seen: boolean; markSeen: () => void }>({ seen: false, markSeen: () => {} });

export function AboutVeronicaProvider({ children }: { children: ReactNode }) {
  const [seen, setSeen] = useState(false);
  return <AboutContext.Provider value={{ seen, markSeen: () => setSeen(true) }}>{children}</AboutContext.Provider>;
}

/** The blinking "Click me!" chip and the note it opens on why Veronica exists. Renders nothing once the note has been opened. */
export function AboutVeronica() {
  const dialog = useRef<HTMLDialogElement>(null);
  const { seen, markSeen } = useContext(AboutContext);
  // The dialog stays mounted while it is open, even though the chip is gone the moment it is clicked.
  const [open, setOpen] = useState(false);
  if (seen && !open) return null;

  function show() {
    setOpen(true);
    dialog.current?.showModal();
  }

  return (
    <>
      {!seen && (
        <button
          type="button"
          onClick={show}
          aria-haspopup="dialog"
          className="type-label inline-flex h-9 animate-blink items-center gap-2.5 border border-rule px-3 text-ink transition-colors hover:border-ember focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember"
        >
          <span aria-hidden className="size-1.5 animate-breathe bg-ember" />
          Click me!
        </button>
      )}

      <dialog
        ref={dialog}
        aria-labelledby="about-veronica-title"
        onClick={(event) => {
          // A click on the backdrop lands on the dialog itself, not on the panel inside it.
          if (event.target === event.currentTarget) event.currentTarget.close();
        }}
        onClose={() => {
          setOpen(false);
          markSeen();
        }}
        className="m-auto w-[min(100%-2rem,40rem)] border border-rule bg-surface p-0 text-ink backdrop:bg-black/70"
      >
        <div className="p-6 sm:p-10">
          <p className="stamp">Why I built Veronica</p>
          <h2 id="about-veronica-title" className="mt-5 text-3xl font-medium leading-[1.1] tracking-[-0.03em] sm:text-4xl">
            Hi Tavus team! <span aria-hidden>👋</span>
          </h2>
          <div className="mt-6 space-y-4 text-ink-body">
            <p>
              As you probably know, half the internet is trying to figure itself out through personality types: MBTI, the
              Enneagram, Socionics, you name it. I built Forge for exactly that. It&apos;s one system that reads you across
              seven of them and gives you the full rundown: where you&apos;re strong, where you&apos;re not, and what to
              actually do with that <span aria-hidden>🔥</span>
            </p>
            <p>
              Here&apos;s the problem it solves. Typology is huge online, and whole subreddits, Discords and TikTok comment
              sections are full of people arguing about whether they&apos;re an INTJ or an INFJ, a 5 or a 6. Most of them took
              a free quiz, got a label, and have been debating it with strangers ever since, because a quiz only knows what
              you clicked. Getting typed properly means someone listening to your real stories for an hour, and the people
              who do that well are usually a therapist or a coach, and they charge like one <span aria-hidden>💸</span>
            </p>
            <p>
              So I made Veronica. She&apos;s the friend who knows way too much about personality types: she asks how your day
              was, then about real moments, and she works out how you take things in and how you decide using Forge&apos;s
              method. Tavus is the reason it feels like talking to a person and not filling in a form. She notices when you
              light up or go quiet, she lets you finish your story, and people tell a face things they&apos;d never type into
              a quiz.
            </p>
            <p>She&apos;s a friend, not a therapist: no diagnoses, and a real crisis line if something heavy comes up.</p>
            <p>
              Talk to her about whatever&apos;s on your mind! Just don&apos;t give her any private information{" "}
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
