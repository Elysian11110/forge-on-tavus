/** The calm confirmation after Delete my data. */
export function AllGone({ tavusConfirmed }: { tavusConfirmed: boolean }) {
  return (
    <section role="status">
      <h1 className="type-display text-[length:clamp(2.75rem,9vw,5rem)] text-ink">All gone.</h1>
      <p className="mt-5 max-w-prose text-lg text-ink-body">
        {tavusConfirmed
          ? "Your goals, what you said and your rundown are gone from Forge, and Tavus deleted its transcript and its camera summary of the call."
          : "Your goals, what you said and your rundown are gone from Forge. Tavus didn't confirm deleting its transcript and camera summary just now."}
      </p>
    </section>
  );
}
