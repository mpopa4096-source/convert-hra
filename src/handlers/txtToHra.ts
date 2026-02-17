import type { FileData, FileFormat, FormatHandler } from "../FormatHandler.ts";

class txtToHraHandler implements FormatHandler {
  public name: string = "txtToHra";

  public supportedFormats: FileFormat[] = [
    {
      name: "Plain Text",
      format: "txt",
      extension: "txt",
      mime: "text/plain",
      from: false,
      to: false,
      internal: "txt"
    },
    {
      name: "Human Readable Archive",
      format: "hra",
      extension: "hra",
      mime: "archive/x-hra",
      from: false,
      to: true,
      internal: "hra"
    }
  ];

  public ready: boolean = true;

  async init() {
    this.ready = true;
  }

// debug-safe replacement for doConvert (paste into your txtToHra.ts temporarily)
async doConvert(
  inputFiles: FileData[],
  inputFormat: FileFormat,
  outputFormat: FileFormat
): Promise<FileData[]> {
  console.log('[txtToHra] doConvert START, inputFiles.length=', inputFiles.length,
              'inputFormat=', inputFormat?.internal, 'outputFormat=', outputFormat?.internal);
  if (inputFormat.internal !== "txt" || outputFormat.internal !== "hra") {
    throw new Error("Unsupported format conversion for txt2hra handler.");
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  // Defensive guard: refuse absurdly large inputs to avoid OOM during debugging
  const MAX_BYTES = 10 * 1024 * 1024; // 10 MB - adjust if needed

  const out: FileData[] = [];

  for (let i = 0; i < inputFiles.length; i++) {
    const file = inputFiles[i];
    try {
      console.log(`[txtToHra] converting file[${i}] name=${file.name} bytesType=${typeof file.bytes}`);

      // Normalize bytes to Uint8Array - handle ArrayBuffer | Uint8Array | string oddities
      let bytes: Uint8Array;
      if (file.bytes instanceof Uint8Array) bytes = file.bytes;
      else if (file.bytes instanceof ArrayBuffer) bytes = new Uint8Array(file.bytes);
      else if (typeof (file.bytes as any) === 'string') bytes = new TextEncoder().encode(file.bytes as any);
      else bytes = new Uint8Array(file.bytes as any);

      console.log(`[txtToHra] file[${i}] bytes.length=${bytes.length}`);
      if (bytes.length > MAX_BYTES) {
        throw new Error(`Input too large: ${bytes.length} bytes (max ${MAX_BYTES})`);
      }

      // decode text
      const txt = decoder.decode(bytes);

      // Simple transformation — keep it tiny while debugging
      const script = `<~= HRA File =~>\n<= File => ${file.name}\n${txt}'@`;
      const newName = file.name.replace(/\.[^.]+$/, "." + outputFormat.extension);

      const outBytes = encoder.encode(script);
      console.log(`[txtToHra] file[${i}] produced outBytes.length=${outBytes.length}`);

      out.push({ name: newName, bytes: outBytes } as FileData);
    } catch (err) {
      console.error(`[txtToHra] file[${i}] conversion error:`, err);
      // rethrow or push an error form — rethrow to make the failure visible to the caller
      throw err;
    }
  }

  console.log('[txtToHra] doConvert END, out.length=', out.length);
  return out;
}

export default txtToHraHandler;
