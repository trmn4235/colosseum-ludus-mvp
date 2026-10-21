# V151 — Görsel sığdırma, sade gişe ve hassas yarış kontrolleri

- Sonuç fotoğrafı `object-fit: contain` ile tamamı görünür. Yatay ekranda yazılar fotoğrafın yanındadır; dikey ekranda altındadır. Taç, baş, atlar ve tekerlekler kırpılmaz; metin fotoğrafın üstünü kapatmaz. Kenar boşluğu aynı görselin bulanık bir katmanıyla doldurulur. Telefonun güvenli ekran alanı hesaba katılır.
- Gişedeki Batı Tribünü/takım listesi kutusu, yönlendirme bandı ve yazılı asma levha kaldırıldı. Roma dönüşü ve konuşma gibi işlevsel düğmeler korunur.
- Cüzdan çerçevesizdir. Hemen altında 1–4 sırası, takımın araba rengiyle yazılır; sıra yarış verisinden sıralanır. Kendi yarışındaki kutusuz `1 / 4` göstergesi korunur.
- Sıra bekleyen iki kişi ve görünmez çarpışma alanları kaldırıldı; gişe memuru kaldı.
- Direksiyon aniden sabit hıza geçmez. Hedef yana hız 3,8'den 2,35 m/s'ye indirildi; basarken yumuşak hızlanma, bırakırken sönümlenme ve yön değişiminde kademeli geçiş var. Araç açısı da yumuşatılır. Pist ve komşu araba sınırları korunur.
- Hamle ilk dokunuşta alınır; parmak kalkana kadar okun hedef dışına gitmesi sonucu değiştirmez. Ekranda çizilmiş son ok konumunun zamanı kullanılır. İstek gidiş/dönüş süresinin orta noktasıyla sunucu saat farkı hesaplanır; tam dönüş süresinin saat farkına eklenmesi kaldırıldı.
- Başarı sonrası yüzde/hızlanma yazıları kaldırıldı. Kısa İsabet/Kaçırdın ve kondisyon/bekleme bilgileri kalır. Hız ve kondisyonun sunucudaki V150 kuralları değişmez; yeni bir ekonomi veya veritabanı işlemi eklenmedi.
- Oda: daha nötr sıva/taş, mat zemin, sekiz yüzey varyantı ve farklı damar yönleri, ince derzler, ahşap tavan birleşimleri, bordo kabartmalı duvar panoları, çıtalı tezgâh ve taş kenar, küçük bronz bağlantılar, gerçek ölçekte kâğıt/kalem/mühür/papirüs ve seramik kap, daha dengeli gün ışığı ve temas gölgeleri. Mevcut malzemeler ve özgün düşük poligonlu geometri kullanıldı; yeni üçüncü taraf varlık yok.

## Doğrulama

- `tests/circus-polish-v151.cjs`: gerçek 3D sahnede hesap yanıtları taklit edilir. Hedefte ilk basış, hedef dışına çıkıldıktan 400 ms sonra bırakış: tek başarılı hamle. Hızın 1,5 katı, kondisyon kilidi ve eski akışlar korunur. Tek NPC, kaldırılan engeller, dört renkli sıralama, çerçevesiz para; iki sonuç görseli dört boyutta kırpılmadan ve yazıyla çakışmadan kontrol edilir.
- `tests/circus-results-fit-v151.cjs`: gerçek sonuç HTML/CSS'siyle iki görsel ve 932×430, 667×375, 390×844, 1440×900 boyutları. Görsel alanı, ayrı yazı alanı ve taşma kontrolü.
- `tests/circus-office-v149.cjs`: gişe, kupon, geçmiş ve kendi atlarıyla katılım; kuyruk kaldırıldığı için güncellenir.
- `tests/circus-driving-rules-v150.cjs`: V151 kurallarıyla mevcut hız/kondisyon kontrolü.

Tarayıcı testleri Chromium/SwiftShader'dır; kontrol döngüsü çalışırken GPU çizimi ekran görüntüsü alınacağı zaman yapılır, piksel oranı 0,65 ve gölgeler kapalıdır. Oyunda bu test kısıtları yoktur. Fiziksel iPhone/Safari FPS ölçümü değildir.
