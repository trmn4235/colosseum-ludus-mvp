# V89 — Harita, demirci, kasa ve klan kartları

Tedarik penceresi ekranı kullanır; sekmeler başlığa taşınır, işçi ve bölge kontrolleri haritanın sağında toplanır. Harita en boy oranı korunarak, kırpılmadan mümkün olan yüksekliği doldurur. Bölge adları simgelerin altında görünür. Tam görsel inceleme, yakınlaştırma ve geri dönüş korunur.

Demircinin 19 tarifi beş sütunlu tek katalogda gösterilir. Oyunun mevcut pazar görselleri aynı ekipmanlar için yeniden kullanılır. Seçim sağdaki malzeme listesini açar; üretim yalnızca Üret düğmesiyle başlar. Malzemeler için beş küçük SVG eklendi. Filtreler, eksik stok kontrolü ve aynı işlem kimliğiyle yeniden deneme akışı korunur.

Tedarik kasasının 12 ürünü sayfalama olmadan, ürün görselleri ve adetleriyle görünür. Bronz ve ahşap sandık simgesi, malzeme/gıda toplamları ve son teslimat bilgisi yeni düzeni tamamlar. Klan kartlarında dört takım ve onar gladyatör veya iki takım ve yirmişer gladyatör açıkça yazılır. Arena başlığındaki ludus adı ve bakiye satırı kaldırılır. Klan savaşlarının mevcut Yakında durumu korunur.

Doğrulama:

- `tests/ui-design-v89.cjs`: Chromium'da 1536×706, 844×390, 667×375, 568×320 ve 1024×768. Gerçek HTML stilleri ve kaynaklarıyla 19 tarif/12 ürün, kart ve metin taşması, tüm tariflerin seçimi, üretim isteğinin doğru SKU'su, filtreler, boş ve 50.000 birimlik stoklar; tarayıcı hatası yok. Test izole örnek veri kullanır, gerçek hesap üzerinde üretim yapmaz.
- `tests/arena-tabs-v81.cjs`: üç arena sekmesi, dört ekran boyutu, okunur takım açıklamaları ve kaldırılmış bakiye alanı.
- `tests/gathering-ui-v85.cjs`, `tests/gathering-ui-v86.cjs`, `tests/rooms-supply-v87.cjs`, `tests/supply-detail-v88.cjs`: mevcut işçi, kayıp yanıt, kasa teslimatı, oda ve görsel inceleme kontrolleri.

Tarayıcı testleri için Playwright ve JSDOM gerekir. Gerekirse `CHROMIUM_EXECUTABLE_PATH` ve `NODE_PATH` ayarlanır. Ekran görüntüleri `LUDUS_DESIGN_OUTPUT` veya `/tmp/ludus-design-v89` altına yazılır. Fiziksel iPhone FPS ölçümü yapılmadı. SQL veya hesap verisi değişikliği yok.

Giriş: `ludus.html?v=revision89`.
