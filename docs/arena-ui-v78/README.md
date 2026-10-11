# V78 — arena sonuçları ve oda girişleri

- Can/kondisyon ikonları 32 → 26 px, göstergeler sola alındı; barlar 14 → 12 px.
- Solo 20 / 4×5 sonucu Roma arena görseli üzerinde gerçek HTML ile gösterilir. Solda sunucunun onayladığı ödüller, sağda verilen/alınan hasar, isabet, alt edilen rakip, blok, sıyrılma, savuşturma ve süre bulunur. Solo 20 derecesi elenme anından hesaplanır; zafer 1/20 gösterir. Rating veya hayali ranked ödülleri eklenmez.
- Ödül kaydı/outbox, yeniden deneme, sunucu otoritesi ve envanter kuralları korunur. Görsel açıldıktan sonra WebGL çizimi durur.
- Dokunmatik cihazlarda varsayılan Dengeli profil: en fazla 1,25 piksel oranı ve 1024 gölge haritası. Detaylı: 1,6 / 1536; Akıcı: 1 / gölgesiz. 1,6 → 1,25 yaklaşık %39 daha az piksel verir; gerçek iPhone FPS artışı bu tarayıcı testiyle kanıtlanmaz.
- Arena afişlerinin arkasındaki eski SVG içerikleri silindi; güncel afişler önceden istenir. Yönetim odasında modeller beklenirken eski masa/halı kurulmaz.
- Dinlenme odasının üç orta meşalesi ve yer engelleri kaldırıldı. Dört duvarın yatay ortasında dört küçük duvar meşalesi vardır; odanın derinliği yatak sayısıyla değiştiğinde konumları güncellenir.

## Kontroller

- 61 mevcut combat/movement/bot/equipment testi.
- `tests/arena-ui-v78.test.cjs`: üç gerçek motorda hasar, ölüm, fazla hasar sınırı, sıyrılma; sunucu ödül miktarı ve render profilleri.
- `tests/arena-ui-v78.cjs`: gerçek sayfalar/modeller, ödülden önce sunucu yanıtı, dört ekran boyutu, küçülen HUD, sonuçta duran WebGL, modeller yüklenirken boş yönetim odası, dört duvar meşalesi.
- `tests/arena-art-v69.cjs`: afiş oranları ve tıklanabilir kontrol yerleşimi.

## Görsel

Proje varlığı: `assets/arena-result-v78.webp` (362.380 byte). Yerleşim ve yazılar bu resme işlenmez; `arena-results-v78.css` / `.js` tarafından gerçek veriyle oluşturulur.

Built-in imagegen ile, kullanıcının Roma arena sonuç ekranı renk ve kompozisyon referansı alınarak üretildi. Prompt: “Landscape 16:9 Roman colosseum background, warm sandstone, burgundy banners, bronze and gold; one central gladiator after battle, sword down, shield at side; calm left/right thirds for real HTML panels, clear top and bottom for titles/buttons; no text, numbers, UI, panels, logos or watermark.”
