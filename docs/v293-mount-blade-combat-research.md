# V293 — Mount & Blade incelemesi ve gladyatör savaş animasyonları

**Tarih: 23 Kasım 2026.** Bu çalışma, Colosseum & Magnus’un mevcut savaş kodunu Mount & Blade II: Bannerlord’un geliştirici açıklamalarıyla karşılaştırır. Amaç; gladyatörün saldırısını, savunmasını, yuvarlanmasını ve toparlanmasını daha anlaşılır ve doğal göstermektir. Bannerlord’un animasyon dosyalarını, modellerini veya kodunu oyuna taşımıyoruz. Araştırmadan alınan tasarım ilkeleri, kendi karakterlerimize ve mobil kontrollerimize uygulanacak.

## 1. Araştırmanın ana sonucu

İyi savaş animasyonu yalnız güzel bir hareket değildir. Oyuncu; rakibin ne hazırladığını, silahın ne zaman tehlikeli olduğunu, darbenin neye çarptığını ve rakibin ne zaman yeniden hazır olacağını görebilmelidir. TaleWorlds’ün 7 Haziran 2018 tarihli animasyon röportajı, zamanlama ve saldırının okunabilirliğini doğrudan oynanış dengesiyle ilişkilendiriyor. Bu nedenle bizim önceliğimiz, hareketleri yalnız yavaşlatmak değil; hazırlık, temas ve toparlanma evrelerini ayırt edilir kılmaktır. [S1]

15 Kasım 2018 tarihli röportaj ise daha ayrıntılı gerçekçi hareketlerin oyuncunun kontrolünü sınırlayabileceğini açıklıyor. Geliştirici, kısa ve değişen girdilere uyum sağlayabilen animasyonları önemsiyor. Buradan çıkardığımız öneri: ağırlık hissini omuz, kalça, adım ve silah yoluyla vermek; oyuncuya gereksiz gecikme eklememek. Bu tarihî açıklamayı, Bannerlord’un bugünkü bütün iptal pencerelerinin birebir tarifi olarak kullanmıyoruz. [S2]

2017–2018 kaynakları geliştirme yaklaşımını açıklar. Güncellik kontrolü için 2025 tarihli 1.3.4 notları da incelendi: kalkan hareketinin yönü iyileştiriliyor ve sık yön değiştirmedeki bacak animasyonu sorunu düzeltiliyor. Bu, bağlantılar ve geçişlerin ayrıca önem taşıdığını destekler; eski bloglardaki tüm denge değerlerinin bugün aynen geçerli olduğunu kanıtlamaz. 11 Kasım 2026 notlarından yeni bir yuvarlanma modeli veya kesin kamera açısı sonucu çıkarılmadı. [S8–S9]

## 2. Mevcut oyunumuzda gerçekten ne var?

Kod incelemesi, sistemin sıfırdan kurulması gerekmediğini gösteriyor. Saldırının hazırlık, etkin vuruş ve toparlanma evreleri; bölgesel darbe tepkileri; yönlü kalkan tepkisi ve el–silah temasını koruyan düzenekler zaten mevcut. Sorunları “bunların hiçbiri yok” diye açıklamak yanlış olur. Geliştirme, bu parçaların doğru eylemde çalışması ve birbirini bozmadan görünmesi üzerine kurulmalı.

En somut yuvarlanma sorunu giriş bağlantısındaydı: V292’de incelenen ana savaş düğmeleri `step` eylemini gönderiyordu. Oyuncu yuvarlanma beklerken kısa kaçınma adımı görüyordu. Ayrıca gerçek `roll` eylemi ve ona ait bir hareket klibi zaten vardı. Dolayısıyla çözüm yalnız yeni bir dosya eklemek değil; düğme, eylem ve görüntüyü aynı hareket üzerinde birleştirmek.

