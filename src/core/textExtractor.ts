function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

async function readAttachmentText(attachment: Zotero.Item): Promise<string> {
  try {
    const value = (attachment as any).attachmentText;
    if (typeof value === "string") {
      return normalizeText(value);
    }
    if (value && typeof value.then === "function") {
      const resolved = await value;
      return typeof resolved === "string" ? normalizeText(resolved) : "";
    }
  } catch (_error) {
    return "";
  }

  return "";
}

export async function getIndexedAttachmentText(
  item: Zotero.Item,
  maxChars: number,
): Promise<string> {
  if (maxChars <= 0) return "";

  const attachmentIDs = item.getAttachments();
  const chunks: string[] = [];
  let remaining = maxChars;

  for (const attachmentID of attachmentIDs) {
    const attachment = Zotero.Items.get(attachmentID);
    if (!attachment?.isAttachment()) continue;

    const text = await readAttachmentText(attachment);
    if (!text) continue;

    const excerpt = text.slice(0, remaining);
    chunks.push(excerpt);
    remaining -= excerpt.length;
    if (remaining <= 0) break;
  }

  return normalizeText(chunks.join("\n\n")).slice(0, maxChars);
}
