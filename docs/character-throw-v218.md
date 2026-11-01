# V218 — Fırlatma hazırlığı ve bırakma görünürlüğü

Bu sürüm, yayımlanan V217 (`4666c1ae997626f4644228acbd0f2859b9bce214`) üzerine uygulanır. Önceki konuşmalardaki V218 kaynak paketi bulunamadığından kayıtlı fırlatma kapsamı mevcut kaynakta yeniden hazırlanmıştır. Önceki 630 senaryoluk sonuç bu kaynağın doğrulaması olarak kullanılmaz.

## Sorun ve değişiklik

Simülasyon, fırlatma başlarken silahı kuşanılmış yuvadan çıkarır; havadaki silah ancak gerçek merminin `launched` durumu açılınca görünür. Bu arada görüntüleyici boş yuvayı kullandığından silah kayboluyor ve parmaklar hazırlık bitmeden açılıyordu.

`ArenaAnatomy.pendingThrow` canlı gladyatörün durumunu ve henüz bırakılmamış gerçek mermisini okur. `throwPose`, yalnızca çizilecek pozda ilgili elin silahını geri koyar. Ekipman yerleşimi ve mevcut parmak tutuşu aynı görsel pozu kullanır. Bırakma, iptal, ölüm veya merminin kaldırılmasıyla bu görsel tutuş sona erer. Görüntüleyicinin ilk karesi hazırlığın ortasına denk gelse de silah türü gerçek mermiden alınır.

Arena ve kervandaki seyrek animasyon güncellemeleri, silahın bırakılmasını anında bir poz değişimi olarak işler. Böylece uzaktaki karakterlerde eldeki model ile havadaki model aynı anda kalmaz. Kervanda yumuşatılmış görüntü zamanı yerine canlı mermi durumu kullanılır. Aventinus gösteri görüntüsü de ortak görsel tutuşu kullanır. Çok oyunculudaki mevcut sunucu zamanına bağlı tutuş korunur.

Simülasyon, envanter, hasar, dayanıklılık, enerji maliyeti, bekleme süresi, fırlatma zamanı, sunucu kodu ve tekrar oynatma kuralları değişmez. V217 modeli, dokular, iskelet ve uzak detay dosyaları aynıdır: **41.638 üçgen, 5.912.072 bayt**. İlgili sayfa ve yükleyicilerin önbellek anahtarları güncellenir.

## Doğrulama

```bash
node tests/character-throw-v218.cjs
node tests/character-throw-integration-v218.cjs
node tests/character-classes-v215.cjs
node tests/character-actions-v215.cjs
node tests/character-asset-v217.cjs
LUDUS_V218_TEST=1 LUDUS_V218_ONLY=1 node tests/arena-browser-v96.cjs
LUDUS_V218_TEST=1 LUDUS_V218_ONLY=1 LUDUS_TEST_ENGINE=webkit node tests/arena-browser-v96.cjs
```

CPU denetimleri gerçek model ve gerçek simülasyon durumlarını kullanır; görüntü dokuları bu denetimlerde yer tutucudur. Tarayıcı denetimleri gerçek dokuları çözer, eldeki/havadaki silahı bırakma sınırında ve seyrek güncellenen uzak karakterlerde kontrol eder; yedi sınıfın tam gövde ve el görüntülerini kaydeder.

Fiziksel iPhone testi bu otomatik denetimlere dahil değildir. Bağımsız parmak/başparmak rig'i, yakın plan el anatomisinin tüm kusurları, elle retopoloji ve yeni doku üretimi bu küçük sürümde tamamlanmış sayılmaz.

### 1 Kasım 2026 sonuçları

- Arena, savaş seçimi, çok oyunculu sayfasındaki gömülü çekirdek ve kervanın kendi simülasyon çekirdeklerinde toplam **420 normal fırlatma, 224 kesilme/ölüm ve 40 kesin bırakma sınırı** denetimi geçti: 684 senaryo, 49.642 animasyon karesi. Bu çok oyunculu çekirdek kontrolü canlı çevrimiçi maç testi değildir.
- Yedi sınıf, beş fırlatılabilir silah ve iki el denetlendi. Arena 20/60/120 Hz, diğer çekirdekler 60 Hz kullanır. 112 yeni model ve 840 yumuşatılmış zaman kontrolü geçti; tutuşun bırakılması gerçek mermi durumunu izledi.
- 174.636 parmak yönü kontrolünde hazırlık sırasında beklenen kapanma korundu. Ölçümde kopyalanan kuaterniyonlar normalize edildi; üretim kemikleri değiştirilmedi. Örneklenen en büyük avuç/sap mesafesi 0,099 mm'nin altında.
- Kervan ve Aventinus'un gerçek çizim çağrılarıyla 12 entegrasyon senaryosu geçti. Bırakma, seyrek animasyon bütçesini beklemeden işlendi; canlı simülasyon verileri değişmedi.
- Chromium ve WebKit'te **28'er gerçek dokulu görüntü**, sağ/sol el için yakın/uzak toplam dörder bırakma sınırı ve yedişer geç oluşturulan model kontrolü geçti. Karşılaştırma görselleri incelendi. Bunlar yazılımsal çizim sonuçlarıdır; fiziksel telefon FPS ölçümü değildir.
- Mevcut 448 sınıf hareketi, 245 kalkan senaryosu, 44 ağ durum kontrolü ve gerçek ağ yaşam döngüleri geçti. V217 varlık bütünlüğü denetimi başarılı; model ve uzak detay dosyaları değişmedi.

Görsel kontrol, mevcut fırlatma animasyonunun alçak gövde eğimini ve bağımsız parmak/başparmak iskeleti bulunmamasından kaynaklanan yakın plan sınırlarını da gösterir. V218'in düzeltmesi elde tutma/bırakma zamanlamasıdır; yeni fırlatma animasyonu veya eksiksiz el anatomisi iddiası değildir.

İlk GitHub çalıştırmasında V218 iş akışındaki tarayıcı imaj kimliğinde tek karakterlik yazım hatası ve eski zamanlama testinin sanal ortamında eksik `ArenaAnatomy` yüklemesi bulundu. İmaj, çalışan V217 tanımıyla eşitlendi; zamanlama testi gerçek ortak modülü yükler. Test koşulları gevşetilmedi. Zamanlama, uzak detay, uyarlanabilir kalite ve çizim ölçeği kontrolleri birlikte yeniden çalıştırılıp geçti.
