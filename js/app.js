(function () {
  "use strict";

  // ---------------------------------------------------------------------------
  // Ayarlar (tarayıcıda saklanır)
  // ---------------------------------------------------------------------------
  const depo = {
    al(k, varsayilan) {
      try { const v = localStorage.getItem(k); return v === null ? varsayilan : JSON.parse(v); } catch (e) { return varsayilan; }
    },
    yaz(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* depolama kapalı olabilir */ } }
  };
  const ayar = { dil: depo.al("ta-dil", "tr") === "en" ? "en" : "tr", tema: depo.al("ta-tema", "koyu") === "acik" ? "acik" : "koyu" };
  const favoriler = new Set(depo.al("ta-fav", []));

  // ---------------------------------------------------------------------------
  // Dil yardımcıları
  // ---------------------------------------------------------------------------
  const I18N = window.I18N, DEGER_EN = window.DEGER_EN, EN = window.EN || {};
  const enMi = () => ayar.dil === "en";
  const bul = (obj, yol) => yol.split(".").reduce((o, k) => (o == null ? o : o[k]), obj);
  function t(anahtar, degiskenler) {
    let s = bul(I18N[ayar.dil], anahtar);
    if (s == null) s = bul(I18N.tr, anahtar);
    if (s == null) s = anahtar;
    if (degiskenler) for (const [k, v] of Object.entries(degiskenler)) s = s.split("{" + k + "}").join(v);
    return s;
  }
  const otoEn = (s) => String(s).replace(/(\d),(\d)/g, "$1.$2").replace(/ yıl\b/g, " years");
  const deger = (v) => (enMi() ? DEGER_EN[v] || v : v);
  // Bir türün alanını seçili dilde döndürür
  function al(katId, x, alan) {
    if (!enMi()) return x[alan];
    const e = (EN[katId] || {})[x.id];
    if (e && e[alan] !== undefined) return e[alan];
    const v = x[alan];
    if (typeof v !== "string") return v;
    return DEGER_EN[v] || otoEn(v);
  }

  // ---------------------------------------------------------------------------
  // Sıralama için metinden sayı çıkarma ("30–40 m" → 4000 cm, "16–22 g" → 0,022 kg)
  // ---------------------------------------------------------------------------
  function sayi(metin, tur) {
    if (metin == null) return null;
    const s = String(metin).toLocaleLowerCase("tr");
    if (tur === "yil") {
      if (/binlerce/.test(s)) return 2000;
      if (/birkaç yüz|yüzlerce/.test(s)) return 300;
      if (/yüzyıl/.test(s)) return 100;
    }
    const sayilar = (s.match(/\d+(?:,\d+)?/g) || []).map((n) => parseFloat(n.replace(",", ".")));
    if (!sayilar.length) return null;
    let v = Math.max.apply(null, sayilar);
    if (tur === "uzunluk" && /\d\s*m\b/.test(s) && !/cm/.test(s)) v *= 100;
    if (tur === "agirlik" && /\d\s*g\b/.test(s) && !/kg/.test(s)) v /= 1000;
    if (tur === "agirlik" && /\bton/.test(s)) v *= 1000;
    return v;
  }
  const say = (l, fn) => l.filter(fn).length;
  const tehlikedeMi = (x) => ["Hassas", "Tehlikede", "Kritik tehlikede"].includes(x.durum);

  // ---------------------------------------------------------------------------
  // Kategoriler
  // ---------------------------------------------------------------------------
  const KATEGORILER = [
    {
      id: "agaclar", ikon: "🌳", veri: () => window.AGACLAR, birim: "tur", italik: true, kapak: "sedir", grup: "bitkiler",
      altBaslik: (x) => x.latince,
      etiketler: (x) => [al("agaclar", x, "yaprak"), al("agaclar", x, "mevsim")],
      bilgiler: [["f.yaprak", "yaprak"], ["f.mevsim", "mevsim"], ["f.boy", "boy"], ["f.omur", "omur"], ["f.yayilis", "yayilis", true]],
      aramaAlanlari: ["latince", "yayilis"],
      istatistik: (l) => [[l.length, "s.tur"], [say(l, (x) => x.yerli), "s.turkiyeDogal"], [say(l, (x) => x.yaprak === "İğne yapraklı"), "s.igne"]],
      siralar: [["siraBoy", "boy", "uzunluk"], ["siraOmur", "omur", "yil"]],
      filtreler: [
        ["tumu", () => true],
        ["igne", (x) => x.yaprak === "İğne yapraklı"],
        ["genis", (x) => x.yaprak === "Geniş yapraklı"],
        ["herdem", (x) => x.mevsim === "Herdem yeşil"],
        ["dokum", (x) => x.mevsim === "Yaprak döken"],
        ["turkiyeDogal", (x) => x.yerli]
      ]
    },
    {
      id: "cicekler", ikon: "🌷", veri: () => window.CICEKLER, birim: "tur", italik: true, kapak: "lale", grup: "bitkiler",
      altBaslik: (x) => x.latince,
      etiketler: (x) => [al("cicekler", x, "tip")].concat(x.endemik ? [t("endemikEt")] : []),
      bilgiler: [["f.tip", "tip"], ["f.ciceklenme", "ciceklenme"], ["f.boy", "boy", true], ["f.yayilis", "yayilis", true]],
      aramaAlanlari: ["latince", "yayilis", "tip"],
      istatistik: (l) => [[l.length, "s.tur"], [say(l, (x) => x.yerli), "s.turkiyedeGorulen"], [say(l, (x) => x.endemik), "s.endemik"]],
      siralar: [],
      filtreler: [
        ["tumu", () => true],
        ["endemik", (x) => x.endemik],
        ["soganli", (x) => x.tip === "Soğanlı ve yumrulu"],
        ["orkideler", (x) => x.tip === "Orkide"],
        ["calilar", (x) => x.tip === "Çalı"],
        ["turkiyedeYetisen", (x) => x.yerli],
        ["dunyadan", (x) => !x.yerli]
      ]
    },
    {
      id: "kediler", ikon: "🐈", veri: () => window.KEDILER, birim: "irk", italik: false, kapak: "ankara-kedisi", grup: "evcil",
      altBaslik: (x) => al("kediler", x, "koken"),
      etiketler: (x) => [al("kediler", x, "tuy"), t("boyEk", { v: deger(x.boyut) })],
      bilgiler: [["f.koken", "koken"], ["f.tuy", "tuy"], ["f.kilo", "kilo"], ["f.omur", "omur"], ["f.karakter", "karakter", true]],
      aramaAlanlari: ["koken", "karakter", "tuy"],
      istatistik: (l) => [[l.length, "s.irk"], [say(l, (x) => x.yerli), "s.turkiyeKokenli"], [say(l, (x) => /uzun/i.test(x.tuy)), "s.uzunTuylu"]],
      siralar: [["siraKilo", "kilo", "agirlik"], ["siraOmur", "omur", "yil"]],
      filtreler: [
        ["tumu", () => true],
        ["kisa", (x) => /^Kısa/.test(x.tuy)],
        ["uzun", (x) => /uzun/i.test(x.tuy)],
        ["tuysuz", (x) => x.tuy === "Tüysüz"],
        ["buyukIrk", (x) => x.boyut === "Büyük"],
        ["turkiyeKokenli", (x) => x.yerli]
      ]
    },
    {
      id: "kopekler", ikon: "🐕", veri: () => window.KOPEKLER, birim: "irk", italik: false, kapak: "kangal", grup: "evcil",
      altBaslik: (x) => al("kopekler", x, "koken"),
      etiketler: (x) => [al("kopekler", x, "grup"), t("boyEk", { v: deger(x.boyut) })],
      bilgiler: [["f.koken", "koken", true], ["f.grup", "grup"], ["f.kilo", "kilo"], ["f.omuz", "boy"], ["f.omur", "omur"], ["f.karakter", "karakter", true]],
      aramaAlanlari: ["koken", "karakter", "grup"],
      istatistik: (l) => [[l.length, "s.irk"], [say(l, (x) => x.yerli), "s.turkIrki"], [say(l, (x) => x.boyut === "Küçük"), "s.kucukIrk"]],
      siralar: [["siraKilo", "kilo", "agirlik"], ["siraBoy", "boy", "uzunluk"], ["siraOmur", "omur", "yil"]],
      filtreler: [
        ["tumu", () => true],
        ["kucuk", (x) => x.boyut === "Küçük"],
        ["orta", (x) => x.boyut === "Orta"],
        ["buyukDev", (x) => x.boyut === "Büyük" || x.boyut === "Dev"],
        ["coban", (x) => x.grup === "Çoban ve bekçi"],
        ["av", (x) => x.grup === "Av köpeği" || x.grup === "Tazı" || x.grup === "Terrier"],
        ["turkIrki", (x) => x.yerli]
      ]
    },
    {
      id: "kuslar", ikon: "🐦", veri: () => window.KUSLAR, birim: "tur", italik: true, kapak: "yalicapkini", grup: "yaban",
      altBaslik: (x) => x.latince,
      etiketler: (x) => [al("kuslar", x, "grup"), al("kuslar", x, "boy")],
      bilgiler: [["f.grup", "grup", true], ["f.boy", "boy"], ["f.kanat", "kanat"], ["f.agirlik", "agirlik"], ["f.omur", "omur"], ["f.yayilis", "yayilis", true]],
      aramaAlanlari: ["latince", "yayilis", "grup"],
      istatistik: (l) => [[l.length, "s.tur"], [say(l, (x) => x.yerli), "s.turkiyedeGorulen"], [say(l, (x) => x.grup === "Yırtıcı kuş"), "s.yirtici"]],
      siralar: [["siraBoy", "boy", "uzunluk"], ["siraKanat", "kanat", "uzunluk"], ["siraKilo", "agirlik", "agirlik"], ["siraOmur", "omur", "yil"]],
      filtreler: [
        ["tumu", () => true],
        ["yirtici", (x) => x.grup === "Yırtıcı kuş"],
        ["su", (x) => x.grup === "Su ve sulak alan kuşu"],
        ["otucu", (x) => x.grup === "Ötücü kuş"],
        ["papagan", (x) => x.grup === "Papağan"],
        ["turkiyede", (x) => x.yerli],
        ["egzotik", (x) => !x.yerli]
      ]
    },
    {
      id: "memeliler", ikon: "🐻", veri: () => window.MEMELILER, birim: "tur", italik: true, kapak: "vasak", grup: "yaban",
      altBaslik: (x) => x.latince,
      etiketler: (x) => [al("memeliler", x, "grup"), al("memeliler", x, "durum")],
      bilgiler: [["f.beslenme", "grup"], ["f.durum", "durum"], ["f.boy", "boy"], ["f.agirlik", "agirlik"], ["f.omur", "omur"], ["f.yayilis", "yayilis", true]],
      aramaAlanlari: ["latince", "yayilis", "grup"],
      istatistik: (l) => [[l.length, "s.tur"], [say(l, (x) => x.yerli), "s.turkiyedeYasayan"], [say(l, tehlikedeMi), "s.tehlikede"]],
      siralar: [["siraBoy", "boy", "uzunluk"], ["siraKilo", "agirlik", "agirlik"], ["siraOmur", "omur", "yil"]],
      filtreler: [
        ["tumu", () => true],
        ["turkiyedeYasayan", (x) => x.yerli],
        ["etcil", (x) => x.grup === "Etçil"],
        ["otcul", (x) => x.grup === "Otçul"],
        ["hepcil", (x) => x.grup === "Hepçil"],
        ["tehlikede", (x) => tehlikedeMi(x)],
        ["dunyadan", (x) => !x.yerli]
      ]
    },
    {
      id: "deniz", ikon: "🐬", veri: () => window.DENIZ, birim: "tur", italik: true, kapak: "caretta", grup: "yaban",
      altBaslik: (x) => x.latince,
      etiketler: (x) => [al("deniz", x, "grup"), al("deniz", x, "durum")],
      bilgiler: [["f.grup", "grup"], ["f.durum", "durum"], ["f.boy", "boy"], ["f.agirlik", "agirlik"], ["f.omur", "omur"], ["f.yayilis", "yayilis", true]],
      aramaAlanlari: ["latince", "yayilis", "grup"],
      istatistik: (l) => [[l.length, "s.tur"], [say(l, (x) => x.yerli), "s.turkiyeDenizleri"], [say(l, tehlikedeMi), "s.tehlikede"]],
      siralar: [["siraBoy", "boy", "uzunluk"], ["siraKilo", "agirlik", "agirlik"], ["siraOmur", "omur", "yil"]],
      filtreler: [
        ["tumu", () => true],
        ["turkiyeDenizleri", (x) => x.yerli],
        ["baliklar", (x) => x.grup === "Balık"],
        ["kopekbaliklari", (x) => x.grup === "Köpekbalığı ve vatoz"],
        ["denizMemelileri", (x) => x.grup === "Deniz memelisi"],
        ["kaplumbagalar", (x) => x.grup === "Deniz kaplumbağası"],
        ["omurgasizlar", (x) => x.grup === "Omurgasız"],
        ["tehlikede", (x) => tehlikedeMi(x)]
      ]
    },
    {
      id: "bocekler", ikon: "🦋", veri: () => window.BOCEKLER, birim: "tur", italik: true, kapak: "kirlangickuyruk", grup: "yaban",
      altBaslik: (x) => x.latince,
      etiketler: (x) => [al("bocekler", x, "grup")],
      bilgiler: [["f.grup", "grup"], ["f.boyut", "boyut"], ["f.omur", "omur", true], ["f.yayilis", "yayilis", true]],
      aramaAlanlari: ["latince", "yayilis", "grup"],
      istatistik: (l) => [[l.length, "s.tur"], [say(l, (x) => x.yerli), "s.turkiyedeGorulen"], [say(l, (x) => x.grup === "Kelebek" || x.grup === "Güve"), "s.kelebek"]],
      siralar: [["siraBoyut", "boyut", "uzunluk"]],
      filtreler: [
        ["tumu", () => true],
        ["kelebekler", (x) => x.grup === "Kelebek" || x.grup === "Güve"],
        ["kinkanatlilar", (x) => x.grup === "Kınkanatlı"],
        ["arilar", (x) => x.grup === "Arı, eşekarısı ve karınca"],
        ["digerBocekler", (x) => x.grup === "Diğer böcekler"],
        ["turkiyede", (x) => x.yerli],
        ["dunyadan", (x) => !x.yerli]
      ]
    },
    {
      id: "surungenler", ikon: "🦎", veri: () => window.SURUNGENLER, birim: "tur", italik: true, kapak: "bukalemun", grup: "yaban",
      altBaslik: (x) => x.latince,
      etiketler: (x) => [al("surungenler", x, "grup")].concat(x.zehirli ? [t("zehirliEt")] : []),
      bilgiler: [["f.grup", "grup"], ["f.durum", "durum"], ["f.boy", "boy"], ["f.omur", "omur"], ["f.yayilis", "yayilis", true]],
      aramaAlanlari: ["latince", "yayilis", "grup"],
      istatistik: (l) => [[l.length, "s.tur"], [say(l, (x) => x.yerli), "s.turkiyedeYasayan"], [say(l, (x) => x.grup === "Kurbağa" || x.grup === "Semender"), "s.amfibi"]],
      siralar: [["siraBoy", "boy", "uzunluk"], ["siraOmur", "omur", "yil"]],
      filtreler: [
        ["tumu", () => true],
        ["kertenkeleler", (x) => x.grup === "Kertenkele"],
        ["yilanlar", (x) => x.grup === "Yılan"],
        ["kaplumbagaTimsah", (x) => x.grup === "Kaplumbağa" || x.grup === "Timsah"],
        ["amfibiler", (x) => x.grup === "Kurbağa" || x.grup === "Semender"],
        ["zehirli", (x) => x.zehirli],
        ["turkiyedeYasayan", (x) => x.yerli],
        ["dunyadan", (x) => !x.yerli]
      ]
    }
  ];
  const katBul = (id) => KATEGORILER.find((k) => k.id === id);
  const hazirMi = (k) => Array.isArray(k.veri());
  const turBul = (katId, id) => { const k = katBul(katId); return k && hazirMi(k) ? k.veri().find((x) => x.id === id) : null; };
  const tumTurler = () => KATEGORILER.filter(hazirMi).flatMap((k) => k.veri().map((x) => ({ k, x })));

  // ---------------------------------------------------------------------------
  // Genel yardımcılar
  // ---------------------------------------------------------------------------
  const $ = (s, kok) => (kok || document).querySelector(s);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const norm = (s) => String(s).toLocaleLowerCase("tr").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ı/g, "i");
  const ad = (k, x) => al(k.id, x, "ad");
  const konum = (x) => (x.foto.konum ? ` style="object-position:${esc(x.foto.konum)}"` : "");
  const favAnahtar = (k, x) => k.id + "/" + x.id;
  const KALP = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7.5-4.6-9.6-9.1C.8 8.4 2.9 4.5 6.6 4.1c2.1-.2 3.9.9 5.4 2.7 1.5-1.8 3.3-2.9 5.4-2.7 3.7.4 5.8 4.3 4.2 7.8C19.5 16.4 12 21 12 21z"/></svg>';

  function aramaMetni(k, x) {
    const parcalar = [x.ad, ad(k, x)];
    k.aramaAlanlari.forEach((a) => { parcalar.push(x[a]); parcalar.push(al(k.id, x, a)); });
    return norm(parcalar.join(" "));
  }

  const el = {
    html: document.documentElement,
    cats: $("#cats"), araclar: $("#araclar"), app: $("#app"), footer: $("#footer"),
    modal: $("#modal"), modalBody: $("#modal-body"), modalClose: $("#modal-close")
  };

  const durum = {
    anahtar: null,       // şu an çizili sayfanın anahtarı
    donus: "#anasayfa",  // detay penceresi kapanınca dönülecek adres
    ustteAc: false,      // detay, mevcut sayfanın üstünde açılsın mı
    sessiz: false,       // pencere kod tarafından kapatılıyor
    acikTur: null,       // { k, x }
    liste: { filtre: 0, arama: "", sira: "" }
  };

  // ---------------------------------------------------------------------------
  // Kart
  // ---------------------------------------------------------------------------
  function kart(k, x, i, katEtiketi) {
    const anahtar = favAnahtar(k, x);
    const fav = favoriler.has(anahtar);
    const no = typeof i === "number" ? `<span class="num">${String(i + 1).padStart(2, "0")}</span>` : "";
    return `<article class="card" data-kat="${k.id}" data-id="${esc(x.id)}" tabindex="0" role="button" aria-label="${esc(ad(k, x))}">
      <div class="ph" data-ikon="${k.ikon}">
        <img src="${esc(x.foto.url)}" alt="${esc(ad(k, x))}" loading="lazy" referrerpolicy="no-referrer"${konum(x)}>
        <div class="rozetler">${no}${x.yerli ? `<span class="native">${esc(t(k.id + ".rozet"))}</span>` : ""}</div>
        <button class="fav${fav ? " on" : ""}" type="button" data-fav="${anahtar}" aria-pressed="${fav}" aria-label="${esc(t(fav ? "favCikar" : "favEkle"))}" title="${esc(t(fav ? "favCikar" : "favEkle"))}">${KALP}</button>
        <div class="info">
          ${katEtiketi ? `<span class="kat-etiket">${k.ikon} ${esc(t(k.id + ".ad"))}</span>` : ""}
          <h3>${esc(ad(k, x))}</h3>
          <div class="latin${k.italik ? "" : " plain"}">${esc(k.altBaslik(x))}</div>
          <div class="tags">${k.etiketler(x).map((e) => `<span class="tag">${esc(e)}</span>`).join("")}</div>
        </div>
      </div>
    </article>`;
  }

  function resimleriBagla(kok) {
    kok.querySelectorAll("img:not([data-bagli])").forEach((img) => {
      img.dataset.bagli = "1";
      const bitti = () => img.classList.add("loaded");
      if (img.complete && img.naturalWidth) bitti();
      img.addEventListener("load", bitti);
      img.addEventListener("error", () => img.parentElement.classList.add("broken"));
    });
  }

  // ---------------------------------------------------------------------------
  // Üst bar
  // ---------------------------------------------------------------------------
  const MENU_GRUPLARI = [
    { id: "bitkiler", ikon: "🌿", ad: "grpBitkiler" },
    { id: "evcil", ikon: "🏠", ad: "grpEvcil" },
    { id: "yaban", ikon: "🦊", ad: "grpYaban" }
  ];
  let acikGrup = null;
  function grupAc(id) {
    acikGrup = id;
    document.querySelectorAll("#cats .grup").forEach((g) => {
      const acik = g.dataset.grup === id;
      g.classList.toggle("acik", acik);
      g.querySelector(".grup-btn").setAttribute("aria-expanded", String(acik));
    });
  }
  function ustBarCiz() {
    const r = rota();
    const aktifKat = r.sayfa === "kategori" || r.sayfa === "detay" ? r.kat : null;
    const katLink = (k) => `<a class="cat${aktifKat === k.id ? " active" : ""}" href="#${k.id}" role="menuitem"><span aria-hidden="true">${k.ikon}</span>${esc(t(k.id + ".ad"))}${hazirMi(k) ? "" : `<span class="soon">${esc(t("yakinda"))}</span>`}</a>`;
    el.cats.innerHTML = MENU_GRUPLARI.map((g) => {
      const ks = KATEGORILER.filter((k) => k.grup === g.id);
      if (!ks.length) return "";
      const aktif = ks.some((k) => k.id === aktifKat) ? " active" : "";
      return `<div class="grup${acikGrup === g.id ? " acik" : ""}" data-grup="${g.id}">
        <button type="button" class="grup-btn${aktif}" aria-haspopup="true" aria-expanded="${acikGrup === g.id}"><span aria-hidden="true">${g.ikon}</span>${esc(t(g.ad))}<span class="ok" aria-hidden="true">▾</span></button>
        <div class="grup-menu" role="menu">${ks.map(katLink).join("")}</div>
      </div>`;
    }).join("");
    const favAktif = r.sayfa === "favoriler" ? " active" : "";
    el.araclar.innerHTML = `
      <a class="arac fav-link${favAktif}" href="#favoriler" title="${esc(t("favoriler"))}" aria-label="${esc(t("favoriler"))}">${KALP}<span class="sayac" id="fav-sayac">${favoriler.size}</span></a>
      <button class="arac" type="button" id="btn-rastgele" title="${esc(t("rastgele"))}" aria-label="${esc(t("rastgele"))}">
        <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="8" cy="8" r="1.6"/><circle cx="16" cy="16" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="16" cy="8" r="1.6"/><circle cx="8" cy="16" r="1.6"/></svg>
      </button>
      <button class="arac" type="button" id="btn-tema" title="${esc(t(ayar.tema === "koyu" ? "temaAc" : "temaKoyu"))}" aria-label="${esc(t(ayar.tema === "koyu" ? "temaAc" : "temaKoyu"))}">
        ${ayar.tema === "koyu"
          ? '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.5"/><g stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/></g></svg>'
          : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11z"/></svg>'}
      </button>
      <button class="arac dil" type="button" id="btn-dil" title="${esc(t("dil"))}" aria-label="${esc(t("dil"))}">${esc(t("dilKisa"))}</button>`;
    el.footer.innerHTML = `<p>${t("footer", { link: '<a href="https://commons.wikimedia.org" target="_blank" rel="noopener">Wikimedia Commons</a>' })}</p>`;
  }

  function favSayacGuncelle() {
    const s = $("#fav-sayac");
    if (s) s.textContent = favoriler.size;
  }

  // ---------------------------------------------------------------------------
  // Yönlendirme
  //   #anasayfa · #agaclar · #agaclar/sedir · #favoriler · #karsilastir/kopekler/kangal,akbas
  // ---------------------------------------------------------------------------
  function rota() {
    let h = location.hash.replace(/^#/, "");
    try { h = decodeURIComponent(h); } catch (e) { /* geçersiz adres */ }
    const p = h.split("/");
    if (!h || p[0] === "anasayfa") return { sayfa: "anasayfa" };
    if (p[0] === "favoriler") return { sayfa: "favoriler" };
    if (p[0] === "karsilastir") {
      const k = katBul(p[1]) && hazirMi(katBul(p[1])) ? p[1] : "agaclar";
      return { sayfa: "karsilastir", kat: k, ids: (p[2] || "").split(",").filter(Boolean) };
    }
    const k = katBul(p[0]);
    if (k) return { sayfa: "kategori", kat: k.id, id: p[1] || null };
    return { sayfa: "anasayfa" };
  }
  const sayfaAnahtari = (r) => r.sayfa === "kategori" ? "kategori:" + r.kat
    : r.sayfa === "karsilastir" ? "karsilastir:" + r.kat + ":" + r.ids.join(",") : r.sayfa;

  function yonlendir() {
    const r = rota();
    // Detay, mevcut sayfanın üstünde açılıyor (karttan, rastgele butonundan vb.)
    if (r.sayfa === "kategori" && r.id && durum.ustteAc && durum.anahtar) {
      durum.ustteAc = false;
      const x = turBul(r.kat, r.id);
      if (x) { detayAc(katBul(r.kat), x); return; }
    }
    durum.ustteAc = false;
    const anahtar = sayfaAnahtari(r);
    if (anahtar !== durum.anahtar) {
      if (r.sayfa === "kategori" && (!durum.anahtar || durum.anahtar !== anahtar)) durum.liste = { filtre: 0, arama: "", sira: "" };
      sayfaCiz(r);
      const oncekiVar = durum.anahtar !== null;
      durum.anahtar = anahtar;
      if (oncekiVar) window.scrollTo(0, 0);
    }
    ustBarCiz();
    if (r.sayfa === "kategori" && r.id) {
      const x = turBul(r.kat, r.id);
      if (x) { durum.donus = "#" + r.kat; detayAc(katBul(r.kat), x); return; }
    }
    if (el.modal.open) { durum.sessiz = true; el.modal.close(); }
  }

  function turAc(k, x) {
    durum.donus = location.hash && !rota().id ? location.hash : (durum.donus || "#anasayfa");
    durum.ustteAc = true;
    const hedef = "#" + k.id + "/" + x.id;
    if (location.hash === hedef) { durum.ustteAc = false; detayAc(k, x); }
    else location.hash = hedef;
  }

  function sayfaCiz(r) {
    document.title = (r.sayfa === "kategori" ? t(r.kat + ".baslik") + " — " : r.sayfa === "favoriler" ? t("favBaslik") + " — " : r.sayfa === "karsilastir" ? t("kBaslik") + " — " : "") + t("siteAdi");
    if (r.sayfa === "anasayfa") anasayfaCiz();
    else if (r.sayfa === "favoriler") favorilerCiz();
    else if (r.sayfa === "karsilastir") karsilastirCiz(r);
    else kategoriCiz(katBul(r.kat));
    resimleriBagla(el.app);
  }

  // Dil/tema değişince her şeyi yeniden çiz
  function hepsiniYenile() {
    el.html.lang = ayar.dil;
    el.html.dataset.tema = ayar.tema;
    const acik = el.modal.open ? durum.acikTur : null;
    durum.anahtar = null;
    const r = rota();
    sayfaCiz(r);
    durum.anahtar = sayfaAnahtari(r);
    ustBarCiz();
    if (acik) detayAc(acik.k, acik.x);
  }

  // ---------------------------------------------------------------------------
  // Ana sayfa
  // ---------------------------------------------------------------------------
  function gununTuru() {
    const tum = tumTurler();
    const gun = Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000);
    return tum[(gun * 7) % tum.length];
  }

  function anasayfaCiz() {
    const toplam = tumTurler().length;
    const g = gununTuru();
    el.app.innerHTML = `
      <section class="hero home-hero">
        <span class="eyebrow">${esc(t("homeEyebrow"))}</span>
        <h1>${esc(t("homeBaslik"))}</h1>
        <p>${esc(t("homeAlt", { n: toplam }))}</p>
        <label class="search buyuk">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.5 3a7.5 7.5 0 0 1 5.96 12.05l4.25 4.24-1.42 1.42-4.24-4.25A7.5 7.5 0 1 1 10.5 3zm0 2a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11z"/></svg>
          <input id="genel-ara" type="search" placeholder="${esc(t("genelAra"))}" autocomplete="off">
        </label>
      </section>
      <section id="ara-sonuc" hidden>
        <p class="count" id="ara-sayi"></p>
        <div class="grid" id="ara-grid"></div>
      </section>
      <div id="home-govde">
        <h2 class="bolum">${esc(t("kategoriler"))}</h2>
        <div class="kat-grid">${KATEGORILER.filter(hazirMi).map((k) => {
          const x = turBul(k.id, k.kapak) || k.veri()[0];
          const n = k.veri().length;
          return `<a class="kat-kart" href="#${k.id}">
            <img src="${esc(x.foto.url)}" alt="" loading="lazy" referrerpolicy="no-referrer"${konum(x)}>
            <div class="kat-kart-yazi"><span class="kat-ikon" aria-hidden="true">${k.ikon}</span>
              <h3>${esc(t(k.id + ".ad"))}</h3><p>${esc(t(k.birim === "tur" ? "turSayisi" : "irkSayisi", { n }))}</p></div>
          </a>`;
        }).join("")}</div>
        <h2 class="bolum">${esc(t("gununTuru"))}</h2>
        <article class="gunun">
          <div class="gunun-foto"><img src="${esc(g.x.foto.url)}" alt="${esc(ad(g.k, g.x))}" referrerpolicy="no-referrer"${konum(g.x)}></div>
          <div class="gunun-yazi">
            <span class="kat-etiket">${g.k.ikon} ${esc(t(g.k.id + ".ad"))}</span>
            <h3>${esc(ad(g.k, g.x))}</h3>
            <div class="latin${g.k.italik ? "" : " plain"}">${esc(g.k.altBaslik(g.x))}</div>
            <p>${esc(al(g.k.id, g.x, "ozet"))}</p>
            <div class="eylemler">
              <button class="btn birincil" type="button" data-ac="${g.k.id}/${esc(g.x.id)}">${esc(t("detay"))}</button>
              <button class="btn" type="button" data-rastgele="1">${esc(t("rastgele"))}</button>
            </div>
          </div>
        </article>
      </div>`;
  }

  function genelAramaCiz(q) {
    const kutu = $("#ara-sonuc"), govde = $("#home-govde");
    if (!kutu) return;
    const nq = norm(q.trim());
    if (!nq) { kutu.hidden = true; govde.hidden = false; return; }
    const sonuc = tumTurler().filter(({ k, x }) => aramaMetni(k, x).includes(nq));
    kutu.hidden = false; govde.hidden = true;
    $("#ara-sayi").textContent = t("sonuc", { n: sonuc.length });
    $("#ara-grid").innerHTML = sonuc.length
      ? sonuc.map(({ k, x }) => kart(k, x, null, true)).join("")
      : `<div class="empty">${esc(t("sonucYok"))}</div>`;
    resimleriBagla(kutu);
  }

  // ---------------------------------------------------------------------------
  // Kategori sayfası
  // ---------------------------------------------------------------------------
  function kategoriCiz(k) {
    if (!hazirMi(k)) {
      el.app.innerHTML = `<section class="hero"><span class="eyebrow">${esc(t("kategori"))} · ${k.ikon}</span><h1>${esc(t(k.id + ".baslik"))}</h1></section>
        <div class="coming"><div class="big">${k.ikon}</div><h2>${esc(t("yakindaBaslik", { ad: t(k.id + ".ad") }))}</h2><p>${esc(t("yakindaAlt"))}</p></div>`;
      return;
    }
    const st = k.istatistik(k.veri());
    el.app.innerHTML = `
      <section class="hero">
        <span class="eyebrow">${esc(t("kategori"))} · ${k.ikon}</span>
        <h1>${esc(t(k.id + ".baslik"))}</h1>
        <p>${esc(t(k.id + ".alt"))}</p>
        <div class="stats">${st.map(([n, a]) => `<div class="stat"><b>${n}</b><span>${esc(t(a))}</span></div>`).join("")}</div>
      </section>
      <section class="toolbar">
        <label class="search">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.5 3a7.5 7.5 0 0 1 5.96 12.05l4.25 4.24-1.42 1.42-4.24-4.25A7.5 7.5 0 1 1 10.5 3zm0 2a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11z"/></svg>
          <input id="search" type="search" placeholder="${esc(t(k.id + ".ara"))}" autocomplete="off" value="${esc(durum.liste.arama)}">
        </label>
        <label class="sirala">
          <span>${esc(t("sirala"))}</span>
          <select id="sira">
            <option value="">${esc(t("siraVarsayilan"))}</option>
            <option value="ad">${esc(t("siraAd"))}</option>
            ${k.siralar.map(([etiket, alan]) => `<option value="${alan}">${esc(t(etiket))}</option>`).join("")}
          </select>
        </label>
        <div class="filters" id="filters" role="group"></div>
      </section>
      <p class="count" id="count"></p>
      <section class="grid" id="grid" aria-live="polite"></section>`;
    $("#sira").value = durum.liste.sira;
    filtreCiz(k);
    listeCiz(k);
  }

  function filtreCiz(k) {
    $("#filters").innerHTML = k.filtreler.map(([etiket], i) =>
      `<button class="chip${i === durum.liste.filtre ? " on" : ""}" data-i="${i}" type="button">${esc(t("flt." + etiket))}</button>`
    ).join("");
  }

  function siralanmis(k, liste) {
    const s = durum.liste.sira;
    if (!s) return liste;
    if (s === "ad") return liste.slice().sort((a, b) => ad(k, a).localeCompare(ad(k, b), ayar.dil));
    const tanim = k.siralar.find(([, alan]) => alan === s);
    if (!tanim) return liste;
    const tur = tanim[2];
    return liste.slice().sort((a, b) => {
      const va = sayi(a[s], tur), vb = sayi(b[s], tur);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      return vb - va;
    });
  }

  function listeCiz(k) {
    const liste = k.veri();
    const f = k.filtreler[durum.liste.filtre] || k.filtreler[0];
    const q = norm(durum.liste.arama.trim());
    const sonuc = siralanmis(k, liste.filter((x) => f[1](x) && (!q || aramaMetni(k, x).includes(q))));
    $("#count").textContent = t("gosteriliyor", { n: sonuc.length, birim: t(k.birim) });
    $("#grid").innerHTML = sonuc.length
      ? sonuc.map((x) => kart(k, x, liste.indexOf(x))).join("")
      : `<div class="empty">${esc(t("sonucYok"))}</div>`;
    resimleriBagla($("#grid"));
  }

  // ---------------------------------------------------------------------------
  // Favoriler
  // ---------------------------------------------------------------------------
  function favorilerCiz() {
    const gruplar = KATEGORILER.filter(hazirMi).map((k) => ({ k, l: k.veri().filter((x) => favoriler.has(favAnahtar(k, x))) })).filter((g) => g.l.length);
    el.app.innerHTML = `
      <section class="hero">
        <span class="eyebrow">♥</span>
        <h1>${esc(t("favBaslik"))}</h1>
        <p>${esc(t("favAlt"))}</p>
        ${favoriler.size ? `<div class="eylemler"><button class="btn" type="button" id="fav-temizle">${esc(t("favTemizle"))}</button></div>` : ""}
      </section>
      ${gruplar.length ? gruplar.map(({ k, l }) => `
        <h2 class="bolum">${k.ikon} ${esc(t(k.id + ".ad"))} <span class="bolum-sayi">${l.length}</span></h2>
        <div class="grid">${l.map((x) => kart(k, x, null, false)).join("")}</div>`).join("")
      : `<div class="coming"><div class="big">♡</div><p>${esc(t("favBos"))}</p></div>`}`;
  }

  function favDegistir(anahtar) {
    if (favoriler.has(anahtar)) favoriler.delete(anahtar); else favoriler.add(anahtar);
    depo.yaz("ta-fav", Array.from(favoriler));
    const on = favoriler.has(anahtar);
    document.querySelectorAll(`[data-fav="${anahtar}"]`).forEach((b) => {
      b.classList.toggle("on", on);
      b.setAttribute("aria-pressed", on);
      const yazi = t(on ? "favCikar" : "favEkle");
      b.setAttribute("aria-label", yazi);
      b.title = yazi;
      const etiket = b.querySelector(".btn-yazi");
      if (etiket) etiket.textContent = yazi;
    });
    favSayacGuncelle();
    if (rota().sayfa === "favoriler" && !el.modal.open) { favorilerCiz(); resimleriBagla(el.app); }
    else if (rota().sayfa === "favoriler") durum.favYenile = true;
  }

  // ---------------------------------------------------------------------------
  // Karşılaştırma
  // ---------------------------------------------------------------------------
  function karsilastirCiz(r) {
    const k = katBul(r.kat);
    const liste = k.veri();
    const secili = [0, 1].map((i) => liste.find((x) => x.id === r.ids[i]) || liste[i]);
    const secim = (i) => `<select class="k-sec" data-taraf="${i}" aria-label="${esc(t("kSec"))}">
        ${liste.map((x) => `<option value="${esc(x.id)}"${x.id === secili[i].id ? " selected" : ""}>${esc(ad(k, x))}</option>`).join("")}
      </select>`;
    const sutun = (x) => `<button class="k-foto" type="button" data-ac="${k.id}/${esc(x.id)}">
        <img src="${esc(x.foto.url)}" alt="${esc(ad(k, x))}" referrerpolicy="no-referrer"${konum(x)}>
        <span class="k-ad">${esc(ad(k, x))}</span>
        <span class="latin${k.italik ? "" : " plain"}">${esc(k.altBaslik(x))}</span>
      </button>`;
    const satirlar = [["ozet", "ozet"]].concat(k.bilgiler.map(([e, a]) => [e, a]));
    el.app.innerHTML = `
      <section class="hero">
        <span class="eyebrow">⇄</span>
        <h1>${esc(t("kBaslik"))}</h1>
        <p>${esc(t("kAlt"))}</p>
      </section>
      <div class="filters k-kategori">${KATEGORILER.filter(hazirMi).map((kk) => `<a class="chip${kk.id === k.id ? " on" : ""}" href="#karsilastir/${kk.id}">${kk.ikon} ${esc(t(kk.id + ".ad"))}</a>`).join("")}</div>
      <div class="karsilastir">
        <div class="k-ust"><div class="k-bos"></div><div>${secim(0)}</div><div>${secim(1)}</div></div>
        <div class="k-ust k-fotolar"><div class="k-bos"></div><div>${sutun(secili[0])}</div><div>${sutun(secili[1])}</div></div>
        ${satirlar.map(([etiket, alan]) => `
          <div class="k-satir">
            <div class="k-etiket">${esc(alan === "ozet" ? t("ozet") : t(etiket))}</div>
            <div>${esc(al(k.id, secili[0], alan))}</div>
            <div>${esc(al(k.id, secili[1], alan))}</div>
          </div>`).join("")}
      </div>`;
  }

  // ---------------------------------------------------------------------------
  // Detay penceresi
  // ---------------------------------------------------------------------------
  function detayAc(k, x) {
    durum.acikTur = { k, x };
    const anahtar = favAnahtar(k, x);
    const fav = favoriler.has(anahtar);
    const liste = k.veri();
    const diger = liste[(liste.indexOf(x) + 1) % liste.length];
    el.modalBody.innerHTML = `
      <div class="m-photo">
        <img src="${esc(x.foto.url)}" alt="${esc(ad(k, x))}" referrerpolicy="no-referrer"${konum(x)}>
        <div class="m-credit">${esc(t("fotograf"))}: ${esc(x.foto.yazar)} · ${esc(deger(x.foto.lisans))} ·
          <a href="${esc(x.foto.kaynak)}" target="_blank" rel="noopener">${esc(t("kaynak"))}</a></div>
      </div>
      <div class="m-text">
        <span class="kat-etiket">${k.ikon} ${esc(t(k.id + ".ad"))}</span>
        <h2 id="m-title">${esc(ad(k, x))}</h2>
        <div class="latin${k.italik ? "" : " plain"}">${esc(k.altBaslik(x))}</div>
        <div class="eylemler m-eylemler">
          <button class="btn fav-btn${fav ? " on" : ""}" type="button" data-fav="${anahtar}" aria-pressed="${fav}">${KALP}<span class="btn-yazi">${esc(t(fav ? "favCikar" : "favEkle"))}</span></button>
          <a class="btn" href="#karsilastir/${k.id}/${esc(x.id)},${esc(diger.id)}" data-karsilastir="1">⇄ ${esc(t("karsilastir"))}</a>
          <button class="btn" type="button" id="link-kopyala">🔗 <span class="btn-yazi">${esc(t("linkKopyala"))}</span></button>
        </div>
        <p class="lead">${esc(al(k.id, x, "ozet"))}</p>
        <div class="facts">${k.bilgiler.map(([etiket, alan, genis]) =>
          `<div class="fact${genis ? " wide" : ""}"><span>${esc(t(etiket))}</span><b>${esc(al(k.id, x, alan))}</b></div>`).join("")}</div>
        <p>${esc(al(k.id, x, "aciklama"))}</p>
        <div class="did"><b>${esc(t("ilginc"))}</b>${esc(al(k.id, x, "ilginc"))}</div>
      </div>`;
    el.modalClose.setAttribute("aria-label", t("kapat"));
    if (!el.modal.open) {
      if (typeof el.modal.showModal === "function") el.modal.showModal();
      else el.modal.setAttribute("open", "");
    }
    el.modalBody.scrollTop = 0;
    const metin = el.modal.querySelector(".m-text");
    if (metin) metin.scrollTop = 0;
  }

  function kapat() {
    if (typeof el.modal.close === "function") el.modal.close();
    else { el.modal.removeAttribute("open"); pencereKapandi(); }
  }

  function pencereKapandi() {
    durum.acikTur = null;
    if (durum.sessiz) { durum.sessiz = false; return; }
    if (rota().id) location.hash = durum.donus || "#anasayfa";
    if (durum.favYenile) { durum.favYenile = false; if (rota().sayfa === "favoriler") { favorilerCiz(); resimleriBagla(el.app); } }
  }

  function linkKopyala(btn) {
    const url = location.href;
    const bildir = () => { const y = btn.querySelector(".btn-yazi"); if (y) { y.textContent = t("linkKopyalandi"); setTimeout(() => { y.textContent = t("linkKopyala"); }, 1800); } };
    const yedek = () => {
      const g = document.createElement("textarea");
      g.value = url; g.setAttribute("readonly", ""); g.style.position = "fixed"; g.style.opacity = "0";
      el.modal.appendChild(g); g.select();
      try { document.execCommand("copy"); bildir(); } catch (e) { /* kopyalama desteklenmiyor */ }
      g.remove();
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(bildir, yedek);
    else yedek();
  }

  function rastgeleAc() {
    const tum = tumTurler();
    let s = tum[Math.floor(Math.random() * tum.length)];
    if (durum.acikTur && s.x === durum.acikTur.x) s = tum[(tum.indexOf(s) + 1) % tum.length];
    turAc(s.k, s.x);
  }

  // ---------------------------------------------------------------------------
  // Olaylar
  // ---------------------------------------------------------------------------
  function kartTiklandi(e) {
    const favBtn = e.target.closest("[data-fav]");
    if (favBtn) { e.preventDefault(); e.stopPropagation(); favDegistir(favBtn.dataset.fav); return true; }
    const ac = e.target.closest("[data-ac]");
    if (ac) { const [kId, id] = ac.dataset.ac.split("/"); const x = turBul(kId, id); if (x) turAc(katBul(kId), x); return true; }
    if (e.target.closest("[data-rastgele]")) { rastgeleAc(); return true; }
    const c = e.target.closest(".card");
    if (c) { const x = turBul(c.dataset.kat, c.dataset.id); if (x) turAc(katBul(c.dataset.kat), x); return true; }
    return false;
  }

  el.app.addEventListener("click", (e) => {
    if (kartTiklandi(e)) return;
    const chip = e.target.closest("#filters .chip");
    if (chip) {
      durum.liste.filtre = Number(chip.dataset.i);
      const k = katBul(rota().kat);
      filtreCiz(k); listeCiz(k);
      return;
    }
    if (e.target.closest("#fav-temizle")) {
      favoriler.clear(); depo.yaz("ta-fav", []);
      favSayacGuncelle(); favorilerCiz();
    }
  });
  el.app.addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === " ") && e.target.classList && e.target.classList.contains("card")) {
      e.preventDefault();
      const x = turBul(e.target.dataset.kat, e.target.dataset.id);
      if (x) turAc(katBul(e.target.dataset.kat), x);
    }
  });
  el.app.addEventListener("input", (e) => {
    if (e.target.id === "search") { durum.liste.arama = e.target.value; listeCiz(katBul(rota().kat)); }
    else if (e.target.id === "genel-ara") genelAramaCiz(e.target.value);
  });
  el.app.addEventListener("change", (e) => {
    if (e.target.id === "sira") { durum.liste.sira = e.target.value; listeCiz(katBul(rota().kat)); }
    else if (e.target.classList.contains("k-sec")) {
      const r = rota();
      const secimler = Array.from(document.querySelectorAll(".k-sec")).map((s) => s.value);
      location.hash = "#karsilastir/" + r.kat + "/" + secimler.join(",");
    }
  });

  el.modal.addEventListener("click", (e) => {
    if (e.target === el.modal) { kapat(); return; }
    const favBtn = e.target.closest("[data-fav]");
    if (favBtn) { favDegistir(favBtn.dataset.fav); return; }
    if (e.target.closest("#link-kopyala")) { linkKopyala(e.target.closest("#link-kopyala")); return; }
    const kars = e.target.closest("[data-karsilastir]");
    if (kars) { e.preventDefault(); const hedef = kars.getAttribute("href"); durum.sessiz = true; kapat(); location.hash = hedef; }
  });
  el.modal.addEventListener("close", pencereKapandi);
  el.modalClose.addEventListener("click", kapat);

  el.araclar.addEventListener("click", (e) => {
    if (e.target.closest("#btn-rastgele")) rastgeleAc();
    else if (e.target.closest("#btn-tema")) { ayar.tema = ayar.tema === "koyu" ? "acik" : "koyu"; depo.yaz("ta-tema", ayar.tema); el.html.dataset.tema = ayar.tema; ustBarCiz(); }
    else if (e.target.closest("#btn-dil")) { ayar.dil = ayar.dil === "tr" ? "en" : "tr"; depo.yaz("ta-dil", ayar.dil); hepsiniYenile(); }
  });

  // Açılır menü grupları
  el.cats.addEventListener("click", (e) => {
    const b = e.target.closest(".grup-btn");
    if (b) { const id = b.parentElement.dataset.grup; grupAc(acikGrup === id ? null : id); return; }
    if (e.target.closest(".grup-menu a")) grupAc(null);
  });
  document.addEventListener("click", (e) => { if (acikGrup && !e.target.closest("#cats")) grupAc(null); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && acikGrup) grupAc(null); });
  window.addEventListener("hashchange", yonlendir);

  // Başlangıç
  el.html.lang = ayar.dil;
  el.html.dataset.tema = ayar.tema;
  yonlendir();

  // Testler için dışarı açılan küçük yardımcılar
  window.TurlerAtlasi = { sayi, rota, ayar, favoriler };
})();
