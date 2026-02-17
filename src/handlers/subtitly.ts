// xcc.ts - Handler for XML Closed Captions (XCC) subtitle format
// By Claude 4.5 Sonnet

import type { FileData, FileFormat, FormatHandler } from "../FormatHandler.ts";

interface XCCMetadata {
  source?: string;
  title?: string;
  language?: string;
  generator?: string;
  videoId?: string;
  duration?: string;
  seconds?: number;
}

interface XCCLine {
  start: string;
  end: string;
  text: string;
  textpos?: { x: number; y: number };
}

class subtitlyHandler implements FormatHandler {
  public name: string = "xcc";
  public supportedFormats?: FileFormat[];
  public ready: boolean = false;

  async init() {
    this.supportedFormats = [
      {
        name: "XML Closed Captions subtitle",
        format: "XCC",
        extension: "xcc",
        mime: "text/x-xcc",
        from: true,
        to: true,
        internal: "xcc"
      },
      {
        name: "SubRip subtitle",
        format: "SRT",
        extension: "srt",
        mime: "application/x-subrip",
        from: true,
        to: true,
        internal: "srt"
      }
    ];
    this.ready = true;
  }

  async doConvert(
    inputFiles: FileData[],
    inputFormat: FileFormat,
    outputFormat: FileFormat
  ): Promise<FileData[]> {
    const outputFiles: FileData[] = [];

    for (const inputFile of inputFiles) {
      const inputText = new TextDecoder().decode(inputFile.bytes);

      let outputData: Uint8Array;
      let outputName: string;

      if (inputFormat.internal === "xcc" && outputFormat.internal === "srt") {
        // XCC to SRT conversion
        const parsed = this.parseXCC(inputText);
        const srtContent = this.convertToSRT(parsed);
        outputData = new TextEncoder().encode(srtContent);
        outputName = inputFile.name.replace(/\.xcc$/i, ".srt");
      } else if (inputFormat.internal === "srt" && outputFormat.internal === "xcc") {
        // SRT to XCC conversion
        const parsed = this.parseSRT(inputText);
        const xccContent = this.convertToXCC(parsed);
        outputData = new TextEncoder().encode(xccContent);
        outputName = inputFile.name.replace(/\.srt$/i, ".xcc");
      } else if (inputFormat.internal === "xcc" && outputFormat.internal === "xcc") {
        // XCC to XCC (passthrough with validation)
        outputData = new Uint8Array(inputFile.bytes);
        outputName = inputFile.name;
      } else if (inputFormat.internal === "srt" && outputFormat.internal === "srt") {
        // SRT to SRT (passthrough)
        outputData = new Uint8Array(inputFile.bytes);
        outputName = inputFile.name;
      } else {
        throw new Error(`Unsupported conversion: ${inputFormat.format} to ${outputFormat.format}`);
      }

      outputFiles.push({
        name: outputName,
        bytes: outputData
      });
    }

    return outputFiles;
  }

  private parseXCC(xccContent: string): { metadata: XCCMetadata; lines: XCCLine[] } {
    const metadata: XCCMetadata = {};
    const lines: XCCLine[] = [];

    // Parse metadata
    const metaMatch = xccContent.match(/<meta>([\s\S]*?)<\/meta>/);
    if (metaMatch) {
      const metaContent = metaMatch[1];
      const sourceMatch = metaContent.match(/<source>(.*?)<\/source>/);
      const titleMatch = metaContent.match(/<title>(.*?)<\/title>/);
      const languageMatch = metaContent.match(/<language>(.*?)<\/language>/);
      const generatorMatch = metaContent.match(/<generator>(.*?)<\/generator>/);
      const videoIdMatch = metaContent.match(/<video-id>(.*?)<\/video-id>/);
      const durationMatch = metaContent.match(/<duration>(.*?)<\/duration>/);
      const secondsMatch = metaContent.match(/<seconds>(.*?)<\/seconds>/);

      if (sourceMatch) metadata.source = sourceMatch[1];
      if (titleMatch) metadata.title = titleMatch[1];
      if (languageMatch) metadata.language = languageMatch[1];
      if (generatorMatch) metadata.generator = generatorMatch[1];
      if (videoIdMatch) metadata.videoId = videoIdMatch[1];
      if (durationMatch) metadata.duration = durationMatch[1];
      if (secondsMatch) metadata.seconds = parseInt(secondsMatch[1], 10);
    }

    // Parse subtitle lines
    const lineRegex = /<line>([\s\S]*?)<\/line>/g;
    let lineMatch;

    while ((lineMatch = lineRegex.exec(xccContent)) !== null) {
      const lineContent = lineMatch[1];
      const startMatch = lineContent.match(/<start>(.*?)<\/start>/);
      const endMatch = lineContent.match(/<end>(.*?)<\/end>/);
      const textMatch = lineContent.match(/<text>([\s\S]*?)<\/text>/);
      const textposMatch = lineContent.match(/<textpos\s+x="(\d+)"\s+y="(\d+)"\s*\/>/);

      if (startMatch && endMatch && textMatch) {
        const line: XCCLine = {
          start: startMatch[1],
          end: endMatch[1],
          text: this.stripFormatting(textMatch[1])
        };

        if (textposMatch) {
          line.textpos = {
            x: parseInt(textposMatch[1], 10),
            y: parseInt(textposMatch[2], 10)
          };
        }

        lines.push(line);
      }
    }

    return { metadata, lines };
  }

