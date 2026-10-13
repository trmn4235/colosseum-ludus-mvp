# Arena performans V96

V95 `cad91c8` ile aynı model, doku, kamera ve 20 gladyatörlü kontrollü sahne karşılaştırıldı. Yazılımsal GPU kullanan Chromium ölçümüdür; fiziksel iPhone FPS ölçümü değildir.

| Ölçüm | Önce | V96 |
| --- | ---: | ---: |
| Toplam çizim çağrısı | 302 | 222 |
| Çizilen üçgen | 1.305.128 | 1.305.128 |
| Görünür vücut parçası | 100 | 20 |
| Karakter iskeleti | 160 | 20 |
| GPU doku sayacı (kemik dokuları dahil) | 183 | 103 |
| Duraklatılmış 120 karede poz hesaplaması | 972 | 0 |

Bu sahnede çizim çağrısı %26,5 azaldı. Bu oran FPS artışı anlamına gelmez. Dört 3D sayfasında, yedi sınıf ve dokuz hareket senaryosunda 1.149.120 kemik/ekipman matris değeri birebir eşleşti. Konum, UV, normal ve kemik ağırlığı verileri değişmeden birleştirildi. Model veya görsel dosyaları yeniden sıkıştırılmadı.

## Değişiklikler

- `Arena hazırlanıyor` kutusu ve eski giriş kontrolleri kaldırıldı. Mevcut arena görseli üzerinde sahne hazırlanır; oyun ve göstergeler ilk çizim tamamlanınca açılır. Kritik yükleme hatalarının tekrar deneme yolu korunur.
- Beş vücut parçası ortak geometriyle tek çizime birleşir. Yeni ekipmanla değiştirilen üç gizli parça ve fazladan iskeletler kaldırılır. İlk boyut hesabı korunduğu için karakter yüksekliği değişmez. Aynı düzenleme Ludus, savaş seçimi ve multiplayer modellerine uygulanır.
- Hazırlık ve duraklatmada sürekli 3D çizim durur. Görüş alanı dışındaki uzak karakterlerin poz hesabı bekler; dövüş simülasyonu ve dünya konumları devam eder. Yerleşmiş cesetler tekrar hesaplanmaz.
- Telefonda Otomatik görünüm, sürekli yavaş karelerde çözünürlük ölçeğini küçük adımlarla azaltır; uzun süre toparlanınca geri yükseltir. Manuel Detaylı/Akıcı seçimi duraklatma menüsündedir. Otomatik mobil gölgeler en fazla 30 Hz güncellenir. Oyun kuralları ve 60 Hz simülasyon değişmedi.
- Kıvılcım/toz nesneleri yeniden kullanılır, sayıları sınırlandırılır. Kullanılmayan eski taş doku üretimi, malzemeler, bayrak döngüsü ve giriş kodu kaldırıldı.
- Kolezyum ön yüklemesi yalnız savaş seçimi sayfasında yapılır. Ludus ve açılmış arenada gereksiz kolezyum yüklemesi kaldırıldı. Karakter önizlemesi 30 Hz ile sınırlı.
- Sayfa geçişleri ve uygulama başlangıcı V96 önbellek anahtarını kullanır. Asset lisansları kaynak dosyasına taşındı.

## Doğrulama

94 davranış kontrolü geçti. Chromium'da dört ekran boyutu (667×375, 844×390, 932×430, 1024×768), ilk giriş kutusunun yokluğu, kalite seçenekleri, duraklatma, ödül kaydı ve eksik modelin hata/tekrar deneme akışı kontrol edildi; JavaScript hatası yok. Hesap ve ödül çağrıları yerel test verisiyle çalışır, canlı oyuncu hesabını etkilemez.

WebKit paketi indirildi; bu çalışma ortamındaki eksik sistem kütüphaneleri ve kurulum yetkileri nedeniyle motor çalıştırılamadı. Gerçek iPhone'da uzun savaş, ısınma ve FPS kazanımı henüz ölçülmedi.

```sh
# Playwright ve @electric-sql/pglite test ortamında kurulu olmalıdır.
node --test tests/adaptive-quality-v96.test.cjs tests/arena-timing-v94.test.cjs tests/movement-v39.test.cjs tests/combat-feel-v23.test.cjs tests/death-v41.test.cjs tests/bot-defense-v72.test.cjs tests/equipment-arena-v30.test.cjs tests/arena-ui-v78.test.cjs
LUDUS_BASELINE_ROOT=/path/to/v95 node tests/arena-performance-v96.cjs
CHROMIUM_EXECUTABLE_PATH=/path/to/chromium node tests/arena-browser-v96.cjs
```