Mevcut yuvarlanmanın savaş süresi **0,46 saniye**. Daha önceki klibin bütününü bu dar zaman aralığına yerleştirmek, hazırlık ve ayağa kalkmayı çok hızlı gösterebilir. V293 çalışması, mevcut süre içinde daha anlaşılır yer teması ve hareket evreleri hazırlıyor. Süreyi artırmak, mesafeyi azaltmak veya dokunulmazlığı uzatmak bu görsel düzeltmenin kendiliğinden bir parçası değildir.

Arena tarafında hareket ve blok için `idle` koşulları bulunuyor. Bu, Bannerlord bloglarında anlatılan hareket özgürlüğünün bizim oyuna yalnız animasyon değiştirerek aktarılamayacağını gösterir. İleride saldırı sırasında yürüyüş veya hazırlığı blokla kesme kararı alınırsa gerçek savaş kuralları da birlikte düzenlenmeli.

## 3. V293 yuvarlanma kapsamı ve tamamlanma sınırı

**V293 kodunda ana yuvarlanma düğmeleri gerçek `roll` eylemine bağlandı; mevcut Quaternius CC0 hareketinin zaman dağılımı ve zemin desteği iyileştirildi.** Yeni bir hareket yakalama dosyası eklenmedi. Yedi sınıf ve dört yönde gerçek karakter/ekipman testleri, hareketin ters dönüşünü, ayağa kalkmasını ve el–silah temasını kontrol ediyor. Yayın durumu sürüm kaydıyla ayrıca doğrulanır; bu araştırma metni tek başına canlı yayın kanıtı değildir.

Uygulama kapsamı, yuvarlanma düğmesinin gerçekten `roll` göndermesi ve hareketin okunabilir bir bütün oluşturmasıdır: dizleri bükerek ağırlığı indirme, gövdeyi toplama, omuz/sırt üzerinden dönme, ayakları altına getirme ve savaş duruşuna dönme. Bu, gerçek tarihî gladyatör tekniği iddiası değil; kullanıcının istediği oyun hareketinin görsel hedefidir.

Gövde dönüşü sırasında yürüyüş katmanı bacakları yeniden dikleştirmemeli. Baş, gövde ve ayakların zemin ilişkisi tutarlı olmalı; modelin yukarıda dönmesi veya son bölümde dik halde kayması önlenmeli. Silah ve kalkan, ellerden kopmadan taşınmalı. Tamamlanma değerlendirmesi yalnız “karakter ters döndü” kontrolüne dayanmamalı; giriş, yerde dönüş, çıkış ve ilk sonraki eylem birlikte incelenmeli.

Gerçek karakter geometrisiyle yapılan kare karşılaştırması ayrıca büyük kalkanın dönüş sırasında zemine girdiğini gösterdi. V293 bu yüzden silah ve kalkan için gövdeye yakın taşıma duruşu da içeriyor: ekipmanın boyutu hesaba katılıyor, kol gerçek avuç temasına uzanıyor ve normal tutuşa geçiş yumuşatılıyor. Bu bulgu, silahsız kaynak hareketin ekipmanlı gladyatöre doğrudan uygulanmasının sınırını gösteriyor: gövde için doğru görünen bir hareket, uzun mızrak veya büyük kalkan için uygun olmayabilir. Kare karşılaştırmaları doku ve GPU ışıklandırması içermeyen gerçek geometri görüntüleridir; telefondaki hareket akıcılığını veya FPS’yi ölçmez.

Saldırıdan yuvarlanmaya, yuvarlanmadan savunmaya ve yön değiştirerek yuvarlanmaya geçişler de önemlidir. Son karede duruşu bir anda sıfırlamak, düzgün görünen hareketin ardından yeni bir sıçrama üretebilir. Kamera ise başın bütün dönüşünü taklit etmemeli; oyuncu hareket sırasında çevresini ve rakibini izleyebilmeli.

## 4. Vuruş ve toparlanma için önerilen aileler

