# V230 — İşçiler ve kervan savunması

İsim düzenleyicisi iOS görsel görünüm alanının üstünde açılır. Kaydetme ve iptal görünür kalır. Alışveriş işçi kartlarında portre ile üç metin satırı ayrı sütunlardadır; sekiz kart iki sıraya sığar.

Her hesabın yeni işçili alışveriş seferleri beşli gruplarda sayılır. Her grupta rastgele seçilen tam iki sefer saldırıya uğrar; başarısız istekler ve tekrar gönderimler sayılmaz. Eski seferler etkilenmez. Saldırı bir dakika sonra (çok kısa seferlerde sürenin dörtte birinde) görünür olur. İşçi sayısı yeşile döner ve İşçilerim → Seferler savunmaya giriş sağlar. En fazla iki saldırı kartı aynı anda gösterilir; diğerleri sayfalıdır.

Kervanın refakatçisi varsa onlardan biri, yoksa hesaba ait müsait bir gladyatör seçilir. Oyuncu orman savaşına girer; yaylı işçiler dost bot olarak ok atar. Hasar okçuluk seviyesine bağlıdır (9–28), oklar sınırlıdır. Kontroller sunucuda aynı rastgele tohumla yeniden oynatılarak sonuç doğrulanır. Giriş ve sonuç tekrarları tek savaş kaydını kullanır.

Zafer yükü korur. Yenilgi yükün aşağı yuvarlanan yarısını kaybettirir; işçiler geri döner. Katılınmayan savaş dönüşte yay, ok, hasar ve refakatçi gücüyle otomatik çözülür. Girilip tamamlanmayan savaş süre sonunda kaybedilir. Kullanılmayan oklar iade edilir. Mevcut sefer eğitimi/teslimat EXP sistemi tek teslimatta çalışır. Doğrulanmış sonuç yalnız servis rolü tarafından kaydedilir; hesaba ait olmayan saldırı ve gladyatör seçilemez.

Avludaki dinlenen zincirli gürz tutuşu aşağı yönelir. Zincir ve top, karakterin dönüşünden bağımsız dünya yerçekimi yönünde sarkar. Saldırı/eğitim pozları korunur.

Doğrulama: PGlite işlem/yetki/tekrar/2-of-5/teslimat testleri; deterministik savaş, ok tüketimi ve hasar testleri; Chromium/WebKit klavye boyutlu görünüm, işçi kartı ve HUD testleri; gerçek 3B avlu ve savunma sayfası testleri. Gerçek iPhone klavyesi ayrıca cihaz üzerinde kontrol edilmelidir.

Dağıtım: migration saldırı üretimini kapalı oluşturur. Edge Function ve istemci yayımlandıktan sonra `ludus_worker_private.defense_config_v230.enabled` açılır. Yeni savaş motoru eski baskınların doğrulayıcısını değiştirmez.
