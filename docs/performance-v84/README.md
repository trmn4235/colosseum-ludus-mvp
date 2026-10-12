# Genel performans çalışması V84

12 Ekim 2026. Karşılaştırmanın temeli Survival V83 sürümü: `7de1ba4289b9f942d583120ae8b0c07f3c5342b1`.

Tekrarlanan indirme, JavaScript ayrıştırma, kare başına nesne üretimi, sahne taraması ve arayüz yazmaları azaltıldı. Kapalı/görünmeyen ekranların işi sınırlandı; önizlemelerin kendilerine ait kaynakları kapatılırken temizleniyor. Görsel dosyalar yeniden sıkıştırılmadı, modeller basitleştirilmedi. Bu çalışma gerçek telefonda ölçülmüş bir FPS artışı veya bütün takılmaların giderildiği iddiası değildir.

## İnceleme kapsamı

Başlangıç sürümünün **414 takip edilen dosyasının tamamı** envantere alındı. Dosya boyutları, SHA-256 değerleri, kaynak türleri ve ilgili çalışma yolları incelendi. Kaynak taraması, çalışma anındaki maliyeti olan kodlara odaklanmayı sağladı; ikili modeller/görseller yapıları, boyutları ve hash değerleriyle kontrol edildi.

| Dosya grubu | Sayı | Kontrol |
| --- | ---: | --- |
| HTML | 14 | Betik bağımlılıkları, gömülü kopyalar, yükleme sırası, arayüz güncellemeleri |
| JavaScript | 39 | Animasyon döngüleri, model/istemci oluşturma, geçici nesneler, kapanış ve görünürlük |
| CSS | 22 | Statik/gömülü kaynaklar, mevcut görünüm ve etkin sahneyle ilişkisi |
| SQL | 34 | Mevcut çağrı yolları, sayfalama ve sunucunun sahip olduğu durum; SQL değişikliği yapılmadı |
| GLB | 29 | Geometri, gömülü görseller, morph/animasyon verileri ve kaynak maliyetleri |
| Diğer | 276 | Raster/SVG varlıklar, testler, araçlar, belgeler, yapılandırma ve arşiv |

[inventory.json](inventory.json) her dosyanın önce/sonra boyutunu ve hash değerini içerir. [models.json](models.json) 29 GLB'nin tamamını kapsar. V84'te eklenen dosyalar git değişikliğinde ayrıca görülebilir. Önceki mobil ve şehir çalışmalarının ölçümleri bu sürümün yeni ölçümleri olarak sunulmamıştır.

## Yükleme ve tekrar kullanım

1. Dört 3D HTML sayfasındaki aynı Three.js/GLTFLoader kopyası, zaten mevcut olan `owner-three-r160.js` dosyasına taşındı. Giriş ve önizleme ekranlarıyla aynı URL/cache anahtarı kullanılıyor. Kütüphane sürümü değişmedi.
2. Supabase SDK'nin sayfalardaki tekrarları tek bir içerik hash'li dosyaya taşındı. Eski önbellekli seviye HTML'sini bozmamak için `ludus-level-runtime-v37.js` korundu; yeni sayfa küçük V84 runtime'ını kullanıyor.
3. Tekrar eden dokuz WebP, data URL yerine ortak dosya oldu. Orijinal ikili görsel verileri birebir aynı. Tekrarlanan kopyalar 1.498.178 ikili bayt ederken ortak dosyalar toplam 312.778 bayt. Önceki base64 HTML gösterimi ayrıca yaklaşık üçte bir kodlama ek yükü taşıyordu.
4. Değişen betik ve gezinme URL'leri V84'e geçirildi. Değişmeyen büyük model dosyalarının cache anahtarları korunuyor. Eğitim deneme sayfaları hem eski gömülü hem yeni harici Three.js düzenini açabiliyor.

| HTML kaynağı, sıkıştırılmamış bayt | Önce | Sonra |
| --- | ---: | ---: |
| `arena.html` | 1.490.164 | 463.897 |
| `ludus.html` | 1.419.292 | 392.153 |
| `multiplayer.html` | 1.755.030 | 404.885 |
| `savas.html` | 1.766.261 | 416.053 |
| `index.html` | 265.515 | 47.666 |
| `gelistirmeler.html` | 768.768 | 84.363 |
| `gorevler.html` | 267.193 | 49.344 |
| `klan.html` | 705.692 | 70.982 |
| `pazar.html` | 755.029 | 70.627 |
| **14 HTML'nin toplamı** | **9.228.481** | **2.035.615** |

