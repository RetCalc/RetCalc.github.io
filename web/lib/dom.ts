/** After a row is added, focus the last field matching `selector` inside
    `root`, once React has drawn it. */
export function focusLast(root: { current: HTMLElement | null }, selector: string): void {
  setTimeout(() => [...(root.current?.querySelectorAll<HTMLElement>(selector) ?? [])].pop()?.focus(), 0);
}
