# Gladyatör ve at kariyeri · V162

Seçim sırasında gerçek geçmişe dayalı karar vermek için ortak Kariyer paneli eklenir. Arena hazırlığında seçili modun maç, galibiyet/mağlubiyet, K/D ve ortalama hasarı görünür. Gladyatör detayında ve kervanın ekip seçiminde Kariyer düğmesi bulunur. Ahırda ve hipodromun at seçim kartlarında yarış/galibiyet sayıları görünür.

Gladyatör paneli 4×5, Solo 20, Deniz Savaşı, Survival, Multiplayer Beta ve Kervan Baskını kayıtlarını ayrı gösterir. Henüz oynanamayan ranked ve klan modları için gerçek dışı sonuç oluşturulmaz. Survival koşuları kazanma oranının paydasına katılmaz. At yarışları düellolardan ve bahislerden ayrıdır; iki atın her biri kendi katılımını ve takımının sonucunu alır.

K/D aynı ölçülmüş karşılaşmalardaki toplam öldürme / toplam ölümdür. Ölüm sıfırsa oran `—` görünür; öldürme/ölüm sayıları ayrı görünmeye devam eder. Maç başına öldürme farklı bir metriktir. Hasar kalan canla sınırlıdır. Ölçülmeyen eski veriler NULL kalır; ortalamaların paydası ilgili metriği kayıtlı karşılaşmaların sayısıdır. Kayıt bilgisi görünümü eksik geçmişi ve eski zafer sayaçlarını açıklar.

## Geçmişin korunması

Eski arena sonuç işlemleri hesap başına yalnızca son beş ayrıntılı maçı bırakır. Yeni özel arşiv tamamlanan maçı güncelleme tetikleyicisiyle bu temizlikten önce saklar. Maç kimliği birincil anahtardır; tekrar gönderme veya sonucu yeniden açma yeni maç eklemez. Mevcut korunmuş maçlar aktarılır. Daha önce silinen ayrıntılar oluşturulmaz.

Kervanda her gladyatörün öldürme, ölüm ve verdiği/aldığı hasar sunucudaki tekrar oynatmadan çıkarılır. Telemetri kodu rastgele sayı çekmez ve savaş sonucunu değiştirmez. Sonuç ve bireysel kayıt aynı işlemde yazılır. Yeni doğrulama RPC'si yalnızca `service_role` tarafından çağrılabilir.

Online yakın dövüş ve mermi isabetleri gerçek can kaybını oyuncuların kariyer alanlarına ekler. Yeni bekleme odalarında sayaçlar sıfırdan başlar; sürüm geçişinde oynanmakta olan eski maçlar eksik veriyi sıfır gibi göstermez. Kariyer okuma RPC'si giriş yapmış hesabın şu anda sahip olduğu gladyatör ve at kimlikleriyle sınırlandırılır. Ad değişikliği veya atın satışı geçmişi sıfırlamaz.

## Yayın sırası

1. `20261022143121_participant_careers_v162.sql` geçişini uygula. Bu, eski istemcilerle uyumludur ve mevcut sonuçları değiştirmez.
2. `caravan-combat-v126` Edge Function'ını klasöründeki yeni `career-combat-v162.js` dahil bütün bağımlılıklarıyla yayımla. Mevcut doğrulama/auth ayarını koru.
3. Web dosyalarını birlikte yayımla. Yeni bağımlılıkların önbellek anahtarı `revision162`dir.
4. Gerçek hesapla arena, ahır, kervan ve yarış seçimlerini kontrol et; bir sonuç sonrasında yalnızca katılan kişilerin kayıtlarının değiştiğini doğrula.

## Doğrulama

Yerel bağımlılıklar: `@electric-sql/pglite@0.3.14`, Playwright ve bir Chromium kurulumu. Tarayıcı testinde isteğe bağlı `@sparticuz/chromium@138.0.2` kullanılır. Paketler oyun istemcisine eklenmez.

```
node tests/careers-v162.cjs
node tests/career-combat-v162.cjs
node tests/career-ui-v162.cjs
```

SQL testi geçişi bağımsız bir PostgreSQL çalışma alanına uygular; gerçek oyuncu verisi değiştirilmez. Kontroller: arşiv/temizlik, tekrar kayıt, mod ayrımı, eski eksik verinin paydası, yarışa gerçek katılım, at sahipliği devri, servis yetkisi, kullanıcı izolasyonu. Savaş testi ölçüm eklenmeden ve eklendikten sonraki deterministik sonuçları karşılaştırır. Arayüz testi masaüstü ve yatay telefonda taşmayı ve iç içe panel kapanışını kontrol eder.
