# Circus Maximus V146 — iki takımlı biga gösterisi

1. Kullanıcının gönderdiği Panko10 Roma arabası oyuna GLB olarak eklendi.
2. Arabanın ahşap, bronz, demir ve deri yüzeyleri ayrıldı; bordo/mavi takım renkleri uygulandı.
3. Sol ve sağ tekerlekler aks merkezinde, gidilen mesafe / tekerlek yarıçapı oranında dönüyor.
4. Her arabaya iki at ve bir sürücü eklendi: toplam iki araba, dört at, iki sürücü.
5. Mevcut ahırdaki yedi renk iki takım için bağımsız seçilebiliyor: beyaz, gri, açık kahve, koyu kahve, siyah, alacalı, karamel.
6. Mevcut atın gerçek iskeletli canter animasyonu, hızla değişen oynatma temposu ve farklı adım fazları kullanılıyor.
7. Dizgin uçları sürücünün ellerini ve atın hareketli ağız bağlantısını takip ediyor.
8. Araba ve sürücüye küçük hareketler, atların altına temas gölgesi ve takip eden yönlü gölgeler eklendi.
9. Pist çevresinde iki ayrı şeritte iki turluk otomatik yarış; geri sayım, hız değişimleri, sıra/tur göstergesi ve kazanan bilgisi eklendi.
10. Üç takip kamerası, duraklat/devam, yeniden yarış ve hipodroma dönüş eklendi.
11. Mobil dikey/yatay ekranlara uyarlanan, kaydırmasız kontroller eklendi.
12. Yarış modelleri sadece Yarış açıldığında yükleniyor; model isteği başarısız olursa yeniden deneme mümkün.

## Kapsam

Otomatik görsel gösteridir; oyuncu tarafından sürülen yarış, ahır kayıtlarına bağlı takım seçimi, bahis veya ödül sistemi değildir. Hesaba, altına ve at kayıtlarına yazmaz. V145 mimari sahne korunmuştur. Kaynak ve değişiklik bildirimi yardım penceresinden erişilebilir.

## Doğrulama

`tests/circus-race-v146.cjs`: pist birleşimleri, bağımsız renk seçimi, eşit at ölçekleri, mesafeye bağlı tekerlek dönüşü, duraklatma, iki turu tamamlama ve sonuç, yeniden başlatma, çıkış, tembel model yükleme, dört ekran boyutunda taşma kontrolü, tarayıcı JavaScript hataları ve hesap isteği yapılmaması.

`tests/circus-maximus-v145.cjs`: mevcut mimari sahne regresyonu.

Yerel Chromium/SwiftShader ile doğrulanır; fiziksel iPhone/Safari FPS ölçümü değildir. Atın mevcut eyer geometrisi korunur. Kaynak: `assets/circus-v146/SOURCES.md`.
