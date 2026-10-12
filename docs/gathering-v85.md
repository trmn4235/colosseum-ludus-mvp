# V85 — Tedarik haritası, işçiler ve demirci

Silahlık, Demirci; Depo, Tedarik odası olarak açılır. Tedarik masasındaki harita
işçi seferlerini, demircideki örs basic ekipman üretimini açar. Harita Roma çevresi
için şematik bir oyun haritasıdır. Yeni 3D model veya ayrı bir açık dünya yüklemez.

## İşçi ödülleri

Ludus seviyeleri **5, 10, 15, 20, 25, 30, 35, 40, 45, 50** mevcut ödüllere ek
olarak birer işçi verir. Başlangıçta 0, 50. seviyede toplam 10 işçi vardır.
Seviye defterinden alınan ödüller kullanılabilir. Önceden alınmış seviyelerin
işçileri geçişte eklenir; diğer seviye ödülleri tekrar verilmez.

## Bir işçinin bir saatlik seferi

| Bölge | Getirilen yük |
|---|---|
| Demir madeni | 12 demir |
| Bakır madeni | 12 bakır |
| Orman | 20 odun |
| Av sahası | 8 et + 6 deri |
| Keten tarlası | 20 keten |
| Tahıl tarlası | 24 tahıl |
| Elma bahçesi | 20 elma |
| Nehir kıyısı | 12 balık |
| Çiftlik | 16 yumurta |
| Bağ evi | 8 şarap |
| Zeytinlik / sıkım evi | 6 zeytinyağı |

Sefer ücretsizdir. Aynı sefere birden fazla boş işçi gönderilebilir; yük işçi
sayısıyla çarpılır, süre değişmez. Sefer çevrimdışıyken ilerler. Süre dolunca
**Seferler → Yükü teslim al** ile ürünler ve işçiler geri alınır. Otomatik
tekrar yoktur. Bir ürünün deposu 50.000 adedi aşacaksa teslimat bütünüyle
bekletilir; yük veya diğer ürünler kaybolmaz.

Gıda mevcut yemekhaneye, beş üretim malzemesi ayrı malzeme stoklarına eklenir.
Teslimattan önce geçmiş günlerin beslenmesi hesaplanır; yeni yük geçmiş günleri
geriye dönük beslemez. Süre ve yük istemciden alınmaz; sunucu başlangıçta kaydeder.

## Demirci

Mevcut Basic kataloğun 19 ürünü üretilebilir. Tarifler sunucudadır; tüketim ve
eşya oluşturma tek işlemde yapılır. Eşya mevcut normal oluşturma tetikleyicisinden
geçer; +0 ve taşsız olarak envantere girer. Üretim altın kesmez. Örneğin gladius
6 demir + 2 odun + 2 deri, ağ 12 keten ister. Bakır kalkan ve zırh bağlantılarında
kullanılır. Mevcut Basic/Forum ekipman pazarı kullanılmaya devam eder.

## Beslenme

Günlük 100 besin birimi / gladyatör ve mevcut otomatik menü devam eder. Pişirme
ve ayrı yemek tarifleri yoktur. Ekmek ve hazır öğünün yeni alımı kapalıdır.
Önceden satın alınmış stoklar `Eski stok` olarak görünür ve mevcut besin değeriyle
tüketilebilir; tamamlanmış eski alımların aynı işlem kimliğiyle tekrarı korunur.

Temel menü +%4, protein veya meyve katkılı menü +%8 savaş içi kondisyon yenilenmesi
sağlar. En yüksek kalite (+%12), tam beslenme ve dengeli menüye ek olarak
**gladyatör başına 1 zeytinyağı** ister. Tüm kadroya yağ yetmiyorsa yağ saklanır,
dengeli menü +%8 verir. Diğer menülerde yağ tüketilmez ve yağ açlığı karşılamaz.
Önceden tamamlanmış günlerin bonusları değiştirilmez. Zeytinyağı 12 denariusa
pazardan da alınabilir. İşletme, hammadde satışı ve ortak fiyat piyasası yoktur.

## Doğrulama

- `tests/gathering-v85.cjs`: gerçek PostgreSQL motorunda migration tekrarı,
  eski ödüller, 10 işçi hakkı, hesap izolasyonu, süre/kapasite denetimi, çift
  teslimata karşı koruma, malzeme tüketimi, yemek geçişi ve yağ tüketimi.
- `tests/gathering-ui-v85.cjs`: DOM üzerinde harita seçimi, işçi miktarı,
  kayıp yanıtın aynı kimlikle tekrar edilmesi, ödül sütunu, demirci ve yemek UI.
- `tests/performance-contracts-v84.cjs`: mevcut model, varlık ve render kuralları.

Yerel doğrulama bağımlılıkları: `@electric-sql/pglite@0.3.14`, `jsdom@26.1.0`.
Testler sırasıyla `LUDUS_PGLITE_MODULE` ve `LUDUS_JSDOM_MODULE` ile modül yolu alır.
Bu sürümün otomatik UI kontrolleri DOM kontrolleridir; tarayıcıda görsel oyun testi
yapıldığını iddia etmez.
