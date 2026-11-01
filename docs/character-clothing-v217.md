# V217 — Kıyafet ve ayakkabı geometrisi

Bu sürüm yayımlanan V216 (`85bc1010477fd8f57f3bf505ca84476c7bb9f7a8`) üzerine uygulanır. Önceki konuşmadaki V217 dosyaları GitHub'da bulunmadığından kayıtlı kıyafet/ayakkabı hafifletme kapsamı mevcut model üzerinde yeniden hazırlanmıştır. Aşağıdaki ölçümler bu kaynak dosyalarına aittir.

## Kapsam ve ölçüm

Yedi sınıfın paylaştığı modelde yalnızca bel kıyafeti ve ayakkabı yüzeyleri sadeleştirildi. Gövde, gözler, iskelet, animasyonlar, materyaller ve gömülü doku görüntüleri aynıdır. Kalan her köşenin konum, normal, teğet, UV, kemik ve ağırlık verileri kaynak köşeyle bayt düzeyinde eşleşir.

| Ölçüm | V216 modeli | V217 modeli |
|---|---:|---:|
| Görünen üçgen | 46.938 | 41.638 |
| Görünen köşe | 27.512 | 24.454 |
| Dosya | 6.195.852 bayt | 5.912.072 bayt |
| Bel kıyafeti üçgeni | 12.000 | 9.300 |
| Ayakkabı üçgeni | 13.262 | 10.662 |

Görünen üçgenlerde %11,29, dosya boyutunda %4,58 azalma var. Bu, cihazda ölçülmüş FPS artışı değildir.

`tools/retopo-character-v217.cjs`, `meshoptimizer@0.23.0` kullanır. Açık geometrik sınırlar ve baskın kemik geçişleri korunur; normal/UV hatası değerlendirilir. Bağıl hata sınırı `.003` olduğu için hedef üçgen sayısına zorlanmaz. Bu değer piksel farkı veya sabit milimetre garantisi değildir. İşlem otomatik yüzey sadeleştirmesidir; elle retopoloji değildir.

## Oyuna bağlantı

- Arena, savaş seçimi, çok oyunculu, Ludus, kervan/Aventinus ve Circus Maximus savaş görünümü yeni `gladiator-mobile-v217.glb` dosyasını kullanır.
- Değişen köşe düzeni için `assets/naval/gladiator-lod-v217.bin` yeniden üretildi. Yakın/orta/uzak üçgen sayıları **41.638 / 18.000 / 7.497**. Konum, normal, UV ve kemik tamponları bütün detay düzeylerinde paylaşılır.
- Değişen yükleyicilerin önbellek anahtarları yenilendi. V215 tutuş ve V216 parmak ışık düzeltmeleri korunur.

## Doğrulama

```bash
node tests/character-asset-v217.cjs
node tests/character-surface-v217.cjs
node tests/character-classes-v215.cjs
node tests/character-grip-v215.cjs
node tests/character-actions-v215.cjs
node tests/character-normals-v216.cjs
node tests/naval-performance-v106.test.cjs
LUDUS_V217_TEST=1 LUDUS_V217_ONLY=1 node tests/arena-browser-v96.cjs
LUDUS_V217_TEST=1 LUDUS_V217_ONLY=1 LUDUS_TEST_ENGINE=webkit node tests/arena-browser-v96.cjs
```

V217 varlık testi özgün doku/iskelet verilerini, kalan köşe verilerini, açık sınırları, geçersiz yüzeyleri ve model/uzak detay eşleşmesini denetler. Yüzey testi, gerçek hareket pozlarında iki modelden örneklenen noktalarla karşı yüzey arasındaki mesafeyi karşılaştırır; bütün olası pozların kapsamlı yüzey eşitliği değildir.

Tarayıcı testi aynı ışık ve hareket koduyla yedi sınıfın bekleme, hareketli savunma ve saldırı pozlarında 42 görüntü çiftini karşılaştırır. Gerçek dokular, kemik matrisleri, el teması ve dolu görüntü kontrol edilir; yakın bacak/ayak görünümleri de kaydedilir. `Clothing geometry V217` iş akışı bu kaynağı Chromium ve WebKit üzerinde doğrular.

### 1 Kasım 2026 yerel sonuçları

- Varlık bütünlüğü ve altı uzak detay testi geçti. Görünen gövde sayacı, animasyon sırasında eklenen ayrı zırh yüzeylerini gövdeden ayıracak şekilde düzeltildi; tek birleşik gövde şartı korunur.
- Yedi sınıfta 56 hareket pozu ve 32.256 yüzey örneği geçti. En büyük örneklenmiş yüzey uzaklığı 8,78 mm; korunan köşelerin ve kemik matrislerinin farkı sıfır.
- Sınıf hareketleri 448 senaryo / 50.688 kare; silah tutuşları 36 senaryo / 3.887 kare; dört çalışma ortamında 245 kalkan senaryosu ve 44 ağ kontrolü geçti. V216 parmak yüzeyi regresyonu beş çalışma ortamında 2.100 poz / 12.600 kare ile geçti.
- Chromium'da 42 görüntü çifti geçti; bekleme, hareketli savunma ve saldırı karşılaştırma görselleri incelendi. En büyük ortalama piksel kanal farkı 0,000922'nin altında, belirgin değişen kanal oranı %0,330'un altında. El temasındaki en büyük boşluk 0,097 mm'nin altında.
- Yerel WebKit 26.5'te aynı 42 görüntü çifti geçti. En büyük ortalama piksel kanal farkı 0,000880'in altında, belirgin değişen kanal oranı %0,312'nin altında; kemik matrisi farkı sıfır. Başlangıçta eksik olan WebKit kitaplıkları geçici test dizininde hazırlanarak test tamamlandı. Chromium ve WebKit sonuçları yazılımsal çizime aittir.

Fiziksel iPhone testi, bağımsız parmak/başparmak rig'i, yeni doku boyaması ve elle retopoloji bu küçük sürümde tamamlanmış sayılmaz.

## Yayın hazırlığı kaydı

V217, V216 (`85bc1010477fd8f57f3bf505ca84476c7bb9f7a8`) üzerinden `codex/character-clothing-v217` dalında hazırlandı. 1 Kasım 2026'daki ilk `git push` girişimi, "V217 devam" talimatında dosyalar ve hedef için yeterli açık gönderim yetkisi bulunmadığı gerekçesiyle otomatik onay denetiminde reddedildi. Kullanıcı daha sonra hazır V217 kodunun, modellerinin, testlerinin ve GitHub Actions dosyasının herkese açık `trmn4235/colosseum-ludus-mvp` deposuna gönderilmesini ve yayımlanmasını açıkça onayladı. Gönderimden sonraki CI ve yayın sonuçları ilgili GitHub PR ve Actions kayıtlarından doğrulanır; yukarıdaki yerel kontroller tek başına canlı yayın kanıtı değildir.
