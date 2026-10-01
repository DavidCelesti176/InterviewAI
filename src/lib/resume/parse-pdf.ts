import { extractText } from "unpdf";

const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46];

export function looksLikePdf(bytes: Uint8Array): boolean {
  return PDF_MAGIC.every((byte, index) => bytes[index] === byte);
}

export async function extractPdfText(bytes: Uint8Array): Promise<string> {
  const result = await extractText(bytes, { mergePages: true });
  return result.text.replace(/\s+\n/g, "\n").replace(/[ \t]{2,}/g, " ").trim();
}
