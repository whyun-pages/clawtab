import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Buffer } from 'node:buffer';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(root, 'dist');
const releaseDir = path.join(root, 'releases');

const crcTable = new Uint32Array(256);
for (let i = 0; i < crcTable.length; i += 1) {
  let value = i;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  crcTable[i] = value >>> 0;
}

function crc32(buffer) {
  let value = 0xffffffff;
  for (const byte of buffer) {
    value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8);
  }
  return (value ^ 0xffffffff) >>> 0;
}

function toDosDateTime(date) {
  const year = Math.min(Math.max(date.getFullYear(), 1980), 2107);
  const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  return { dosDate, dosTime };
}

async function collectFiles(directory, base = directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(absolutePath, base)));
      continue;
    }

    if (entry.isFile()) {
      files.push({
        absolutePath,
        archivePath: path.relative(base, absolutePath).split(path.sep).join('/'),
      });
    }
  }

  return files.sort((left, right) => left.archivePath.localeCompare(right.archivePath));
}

function createLocalHeader({ archivePath, crc, data, dosDate, dosTime }) {
  const name = Buffer.from(archivePath, 'utf8');
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(0x0800, 6);
  header.writeUInt16LE(0, 8);
  header.writeUInt16LE(dosTime, 10);
  header.writeUInt16LE(dosDate, 12);
  header.writeUInt32LE(crc, 14);
  header.writeUInt32LE(data.length, 18);
  header.writeUInt32LE(data.length, 22);
  header.writeUInt16LE(name.length, 26);
  header.writeUInt16LE(0, 28);
  return Buffer.concat([header, name]);
}

function createCentralDirectoryHeader({ archivePath, crc, data, dosDate, dosTime, offset }) {
  const name = Buffer.from(archivePath, 'utf8');
  const header = Buffer.alloc(46);
  header.writeUInt32LE(0x02014b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(20, 6);
  header.writeUInt16LE(0x0800, 8);
  header.writeUInt16LE(0, 10);
  header.writeUInt16LE(dosTime, 12);
  header.writeUInt16LE(dosDate, 14);
  header.writeUInt32LE(crc, 16);
  header.writeUInt32LE(data.length, 20);
  header.writeUInt32LE(data.length, 24);
  header.writeUInt16LE(name.length, 28);
  header.writeUInt16LE(0, 30);
  header.writeUInt16LE(0, 32);
  header.writeUInt16LE(0, 34);
  header.writeUInt16LE(0, 36);
  header.writeUInt32LE(0, 38);
  header.writeUInt32LE(offset, 42);
  return Buffer.concat([header, name]);
}

function createEndOfCentralDirectory({ entryCount, centralDirectorySize, centralDirectoryOffset }) {
  const header = Buffer.alloc(22);
  header.writeUInt32LE(0x06054b50, 0);
  header.writeUInt16LE(0, 4);
  header.writeUInt16LE(0, 6);
  header.writeUInt16LE(entryCount, 8);
  header.writeUInt16LE(entryCount, 10);
  header.writeUInt32LE(centralDirectorySize, 12);
  header.writeUInt32LE(centralDirectoryOffset, 16);
  header.writeUInt16LE(0, 20);
  return header;
}

async function main() {
  const manifestPath = path.join(distDir, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const packageName = String(manifest.name ?? 'extension').toLowerCase().replace(/[^a-z0-9._-]+/g, '-');
  const outputPath = path.join(releaseDir, `${packageName}-v${manifest.version}.zip`);
  const files = await collectFiles(distDir);

  if (files.length === 0) {
    throw new Error('No files found in dist/. Run pnpm build before packaging.');
  }

  const manifestEntry = files.find((file) => file.archivePath === 'manifest.json');
  if (!manifestEntry) {
    throw new Error('dist/manifest.json is required at the root of the Chrome Web Store ZIP.');
  }

  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const file of files) {
    const data = await readFile(file.absolutePath);
    const stats = await stat(file.absolutePath);
    const { dosDate, dosTime } = toDosDateTime(stats.mtime);
    const entry = {
      archivePath: file.archivePath,
      crc: crc32(data),
      data,
      dosDate,
      dosTime,
      offset,
    };
    const localHeader = createLocalHeader(entry);
    localParts.push(localHeader, data);
    centralParts.push(createCentralDirectoryHeader(entry));
    offset += localHeader.length + data.length;
  }

  const centralDirectoryOffset = offset;
  const centralDirectory = Buffer.concat(centralParts);
  const endOfCentralDirectory = createEndOfCentralDirectory({
    entryCount: files.length,
    centralDirectorySize: centralDirectory.length,
    centralDirectoryOffset,
  });

  await mkdir(releaseDir, { recursive: true });
  await rm(outputPath, { force: true });
  await writeFile(outputPath, Buffer.concat([...localParts, centralDirectory, endOfCentralDirectory]));

  console.log(`Packaged ${files.length} files into ${path.relative(root, outputPath)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
