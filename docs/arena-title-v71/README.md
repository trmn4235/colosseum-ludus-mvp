# Arena başlık tasarımı V71

Düz iki satırlı başlık yerine bir oyun amblemi düzeni:

- Bordo kalkan, çapraz kılıçlar, altın defne ve ince yatay çizgiler.
- Aralıklı büyük harflerle SAVAŞINI SEÇ; küçük ve ikincil slogan.
- Arka planla bütünleşen yumuşak koyu gölge, ayrı dikdörtgen panel yok.
- Gerçek `h1` ve paragraf korunur. Amblem dekoratif CSS/SVG'dir, ek
  erişilebilirlik duyurusu üretmez ve yüksek piksel yoğunluğunda nettir.
- Yalnız seçim başlığına uygulanır; diğer sayfalardaki başlıklar değişmez.
- Mevcut afişler ve giriş arka planı aynıdır. Kısa ekranda başlık için
  ayrılan yükseklik kart oranını bozmadan karşılanır.

Varlık: `assets/arena-title-crest-v71.svg`.
Stil: `arena-title-v71.css`.

Chromium: 1536×706, 844×390, 667×375 ve 568×320 görünümlerinde afiş
oranı, başlık/afiş çakışmaması, geri düğmesi, görsel yüklenmesi ve
hazırlığa geçiş kapsamı `tests/arena-art-v69.cjs` ile geçti. Kuyruk
yerleşimi de regresyon kontrolünden geçti. Canlı oyun oturumu veya
fiziksel Safari/iPhone testi yapılmadı. Yerel sürüm; yayınlanmadı.

`selection-mobile.png`: gerçek HTML/CSS çıktısı; hesap bilgisi testte
yükleniyor durumunda bırakılır.
