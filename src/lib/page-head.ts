export function pageHead(title: string, description: string) {
  return { meta: [
    { title: `حاسبة الصاغة — ${title}` },
    { name: "description", content: description },
    { property: "og:title", content: `حاسبة الصاغة — ${title}` },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] };
}