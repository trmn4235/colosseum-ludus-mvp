# V91 — Kazan girişi ve Roma panoraması

Yemekhanenin ekran altındaki metin düğmesi kaldırıldı. Aynı menü, kazanın üstünde kamera ile birlikte konumlanan, erişilebilir adı olan 44 piksellik bir simgeden açılır. Odadan çıkıldığında, menü açıldığında veya kazan görüş dışına çıktığında simge gizlenir. Mevcut stok/alım ve tekrar deneme işlemleri korunur.

Haritanın yeni geniş görseli `assets/supply-v91/rome-panorama.webp` konumundadır. Çerçeveyi `object-fit: cover` ile doldurur; görüntü esnetilmez, iki yanda veya üst/alt kenarlarda düz renk şerit kalmaz. Farklı ekran oranlarında kenarlar kesilebilir; tüm panoramaya Haritayı incele ile erişilir. Bölge düğmeleri görünür alanın içinde kalır. Yeni görsel yaklaşık 640 KiB'dir.

Doğrulama: harita/ikon/etiket sınırları ve çerçevenin dört kenarını doldurması beş ekran boyutunda; yemekhane simgesinin gerçek 3B kazan konumuna projeksiyonu ve dört boyutta mevcut menü/alım/yeniden deneme davranışı. İzole veriler kullanıldı, gerçek hesaptan alım yapılmadı.

## Görsel üretim kaydı

Yerleşik imagegen kullanıldı; referans `assets/supply-v86/rome-map.webp`. Seçilen çıktı WebP olarak sıkıştırıldı, eski dosya korunur. Son istem:

“Extend the landscape horizontally into a seamless wide panorama with final aspect ratio 2:1. Preserve the original full central 3:2 composition, its height, and all its landmarks: river, bridges, Colosseum, long circus, quarry, farms. Outpaint new landscape on the left and right, matching scale, perspective, dense architectural detail, warm daylight and realistic historical illustration. Fill every edge with continuous ancient Roman terrain, riverbanks, groves, farms and city outskirts. No borders, beige margins, labels, UI, icons or vignette.”

Hareket araştırması ve kaynak notları: [locomotion-v91.md](locomotion-v91.md).
