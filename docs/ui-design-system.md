# Colosseum & Ludus — Arayüz tasarım kuralları

Oyunun arayüz paleti **beyaz, bordo ve altındır**. Ortak renk kaynağı
`roman-ui-v56.css` içindeki `--ui-*` değişkenleridir. Yeni arayüzler renkleri
bu değişkenlerden alır; ekrana özel kahverengi/krem palet tanımlanmaz.

| Görev | Değişken | Renk |
| --- | --- | --- |
| Kartlar, paneller, girdi alanları | `--ui-white` | `#FFFFFF` |
| Sayfa zemini | `--ui-canvas` | `#FAF9F6` |
| Ana menü, başlıklar, birincil eylemler | `--ui-burgundy` | `#591823` |
| İnce çerçeve, odak, sikke | `--ui-gold` | `#B38B43` |
| Bordo üzerindeki tüm yazılar ve ikonlar | `--ui-gold-light` | `#E4C77B` |
| Gövde yazısı | `--ui-ink` | `#30232A` |
| Yardımcı yazı | `--ui-muted` | `#74656C` |
| Seçili satır / net gelir | `--ui-selected` | `#F6EDF0` |

## Uygulama

- Beyaz yüzey üzerinde başlık bordo; bordo yüzey üzerinde bütün metinler
  ve ikonlar açık altın sarısıdır (`#E4C77B`).
- Altın vurgu ve çerçeve rengidir. Büyük altın, bej, parşömen, kahverengi
  yüzeyler ve bronz geçişler kullanılmaz. Oyun varlıklarının (silah, taş,
  gladyatör, çevre) kendi renkleri bu arayüz kuralının dışındadır.
- Başlıklar Georgia, arayüz metinleri ve sayılar Arial/Helvetica kullanır.
  Sayısal değerler tabular-nums kullanır. Başlıklarda gölge kullanılmaz.
- Çerçeveler 1 px; köşeler 4–5 px; iç boşluklar normal ekranda 10–16 px,
  dar yatay ekranda en az 7 px. Köşe süsü metin alanına konulmaz.
- Ana eylem bordo dolgu ve altın kenardır. İkincil eylem beyaz dolgu,
  bordo metindir. Seçili menü ikonu kendi yüzeyine kontrast verir.
- Para bilgisi sikke, küçük para birimi etiketi ve belirgin tutardan oluşur.
  Tutar uygulamanın mevcut gerçek hesap verisinden güncellenir.
- Dar yatay ekranda listeler ve ayrıntılar kendi içlerinde kayar. Ana
  eylemler görünür kalır. Dikey telefonda mevcut yatay çevirme ekranı korunur.

## İlk uygulama: Pazar V67

- Sol menü 9 vw / en fazla 142 px yerine 6 vw / en fazla 88 px.
- Yeni ilan düğmesi alt panelden başlığın yanına taşındı.
- Benim İlanlarım satırları alt panelin bütün genişliğini kullanır.
- Seçili İlan ve Benim İlanlarım köşe süsleri kaldırıldı.
- Forum, Basic, ilan oluşturma ve onay pencereleri ortak paleti kullanır.
- V67 pazarla sınırlıydı; aşağıdaki V68 uygulaması temayı diğer ekranlara taşır.

## Ortak uygulama: V68

- `roman-theme-v68.css` bütün 14 HTML sayfasında, mevcut stillerden sonra
  yüklenir. Renk değişikliklerinin kaynağı yine ortak `--ui-*` değişkenleridir.
- Giriş, karakter düzenleyici, Ludus araçları, savaş hazırlığı, geliştirmeler,
  görevler, seviye, klan, pazar ve arena kontrolleri aynı paleti kullanır.
- Gladyatör/antrenman, ekipman, imparator görevleri, yemek, klan sandığı,
  mesajlar ve arkadaş pencereleri de ortak arayüz kapsamındadır.
- Beyaz seçili menüde yazı/ikon bordodur; bordo menüde açık altındır.
- Oyun mantığı, gerçek bakiye hesapları, 3B sahneler, oyuncunun arma renkleri,
  taşlar ve sağlık/enerji/takım göstergelerinin anlamlı renkleri korunur.
- Yükseklik, sayfalama, kaydırma ve mevcut yönlendirme davranışları korunur.
- Test kapsamı ve sınırlamalar: `docs/roman-theme-v68/README.md`.
