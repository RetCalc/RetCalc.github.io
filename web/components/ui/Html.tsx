/* Text the page builds with a little markup (a figure in bold, a warning
   colored), as the old page wrote it. Only for the site's own sentences;
   anything a person typed is escaped before it goes in. */
export function Html({ html, as: Tag = "div", ...attrs }: { html: string; as?: "div" | "span" | "p" | "ul" } & React.HTMLAttributes<HTMLElement>) {
  return <Tag {...attrs} dangerouslySetInnerHTML={{ __html: html }} />;
}
