import { simpleParser, ParsedMail } from "mailparser";
import { PDFParse } from "pdf-parse";
import * as fs from "fs";

export interface AttachmentInfo {
  filename: string;
  contentType: string;
  size: number;
  text: string | null;
}

export interface ParsedEmail {
  from: string | undefined;
  to: string | undefined;
  subject: string | undefined;
  date: Date | undefined;
  textBody: string;
  htmlBody: string;
  attachments: AttachmentInfo[];
}

export async function parseEmlFile(filePath: string): Promise<ParsedEmail> {
  const raw = fs.readFileSync(filePath);
  const parsed: ParsedMail = await simpleParser(raw);

  const attachments: AttachmentInfo[] = [];

  if (parsed.attachments) {
    for (const attachment of parsed.attachments) {
      const info: AttachmentInfo = {
        filename: attachment.filename || "unnamed",
        contentType: attachment.contentType || "unknown",
        size: attachment.size,
        text: null,
      };

      if (
        attachment.contentType?.startsWith("text/") ||
        attachment.filename?.endsWith(".txt") ||
        attachment.filename?.endsWith(".csv")
      ) {
        info.text = attachment.content.toString("utf-8");
      } else if (
        attachment.contentType === "application/pdf" ||
        attachment.filename?.endsWith(".pdf")
      ) {
        try {
          const parser = new PDFParse({ data: new Uint8Array(attachment.content) });
          const textResult = await parser.getText();
          info.text = textResult.text;
          await parser.destroy();
        } catch (err) {
          console.warn(`Failed to parse PDF "${attachment.filename}":`, err);
          info.text = `[PDF parse failed: ${attachment.filename}]`;
        }
      }

      attachments.push(info);
    }
  }

  const fromAddress = parsed.from?.value?.[0]?.address;
  const fromName = parsed.from?.value?.[0]?.name;
  const fromStr = fromName ? `${fromName} <${fromAddress}>` : fromAddress;

  const toValue = Array.isArray(parsed.to) ? parsed.to[0] : parsed.to;
  const toAddress = toValue?.value?.[0]?.address;
  const toName = toValue?.value?.[0]?.name;
  const toStr = toName ? `${toName} <${toAddress}>` : toAddress;

  return {
    from: fromStr,
    to: toStr,
    subject: parsed.subject,
    date: parsed.date,
    textBody: parsed.text || "",
    htmlBody: parsed.html || "",
    attachments,
  };
}

const MAX_CONTENT_CHARS = 180_000;

export function buildContentString(parsed: ParsedEmail): string {
  const sections: string[] = [
    `From: ${parsed.from || "unknown"}`,
    `To: ${parsed.to || "unknown"}`,
    `Subject: ${parsed.subject || "unknown"}`,
    `Date: ${parsed.date?.toISOString() || "unknown"}`,
    "",
    "=== EMAIL BODY ===",
    parsed.textBody || parsed.htmlBody || "[empty body]",
  ];

  for (const att of parsed.attachments) {
    sections.push("");
    sections.push(`=== ATTACHMENT: ${att.filename} (${att.contentType}, ${att.size} bytes) ===`);
    if (att.text) {
      sections.push(att.text);
    } else {
      sections.push(`[binary attachment — not extracted]`);
    }
  }

  let content = sections.join("\n");

  if (content.length > MAX_CONTENT_CHARS) {
    content = content.slice(0, MAX_CONTENT_CHARS) + "\n\n[... TRUNCATED — content exceeded context limit ...]";
  }

  return content;
}
