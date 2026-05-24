export function normalizePlainText(value: string) {
  const normalized = value
    .normalize("NFC")
    .replace(/\\r\\n|\\n|\\r/g, "\n")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u2028\u2029]/g, "\n")
    .replace(/[\u00a0\u1680\u180e\u2000-\u200a\u202f\u205f\u3000]/g, " ")
    .replace(/[\u200b-\u200d\u2060\ufeff\u00ad]/g, "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/\t/g, "  ");

  const lines = normalized
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

export function normalizePlainTextLines(values: string[]) {
  return values
    .map((value) => normalizePlainText(value))
    .filter(Boolean);
}
