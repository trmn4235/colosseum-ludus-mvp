# V149 — Tek gişe, küçük oda, bahis geçmişi ve kendi takımınla yarış

- Yürüme sınırları 18,2 × 36 m'den 8,2 × 10 m'ye indirildi: 655,2 → 82 m², yaklaşık sekizde bir. Çevreleyen oda 12 × 12 m. Tüm hipodromun/pistin ölçeği korunur.
- İki ayrı tezgâh yerine tek kapalı gişe; bronz parmaklık, servis açıklığı, taş tezgâh, arkasında bir giyimli memur, önünde iki giyimli ziyaretçi. Üç model mevcut sürücü varlığından, kollara doğal dinlenme pozu verilerek türetilir.
- Beyaz büyük salon yerine eskitilmiş taş döşeme, kireç sıva, bordo duvar altları, ahşap kirişli tavan, taş sütunlar ve düşük güçlü sıcak iç ışık. Yeni üçüncü taraf varlık yok.
- Eski geniş batı tribünü boşluğu odanın boyutuna daraltıldı; çevredeki koltuk ve seyirciler geri getirildi. Batıdaki bölünmüş koltuk parçalarının yanlış doğu tarafına eklenmesi de düzeltildi.
- Tek memurun iki hizmeti: **Bahis yap**, **Yarışmaya katıl**. Tribün oturağı odanın pist kenarında.
- Bahis ekranının sağında hesap sahibinin geçmiş kuponları: takım, tarih, oran, bedel, bekliyor/kazanç/kayıp. Kazanç net tutardır; yatırılan kupon dahil toplam ödeme ayrıca yazılır. Örnek: 100 × 1,5 → net +50 D / ödeme 150 D. Kaybedilen 100 D → −100 D.
- Geçmiş sunucudaki mevcut yarış kayıtlarından gelir; eski kuponlar da görünür. Üç kayıt/sayfa, tamamına önceki/sonraki düğmeleriyle erişim; sayfalar sunucuda sınırlanır. Başka hesabın kuponları veya bitmemiş yarışın kazananı gösterilmez.
- Katılım ayrı bir sayfa/panel: kendi atlarından iki farklı hazır at seçimi, iki atın fotoğraf/renk/istatistikleri, kayıt onayı ve aynı ekranda **Takımla piste çık**.
- Bitmiş yarıştan doğrudan yeni katılım açılır. Devam eden kendi yarışına geri dönülür. Aynı yarışta kupon ve katılımın birlikte olmaması korunur.
- Yarışa uygun olmayan atlar seçimden silinmez; yaş, açlık, düşük enerji, gebelik, antrenman, satış, düello dinlenmesi gerekçeleri gösterilir. Atı hazırlamak için **Ahıra git** bağlantısı gerçek ahır odasını açar; yönlendirme parametresi tüketilir.
- Bahis tutarı ve at seçimi panel yenilendiğinde korunur. Yanıtı kaybolmuş işlemler aynı istek kimliğiyle yeniden denenir; ikinci kesinti/ödeme yoktur.
- Katılım ücretsiz, otomatik sürüş ve mevcut dört araba/sekiz at/iki tur kuralları korunur. Bu güncelleme manuel sürüş, katılım ödülü veya yeni at enerjisi/deneyim kuralı eklemez.

## Kontrol

`tests/circus-office-v149.sql`: gerçek sunucuda geçici hesap/atlarla kazanç-kayıp geçmişi, sayfalama, hesap izolasyonu, hazır olmayan at gerekçeleri ve reddi, kendi iki atıyla kayıt/start, aynı isteğin tekrarı ve tek ödeme. Her değişiklik ROLLBACK ile geri alınır.

`tests/circus-office-v149.cjs`: gerçek 3D sahnede hesap yanıtları taklit edilerek oda boyutu, üç NPC, tek gişe, yürüyüş/çarpışma, iki hizmet, sağ geçmiş/sayfalama, dört ekran boyutu, sekiz at, kayıp kupon yanıtını yeniden deneme, tribün, dört arabanın ve tekerleklerin ilerlemesi, iki farklı kendi atıyla kayıt/start, yarışı yeniden izleme ve uygun olmayan at açıklamaları. Chromium/SwiftShader; fiziksel iPhone/Safari FPS ölçümü değildir.

Veritabanında yeni tablo veya erişim yetkisi yok; mevcut auth.uid kontrollü özel API'nin dönüşü genişletildi. Danışmandaki özel heat/receipt tablolarının politikasız RLS bilgisi kasıtlıdır: doğrudan tablo erişimi yoktur. [Danışman açıklaması](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy). Başka modüllere ait mevcut uyarılar bu güncellemenin kapsamı dışındadır.
