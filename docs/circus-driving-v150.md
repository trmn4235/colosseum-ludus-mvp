# V150 — Oyuncu kontrollü hipodrom yarışı

Kendi iki atıyla kayıt olup **Takımla piste çık** denildiğinde V150 kontrol sözleşmesiyle yeni yarış başlar.

- Sol alttaki iki yön düğmesi veya A/D, sol/sağ ok tuşları arabanın pist içindeki konumunu değiştirir. İleri koşu sürer. Yönü bırakma, dokunma iptali, odak kaybı ve sekme gizlenmesi direksiyonu serbest bırakır. Pist sınırları ve yakındaki arabaların alanına yatay geçiş engellenir.
- Ekranın altındaki yarı saydam zamanlama barında ok bir ucu 0,85 saniyede geçer; ahırdaki altı saniyelik barın yaklaşık yedi katı hızlıdır. Altın hedef %70–88 aralığıdır.
- Sağ alttaki **Hamle yap** veya boşluk tuşu ile hedef yakalanırsa 4 saniye boyunca baz hızın tam 1,5 katı uygulanır. Başarılı segment normal hıza göre iki saniye avantaj sağlar; yarış sonuna yakın segmentte kalan mesafe kadar avantaj hesaplanır.
- Başlangıç kondisyonu iki atın sunucudaki enerjisinden düşük olanıdır. Başarılı hamle 25 puan tüketir. Hızlanma dışında saniyede 2,5 puan toparlanır; tavan 100. Kondisyon yetmezken veya 5 saniyelik başarılı hamle aralığı dolmadan hızlanma açılamaz. Iska kondisyon tüketmez; hamleler arasında en az 0,8 saniye vardır.
- Küçük kondisyon göstergesi sol üsttedir. Sıralama üstte **1 / 4**, **2 / 4** biçiminde, kutusuz görünür. Dört sayısı gerçekten sahnedeki araba sayısından alınır.
- Kendi yarışında eski Batı Tribünü başlığı/takım listesi, cüzdan, Roma haritası, Tribüne dön ve Kamera düğmeleri gizlenir. Yarış izlerken de Roma/cüzdan gizlenir. Normal gişe gezisinde geri dönüşler korunur.
- Kazanan ve kaybeden için iki ayrı tam ekran fotoğraf gerçekçiliğinde tarihsel canlandırma görseli vardır. Sonuç başlığı, gerçek sıra/kupon ödeme tutarı HTML katmanıdır. Gişeye dön ve Yeni yarış ile devam edilir.
- Görseller hem kendi takımının sonucu hem bahis kuponunun sonucu için kullanılır. Katılım yarışı yeni bir para ödülü yaratmaz; bahis ödemesinin mevcut kuralları değişmez.

## Kayıt ve doğrulama

Kendi yarışında baz süreler ve onaylanmış hızlanma zamanları sunucuda saklanır. `boost` işlemi hesap/yarış sahipliği, katılım durumu, zaman damgası, kondisyon, bekleme ve bitiş kontrolü yapar. Dokunma anının sunucu saatinden en fazla 0,65 saniye geride olmasına izin verilir; gelecekteki zamanlar reddedilir. Aynı istek kimliğinin tekrarı ikinci hızlanma/kondisyon kesintisi oluşturmaz. İstemci ok animasyonu ve sunucu aynı kuralları kullanır.

Hamleler bittikten sonraki bitiş zamanları bunlardan hesaplanır; bitişte kazanan bu zamanların sırasına göre belirlenir. Kendi katılım yarışları kupon kabul etmez. Seyirci bahis yarışları mevcut rastgele ağırlıklı sonuç düzenini kullanır ve `boost` kabul etmez.

Direksiyon konumu istemci içinde çizilir; hızlanma, kondisyon ve bitiş avantajı sunucuda tutulur. Bu sürüm temas hasarı veya araba devrilmesi eklemez. Yarış kondisyonu mevcut ahır enerjisinden başlar, ahırdaki kalıcı enerjiyi bu sürüm değiştirmez. Güncellemeden önce başlatılmış yarışın mevcut sonucu korunur; kontrol ve hızlanma yeni açılan katılım yarışlarında devreye girer.

## Testler

- `tests/circus-driving-v150.sql`: gerçek veritabanında geçici kayıtlarla hedef/ıska, %50 segment, kondisyon/bekleme/tarih reddi, aynı isteğin tekrarı, hızlanmayla kazananın değişmesi, hesap parası ve bahis yarışlarının korunması. Tüm değişiklikler geri alınır.
- `tests/circus-driving-rules-v150.cjs`: hızlı ok, hedef fazı, tam %50 hız oranı, kondisyon tüketim/toparlanma ve direksiyon sınırı/yan yana araba aralığı.
- `tests/circus-driving-v150.cjs`: gerçek 3D sahnede hesap yanıtları taklit edilerek yönler, hareketli ok, başarılı/başarısız hamle, gerçek mesafeden hız oranı, kondisyon kilidi, temiz yarış arayüzü, dört ekran boyutu ve iki fotoğraflı sonuç.
- `tests/circus-office-v149.cjs`: önceki tek gişe/kupon/kendi atlarıyla katılım akışı yeni sonuç dönüşüne göre güncellenir.

Kontrol testinde yazılımsal çizimin maliyeti nedeniyle piksel oranı 0,65 ve gölgeler kapalıdır; sürekli GPU çizimi yerine ekran görüntüsü alınırken gerçek sahne çizilir, güncelleme/kontrol döngüsü çalışmaya devam eder. Oyun kodunda bu kısıtlama yoktur.

Yerel testler Chromium/SwiftShader'dır; fiziksel iPhone/Safari FPS ölçümü değildir.

Güvenlik danışmanındaki özel heat/receipt tablolarının politikasız RLS bilgisi, doğrudan tablo erişiminin kapalı olduğu mevcut tasarımdır. Anon rolünün özel şema, receipt SELECT ve genel RPC erişimi olmadığı; authenticated rolünün de receipt SELECT/heat UPDATE yetkisi olmadığı ayrıca sorgulanarak doğrulandı. [RLS danışman açıklaması](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) · [Anon erişim açıklaması](https://supabase.com/docs/guides/database/database-advisors?queryGroups=lint&lint=0012_auth_allow_anonymous_sign_ins).