  private parseSRT(srtContent: string): XCCLine[] {
    const lines: XCCLine[] = [];
    const blocks = srtContent.trim().split(/\n\s*\n/);

    for (const block of blocks) {
      const blockLines = block.split('\n');
      if (blockLines.length < 3) continue;

      const timingLine = blockLines[1];
      const timingMatch = timingLine.match(/(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})/);

      if (timingMatch) {
        const start = timingMatch[1].replace(',', '.');
        const end = timingMatch[2].replace(',', '.');
        const text = blockLines.slice(2).join('\n');

        lines.push({ start, end, text });
      }
    }

    return lines;
  }

  private convertToSRT(parsed: { metadata: XCCMetadata; lines: XCCLine[] }): string {
    let srtContent = '';

    parsed.lines.forEach((line, index) => {
      const start = line.start.replace('.', ',');
      const end = line.end.replace('.', ',');

      srtContent += `${index + 1}\n`;
      srtContent += `${start} --> ${end}\n`;
      srtContent += `${line.text}\n\n`;
    });

    return srtContent;
  }

  private convertToXCC(lines: XCCLine[], metadata?: XCCMetadata): string {
    let xccContent = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xccContent += '<xcc xmlns="https://www.mihaipopa.com/2025/xcc">\n\n';

    // Add metadata section
    xccContent += '  <meta>\n';
    if (metadata?.source) xccContent += `    <source>${this.escapeXML(metadata.source)}</source>\n`;
    if (metadata?.title) xccContent += `    <title>${this.escapeXML(metadata.title)}</title>\n`;
    if (metadata?.language) xccContent += `    <language>${this.escapeXML(metadata.language)}</language>\n`;
    if (metadata?.generator) xccContent += `    <generator>${this.escapeXML(metadata.generator)}</generator>\n`;
    if (metadata?.videoId !== undefined) xccContent += `    <video-id>${this.escapeXML(metadata.videoId)}</video-id>\n`;
    if (metadata?.duration) xccContent += `    <duration>${this.escapeXML(metadata.duration)}</duration>\n`;
    if (metadata?.seconds !== undefined) xccContent += `    <seconds>${metadata.seconds}</seconds>\n`;
    
    // Add default metadata if none provided
    if (!metadata || Object.keys(metadata).length === 0) {
      xccContent += '    <source>converted</source>\n';
      xccContent += '    <language>en</language>\n';
      xccContent += '    <generator>universal-file-converter</generator>\n';
    }
    
    xccContent += '  </meta>\n\n';

    // Add subtitles section
    xccContent += '  <subtitles>\n';

    for (const line of lines) {
      xccContent += '    <line>\n';
      xccContent += `      <start>${line.start}</start>\n`;
      xccContent += `      <end>${line.end}</end>\n`;
      
      if (line.textpos) {
        xccContent += `      <textpos x="${line.textpos.x}" y="${line.textpos.y}"/>\n`;
      }
      
      xccContent += `      <text>${this.escapeXML(line.text)}</text>\n`;
      xccContent += '    </line>\n';
    }

    xccContent += '  </subtitles>\n';
    xccContent += '</xcc>\n';

    return xccContent;
  }

  private stripFormatting(text: string): string {
    // Remove XCC formatting tags while preserving content
    return text
      .replace(/<font[^>]*>(.*?)<\/font>/g, '$1')
      .replace(/<b>(.*?)<\/b>/g, '$1')
      .replace(/<i>(.*?)<\/i>/g, '$1')
      .replace(/<u>(.*?)<\/u>/g, '$1')
      .replace(/<s>(.*?)<\/s>/g, '$1')
      .replace(/<sub>(.*?)<\/sub>/g, '$1')
      .replace(/<sup>(.*?)<\/sup>/g, '$1')
      .trim();
  }

  private escapeXML(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}

export default subtitlyHandler;
