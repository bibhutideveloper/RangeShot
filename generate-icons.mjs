import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function createCRC32Table() {
  const table = new Int32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  return table;
}

const crcTable = createCRC32Table();

function crc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

function createChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);

  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);

  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(body), 0);

  return Buffer.concat([len, body, crcBuf]);
}

function generateIconPNG(size) {
  const width = size;
  const height = size;

  const rawBytes = Buffer.alloc(height * (1 + width * 4));
  let offset = 0;

  for (let y = 0; y < height; y++) {
    rawBytes[offset++] = 0; // Filter: None

    for (let x = 0; x < width; x++) {
      const radius = size * 0.2;
      const dx = Math.max(0, Math.abs(x - (width / 2)) - (width / 2 - radius));
      const dy = Math.max(0, Math.abs(y - (height / 2)) - (height / 2 - radius));
      const isInsideRounded = (dx * dx + dy * dy) <= (radius * radius);

      if (!isInsideRounded) {
        rawBytes[offset++] = 0;
        rawBytes[offset++] = 0;
        rawBytes[offset++] = 0;
        rawBytes[offset++] = 0;
        continue;
      }

      const normX = x / width;
      const normY = y / height;

      let r = Math.round(79 + (59 - 79) * normY);
      let g = Math.round(70 + (130 - 70) * normY);
      let b = Math.round(229 + (246 - 229) * normY);
      let a = 255;

      if (normY >= 0.22 && normY <= 0.28 && normX >= 0.25 && normX <= 0.75) {
        r = 16; g = 185; b = 129;
      }
      if (normY >= 0.22 && normY <= 0.38 && (Math.abs(normX - 0.25) <= 0.04 || Math.abs(normX - 0.75) <= 0.04)) {
        r = 16; g = 185; b = 129;
      }

      if (normY >= 0.72 && normY <= 0.78 && normX >= 0.25 && normX <= 0.75) {
        r = 16; g = 185; b = 129;
      }
      if (normY >= 0.62 && normY <= 0.78 && (Math.abs(normX - 0.25) <= 0.04 || Math.abs(normX - 0.75) <= 0.04)) {
        r = 16; g = 185; b = 129;
      }

      const centerX = 0.5;
      const centerY = 0.5;
      const distFromCenter = Math.sqrt((normX - centerX) ** 2 + (normY - centerY) ** 2);
      if (distFromCenter <= 0.12) {
        r = 255; g = 255; b = 255;
      }

      rawBytes[offset++] = r;
      rawBytes[offset++] = g;
      rawBytes[offset++] = b;
      rawBytes[offset++] = a;
    }
  }

  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const ihdrChunk = createChunk('IHDR', ihdr);
  const compressed = zlib.deflateSync(rawBytes, { level: 9 });
  const idatChunk = createChunk('IDAT', compressed);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

const outDir = path.resolve('public/icons');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

for (const size of [16, 48, 128]) {
  const iconBuf = generateIconPNG(size);
  const filePath = path.join(outDir, `icon${size}.png`);
  fs.writeFileSync(filePath, iconBuf);
  console.log(`Generated ${filePath} (${iconBuf.length} bytes)`);
}
