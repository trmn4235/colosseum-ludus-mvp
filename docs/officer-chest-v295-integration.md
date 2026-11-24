# V295 Roma subayı göğüs zırhı

`chest-officer` ve `chest-officer-black` iki ayrı envanter kimliğidir. Model kimlikleri sırasıyla `officer_chest` ve `officer_chest_black`. İkisi de `chest` yuvasına takılır ve işlemeli göğüs zırhıyla aynı tarifi ve istatistik kurallarını kullanır. Üretim her işlemde seçilen renkten bir eşya verir. Demirci papirüsleri mevcut yükseltilebilir eşya kurallarıyla çalışır.

Her iki renk tek bir 2.999 üçgenlik GLB kullanır. Materyaller ayrıdır. Siyah sürümde ana yüzey değişirken altın süslemeler korunur. İki ikon kendi materyali uygulanmış modelden üretilmiştir. İskelete uydurulan geometri aynı vücut modeli için yeniden kullanılabilir. Kuşanma, renk değiştirme ve ganimetin görünümü ana model ile siyah dokunun yüklenmesini takip eder.

- Kaynak, üretici, lisans, ölçümler ve dosya özetleri `assets/armor-v295/source-manifest.json` içinde yer alır. Oyundan erişilebilen atıflar `asset-credits-v21.txt` dosyasındadır.
- Katalog ve üretim kayıtları `supabase/migrations/20261124092115_officer_chest_v295.sql` ile eklenir.
- Dokuz hareket, farklı karakterlerde eşzamanlı renk kullanımı, renk değişimi ve ganimetin yüklenmesi için `node --test tests/officer-chest-v295.cjs` çalıştırılır.
- Gerçek arenada WebGL kontrolleri `tests/free-armour-browser-v295.cjs` içinde bulunur. Fiziksel iPhone performansı ayrıca ölçülmelidir.