TaleWorlds’ün 21 Aralık 2017 açıklamasında sol/sağ duruş çeşitleri ve silah ağırlığına göre hafif–ağır animasyon karışımları anlatılıyor. Bizim çıkarımımız, bütün silahlara aynı hareketi farklı hızda oynatmak yerine, mevcut mekanik sınırlar içinde farklı beden kullanımı hazırlamaktır. Aşağıdaki tablo **sonraki çalışma önerisidir; V293’te tamamlanmış silah animasyonları listesi değildir.** [S3]

| Silah ailesi | Hazırlık ve vuruş görünümü | Toparlanma ve kontrol ölçütü |
|---|---|---|
| Gladius / spatha / sica | Kısa omuz hazırlığı, kontrollü kalça dönüşü; kesme ve saplama ayrı okunur. Sica eğrisi, düz kılıçtan farklı bir el yolu taşıyabilir. | Kol rastgele geriye sıçramadan koruma hattına döner. Bir sonraki hareket önceki silah konumundan başlar. |
| Mızrak / trident | Uç hedefe yönelirken omuz ve gövde birlikte hazırlanır; itiş boyunca sap elde kalır. Gereksiz geniş kılıç savuruşu kullanılmaz. | Uç kontrollü geri çekilir. Çekilme sırasında sapın avuçtan ayrılmaması ve kolun aşırı uzamaması denetlenir. |
| Teber | Mevcut kesme eylemine uygun geniş veya çapraz yol; kalça, omuz ve silah başı birlikte ağırlık aktarır. Tutuş, gerçek ekipman düzenine uyar. | Silah başının hareketi gövdede karşılık bulur; uç aniden nötr konuma ışınlanmaz. Hasar yolu görsel gösteriş için değiştirilmez. |
| Gürz / çekiç | Başın ağırlığını gösteren belirgin hazırlık; bilekten sallanan hafif bir çubuk görüntüsünden kaçınılır. | İsabet, blok ve boşa savurma farklı görsel devamlar alabilir. Yeni sersemletme veya hasar avantajı bu öneriye dahil değildir. |
| Kalkan | Mevcut yönlü tepki geliştirilir; temas edilen taraf, dirsek ve omuz kısa bir geri tepme gösterir. | Kalkan kolda bağlı kalır, gövde küçük bir dengeleme hareketi yapar ve korumaya döner. Her darbede aynı bütün-vücut sarsıntısı kullanılmaz. |

Başarılı vuruş, kalkanla durdurulan vuruş ve boşa giden vuruş aynı sonuç gibi görünmemeli. Ancak her biri için uzun yeni kilitlenme eklemek gerekmez. Önce mevcut sonuç bilgisini doğru görsel tepkiye bağlamak gerekir. Bu ayrım, oyuncunun neden hasar verdiğini veya neden durdurulduğunu anlamasına yardım eder.

2017 E3 açıklaması, tamamlanan savuruşların devam saldırısına bağlanmasını ve bazı ağır silahlarda önceki hareketin momentumundan yararlanılmasını anlatıyor. Bizim görsel önerimiz, mevcut kombo varsa sonraki saldırının girişini önceki silah yoluna bağlamak. Yeni kombo süresi veya saldırı hızı bonusu ayrıca tasarlanması gereken mekaniktir. [S4]

## 5. Savunma, darbe tepkisi ve ayakların rolü

22 Mart 2018 kalkan yazısındaki güçlü fikir, tepkinin temasın yönü ve kuvvetiyle ilişkili olmasıdır. Bizde bunun temeli mevcut; geliştirme hedefi, tepkinin daha anlaşılır ve tutuşla uyumlu olmasıdır. Kalkanın soluna gelen bir darbe ile üstten gelen darbe aynı salınımı üretmemeli. Kalkan–el–dirsek bağlantısı korunurken küçük gövde dengelemesi kullanılabilir. [S5]

