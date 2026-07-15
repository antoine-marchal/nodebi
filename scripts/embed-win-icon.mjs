import fs from 'node:fs';

import * as ResEdit from 'resedit';


const [inputPath, iconPath, outputPath] = process.argv.slice(2);

if (!inputPath || !iconPath || !outputPath) {
  console.error('Usage: node scripts/embed-win-icon.mjs <input.exe> <icon.ico> <output.exe>');
  process.exit(1);
}

const executable = ResEdit.NtExecutable.from(fs.readFileSync(inputPath));
const resources = ResEdit.NtExecutableResource.from(executable);
const icon = ResEdit.Data.IconFile.from(fs.readFileSync(iconPath));

ResEdit.Resource.IconGroupEntry.replaceIconsForResource(
  resources.entries,
  1,
  1033,
  icon.icons.map(item => item.data),
);

resources.outputResource(executable);
fs.writeFileSync(outputPath, Buffer.from(executable.generate()));
