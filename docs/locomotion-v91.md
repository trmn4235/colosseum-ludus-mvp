# V91 — Doğal hareket araştırması ve uyarlama

## Karar

CMU'nun gerçek insan hareket yakalama kayıtlarından yürüyüş, hafif koşu ve koşu döngüleri seçildi. Ham kayıtların adı tek başına kalite garantisi değildir: oyunun kendi gladyatörü ve ekipmanları üzerinde aktarım, döngü ve görünüm kontrol edildi. Aşağıdaki alternatiflerin tamamı aynı model üzerinde denenmiş değildir; kaynak/erişim incelemesi ile doğrudan oyun testini ayırıyoruz.

| Kaynak | İnceleme sonucu | Bu sürümde kullanım |
|---|---|---|
| [CMU Graphics Lab](https://mocap.cs.cmu.edu/) | İnsan hareket yakalama verisi; ürünlerde kullanım mümkün, ham verinin doğrudan yeniden satışı yasak. Temizleme ve iskelet uyarlaması gerekiyor. | Altı kayıt indirildi; üç kayıt oyunda kullanılıyor. |
| [Rokoko yürüyüş/koşu paketi](https://www.rokoko.com/resources/rokoko-mocap-16-free-walk-and-run-cycle-animations) | 16 kayıt, Mixamo iskeleti, FBX, 30 FPS; ticari kullanım belirtiliyor. İndirme akışı kişisel bilgiler ve pazarlama onayı istiyor. | Form doldurulmadı; dosyalar indirilmedi ve oyun içi kalite iddiası yapılmıyor. |
| [Adobe Mixamo](https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html) | Adobe ID ile ücretsiz; ticari oyunlarda kullanım belirtiliyor. Karaktere özel önizleme/aktarım olanağı var. | Hesap açılmadı, yeni kayıt indirilmedi. |
| [ActorCore](https://actorcore.reallusion.com/3d-motion/Daily%20Life/Mobility%20of%20Daily%20Life) | Normal Walk ve Run dahil profesyonel hareket seçenekleri; ürüne göre erişim/ücret değişiyor. | Satın alma yapılmadı; bu karakter üzerinde test edilmedi. |

Bu seçim, bütün kütüphanelerin en iyi animasyonunu bulduğumuz iddiası değildir. Erişilebilir gerçek kayıtları mevcut oyun iskeletinde doğrulanabilir biçimde kullanır.

## İncelenen CMU kayıtları

Kaynak BVH'ler: [Shriinivas/cmubvh](https://github.com/Shriinivas/cmubvh), Bruce Hahne / cgspeed dönüşümü. Kaynak asılları CMU'dur. Dönüşüm açıklaması ve kullanım notları [cgspeed](https://sites.google.com/a/cgspeed.com/cgspeed/motion-capture) üzerindedir. Yalnızca BVH hareketleri kullanıldı; örnek karakter veya başka bir model alınmadı.

| Kayıt | Değerlendirme | Seçilen sıfır-tabanlı kare aralığı |
|---|---|---|
| 35_01 | Normal yürüyüş; tam döngü seçildi. | 144–278 |
| 35_03 | Benzer alternatif yürüyüş; yaklaşık 1,125 saniyelik döngü. | Üretime alınmadı. |
| 35_17 | Hafif koşu; tam döngü seçildi. | 28–116 |
| 09_01 | Koşu; başlangıç hızlanması yerine döngü içi kesit seçildi. | 35–124 |
| 09_03 | Kesitte temiz tam döngü seçme koşulları sağlanmadı. | Elendi. |
| 09_06 | Alternatif koşu; yaklaşık 0,733 saniyelik döngü bulundu. | Üretime alınmadı. |

Kaynak kare süresi yaklaşık 1/120 saniye. Seçilen döngüler 49 örneğe indirildi; oyun örnekler arasında interpolasyon yapar. Kaynak dosya SHA-256 değerleri, aralıklar, süre, mesafe ve bacak ölçüsü `arena-locomotion-data-v91.js` içinde bulunur. Veri yaklaşık 76 KiB; yeni karakter ağı veya doku eklenmedi.

## Mevcut aktarımda değişenler

- V81 yalnızca kol/bacak yönlerini aktarıyordu; kalça, omurga, boyun ve baş hareketleri artık kayıttan gelir.
- Sabit, tahmini adım uzunluğu yerine kaydın ilerleme mesafesi ve kaynak/hedef bacak uzunluğu kullanılır.
- Üç döngü aynı ayak fazına hizalanır. Hızlar arası keskin değişim yerine karışım; hareket başında/sonunda kısa ağırlık geçişi uygulanır.
- Büyük kalkan, silahsız kayıttaki serbest kol hareketini aynen izlemez. Taşıma kolu dengelenir ve kalkan dik tutulur. Aktif savunmanın mevcut eli yönlendiren sistemi önceliğini korur.
- Saldırı, darbe tepkisi, kaçınma ve ölüm durumları bu hareket katmanının dışındadır. Savaş kuralları, hızları, hasar ve kondisyon hesabı değiştirilmez.
- Tam ayak kilitlemeli IK veya kapsamlı hareket eşleştirme sistemi değildir. Çok keskin yanal/geri yön değişimleri için ayrı yönsel kayıtlar gelecekte ayrıca değerlendirilebilir. Fiziksel iPhone FPS ölçümü yapılmadı.

## Doğrulama

- Gerçek arena sayfasında izole hesap verisiyle yürüyüş/hafif koşu/koşu ve saldırıya geçiş; sonlu koordinatlar ve zemine yakın destek ayağı kontrol edildi.
- Oyunun gladyatör modeli ve kalkan/kılıcıyla 180 karelik önizleme render edildi: [önizleme](locomotion-v91/preview.mp4).
- Döngü uçları eşleşir; kalça/gövde örneklerinde ardışık en yüksek dönüş farkı yaklaşık 3,71 derece.
- Aynı mesafe 30 ve 60 FPS adımlarıyla oynatıldığında faz farkı 0,000000004'ten küçüktür. Durunca döngü ilerlemez; ani konum sıçraması koşu adımı olarak yorumlanmaz.
- Yeniden üretim: `python tools/bake-cmu-locomotion-v91.py /path/to/bvh-directory` (NumPy/SciPy). BVH dizininde `35_01.bvh`, `35_17.bvh`, `09_01.bvh` bulunmalıdır. Ham BVH dosyaları oyunda indirilmez.

Attribution: The data used in this project was obtained from mocap.cs.cmu.edu. The database was created with funding from NSF EIA-0196217.