Hasar alan bölgeye özgü kısa tepkiler de desteklenebilir: baş darbesinde üst gövde, gövde darbesinde göğüs ve omuzlar daha belirgin tepki verir. Bu, mevcut bölge bilgisini görselleştirme önerisidir; yeni yaralanma veya sersemleme kuralı değildir. Tepki, devam eden hareketi gereksiz yere baştan başlatmamalı.

Ayaklar yerle temas kurmadan yalnız üst gövdeyi güzelleştirmek, kayma hissini tamamen çözmez. İleri/geri ve yana hareket, dönüş anı ve ağırlık verilen ayak ayrı kontrol edilmeli. Gerçek konum ilerlemesiyle adım temposunun uyumu ölçülmeli. Aynı testi yalnız sabit duran karakter üzerinde geçirmek yeterli değildir.

## 6. Sağ omuz kamerası için deney planı

Mevcut Ranked kamera yaklaşık **48° görüş açısı, 3,1 yükseklik ve 4,2 geri mesafe** kullanıyor. Tek oyunculu sağ omuz seçeneğinde yaklaşık **0,72 yan uzaklık, 2,15 geri mesafe ve 1,6 yükseklik** bulunuyor; varsayılan görünüm başka bir üçüncü şahıs ayarı. Kervan kamerası daha yüksekten bakıyor. Bu farklılıklar aynı animasyonun farklı hissedilmesine yol açabilir; hepsini tek sabit sayıya bağlamak için yeterli kanıt yok.

TaleWorlds’ün 2020 e1.4.3 notları, yakın üçüncü şahıs kamerada karakterin ekranı daha az kaplaması için yükseklik hesabının değiştirildiğini söylüyor. Buradan alınacak ilke rakibin görünürlüğüdür. Kaynak, bizim kullanmamız gereken kesin açı veya mesafeyi vermiyor. [S6]

**Aşağıdaki değerler Mount & Blade’den ölçülmüş değerler değil, bizim sağ omuz prototipimiz için deney aralıklarıdır:**

| Parametre | İlk deneme aralığı | Değerlendirme |
|---|---|---|
| Dikey görüş açısı | 48–54° | Rakibin silahı ve yakındaki ikinci düşman görünürken mesafe algısı korunuyor mu? |
| Omuzun yan uzaklığı | 0,65–0,85 oyun birimi | Sağ el silahı görülüyor mu; karakter hedefin göğsünü örtüyor mu? |
| Geri mesafe | 2,15–2,70 oyun birimi | Yakın dövüş okunuyor mu; duvar yaklaşınca kamera modeli kapatıyor mu? |
| Yükseklik | 1,55–1,80 oyun birimi | Silah uçları, rakibin gövdesi ve zemindeki hareket aynı anda seçiliyor mu? |

Kamera sabit dünya ufkunu korumalı; yuvarlanırken oyuncuyla takla atmamalı. Hedef değişiminde yön yumuşatılabilir, fakat oyuncunun hareket yönü geciktirilmemeli. Kamera hedefi için her karede sallanan baş yerine kararlı savaş konumu kullanılmalı. Duvar, dar köşe ve iki yakın rakip senaryolarında ayrı kontrol gerekir. Daha geniş görüş açısının performansı artıracağı varsayılmamalı.

## 7. Mobil, ağ ve doğrulama sınırları

Bannerlord belgeleri, animasyonların giriş/çıkışta birlikte akmasının ani kemik hızı değişikliklerini azaltabildiğini açıklar. Aynı belgeler hareket, kök dönüşü ve el/ayak kısıtlarının eyleme göre yönetildiğini gösterir. Bizim önerimiz de geçişleri tek sahiplik düzeninde tutmaktır: yürüyüşün, yuvarlanmanın ve tutuş çözümünün aynı kemiği çelişkili biçimde düzeltmesi engellenmeli. [S7]