Toplam HTML kaynağı **%77,9** küçüldü. Bu, ilk açılıştaki bütün ağ trafiğinin %77,9 azaldığı anlamına gelmez: ortak kütüphaneler ve kullanılan görseller ilk kez açılırken yine indirilir, ayrı HTTP istekleri oluşur. Asıl tekrar kullanım kazancı, HTML'ye tekrar gömülmeden tarayıcı önbelleğinden alınabilmeleridir. Üretim HTTP sıkıştırması, önbellek durumu ve bağlantı gecikmesi burada ölçülmedi.

## Oyun sırasında yapılan iş

- Dört karakter runtime'ında kol IK'si, ayak yerleştirme, kayıtlı pozlar, yuvarlanma ve yere düşme için vektör/quaternion çalışma alanları yeniden kullanılıyor. Kemik listesi her karede oluşturulmuyor; aynı renk parlaması tekrar tekrar yazılmıyor. Modelin kendisine ait düşme/geçiş kayıtları paylaşılmıyor.
- Ekipman senkronizasyonu yalnızca yükleme revizyonu, ekipman, takım veya ilgili görünürlük durumu değiştiğinde yapılıyor. Eğitimde rudis takılıp normal silaha dönme, aynı silah türüyle geçersizleştirme ve ölü karakter donanımı korunuyor.
- Arenada gölge mesh listesi ekipman değişince hazırlanıyor. Yakınlık aynı kalıyorsa bütün karakter ağacı her karede yeniden taranmıyor. Fazladan ikinci ekipman senkronizasyonu kaldırıldı.
- Arena ve multiplayer, tamamen kamera dışında kalan karakter köklerini çizimden çıkarıyor. Altı metrelik muhafazakâr küre beden/silah kenarlarını koruyor; oyuncu daima tutuluyor. Oyun simülasyonu ve karakter durumları işlemeye devam ediyor; kamera dönüşünde görünürlük yeniden hesaplanıyor.
- HUD metni, HTML, stil ve erişilebilirlik değerleri değişmedikçe DOM'a yazılmıyor. Başka bir olayın yaptığı yazma dikkate alınıyor; örneğin gösterilen bildirim süre bitince tekrar gizlenebiliyor. Gösterilmeyen rakip etiketleri projekte edilmiyor. Oda simgeleri aynı karede aynı canvas ölçümünü kullanıyor; tıklama ayrı güncel ölçüm alıyor.
- Ludus genel görünümünde görünmeyen sahibin animasyonu çalışmıyor. Duraklatılmış modal arka planı saniyede en fazla dört kez çiziliyor. Sahibi oluşturma ve gladyatör ayrıntısı önizlemeleri en fazla 30 Hz çiziliyor. Gizli sekmede 3D kare işi atlanıyor.
- Görünüm sürgüsündeki hızlı girişler 100 ms içinde birleştiriliyor. Son seçim hazır olmadan kayıt etkinleşmiyor. Kapanışta bekleyen yeniden oluşturma ve RAF iptal ediliyor; model materyalleri, ten dokusu, iskelet dokuları ve eski render listeleri temizleniyor. Sahip editörü tek renderer/canvas bağlamını tekrar kullanıyor; her açılışta yeni GPU geometri önbelleği oluşturulmuyor. Ayrıntı önizlemesi, kaldırılan canvas ile birlikte renderer'ını tamamen bırakıyor.
- Sayfadaki aynı URL/anahtarlı standart Supabase istemcileri birleşiyor. Aynı anda yapılan `getUser()` çağrıları yalnızca devam eden isteği paylaşır. Sonuç kalıcı olarak cache'lenmez; sonraki çağrı yeniden doğrulanır. Hesap değişimi/çıkış yeni istek açar; açık JWT ve özel istemci seçenekleri bağımsız kalır.

## Karşılaştırmalı ölçümler

