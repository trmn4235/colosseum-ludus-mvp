# Arena hareket akıcılığı · V94

13 Ekim 2026 (Türkiye). Karşılaştırma temeli V93: `453270f91dfdce0a1779ff1c93534f606e13be95`.

## Düzeltmeler

- Uzak karakterlerin 30 Hz poz zamanlayıcısı artan süreyi koruyor. Önceki kod her güncellemede saati sıfırlıyordu; 16,6 ms karelerde yaklaşık 20,1, 33,3 ms karelerde yaklaşık 15 poz/saniye üretiyordu. Bunlar kontrollü zamanlama sonuçlarıdır, telefon FPS ölçümü değildir.
- İskelet pozu hesaplanmayan karelerde yürüyen karakterlerin dünya konumu ve yönü güncelleniyor. Saldırı, savunma, hareket, hasar tepkisi ve ölüm geçişleri hemen çiziliyor. Yuvarlanma ve yere düşmenin kendi kök konumları/yönleri korunuyor.
- Oyuncunun darbe ve blok olaylarında tüm simülasyonu durduran 25–55 ms `hitStop` kaldırıldı. Ses, darbe tepkileri, kalkan geri tepmesi ve kısa kamera etkisi devam ediyor. Dövüş kuralları ve sabit 1/60 simülasyon adımı değişmedi.
- Arena, savaş hazırlığı, multiplayer ve Ludus'taki ortak kemik yönlendirmesi, her kemik değişiminde bütün alt ağacı tekrar güncellemiyor. Gerekli dünya koordinatı sorguları ve son kök güncellemesi dönüşümleri yayıyor. Animasyon kaydı, geometri ve dokular aynı.
- Giriş ve arena gezinmesi `revision94` açıyor; değişen locomotion betiğinin cache anahtarı yenilendi. FPS paneli `ARENA V94` gösteriyor.

## Doğrulama

- **86 test geçti:** zamanlama, darbe sırasında kesintisiz simülasyon, bot savunması, yakın dövüş, ekipman etkileri, hareket, ölüm/ganimet ve sonuç göstergeleri. Yeni 12 testin 9'u eski V93 üzerinde başarısız olurken V94 üzerinde 12/12 geçti.
- Gerçek GLB iskeletleriyle dört sayfa × yedi sınıf × dokuz hareket senaryosu karşılaştırıldı. **1.149.120 poz/matris değeri birebir aynı**, en büyük fark 0. [Ham sonuç](rig-results.json).
- Aynı karşılaştırmada arena/savaş hazırlığı/multiplayer için `updateWorldMatrix` çağrı sayısı sayfa başına **2.934.288 → 2.631.696**; Ludus için **1.736.476 → 1.691.404**. Bu sayılar genel FPS artışı yüzdesi değildir.
- **Chromium ve WebKit:** gerçek model/dokularla arena açılışı, HUD, yürüyüş/koşu, ayak yerleşimi, durma, teleport ve saldırıya geçiş geçti; JavaScript sayfa hatası yok. Kontrollü 30/60 Hz kare adımlarında tekrarlanan darbelere rağmen 1 saniyelik simülasyon ±1 sabit adım içinde tamamlandı; karakter kök konumu hatası 0. Bu bölümde simülasyon/animasyon adımları arasında yazılım GPU'suna gereksiz çizim kuyruğu gönderilmez; ekran görüntüleri gerçek çizimden alınır.
- 14 HTML sayfasının gömülü betikleri ve 98 yerel betik referansı derlendi/doğrulandı.

CPU ölçüm aracı eski sabit V81 betiği yerine artık sayfanın gerçekten yüklediği locomotion sürümünü kullanıyor. İki sürüm aynı güncel test aracıyla, aynı gerçek GLB ve boş doku görüntüleriyle çalıştırıldı. [Önce](cpu-before.json), [sonra](cpu-after.json). 12 karakter × 40 karelik örneklerin medyanları:

| Senaryo | V93, ms | V94, ms |
| --- | ---: | ---: |
| Yürüme | 220,6 | 219,8 |
| Koşma | 248,0 | 223,3 |
| Saldırı | 190,7 | 174,7 |
| Blok | 189,3 | 193,4 |
| Hasar tepkisi | 84,0 | 92,7 |
| Yuvarlanma | 227,6 | 255,6 |
| Ölüm | 252,7 | 252,9 |

CPU sonuçları karışık ve ortama bağlıdır. Tekrarlanan ağaç işinin azaldığı ve pozların korunduğu doğrulandı; bütün hareketlerde CPU hızlanması veya fiziksel telefonda belirli bir FPS kazanımı iddia edilmiyor. Ayrıntılı modellerin/gölgelerin GPU maliyeti sürüyor. Gerçek cihaz performansı arenadaki FPS panelinden ayrıca ölçülmelidir.

## Tekrar çalıştırma

```sh
node --test tests/arena-timing-v94.test.cjs tests/combat-feel-v23.test.cjs tests/bot-defense-v72.test.cjs tests/arena-ui-v78.test.cjs tests/equipment-arena-v30.test.cjs tests/movement-v39.test.cjs tests/death-v41.test.cjs
LUDUS_BASELINE_ROOT=/path/to/v93 node tests/arena-rig-v94.cjs
node tests/arena-motion-v81.cjs
LUDUS_TEST_ENGINE=webkit node tests/arena-motion-v81.cjs
```

Mevcut test ortamındaki Playwright, Chromium/WebKit bağımlılıkları ve `@electric-sql/pglite` gerekir. Testler izole hesap verileri kullanır; canlı oyuncu hesabında savaş/ödül işlemi yapmaz. SQL veya veritabanı değişikliği yok.
