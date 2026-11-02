/**
 * Minimal dependency-free PDF writer (text + filled rectangles, Helvetica fonts).
 * Replaces pdf-lib, whose CommonJS/tslib build broke under Vite/Workers
 * ("Cannot destructure property '__extends'"). Pure ES module, runs anywhere.
 */
export type RGB = { r: number; g: number; b: number };
export const rgb = (r: number, g: number, b: number): RGB => ({ r, g, b });
export const StandardFonts = { Helvetica: "Helvetica", HelveticaBold: "Helvetica-Bold" } as const;
type Font = { key: string; base: string };

const WIN_ANSI: Record<string, number> = { "€": 0x80, "’": 0x92, "–": 0x96, "—": 0x97 };
function encodeText(s: string): string {
  let out = "";
  for (const ch of s) {
    let c = WIN_ANSI[ch] ?? ch.charCodeAt(0);
    if (c > 0xff || (c < 0x20 && c !== 0x09)) c = 0x3f; // "?"
    const k = String.fromCharCode(c);
    out += k === "(" || k === ")" || k === "\\" ? `\\${k}` : k;
  }
  return out;
}
const n = (v: number) => (Math.round(v * 1000) / 1000).toString();
const col = (c: RGB) => `${n(c.r)} ${n(c.g)} ${n(c.b)}`;

class Page {
  ops: string[] = [];
  constructor(public width: number, public height: number) {}
  drawText(t: string, o: { x: number; y: number; size: number; font: Font; color?: RGB }) {
    this.ops.push(`BT ${col(o.color ?? rgb(0, 0, 0))} rg /${o.font.key} ${n(o.size)} Tf ${n(o.x)} ${n(o.y)} Td (${encodeText(t)}) Tj ET`);
  }
  drawRectangle(o: { x: number; y: number; width: number; height: number; color: RGB }) {
    this.ops.push(`${col(o.color)} rg ${n(o.x)} ${n(o.y)} ${n(o.width)} ${n(o.height)} re f`);
  }
}

export class PDFDocument {
  private pages: Page[] = [];
  private fonts: Font[] = [];
  private title = "";
  static async create() { return new PDFDocument(); }
  setTitle(t: string) { this.title = t; }
  addPage([w, h]: [number, number]) { const p = new Page(w, h); this.pages.push(p); return p; }
  async embedFont(base: string): Promise<Font> {
    const f = this.fonts.find((x) => x.base === base) ?? { key: `F${this.fonts.length + 1}`, base };
    if (!this.fonts.includes(f)) this.fonts.push(f);
    return f;
  }
  async save(): Promise<Uint8Array> {
    const objs: string[] = [];
    const add = (s: string) => { objs.push(s); return objs.length; };
    const catalogId = add(""); const pagesId = add("");
    const fontIds = this.fonts.map((f) => add(`<< /Type /Font /Subtype /Type1 /BaseFont /${f.base} /Encoding /WinAnsiEncoding >>`));
    const fontRes = this.fonts.map((f, i) => `/${f.key} ${fontIds[i]} 0 R`).join(" ");
    const kids: number[] = [];
    for (const p of this.pages) {
      const stream = p.ops.join("\n");
      const cId = add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
      kids.push(add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${p.width} ${p.height}] /Resources << /Font << ${fontRes} >> >> /Contents ${cId} 0 R >>`));
    }
    objs[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
    objs[pagesId - 1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(" ")}] /Count ${kids.length} >>`;
    const infoId = add(`<< /Title (${encodeText(this.title)}) /Producer (TowIA) >>`);

    let out = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
    const offsets: number[] = [];
    objs.forEach((o, i) => { offsets.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
    const xref = out.length;
    out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
    for (const off of offsets) out += `${String(off).padStart(10, "0")} 00000 n \n`;
    out += `trailer\n<< /Size ${objs.length + 1} /Root ${catalogId} 0 R /Info ${infoId} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    const bytes = new Uint8Array(out.length);
    for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 0xff;
    return bytes;
  }
}
