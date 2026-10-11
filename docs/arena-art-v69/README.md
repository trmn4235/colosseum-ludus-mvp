# Arena giriş görselleri V69

Kullanıcının onayladığı 4x5 / Solo20 ortak afişi ve Multiplayer afişi
gerçek seçim düğmelerine uygulandı. Görsellerdeki başlıklar korunur;
erişilebilir düğme isimleri ve mevcut seçim olayları değiştirilmez.
İki kart ortak görselden CSS background-position ile gösterilir;
yeniden çizim/kırpılmış dosya veya gerilmiş kart oranı kullanılmaz.

Multiplayer bekleme ekranında afiş solda, mevcut gerçek sayaç/oyuncu
bilgisi/iptal kontrolü sağdadır. Bu düzen sadece lobiye uygulanır;
maç HUD'u veya ağ/ödül mantığı değiştirilmez.

Gladyatör detayındaki transparan canlı WebGL karakterin arkasına sade
hazırlık odası kondu. Mevcut model ve ekipman korunur. 3B önizleme
yüklenemezse eski opak portre yedeği korunur; bu yedek portrede yeni
oda arka planı görünmeyebilir. Giriş görseli, oyun adı ve görev resimleri
değiştirilmedi.

## Varlıklar

- `assets/arena-modes-v69.webp`
- `assets/multiplayer-poster-v69.webp`
- `assets/gladiator-preparation-v69.webp`
- Tüketen stil: `arena-art-v69.css`, savas / multiplayer / ludus sayfaları.

Görseller yerleşik imagegen ile üretildi. İlk iki varlık konuşmada
onaylanan nihai afişlerdir. Yeni arka planın üretim özeti: fotoğraf
gerçekliğinde Roma gladyatör hazırlık odası, merkez boş, beyaz doğal taş,
kenarlarda bordo kumaş ve sınırlı ekipman, yumuşak yan gün ışığı,
karakterden düşük kontrast, insan/metin/arayüz yok. PNG kaynaklar
kayıpsız WebP'ye kodlandı; görsel içeriği değiştirilmedi.

## Doğrulama

- `tests/arena-art-v69.cjs`: gerçek HTML/CSS, scriptsiz güvenli fixture;
  dört yatay boyutta sekiz görünüm, kart oranları, erişilebilir adlar,
  dokunma hedefleri, resimlerin çözümlenmesi ve afiş/kontrol ayrımı.
- `tests/gladiator-exercise-ui-v46.cjs`: Chromium'da altı boyut;
  mevcut antrenman durumları ve kaydırmasız yerleşim geçti.
- `tests/gladiator-detail-preview-v47.cjs`: gerçek Three.js renderer,
  test modeliyle yaşam döngüsü/ekipman/temizlik kontrolleri geçti.
- Combat feel + equipment arena: 32/32 test geçti; gömülü kod derleniyor.
- Canlı eşleştirme, fiziksel iPhone ve Safari denenmedi.
- Bu sürüm yereldir; GitHub aktarımı veya yayın yapıldığı anlamına gelmez.

`selection-mobile.png` ve `queue-mobile.png` gerçek yerleşimden alınmış
örneklerdir; kuyruk sayıları ve isimler test verisidir.
