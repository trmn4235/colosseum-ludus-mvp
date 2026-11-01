# V215 — Yedi sınıfta tutuş ve ekipman bağlantıları

Bu sürüm, yayımlanan V214 (`b01d1b30b36b5837ea8f6caf3a0d501b120d00a8`) üzerine uygulanır. Önceki V215'in ayrı kaynak paketi bulunamadığı için kayıtlı kapsam, mevcut kaynakta yeniden doğrulanıp uygulanmıştır.

## Değişiklikler

- Ağ, hazırlık sırasında elde kalır; 0,3 saniyedeki bırakma anında gizlenir. Geri dönüş ve iptal, mevcut `netBusy` durumunu izler. Oyun simülasyonu değişmez.
- Kalkan tutuşu, modelin gerçek tutma noktasını ve darbe dönüşünü kullanır. Aktif savunma düzlemi korunur. Savunma dışındaki taşıma, saldırı ve kalkan itişinde kalkan, erişilen avuç noktasını izler.
- Özel hareketlerde veya diğer elle saldırırken elde kalan silahın kabzası bilek köküne dönmez; avuç temasını korur.
- Scissor kol aparatı düzeltilen el eksenine oturur. Ekipman değiştirilince önceki bağlantı dönüşü geri yüklenir; silah türü değişimi eski taşıma dönüşünü kullanmaz.
- Tutuş çözümünün iç adımlarında eşdeğer eksen işareti sabit tutulur. Bu, Thraex'in geçerli saldırı geçişindeki salınımı giderir. Kılıç için 20°, uzun silah için 12° bilek sınırı, 28 çözüm adımı ve 2,5 cm toplam omuz kayması sınırı korunur.
- Arena, savaş seçimi, çok oyunculu, kervan ve Ludus bağlantıları güncellenir. Ortak dosyaları kullanan Aventinus yükleyicisinin önbellek anahtarı da yenilenir.

## Model ve uzak mesafe detayları

`gladiator-mobile-v214.glb` değiştirilmez: 6.195.852 bayt, 46.938 görünen üçgen. Kaynak gövde, iskelet, animasyonlar ve dokular aynıdır.

V214'ün değişen geometri düzeni, eski uzak mesafe indeksleriyle eşleşmiyordu. Uyumlu `assets/naval/gladiator-lod-v215.bin` yeniden üretildi:

| Detay | Gövde üçgeni |
|---|---:|
| Yakın | 46.938 |
| Orta | 18.000 |
| Uzak | 7.497 |

Üç düzey de aynı konum, normal, UV ve kemik/ağırlık tamponlarını paylaşır. Yakına dönüldüğünde asıl geometri geri gelir. Bunlar geometri ölçümleridir; fiziksel cihaz FPS ölçümü değildir.

## Doğrulama

```bash
node tests/character-classes-v215.cjs
node tests/character-grip-v215.cjs
node tests/character-actions-v215.cjs
node tests/character-asset-v214.cjs
node tests/character-guard-v214.cjs
node tests/character-pose-v214.cjs
node tests/naval-performance-v106.test.cjs
```

Sınıf testi 448 senaryo içerir: yedi gerçek sınıf yüklemesi × dört kare hızı × sekiz hareket yönü × hafif/ağır saldırı. Her senaryo yürüme, hareketli savunma, tam saldırı ve toparlanmayı işler. Testler gerçek model matrislerini, gereken aktif tutuşları, avuç/ekipman temasını ve simülasyonun değişmediğini kontrol eder.

`Seven-class contacts and detail V215` iş akışı aynı kaynak üzerinde Chromium ve WebKit kontrollerini çalıştırır; yedi sınıftan on altı görünüm ve bir karşılaştırma görseli üretir. Fiziksel iPhone kontrolü bu otomatik testlerin kapsamı dışındadır.
