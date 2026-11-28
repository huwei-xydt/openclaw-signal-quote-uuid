import { getMarkdownTableSource } from "openclaw/plugin-sdk/markdown-table-runtime";
import { markdownToIRWithMeta } from "openclaw/plugin-sdk/text-chunking";

/**
 * Header lines to replay at the start of a chunk that begins on a table row.
 *
 * The channel chunker runs before table conversion, so a cut inside a pipe table
 * leaves the trailing chunk with rows but no header. `convertMarkdownTables` only
 * rewrites ranges the parser recognizes as tables, so those rows stay raw pipes.
 * Replaying the header keeps every continuation parseable, the same way a reopened
 * code fence keeps its body inside the fence.
 */
export function resolveTableContinuationHeaders(
  source: string,
  maxChars: number,
): Map<number, string> {
  const headers = new Map<number, string>();
  if (!source.includes("|")) {
    return headers;
  }
  const { tables } = markdownToIRWithMeta(source, { tableMode: "block" });
  for (const table of tables) {
    const range = getMarkdownTableSource(table);
    if (!range) {
      continue;
    }
    // The header is the first two lines: the header row and its delimiter row.
    const headerEnd = source.indexOf("\n", source.indexOf("\n", range.start) + 1) + 1;
    if (headerEnd <= range.start || headerEnd >= range.end) {
      continue;
    }
    const header = source.slice(range.start, headerEnd);
    // Rows that cannot fit beside their header keep the existing hard-break behavior.
    if (header.length >= maxChars) {
      continue;
    }
    // Every row start after the header is a point where a chunk needs the header back.
    let offset = headerEnd;
    while (offset > 0 && offset < range.end) {
      const lineEnd = source.indexOf("\n", offset);
      const end = lineEnd === -1 || lineEnd > range.end ? range.end : lineEnd;
      headers.set(offset, header);
      if (end >= range.end) {
        break;
      }
      offset = end + 1;
    }
  }
  return headers;
}