Node/Three.js testi gerçek GLB geometri ve rig verilerini kullanır; raster doku çözme yerine boş Texture nesneleri kullanır. **Tarayıcı, GPU, WebGL çizimi veya telefon ölçümü değildir.** Aynı test kodu temel ve aday sürüme uygulanmıştır.

Her senaryoda 12 karakter kullanılır. Süre sütunu, her biri 40 kare × 12 karakter olan beş örneğin medyanıdır. Nesne sayısı ayrı bir 200 kare × 12 karakter geçişinde ölçülür; süre ölçümünde sayaç enstrümantasyonu yoktur. Nesne sayacı yalnızca açık `THREE.Vector3/Quaternion/Euler` kurucu çağrılarını sayar; kütüphane içindeki clone nesneleri veya tüm JavaScript/heap tahsisleri değildir.

| Hareket | CPU medyanı önce, ms | CPU medyanı sonra, ms | Açık matematik nesnesi önce | Sonra |
| --- | ---: | ---: | ---: | ---: |
| Yürüme | 173,8 | 190,7 | 134.400 | 0 |
| Koşma | 177,4 | 183,7 | 134.400 | 0 |
| Saldırı | 177,0 | 169,4 | 236.520 | 720 |
| Blok | 198,9 | 185,3 | 271.800 | 0 |
| Hasar tepkisi | 92,1 | 84,6 | 14.400 | 0 |
| Yuvarlanma | 227,9 | 237,8 | 168.000 | 0 |
| Yere düşme/ölüm | 247,2 | 250,6 | 349.020 | 0 |

Toplam açık matematik nesnesi üretimi **1.308.540 → 720** oldu. Kalan saldırı nesneleri geçişte karaktere ait poz kayıtlarıdır. CPU süresi karışıktır: bazı senaryolarda azalırken bazılarında artmıştır. Bu test, genel FPS artışı veya çöp toplama duraklamasının ölçülmüş azalması olarak yorumlanamaz. Azalan nesne trafiği ile yeniden yapılan iş miktarı doğrudan doğrulanmıştır.

| Kontrollü tekrar testi | Önceki işlem düzeni | V84 sonucu |
| --- | ---: | ---: |
| Aynı gölge/ekipman durumu, 600 çağrı | 600 ağaç taraması | 1 tarama |
| Değişmeyen üç HUD alanı, 600 güncelleme | 1.800 yazma | 3 yazma |
| Aynı karede canvas ölçümü, 21 çağrı | 21 ölçüm | 1 ölçüm; sonraki kare yenilenir |
| Eşzamanlı standart kullanıcı sorguları | Bağımsız istekler | 1 devam eden istek |

[before.json](before.json), [after.json](after.json) ve [contracts.json](contracts.json) ham sonuçları içerir. Tek çalışma ortamındaki bu CPU süreleri cihaz performansını temsil etmez.

## Davranış ve doğrulama

- `arena.html`, `savas.html`, `multiplayer.html`, `ludus.html`: altı hareketin sonunda altı kemiğin toplam **2.304 matris değeri birebir aynı**. Ludus'a özgü kol yönlendirmesi ayrı korunuyor. [Önce](poses-before.json) / [sonra](poses-after.json).
- Testteki yürüme/koşma/saldırı/blok/hasar/yuvarlanma/ölüm pozları ve gövde/kök konumları da birebir aynı.
- Önceden var olan GLB, raster, SVG ve arşiv dosyaları SHA-256 ile aynı. Çıkarılan ortak görseller orijinal HTML'deki ikili veriyle aynı; manifest kütüphane ve görsel hash'lerini doğruluyor.
- Görünürlük testi kameranın hareketini, ekrandan çıkıp geri dönmeyi, kenardaki silah payını ve oyuncunun korunmasını kapsıyor. Önizleme testi bağımsız iskeletlerin temizlenmesini, diğer modelin yaşamaya devam etmesini ve erken kapanan bekleyen modelin sonradan bağlanmamasını kontrol ediyor.
- Standart istemci birleşmesi, sonraki kullanıcı sorgusunun tazeliği, çıkış sırasında yeni istek, açık JWT ve özel istemci seçenekleri kontrol edildi. Bunlar izolasyonlu istemci testleridir; canlı oyuncu hesabında işlem yapılmadı.
- Mevcut dövüş, bot savunması, ekipman, hareket, ölüm, UI, mobil varlık, şehir ve sahip testlerinde **80 geçti, 0 hata, 1 isteğe bağlı eski temel-varlık testi atlandı**. Yeni sözleşme testi ayrıca varlıkları V83 ile birebir karşılaştırdı.
- Survival V83'ün 310 aşama ve PGlite kayıt/yetki/tekrar-deneme kontrolleri geçti. Kural aynıdır: sonu 0 olan pozitif aşamada `stage / 10`, diğerlerinde 1 rakip. Örneğin 20→2, 40→4, 41→1, 60→6, 100→10. 41 özel eşik değildir. İlk geliş süresi 5 saniye; sonraki aşamalar devam eder.

