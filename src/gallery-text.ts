/** Word-wrap to at most `width` characters per line. A single word longer than the width is split (never dropped). */
export function wrap(text: string, width: number): string[] {
  const out: string[] = [];
  let line = '';
  for (let word of text.split(/\s+/).filter(Boolean)) {
    while (word.length > width) {
      if (line) { out.push(line); line = ''; }
      out.push(word.slice(0, width));
      word = word.slice(width);
    }
    if (!line) line = word;
    else if (line.length + 1 + word.length <= width) line += ' ' + word;
    else { out.push(line); line = word; }
  }
  if (line) out.push(line);
  return out;
}
