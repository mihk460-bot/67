const URL_RE = /((?:https?:\/\/|www\.)[^\s]+|\+?\d[\d\s-]{7,}\d)/g;

export function Linkify({ text }: { text: string }) {
  const parts = text.split(URL_RE);
  return (
    <>
      {parts.map((p, i) => {
        if (i % 2 === 0) return p;
        const isPhone = /^\+?\d[\d\s-]+$/.test(p);
        const href = isPhone
          ? `tel:${p.replace(/[^\d+]/g, "")}`
          : /^https?:\/\//i.test(p)
            ? p
            : `https://${p}`;
        return (
          <a
            key={i}
            href={href}
            target={isPhone ? undefined : "_blank"}
            rel="noopener noreferrer"
            dir="ltr"
            className="break-all font-semibold text-primary underline underline-offset-2"
          >
            {p}
          </a>
        );
      })}
    </>
  );
}
