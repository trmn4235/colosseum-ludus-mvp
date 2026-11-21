# V288 — Özel çalışanlar ve papirüs bilgileri

Doctore, Demirci, Aşçı, Seyis, Muhafız ve Doktor, kullanıcı tarafından onaylanan aynı iki sayfayı kullanır. Çalışan seçimi ayrı ekrandır. Profilde küçük fotoğraf portresi, koleksiyon sayıları ve öğrenilmiş etkin pasifler bulunur. Papirüsler sayfasında mesleğe ait 25 başlık, öğrenim metni ve etki görünür.

## Koleksiyon ve okuma

- Her meslek 25, toplam katalog 150 farklı bilgidir. Meslek başına nadirlik dağılımı 12 yaygın, 8 nadir, 4 çok nadir, 1 eşsizdir.
- Overall, kasada bulunan veya öğrenilmiş farklı bilgilerin birleşiminin 25'e oranıdır. Fazla nüshalar sayılmaz; okutmak overall puanını düşürmez.
- Okuma bir fiziksel nüsha tüketir ve bilgiyi kalıcı olarak kaydeder. Aynı işlem kimliğiyle yeniden denemek ikinci nüsha tüketmez. Öğrenilmiş bilgi yeniden okutulamaz.
- Eski numaralı bilgiler ve öğrenilmiş Muhafız bonusları ayrı arşivde korunur. Yeni 25'lik koleksiyonla aynı kayıt gibi sayılmaz.
- Eşsiz bilginin sunucudaki ilk üretimi kalıcıdır; tüketmek veya hesabı silmek yeni bir eşsiz nüsha açmaz.
- Maç sonu her oyuncu için en fazla bir papirüs çekilişi yapılır. Kazanmak ve kaybetmek aynı olasılıkları kullanır. Bütün mevcut maç türleri açıktır; kapsam sunucu ayarından daraltılabilir.

| Nadirlik | Düşme ihtimali |
|---|---:|
| Yaygın | %1,25 |
| Nadir | %0,25 |
| Çok nadir | %0,025 |
| Eşsiz | %0,00025 |

## Onaylanan arayüz

Ana sayfadaki pasifler 25'lik sayfalarda 13 + 12 satır halinde gösterilir. Katkı değerleri yeşildir. Nadirlik satırları sahip olunan/toplam adetlerini gösterir ve ilgili filtreyi açar. Ana sayfada papirüs başlıkları yerine net etki ve koşullar bulunur.

Papirüsler sayfasında Olanlar, Olmayanlar ve Hepsi olmak üzere üç sahiplik filtresi vardır. Dört nadirlik ayrı seçilir. Eksik bilgilerin başlık ve etkileri görünür. Ayrıntıda öğrenim paragrafı, etkinin koşulları ve uygun olduğunda okutma düğmesi bulunur. Geri dönüş seçili çalışanı ve filtreleri korur.

Portreler fotoğraf biçiminde altı ayrı WebP dosyasıdır. Çalışan ekranı ek WebGL bağlamı oluşturmaz; açıkken mevcut dünyayı çizme duraklatması korunur. Dünya içindeki çalışan modelleri değişmez.

## Etkinin gerçekten uygulanması

Koleksiyon ile oyun hesabına bağlanmış etki ayrı tutulur. `runtime_status=active` yalnız gerçek hesap noktaları bağlanmış bilgiler içindir. Diğer bilgiler öğrenilebilir; arşivde bağlantısının hazırlanmakta olduğu açıkça belirtilir ve “Etkin pasifler” toplamına girmez. Bir etkinin desteklediği maç veya işlem kapsamı açıklamasında gösterilir.

Demircinin 25 bilgisi gerçek sunucu geliştirme işlemine ve aynı hesabı gösteren önizlemeye bağlıdır. Bir işlemde genel katkı ile en yüksek uygun koşullu katkı birleşir; yeni papirüs katkısının üst sınırı +0,6 yüzde puandır. Kalite bonusu %95 ve üzeri havuza eklenir; %100:%95 oranı ve alt kalite havuzunun kendi içindeki oranları korunur. Yakut, eşya yok olması, taş tüketimi ve işlem tekrar kayıtları mevcut kurallarını korur.

Demirci serisi aynı fiziksel eşya ve işlem ailesi için tamamlanan denemeleri sayar. Farklı eşya veya işlem ailesindeki tamamlanmış deneme seriyi değiştirir. Menü kapatmak veya yeniden giriş yapmak seriyi silmez. V288'den önceki denemeler yeni seriye tahminen eklenmez.

Aşçının farklı öğrenilmiş bilgilerinden aynı istatistiğe gelen oranlar toplanır ve taban değere bir kez uygulanır. Örneğin +%0,2 ve +%0,4 birlikte taban × 1,006 eder. Koşullu bilgi yalnız kendi koşulunda bu toplama katılır; fazla nüsha ek etki vermez.

Seyisin tamamlanan ahır antrenmanına bağlı üç bilgisi gerçek sunucu hesabında uygulanır. Kesirli ilerleme ve enerji korunur; aynı eğitimin tekrar sorgulanması ikinci katkı sağlamaz. Henüz bulunmayan tedavi malzemesi veya savaş eylemi için yeni bir sonuç varsayılmaz.

| Çalışan | Bağlanan / toplam | Uygulandığı yer |
|---|---:|---|
| Demirci | 25 / 25 | Sunucudaki geliştirme, Safir ve Zümrüt işlemleri |
| Doctore | 23 / 25 | 4×5 ve Solo20; Ranked henüz kapsamda değil |
| Aşçı | 20 / 25 | 4×5 ve Solo20 |
| Muhafız | 18 / 25 | Oyuncunun katıldığı kervan savunması ve aynı sunucu tekrarı |
| Seyis | 3 / 25 | Tamamlanan ahır antrenmanı |
| Doktor | 0 / 25 | Özel sakatlık ve tedavi malzemesi akışı bekleniyor |

Toplam 89 bilgi mevcut hesaplara bağlıdır. Kalan 61 bilgi katalogda ve öğrenim arşivinde korunur; etkin pasif olarak gösterilmez. Öğrenilen bekleyen bilgi, kendi oyun akışı bağlandığında yeni nüsha gerektirmeden etkinleşebilir.

## Yayın ve doğrulama

Veritabanı sırası: `papyrus_catalog_v288`, `smith_effects_v288`, `staff_combat_v288`, `staff_care_v288`. Hesaba özel deneme koleksiyonu genel migration içinde uygulanmaz; yayın sonrasında ayrı, tekrar güvenli işlemle verilir.

Testler; sahiplik ve erişim sınırlarını, koleksiyon matematiğini, okuma ve ödül tekrarlarını, eşsiz arzını, gerçek geliştirme zarlarını, Yakut davranışlarını, kesirli antrenman kazanımını ve ekran düzenlerini kapsar. Tarayıcı kontrolleri GitHub Actions üzerinde Chromium ve WebKit ile yürütülür. Başarılı birleştirmeden sonra GitHub Pages yayını ve Cloudflare R2 sürüm kaydı aynı gerçek commit ile doğrulanır.
