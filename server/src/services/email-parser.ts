import { simpleParser, ParsedMail } from "mailparser";
import { PDFParse } from "pdf-parse";
import * as fs from "fs";
import * as path from "path";

export interface AttachmentInfo {
  filename: string;
  contentType: string;
  size: number;
  text: string | null;
  pdfBuffer?: Buffer;
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
        info.pdfBuffer = attachment.content;
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

export interface ParsedPdf {
  filename: string;
  text: string;
  size: number;
  buffer: Buffer;
}

export async function parsePdfFile(filePath: string): Promise<ParsedPdf> {
  const raw = fs.readFileSync(filePath);
  const parser = new PDFParse({ data: new Uint8Array(raw) });
  const result = await parser.getText();
  await parser.destroy();

  return {
    filename: path.basename(filePath),
    text: result.text,
    size: raw.length,
    buffer: raw,
  };
}

export interface ContentSection {
  label: string;
  content: string;
  pdfBuffer?: Buffer;
}

const MAX_SECTION_CHARS = 180_000;

function capContent(content: string): string {
  if (content.length > MAX_SECTION_CHARS) {
    return content.slice(0, MAX_SECTION_CHARS) + "\n\n[... TRUNCATED — content exceeded context limit ...]";
  }
  return content;
}

export function splitEmailIntoSections(parsed: ParsedEmail): ContentSection[] {
  const sections: ContentSection[] = [];

  const bodyText = parsed.textBody || parsed.htmlBody || "";
  if (bodyText.length > 0) {
    const bodyContent = [
      `From: ${parsed.from || "unknown"}`,
      `To: ${parsed.to || "unknown"}`,
      `Subject: ${parsed.subject || "unknown"}`,
      `Date: ${parsed.date?.toISOString() || "unknown"}`,
      "",
      "=== EMAIL BODY ===",
      bodyText,
    ].join("\n");

    sections.push({
      label: "email body",
      content: capContent(bodyContent),
    });
  }

  for (const att of parsed.attachments) {
    if (!att.text && !att.pdfBuffer) continue;

    const attContent = [
      `Source: attachment from email "${parsed.subject || "unknown"}"`,
      `Filename: ${att.filename} (${att.contentType}, ${att.size} bytes)`,
      "",
      "=== ATTACHMENT CONTENT ===",
      att.text || "[content available via PDF document vision]",
    ].join("\n");

    sections.push({
      label: `attachment: ${att.filename}`,
      content: capContent(attContent),
      pdfBuffer: att.pdfBuffer,
    });
  }

  return sections;
}

export function splitPdfIntoSections(parsed: ParsedPdf): ContentSection[] {
  const content = [
    `Source Document: ${parsed.filename} (${parsed.size} bytes)`,
    "",
    "=== PDF CONTENT ===",
    parsed.text || "[content available via PDF document vision]",
  ].join("\n");

  return [{
    label: `pdf: ${parsed.filename}`,
    content: capContent(content),
    pdfBuffer: parsed.buffer,
  }];
}

export function buildPdfContentString(parsed: ParsedPdf): string {
  const content = [
    `Source Document: ${parsed.filename} (${parsed.size} bytes)`,
    "",
    "=== PDF CONTENT ===",
    parsed.text || "[empty document]",
  ].join("\n");

  return capContent(content);
}

export function buildContentString(parsed: ParsedEmail): string {
  const parts: string[] = [
    `From: ${parsed.from || "unknown"}`,
    `To: ${parsed.to || "unknown"}`,
    `Subject: ${parsed.subject || "unknown"}`,
    `Date: ${parsed.date?.toISOString() || "unknown"}`,
    "",
    "=== EMAIL BODY ===",
    parsed.textBody || parsed.htmlBody || "[empty body]",
  ];

  for (const att of parsed.attachments) {
    parts.push("");
    parts.push(`=== ATTACHMENT: ${att.filename} (${att.contentType}, ${att.size} bytes) ===`);
    if (att.text) {
      parts.push(att.text);
    } else {
      parts.push(`[binary attachment — not extracted]`);
    }
  }

  return capContent(parts.join("\n"));
}
