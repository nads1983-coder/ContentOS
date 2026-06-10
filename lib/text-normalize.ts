const htmlEntityMap: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: "\"",
  apos: "'",
  nbsp: " "
};

export function safeDecodeContent(value: string): string {
  if (!value) return "";

  if (!/%[0-9a-f]{2}/i.test(value)) {
    return value;
  }

  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function decodeHtmlEntities(value: string) {
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    const normalized = entity.toLowerCase();

    if (normalized.startsWith("#x")) {
      const codePoint = Number.parseInt(normalized.slice(2), 16);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }

    if (normalized.startsWith("#")) {
      const codePoint = Number.parseInt(normalized.slice(1), 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }

    return htmlEntityMap[normalized] ?? match;
  });
}

function stripHtmlTags(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p\s*>/gi, "\n\n")
    .replace(/<\/div\s*>/gi, "\n")
    .replace(/<\/li\s*>/gi, "\n")
    .replace(/<[^>\n]+>/g, "");
}

function removeUnsafeControlCharacters(value: string) {
  let result = "";

  for (const character of value) {
    const code = character.charCodeAt(0);

    if (code === 127 || (code < 32 && code !== 9 && code !== 10 && code !== 13)) {
      continue;
    }

    result += character;
  }

  return result;
}

export function normalizePlainText(value: string) {
  const normalized = decodeHtmlEntities(stripHtmlTags(safeDecodeContent(value)))
    .normalize("NFC")
    .replace(/\\r\\n|\\n|\\r/g, "\n")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u2028\u2029]/g, "\n")
    .replace(/[\u00a0\u1680\u180e\u2000-\u200a\u202f\u205f\u3000]/g, " ")
    .replace(/[\u200b-\u200d\u2060\ufeff\u00ad]/g, "")
    .replace(/\t/g, "  ");

  const textWithoutControls = removeUnsafeControlCharacters(normalized);

  const lines = textWithoutControls
    .split("\n")
    .map((line) =>
      line
        .replace(/[ ]{3,}/g, "  ")
        .replace(/\s+([.,!?;:])/g, "$1")
        .trimEnd()
    );

  const compacted: string[] = [];
  let previousWasBlank = true;

  lines.forEach((line) => {
    const isBlank = line.trim().length === 0;

    if (isBlank) {
      if (!previousWasBlank) {
        compacted.push("");
      }
      previousWasBlank = true;
      return;
    }

    compacted.push(line);
    previousWasBlank = false;
  });

  while (compacted.length && compacted[compacted.length - 1] === "") {
    compacted.pop();
  }

  return compacted.join("\n").trim();
}

export function cleanPlainText(value: string) {
  return normalizePlainText(value);
}

export function normalizePlainTextLines(values: string[]) {
  return values
    .map((value) => cleanPlainText(value))
    .filter(Boolean);
}
