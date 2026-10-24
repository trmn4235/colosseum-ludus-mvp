# V176 — Gaius, 1x10 ve 2x5

- Konuşma ve bahis arka planı, kullanıcının ikinci ekindeki `8C4D243C-B7EB-4399-B7D5-DDDD76291116.jpeg` dosyasının değiştirilmemiş kopyasıdır (`assets/pit-v176/gaius.jpg`). Üst kadraj saçları kesmez. Ortak NPC fontu, sütunları ve alt konumu korunur; uzun cevaplar aynı sütunda satır kırar.
- Avlu görevlisinin adı Gaius'tur. Karşılama, ayrılma, müsabaka ve rakip konuşmaları doğal Türkçe olarak yenilendi. Favori yorumu kesin galibiyet sözü değildir. Hanedanlar ve bütün rakip isimleri kısa konuşmalarla gösterilir; hazırlığa dönülebilir.
- Avlunun konuşmasında 1x10 ve 2x5 vardır. Çevrimiçi seçim kaldırıldı. Ana arenanın multiplayer modlarına dokunulmadı.
- 1x10: ilk dört savaşçı görünür ve aktiftir; altı savaşçı kapıda bekler. Her ölüm bir giriş açar. Eşzamanlı ölümlerde girişler 0,65 saniye arayla sırayla yapılır. Sağ üst sayaç giren toplamı gösterir: 4/10 → 10/10. Bekleyenler ölmüş rakip sayılmaz; girişler tamamlanmadan zafer verilmez.
- 2x5: beş ikili takım ve on gladyatör baştan aktiftir. Oyuncu kendi iki hazır gladyatörünü, her biri için ayrı avlu silahını seçer. İlk gladyatörü oyuncu, takım arkadaşını yapay zekâ yönetir. Dostlar hedef seçilmez. İlk gladyatör düşünce yaşayan takım arkadaşı kazanabilir.
- Katılımcılar sunucuda belirlenir; Gaius'un isim listesi ile savaş kaydının listesi aynıdır. Kişisel eşya kullanılmaz. Galibiyet seçilen gladyatöre, 2x5'te iki takım üyesine de birer Şan verir. Aynı sonuç tekrar gönderildiğinde ödül yinelenmez.
- Eski dört/iki kişilik savaş kayıtları ve mevcut bahis kuponları kendi sürümlerinde çalışmaya devam eder. Bahis gösterisinin kuralları bu değişikliğin parçası değildir.

## Kontroller

`tests/pit-round-v176.cjs` gerçek yerel PostgreSQL fonksiyonları ile oyun simülasyonunu birlikte kontrol eder: sıra, eşzamanlı ölüm, erken zafer, beş takım, dost hedefi, takım arkadaşının zaferi, sahiplik, hazır olma, silahlar, istek/ödül tekrarı ve eski savaşlar.

`tests/pit-browser-v176.cjs` bu testin oluşturduğu `/tmp/pit-fixtures-v176.json` ile gerçek sayfaları açar: 932×430, 667×375 ve 390×844; konuşma ve geri dönüşler, bütün isimler, iki aşamalı seçim, arka plan, taşma ve savaş sahnesi. API yanıtları test verisidir; gerçek oyuncularla maç başlatılmaz. Yazılımsal WebGL testi, fiziksel iPhone GPU performansı ölçümü değildir.

```sh
LUDUS_PGLITE_MODULE=/tmp/avlu-tools/node_modules/@electric-sql/pglite node tests/pit-round-v176.cjs
CHROMIUM_PATH=/tmp/chromium node tests/pit-browser-v176.cjs
```

Yerel test bağımlılığı: PGlite 0.5.11. Migration Supabase CLI 2.122.0 ile oluşturuldu. Şema değişikliği yeni tablo açmaz; yalnızca avlu işlevlerini genişletir. Özel işlevler doğrudan istemcilere açılmaz.