İlk kontrol grubu gerçek karakter ve ekipmanla yapılmalı: yön değişimi, eğri kare aralıkları, uzak karakterlerin seyrek güncellenmesi, durma–başlama ve düşük kare hızında eylem geçişleri. Tek oyunculu, Ranked ve kervan aynı olayın aynı evresini göstermeli. Sunucu sonucu, istemci görüntüsü ve savaş tekrarı ayrışmamalı.

Saldırı sırasında hareket, hazırlığı blokla kesme, yeni savunma zamanlaması, daha uzun yuvarlanma veya farklı kaçınma mesafesi istenirse sunucu, istemci ve tekrar sistemi birlikte değişmelidir. Bunlar yalnız görsel iyileştirme diye yayımlanamaz. Mevcut hasar, kondisyon ve dokunulmazlık pencereleri ayrı doğrulama gerektirir.

Başarı ölçütümüz yalnız test sayısı değildir: hareket amacı telefonda anlaşılmalı, silah elde kalmalı, zemin teması tutarlı olmalı ve oyuncu kontrolü korunmalıdır. Otomatik testler gerekli kanıtı sağlar; gerçek iPhone FPS, ısınma ve algılanan akıcılık ölçümünün yerine geçmez. Bu araştırma belirli bir FPS artışı vaat etmez.

## Kaynaklar

- **S1 — 7 Haziran 2018, animasyonların okunabilirliği:** [TaleWorlds](https://www.taleworlds.com/en/Games/Bannerlord/Blog/63), [geliştiricinin Steam yayını](https://store.steampowered.com/news/posts/?appids=261550&enddate=1531421189).
- **S2 — 15 Kasım 2018, gerçekçilik ve kontrol dengesi:** [TaleWorlds](https://www.taleworlds.com/en/Games/Bannerlord/Blog/86), [Steam arşivi](https://store.steampowered.com/news/posts/?appids=261550&enddate=1544720772).
- **S3 — 21 Aralık 2017, duruş ve silah ağırlığı:** [TaleWorlds](https://www.taleworlds.com/en/Games/Bannerlord/Blog/40), [geliştiricinin Steam yayını](https://store.steampowered.com/news/posts/?appids=261550&enddate=1515672385).
- **S4 — 12 Haziran 2017, saldırı devamları:** [TaleWorlds E3 combat açıklaması](https://www.taleworlds.com/en/News/174).
- **S5 — 22 Mart 2018, kalkan temas tepkisi:** [TaleWorlds](https://www.taleworlds.com/en/Games/Bannerlord/Blog/52), [geliştiricinin Steam yayını](https://store.steampowered.com/news/posts/?appids=261550&enddate=1525369632).
- **S6 — 2020 e1.4.3, üçüncü şahıs kamera görünürlüğü:** [TaleWorlds beta notları](https://www.taleworlds.com/en/News/361), [19 Ağustos 2020 ana sürüm Steam notları](https://store.steampowered.com/news/posts/?appids=261550&enddate=1597950092).
- **S7 — Animasyon sisteminin teknik belgeleri:** [TaleWorlds modlama dokümantasyonu](https://moddocs.bannerlord.com/asset-management/asset-types/animations/).
- **S8 — 2025 v1.3.4 sürüm notları:** [TaleWorlds](https://www.taleworlds.com/en/News/587).
- **S9 — 11 Kasım 2026 sürüm notları:** [TaleWorlds](https://www.taleworlds.com/en/News/611).

Kaynak erişim notu: TaleWorlds ana sitesindeki bazı doğrudan açılışlar 403 yanıtı verdi. İçerik, erişilebilen resmî dokümantasyon, geliştiricinin Steam yayınları ve ana sitenin arama dizinindeki kayıtlarıyla karşılaştırıldı. Oyuncu forumlarındaki kamera sayıları, doğrulanmış Bannerlord ayarı olarak kullanılmadı.
