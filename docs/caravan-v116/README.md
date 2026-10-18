# Toplama odası ve kervanlar — V116

## Bu sürüm

- Tek Toplama kapısı, at arabası simgesi. Gıda haritası sol duvarda; MS 80 şehir haritası sağ duvarda; açılır ahşap kasa karşı duvarda. Ortadaki masa kaldırıldı.
- Sürücü ve kervan tek hak: 1. seviyede 1, 10/20/30/40/50 seviyelerinde toplam 2/3/4/5/6. Hak otomatik hesaplanır; para/eşya ödüllerinin talep edilmesine bağlı değildir.
- Önceki işçi seferleri ve yükleri korunur. Eski seferler yeni kapasiteyi aşarsa bitene kadar yeni sefer başlatılamaz. Arka plandaki teslimat işi aynı kasaya aktarır.
- Soldaki yedi gıda rotası kervan başına 15 porsiyon getirir. Av rotası yalnızca et getirir. Gıda ve şehir seferleri aynı kervan havuzunu kullanır.
- Sağdaki 60 şehirden **mevcut beş üretim girdisi** (demir, bakır, odun, deri, keten) alınabilir. Bu sürüm on hammaddelik yeni üretim zincirini veya haftalık beslenme kurallarını uygulamaz; mevcut demirci ve yemekhane stoklarıyla uyumludur.
- Şehir araştırması elle yapılır. Fiyat ve şehir stoğu sunucunun 60 saniyelik dönemine bağlıdır. Süresi dolan tekliften alım yapılamaz; onaylanan ücret ve yük sefer boyunca sabittir. Bir kervan 15 birim taşır ve bir saatte döner.
- Her malzeme için 60 şehrin 15'inde bar 10, toplam 20'sinde bar en az 9, toplam 30'unda en az 8 olur. Bir şehir aynı üründe üst üste iki dakika bar 10 kalmaz. Bu bir oyun ekonomisi kuralıdır; tarihsel fiyat iddiası değildir.
- Ortak şehir stokları atomik ayrılır. Hesap kilidi, işlem makbuzu ve sahiplik kontrolü çift harcamayı, çift teslimatı ve başka hesaba erişimi önler. Üretim reçeteleri bu sürümde değiştirilmez.
- Baskın, gladyatör muhafız atama, Telegram ve tam hammadde işleme ağacı bu sürümün kapsamında değildir.

## Harita verisi

Koordinatlar [Stanford ORBIS](https://orbis.stanford.edu/) projesinin [sites_extended.csv](https://github.com/emeeks/orbis_v2/blob/master/sites_extended.csv) dosyasından seçilmiştir. ORBIS'in model yılı yaklaşık MS 200'dür; onun siyasi sınırları MS 80 diye kopyalanmamıştır. Harita MS 80'de var olan 60 kentten oluşan bir oyun seçkisidir. Constantinopolis kaydı dönemine uygun **Byzantion** adıyla kullanılır. MS 79'da yıkılan Pompeii ve Herculaneum, MS 80 sonrası kurulmuş kentler ve sonraki ilhakların sınırları eklenmemiştir. Dönem adlarının kontrol kaynağı: [Pleiades](https://pleiades.stoa.org/).

Kıyı çizgileri [world-atlas](https://github.com/topojson/world-atlas) / [Natural Earth](https://www.naturalearthdata.com/about/terms-of-use/) 1:110m kara verisidir; kıyılar yaklaşık ve modern referanslıdır. Deniz/kara ayrımı gösterilir, imparatorluk sınırı iddia edilmez. Üretim betiği projeksiyonu, seçkiyi ve varlıkları tekrar oluşturur; oyun çalışırken üçüncü taraf isteği yapılmaz.

## Doğrulama

`node tests/caravan-collection-v116.cjs`: PostgreSQL/PGlite üzerinde 1–50 seviye sınırları, geçmiş seferler, 60 şehir, fiyat süresi, ortak stok, tekrar deneme, hesap ayrımı, kapasite, tek teslimat ve diğer ödüllerin yeniden verilmemesi.

`node tests/caravan-browser-v116.cjs`: gerçek oda geometrisi ve gerçek arayüz betikleri, izole hesap verileriyle 1366×768, 932×430, 844×390 ve 667×375 boyutlarında. Tarayıcıda gerçek hesaba alım gönderilmez. Yazılım çizimiyle çalışan Chromium testi, telefonda FPS ölçümü değildir.

Dağıtım sırası: testler → Supabase migration → web dosyaları → canlı sürüm kontrolü. RPC'nin eski `workers` alanları yalnızca önbellekteki istemciler için uyumluluk takma adlarıdır; yeni arayüzde işçi sistemi bulunmaz.