Aktif dövüşün sabit simülasyon adımı, hareket/saldırı süreleri, hasar, kazanımlar, antrenman, kayıtlar ve sunucu yetki kuralları değiştirilmedi. Yeni SQL/migration gerekmez.

## Kalan maliyet ve sınırlar

| Büyük kaynak | Dosya baytı | Benzersiz kaynak üçgeni |
| --- | ---: | ---: |
| Sahip GLB | 21.411.012 | 147.560 |
| Arena GLB | 15.825.436 | 198.225 |
| Gladyatör GLB | 11.908.916 | 78.158 |

İlk GLB çözme, görünür çok sayıda karakterin skinning'i, arena çizimleri ve gerçek GPU doku belleği hâlâ maliyetlidir. Kaynak üçgen sayıları ekrandaki toplam çizim maliyeti değildir; klonlar, görünürlük ve gölge geçişleri bunu değiştirir. Doku bellek tahminleri ölçülmüş VRAM değildir.

Bu ortamda tarayıcı kontrolü bulunmadığı için yeni tarayıcı görsel testi veya fiziksel telefon testi çalıştırılmadı; eski ekran görüntüleri V84 doğrulaması olarak kullanılmadı. Aynı cihazdaki mevcut arena ölçüm paneli gerçek FPS, P95 kare süresi ve çizim sayısını ölçmek için kullanılabilir. Doku/mesh codec'leri veya kaliteyi azaltan değişiklikler, cihazda görsel ve bellek doğrulaması gerektiren ayrı bir çalışmadır.

## Tekrar üretme

```sh
git worktree add --detach /tmp/ludus-v83 7de1ba4289b9f942d583120ae8b0c07f3c5342b1
LUDUS_PERF_ROOT=/tmp/ludus-v83 node tests/performance-v84.cjs > /tmp/v84-before.json
node tests/performance-v84.cjs > /tmp/v84-after.json
# Önce temel sürümün pozlarını oluştur, sonra adayı karşılaştır.
LUDUS_PERF_ROOT=/tmp/ludus-v83 LUDUS_POSE_OUTPUT=/tmp/v84-poses-before.json node tests/performance-contracts-v84.cjs
LUDUS_BASELINE_ROOT=/tmp/ludus-v83 LUDUS_BASELINE_POSES=/tmp/v84-poses-before.json node tests/performance-contracts-v84.cjs
python tools/mobile-asset-audit.py > /tmp/v84-models.json
python tools/performance-inventory-v84.py --baseline-root /tmp/ludus-v83 --output /tmp/v84-inventory.json
node --test tests/combat-feel-v23.test.cjs tests/bot-defense-v72.test.cjs tests/arena-ui-v78.test.cjs tests/mobile-assets.test.cjs tests/equipment-arena-v30.test.cjs tests/movement-v39.test.cjs tests/death-v41.test.cjs tests/ludus-city-backdrop.test.cjs tests/owner-avatar-v26.test.cjs
# Kurulu @electric-sql/pglite modülünün yolunu ver.
LUDUS_PGLITE_MODULE=/path/to/@electric-sql/pglite node tests/survival-v83.cjs
```

Node 18+; model/envanter araçları için Python ve Pillow. Bu komutlar tarayıcı başlatmaz ve oyuncu hesabına bağlanmaz.
