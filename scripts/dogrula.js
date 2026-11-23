// Veri dosyalarını kontrol eder: her kayıtta gerekli alanlar var mı, id'ler benzersiz mi?
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ORTAK = ["id", "ad", "ozet", "aciklama", "ilginc", "foto"];
const ALANLAR = {
  AGACLAR: ["latince", "yaprak", "mevsim", "boy", "omur", "yayilis"],
  KEDILER: ["koken", "tuy", "boyut", "kilo", "omur", "karakter"],
  KOPEKLER: ["koken", "grup", "boyut", "kilo", "boy", "omur", "karakter"],
  KUSLAR: ["latince", "grup", "boy", "kanat", "agirlik", "omur", "yayilis"],
  MEMELILER: ["latince", "grup", "durum", "boy", "agirlik", "omur", "yayilis"],
  DENIZ: ["latince", "grup", "durum", "boy", "agirlik", "omur", "yayilis"],
  BOCEKLER: ["latince", "grup", "boyut", "omur", "yayilis"],
  CICEKLER: ["latince", "endemik", "tip", "ciceklenme", "boy", "yayilis"],
  SURUNGENLER: ["latince", "grup", "durum", "zehirli", "boy", "omur", "yayilis"]
};
const FOTO = ["url", "kaynak", "yazar", "lisans"];

const dizin = path.join(__dirname, "..", "data");
let hata = 0;

for (const dosya of fs.readdirSync(dizin).filter((f) => f.endsWith(".js"))) {
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(dizin, dosya), "utf8"), sandbox);
  for (const [ad, liste] of Object.entries(sandbox.window)) {
    if (!Array.isArray(liste)) continue;
    const idler = new Set();
    liste.forEach((x, i) => {
      for (const alan of ORTAK.concat(ALANLAR[ad] || [])) {
        if (x[alan] === undefined || x[alan] === "") { console.error(`${dosya} › ${ad}[${i}] eksik alan: ${alan}`); hata++; }
      }
      for (const alan of FOTO) {
        if (!x.foto || !x.foto[alan]) { console.error(`${dosya} › ${ad}[${i}] eksik foto alanı: ${alan}`); hata++; }
      }
      if (x.foto && !/^https:\/\//.test(x.foto.url)) { console.error(`${dosya} › ${x.id} foto.url https olmalı`); hata++; }
      if (typeof x.yerli !== "boolean") { console.error(`${dosya} › ${x.id} "yerli" alanı true/false olmalı`); hata++; }
      if (idler.has(x.id)) { console.error(`${dosya} › tekrar eden id: ${x.id}`); hata++; }
      idler.add(x.id);
    });
    console.log(`${dosya} › ${ad}: ${liste.length} kayıt`);
  }
}

// İngilizce içerik ve arayüz metinleri kontrolü
const ortak = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(dizin, "en.js"), "utf8"), ortak);
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "js", "i18n.js"), "utf8"), ortak);
const KAT = { AGACLAR: "agaclar", KEDILER: "kediler", KOPEKLER: "kopekler", KUSLAR: "kuslar", MEMELILER: "memeliler", DENIZ: "deniz", BOCEKLER: "bocekler", CICEKLER: "cicekler", SURUNGENLER: "surungenler" };
for (const dosya of fs.readdirSync(dizin).filter((f) => f.endsWith(".js") && f !== "en.js")) {
  const sb = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(dizin, dosya), "utf8"), sb);
  for (const [ad, liste] of Object.entries(sb.window)) {
    if (!Array.isArray(liste) || !KAT[ad]) continue;
    const en = (ortak.window.EN || {})[KAT[ad]] || {};
    liste.forEach((x) => {
      for (const alan of ["ozet", "aciklama", "ilginc"]) {
        if (!en[x.id] || !en[x.id][alan]) { console.error(`en.js › ${KAT[ad]}.${x.id} eksik İngilizce alan: ${alan}`); hata++; }
      }
    });
    console.log(`en.js › ${KAT[ad]}: ${liste.length} türün çevirisi kontrol edildi`);
  }
}
function anahtarlar(o, on) {
  return Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" ? anahtarlar(v, on + k + ".") : [on + k]));
}
const tr = anahtarlar(ortak.window.I18N.tr, ""), enK = new Set(anahtarlar(ortak.window.I18N.en, ""));
tr.filter((k) => !enK.has(k)).forEach((k) => { console.error(`i18n.js › İngilizcede eksik metin: ${k}`); hata++; });
console.log(`i18n.js › ${tr.length} arayüz metni kontrol edildi`);

if (hata) { console.error(`${hata} hata bulundu.`); process.exit(1); }
console.log("Tüm veriler geçerli ✔");
