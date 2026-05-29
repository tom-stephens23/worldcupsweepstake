import { Link } from 'react-router-dom'

export function NotFound({ slug }: { slug?: string }) {
  return (
    <main className="mx-auto max-w-xl px-4 py-16 text-center">
      <div className="text-5xl">🤷</div>
      <h1 className="mt-4 text-2xl font-bold">
        {slug ? (
          <>
            No sweepstake at <code className="rounded bg-neutral-100 px-1.5 dark:bg-neutral-800">/s/{slug}</code>
          </>
        ) : (
          'Page not found'
        )}
      </h1>
      <p className="mt-2 text-neutral-500">
        {slug
          ? "That pool doesn't exist yet. Check the link, or create it from the home page."
          : "That page doesn't exist."}
      </p>
      <Link to="/" className="btn-primary mt-6 inline-flex">
        Go to home
      </Link>
    </main>
  )
}
