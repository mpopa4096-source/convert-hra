import * as Magick from "/node_modules/wasm-imagemagick/dist/magickApi.js";

import mime from "/node_modules/mime/dist/src/index.js";

let supportedFormats = [];

async function init () {

  const listFormats = await Magick.call([], ["convert", "-list", "format"]);
  const listDelegates = await Magick.call([], ["convert", "-list", "delegate"]);

  const delegates = listDelegates.stdout.slice(5)
    .map(c => c.split("=")[0].trim())
    .filter(c => !c.endsWith("<") && !c.includes(":"));

  const lines = listFormats.stdout.slice(2).map(c => c.trim());
  for (let line of lines) {

    let len;
    do {
      len = line.length;
      line = line.replaceAll("  ", " ");
    } while (len !== line.length);

    const parts = line.split(" ");
    if (parts.length < 2) continue;

    const format = parts[0].toLowerCase().replace("*", "");
    const flags = parts[1];
    const description = parts.slice(2).join(" ");

    if (delegates.includes(format)) continue;
    if (description.toLowerCase().includes("mpeg")) continue;

    if (flags.length !== 3 || (!flags.endsWith("+") && !flags.endsWith("-"))) continue;

    supportedFormats.push({
      name: description,
      format: format,
      extension: format,
      mime: mime.getType(format),
      from: flags.includes("r"),
      to: flags.includes("w"),
      internal: format,
    });

  }

}

async function doConvert (inputFile, inputFormat, outputFormat) {

  const command = ["convert", inputFile.name, `${outputFormat.internal}:out`];
  const image = { name: inputFile.name, content: inputFile.bytes };
  const result = await Magick.call([image], command);

  if (result.exitCode !== 0) {
    throw result.stderr.join("\n");
  }

  return result.outputFiles[0].buffer;

}

export default {
  name: "ImageMagick",
  init,
  supportedFormats,
  doConvert
};
