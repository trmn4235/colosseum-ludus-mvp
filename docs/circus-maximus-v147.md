# Circus Maximus V147 — gişe, kupon, tribün ve dört araba

## Oyuncu akışı

- Hipodrom artık ludus sahibinin kayıtlı görünümüyle batı seyirci galerisine açılır. Misafirler varsayılan sahip modeliyle gezebilir.
- Analog veya WASD/yön tuşlarıyla yürüme, sürükleyerek kamera, tezgâh çarpışmaları ve galeri sınırları vardır.
- Gişe memuruna yaklaşınca konuşma düğmesi açılır. Dört takım sekmesinin her biri iki at gösterir: toplam sekiz ayrı at, isim ve renk, genel puan ve dokuz istatistik.
- İstatistikler: hız, dayanıklılık, hızlanma, çeviklik, güç, denge, cesaret, patlama ve toparlanma.
- İki atın genel puan ortalaması takım gücüdür. Güç sırasına verilen sabit ondalık oranlar 1,5 / 1,9 / 2,3 / 3,9.
- Kupon bedeli 10–10.000 denarius, 10'un katlarıdır. Panel toplam ödemeyi yatırılan bedel dahil gösterir: 100 × 1,5 = 150 D; net kazanç 50 D.
- Kuponu onayladıktan sonra tribüne yürüyüp oturulur. Yarış oturma yerinden başlatılır; sabit seyirci kamerası yarışı izler, Yakın izle/Geniş açı değiştirilebilir.
- Dört arabanın her birinde iki at ve sürücü bulunur; iki tur yarışılır. İki atın renkleri bağımsızdır. Tekerlekler gerçek şerit mesafesiyle döner.
- Katılım görevlisinden ahırdaki iki farklı uygun at seçilir. Dördüncü arabanın takım adı ludus adı olur; atların istatistik ve renkleri hesaptan gelir, takım oranları yeniden sıralanır.
- Katılım için yetişkin, tok, enerji ≥35 olan; gebe, eğitimde, satışta veya düello beklemesinde olmayan iki at gerekir. Yarış başlangıcında sahiplik/uygunluk tekrar doğrulanır.
- Kendi takımınla katılım ve kuponlu izleme ayrı akışlardır. Katılım ücretsizdir, sürüş otomatik ve üç araba kamerası vardır. Bu sürüm manuel sürüş, katılım ödülü veya at deneyim/enerji değişikliği eklemez.
- Genel görünüm düğmesi mimari incelemeye döner. `?preview=1` doğrudan mimari önizlemeyi açar.

## Sunucu ve kayıt

`public.ludus_circus` yalnızca oturum açmış hesaplara açık, `security invoker` bir sarmalayıcıdır. Yetkili işlemler, boş search_path ve auth.uid denetimi olan özel şemadaki API'de yürür. Heat ve receipt tabloları RLS ile kapalıdır ve istemciye tablo erişimi verilmez.

Hesap satırı kilidi altında kupon bedeli düşer, istek UUID'si ile aynı işlemin tekrarı ikinci kez para kesmez. Yanıt kaybolursa bekleyen işlem tarayıcıda hesap bazında korunur. Yarış başladıktan sonra kupon veya takım değiştirilemez. Yarış sıralaması başlangıçta sunucuda çekilir; takım gücünün dördüncü kuvveti kazanma ağırlığıdır. Güçlü takımın şansı daha yüksektir, kazanması garanti değildir.

İstemci görünümü sunucunun başlangıç zamanı ve yarış sürelerinden hesaplanır; sekme gizlense/yenilense de yarış ilerler. Kazanç ancak sunucudaki bitiş süresinden sonra ve yalnızca bir kez hesaba geçer. State çağrısı bitmiş yarışı tahsil eder; kullanıcı yarış sırasında çıkarsa sonraki hipodrom ziyaretinde ödeme yapılır. Yarışlar hesap başına oluşturulur, paylaşılan canlı çok oyunculu yarış değildir.

## Varlıklar ve performans

V145 mimari korunur; batıdaki ilgili oturma alanı galeri için açılır, o bölümde seyirci/merdiven çakışmaları kaldırılır. Mermer, bordo panolar, ahşap gişe, sütunlar, oturma sıraları ve korkuluk eklenir. Galeri malzemeleri ayrı kopyalarda vertexColors kapalı olarak kullanılır; mimarinin vertex renklerine müdahale edilmez.

Mevcut LudusOwner modeli ve yürüyüş klibi, mevcut giyimli sürücü modeli, Panko10 araba türevi ve Warhorse yeniden kullanılır. Yeni bir üçüncü taraf varlık indirilmedi. İlgili lisanslar: OWNER_ASSETS.md ve assets/circus-v146/SOURCES.md. Galeri geometrisi bu proje için oluşturuldu.

Ziyaretçi dururken veya gişe açıkken sürekli çizim yapılmaz; hareket/yarış sırasında devam eder. Misafirden hesap bakiyesi alınmaz, gerçek bahis yapılamaz.

## Doğrulama

- `tests/circus-economy-v147.sql`: geçici kayıtlarla gerçek sunucuda sekiz at, kupon bedeli, aynı isteğin tekrarı, değiştirilmiş istek reddi, kapanmış bahis, erken ödeme olmaması, tek tahsil, iki farklı sahip olunan atla katılım, rol izinleri ve oturumsuz erişim. Tüm kayıt ve para değişiklikleri ROLLBACK ile geri alınır.
- `tests/circus-visit-v147.cjs`: hesap yanıtları taklit edilerek gerçek tarayıcıda yürüyüş, sınırlar, tezgâh çarpışması, sekiz farklı at ve 18 istatistik/sekme, dört ekran boyutu, yanıtı kaybolmuş kuponun aynı kimlikle tekrarı, tribün, yakınlaştırma, dört arabanın hareketi, ödeme görünümü ve ahır takımının piste çıkışı.
- Görsel kontrol: misafir ve hesap ekranları, yatay/dikey gişe, tribünden görünüm. Chromium/SwiftShader testidir; fiziksel iPhone/Safari FPS ölçümü değildir.

Güvenlik danışmanı özel iki tabloda politikasız RLS'yi bilgi olarak bildirir: bu kasıtlı deny-by-default tasarımdır, tablo erişim yetkisi yoktur. Mevcut başka modüllerin danışman uyarıları bu değişikliğin kapsamında değiştirilmez. [RLS danışman açıklaması](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).
