import Link from "next/link";

export default function NotFound() {
  return (
    <div className="stack solo">
      <h1 className="srlive" id="pageH1">Page not found</h1>
      <section className="panel">
        <h2>There&apos;s no page at this address</h2>
        <p className="hint">
          Try the <Link href="/">calculator</Link> or the <Link href="/tools">list of tools</Link>.
        </p>
      </section>
    </div>
  );
}
