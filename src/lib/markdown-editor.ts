export type MarkdownToolbarAction =
  | "heading"
  | "bold"
  | "italic"
  | "bullet-list"
  | "numbered-list"
  | "checklist"
  | "link"
  | "code"
  | "quote";

export type MarkdownEditResult = {
  value: string;
  selectionStart: number;
  selectionEnd: number;
};

const LIST_OR_QUOTE_LINE_RE = /^\s*(?:[-*+]|\d+\.|>)\s/;

export function normalizeTabIndent(text: string): string {
  return text.replace(/\t/g, "  ");
}

function getLineBounds(value: string, start: number, end: number) {
  const lineStart = value.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
  const nextNewline = value.indexOf("\n", end);
  const lineEnd = nextNewline === -1 ? value.length : nextNewline;
  return { lineStart, lineEnd };
}

export function applyMarkdownToolbarAction(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  action: MarkdownToolbarAction,
): MarkdownEditResult {
  const start = Math.max(0, Math.min(selectionStart, value.length));
  const end = Math.max(start, Math.min(selectionEnd, value.length));
  const selected = value.slice(start, end);
  const before = value.slice(0, start);
  const after = value.slice(end);

  switch (action) {
    case "bold": {
      const content = selected || "bold text";
      const next = `${before}**${content}**${after}`;
      return {
        value: next,
        selectionStart: start + 2,
        selectionEnd: start + 2 + content.length,
      };
    }
    case "italic": {
      const content = selected || "italic text";
      const next = `${before}*${content}*${after}`;
      return {
        value: next,
        selectionStart: start + 1,
        selectionEnd: start + 1 + content.length,
      };
    }
    case "link": {
      const isUrl = /^https?:\/\/\S+$/i.test(selected.trim());
      if (isUrl) {
        const label = "link";
        const next = `${before}[${label}](${selected.trim()})${after}`;
        return {
          value: next,
          selectionStart: start + 1,
          selectionEnd: start + 1 + label.length,
        };
      }
      const label = selected || "link text";
      const url = "https://";
      const next = `${before}[${label}](${url})${after}`;
      const urlStart = start + label.length + 3;
      return {
        value: next,
        selectionStart: selected ? urlStart : start + 1,
        selectionEnd: selected ? urlStart + url.length : start + 1 + label.length,
      };
    }
    case "code": {
      if (selected.includes("\n")) {
        const block = `\`\`\`\n${selected}\n\`\`\``;
        return {
          value: `${before}${block}${after}`,
          selectionStart: start + 4,
          selectionEnd: start + 4 + selected.length,
        };
      }
      const content = selected || "code";
      return {
        value: `${before}\`${content}\`${after}`,
        selectionStart: start + 1,
        selectionEnd: start + 1 + content.length,
      };
    }
    case "heading": {
      const { lineStart, lineEnd } = getLineBounds(value, start, end);
      const block = value.slice(lineStart, lineEnd);
      const updated = block
        .split("\n")
        .map((line) => {
          const match = line.match(/^(#{1,3})\s+(.*)$/);
          if (match) {
            const hashes = match[1].length < 3 ? "#".repeat(match[1].length + 1) : "#";
            return `${hashes} ${match[2]}`;
          }
          return `# ${line}`;
        })
        .join("\n");
      const delta = updated.length - block.length;
      return {
        value: value.slice(0, lineStart) + updated + value.slice(lineEnd),
        selectionStart: Math.max(lineStart, start + delta),
        selectionEnd: Math.max(lineStart, end + delta),
      };
    }
    case "bullet-list":
    case "numbered-list":
    case "checklist":
    case "quote": {
      const { lineStart, lineEnd } = getLineBounds(value, start, end);
      const block = value.slice(lineStart, lineEnd);
      const lines = block.split("\n");
      const updated = lines
        .map((line, index) => {
          const indentMatch = line.match(/^(\s*)/);
          const indent = indentMatch ? indentMatch[1] : "";
          const stripped = line
            .slice(indent.length)
            .replace(/^(?:[-*+]\s+\[[ xX]\]\s+|[-*+]\s+|\d+\.\s+|>\s+)/, "");
          if (action === "bullet-list") return `${indent}- ${stripped}`;
          if (action === "numbered-list") return `${indent}${index + 1}. ${stripped}`;
          if (action === "checklist") return `${indent}- [ ] ${stripped}`;
          return `${indent}> ${stripped}`;
        })
        .join("\n");
      const delta = updated.length - block.length;
      return {
        value: value.slice(0, lineStart) + updated + value.slice(lineEnd),
        selectionStart: start === end ? lineStart + updated.length : lineStart,
        selectionEnd: lineStart + updated.length + (delta === 0 ? 0 : 0),
      };
    }
  }
}

export function applyMarkdownKeyCommand(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  key: string,
  shiftKey = false,
): MarkdownEditResult | null {
  const start = Math.max(0, Math.min(selectionStart, value.length));
  const end = Math.max(start, Math.min(selectionEnd, value.length));

  if (key === "Tab") {
    const { lineStart, lineEnd } = getLineBounds(value, start, end);
    const block = value.slice(lineStart, lineEnd);
    const lines = block.split("\n");

    if (shiftKey) {
      let firstLineRemoved = 0;
      let totalRemoved = 0;
      const updated = lines
        .map((line, idx) => {
          let removed = 0;
          let nextLine = line;
          if (nextLine.startsWith("\t")) {
            nextLine = nextLine.slice(1);
            removed = 1;
          } else if (nextLine.startsWith("  ")) {
            nextLine = nextLine.slice(2);
            removed = 2;
          } else if (nextLine.startsWith(" ")) {
            nextLine = nextLine.slice(1);
            removed = 1;
          }
          if (idx === 0) firstLineRemoved = removed;
          totalRemoved += removed;
          return nextLine;
        })
        .join("\n");

      return {
        value: value.slice(0, lineStart) + updated + value.slice(lineEnd),
        selectionStart: Math.max(lineStart, start - firstLineRemoved),
        selectionEnd: Math.max(lineStart, end - totalRemoved),
      };
    }

    // Forward Tab (2 spaces): indent line(s) if multi-line selection or list/quote line
    if (start !== end || lines.length > 1 || LIST_OR_QUOTE_LINE_RE.test(lines[0])) {
      const updated = lines.map((line) => `  ${line}`).join("\n");
      return {
        value: value.slice(0, lineStart) + updated + value.slice(lineEnd),
        selectionStart: start + 2,
        selectionEnd: end + lines.length * 2,
      };
    }

    // Plain single-cursor Tab -> insert 2 spaces at cursor
    return {
      value: `${value.slice(0, start)}  ${value.slice(end)}`,
      selectionStart: start + 2,
      selectionEnd: start + 2,
    };
  }

  if (key === "Enter" && !shiftKey && start === end) {
    const { lineStart, lineEnd } = getLineBounds(value, start, end);
    const lineBeforeCursor = value.slice(lineStart, start);
    const lineAfterCursor = value.slice(start, lineEnd);

    // 1. Check if current line is an empty list item or empty blockquote at the end of the line
    const emptyListMatch = lineBeforeCursor.match(/^(\s*)([-*+]\s+\[[ xX]\]|[-*+]|\d+\.|>)\s*$/);
    if (emptyListMatch && lineAfterCursor.trim() === "") {
      const indent = emptyListMatch[1];
      const marker = emptyListMatch[2];
      if (indent.length >= 2) {
        // Outdent nested empty list item by 2 spaces
        const nextIndent = indent.slice(2);
        const replacement = `${nextIndent}${marker} `;
        const nextValue = value.slice(0, lineStart) + replacement + value.slice(lineEnd);
        const cursor = lineStart + replacement.length;
        return {
          value: nextValue,
          selectionStart: cursor,
          selectionEnd: cursor,
        };
      }
      // Root-level empty list item -> exit list cleanly
      const nextValue = value.slice(0, lineStart) + value.slice(lineEnd);
      return {
        value: nextValue,
        selectionStart: lineStart,
        selectionEnd: lineStart,
      };
    }

    // 2. Checklist continuation: - [ ] or - [x]
    const checklistMatch = lineBeforeCursor.match(/^(\s*)([-*+])\s+\[[ xX]\]\s+(.+)$/);
    if (checklistMatch) {
      const insert = `\n${checklistMatch[1]}${checklistMatch[2]} [ ] `;
      const nextValue = value.slice(0, start) + insert + value.slice(end);
      const cursor = start + insert.length;
      return { value: nextValue, selectionStart: cursor, selectionEnd: cursor };
    }

    // 3. Unordered list continuation: - / * / +
    const bulletMatch = lineBeforeCursor.match(/^(\s*)([-*+])\s+(.+)$/);
    if (bulletMatch) {
      const insert = `\n${bulletMatch[1]}${bulletMatch[2]} `;
      const nextValue = value.slice(0, start) + insert + value.slice(end);
      const cursor = start + insert.length;
      return { value: nextValue, selectionStart: cursor, selectionEnd: cursor };
    }

    // 4. Ordered list continuation: 1. -> 2.
    const numberedMatch = lineBeforeCursor.match(/^(\s*)(\d+)\.\s+(.+)$/);
    if (numberedMatch) {
      const nextNumber = Number(numberedMatch[2]) + 1;
      const insert = `\n${numberedMatch[1]}${nextNumber}. `;
      const nextValue = value.slice(0, start) + insert + value.slice(end);
      const cursor = start + insert.length;
      return { value: nextValue, selectionStart: cursor, selectionEnd: cursor };
    }

    // 5. Blockquote continuation: >
    const quoteMatch = lineBeforeCursor.match(/^(\s*)>\s+(.+)$/);
    if (quoteMatch) {
      const insert = `\n${quoteMatch[1]}> `;
      const nextValue = value.slice(0, start) + insert + value.slice(end);
      const cursor = start + insert.length;
      return { value: nextValue, selectionStart: cursor, selectionEnd: cursor };
    }
  }

  return null;
}
