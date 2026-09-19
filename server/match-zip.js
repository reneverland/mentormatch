const CRC_TABLE = (function () {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let j = 0; j < 8; j += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    c = CRC_TABLE[(c ^ buffer[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function dosDateTime(date) {
  const d = date instanceof Date ? date : new Date();
  const dosTime =
    (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2);
  const dosDate =
    ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return { dosTime, dosDate };
}

function u16(n) {
  const b = Buffer.alloc(2);
  b.writeUInt16LE(n & 0xffff, 0);
  return b;
}

function u32(n) {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n >>> 0, 0);
  return b;
}

// 简历已经是压缩过的 PDF，用 STORE 打 zip 即可，不引入第三方包。
function zipStore(entries) {
  const files = [];
  const now = dosDateTime(new Date());

  entries.forEach((entry) => {
    const name = Buffer.from(String(entry.name), "utf8");
    const data = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data || "");
    const crc = crc32(data);
    files.push({ name, data, crc, size: data.length, dosTime: now.dosTime, dosDate: now.dosDate });
  });

  const locals = [];
  const centrals = [];
  let offset = 0;

  files.forEach((file) => {
    const local = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x03, 0x04]),
        u16(20),
        u16(0x0800),
        u16(0),
        u16(file.dosTime),
        u16(file.dosDate),
        u32(file.crc),
        u32(file.size),
        u32(file.size),
        u16(file.name.length),
        u16(0),
        file.name,
        file.data,
      ]);
      locals.push(local);
  
      const central = Buffer.concat([
        Buffer.from([0x50, 0x4b, 0x01, 0x02]),
        u16(20),
        u16(20),
        u16(0x0800),
        u16(0),
      u16(file.dosTime),
      u16(file.dosDate),
      u32(file.crc),
      u32(file.size),
      u32(file.size),
      u16(file.name.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(offset),
      file.name,
    ]);
    centrals.push(central);
    offset += local.length;
  });

  const centralBlob = Buffer.concat(centrals);
  const eocd = Buffer.concat([
    Buffer.from([0x50, 0x4b, 0x05, 0x06]),
    u16(0),
    u16(0),
    u16(files.length),
    u16(files.length),
    u32(centralBlob.length),
    u32(offset),
    u16(0),
  ]);

  return Buffer.concat(locals.concat([centralBlob, eocd]));
}

module.exports = { zipStore };
