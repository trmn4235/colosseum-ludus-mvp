# Ahır V161 — gerçekçilik incelemesi ve uygulanan değişiklikler

22 Ekim 2026. İnceleme, kullanıcının gönderdiği V160 oyun görüntüsü ve çalışan sahnenin kaynakları üzerinden yapıldı. Aşağıdaki 48 madde tasarımsal kusurları ve V161'deki karşılıklarını tek tek kaydeder. Malzemeler hazır taramalardan, dört eşya ailesi hazır 0 A.D. modellerinden gelir. Yeni bir yapay zekâ görseli üretilmedi.

| No. | V160'taki sorun | V161'deki düzenleme |
|---|---|---|
| 1 | Duvarın belirgin taş lekeleri her birkaç metrede aynı konuma dönüyordu. | Koyu duvar örgüsü tek levha yerine taşlara bölündü; her taş hazır taramanın farklı bölümünü örnekliyor. |
| 2 | Bütün taşlar düz bir kutu yüzeyine basılmış görünüyordu. | Taşlara farklı uzunluklar, şaşırtmalı sıralar, derzler ve kırılmış kenar geometrisi verildi. |
| 3 | Duvarın rengi bütün yükseklik boyunca aynıydı. | Duvar dipleri, sıvalı üst yüzeyler, kuşak ve başlıklar ayrıldı; düşük yoğunluklu yüzey yaşlanması eklendi. |
| 4 | Ahır, Ludus'un kendi mimarisinden kopuktu. | Doğu ve giriş çevre duvarlarında Ludus'un mevcut kumtaşı malzemesi doğrudan paylaşılıyor; yükseklik 5,6 m. |
| 5 | Uzun çevre duvarlarında düşey mimari bölünme yoktu. | Ayaklar ve taban kaideleri büyük yüzeyleri bölüyor. |
| 6 | Duvar başlıkları duvarın aynı küçük taş dokusuyla kaplıydı. | Ayrı açık taş başlıklar ve görünür kapak blokları kullanıldı. |
| 7 | Zemin ile duvar aynı arduvaz taramasını kullanıyordu. | Ön dolaşım zemini hazır Cobblestone Floor 08 taramasıyla değiştirildi. |
| 8 | Döşeme üzerindeki duvar derzleri, gerçek döşeme derzleriyle çakışıyordu. | Yeni döşemede taramanın kendi taş ve derz düzeni korunuyor. |
| 9 | Oda içi duvarlar dış cepheyle aynı karanlık yüzeydi. | Alt bölüm koyu taş, üst bölüm yaşlandırılmış kireç sıvası oldu. |
| 10 | Her bölme tavana kadar ağır, kapalı bir duvar hissi veriyordu. | Bölmelerin üstünde açık havalandırma aralığı ve ahşap taşıyıcılar bırakıldı. |
| 11 | Kum fazla sarı ve büyük lekelerle kaplıydı. | Hazır Dense Sand taramasının daha sakin doğal bej tonu kullanıldı. |
| 12 | Kum da düzenli kareler halinde tekrar ediyordu. | Üç farklı doku örneğini kesintisiz karıştıran örnekleme eklendi. |
| 13 | Zemin kusursuz düz bir levhaydı. | Birkaç santimetreyi aşmayan yüzey farkları ışığın kumda hafifçe kırılmasını sağlıyor. |
| 14 | Yüzey kabartması renk lekelerinden hesaplanıyordu. | Kum ve döşemede ayrı hazır yükseklik ve pürüzlülük haritaları kullanılıyor. |
| 15 | Nal izleri koyu renkli, zeminin üzerine konmuş halkalar gibiydi. | Bu geometrik halkalar tamamen kaldırıldı. |
| 16 | Nal izleri kusursuz bir elips ve eşit aralıklarla dizilmişti. | Yapay elips kaldırıldı; cephe boyunca hafif ve düzensiz kullanım farkı bırakıldı. |
| 17 | Kum ile taş apron arasında suyun nereye gideceği anlaşılmıyordu. | Zemine yakın taş kapaklı bir tahliye hattı eklendi. |
| 18 | Duvarlar doğrudan kuma saplanan ince levhalar gibi görünüyordu. | Duvar dibi kaideleri ve yükseltilmiş taş tabanlar eklendi. |
| 19 | Ahır kapılarında belirgin bir eşik yoktu. | Alçak taş eşikler eklendi; mevcut kapı önündeki yürüme yolu açık tutuldu. |
| 20 | Kapı menteşeleri yalnızca düz metal şeritler gibi görünüyordu. | Menteşe milleri, bağlantı plakaları ve perçinler birlikte kullanıldı. |
| 21 | Bütün kapı tahtaları aynı koyulukta ve aynı kesimdeydi. | Kahverengi hazır ahşap korunarak tahta tonu, doku başlangıcı ve küçük yükseklik farkları çeşitlendirildi. |
| 22 | Ahşap direklerin zemine ve kirişe bağlantısı belirsizdi. | Taş ayaklar, metal alt kuşaklar ve kiriş bağlantıları eklendi. |
| 23 | Çatı altı tek düz ahşap levha olarak okunuyordu. | Kirişler, çapraz payandalar ve yatay çatı çıtaları görünür hale getirildi. |
| 24 | Kiremitler fazla tek renkliydi. | Aynı terracotta ailesi içinde ölçülü ton farkları uygulandı. |
| 25 | Saman yatakları birbirinin aynı dikdörtgen halılara benziyordu. | Hazır 0 A.D. saman dokusuyla farklı sınır ve kalınlıktaki gevşek yataklar oluşturuldu. |
| 26 | Saman sapları kalın çubuklar gibi görünüyordu. | Saplar inceltildi, uzunlukları ve yönleri çeşitlendirildi. |
| 27 | Yemlikler odanın arkasına gömülmüş, işlevleri zor seçiliyordu. | Yan duvara yakın, önden daha okunabilir konuma alındılar. |
| 28 | Yemlikler basit, kapalı kutular gibi görünüyordu. | Açık çıtalı yüz, eğimli ön çubuklar ve görünen yem eklendi. |
| 29 | Küçük suluklar da kaba duvar taşıyla yapılmıştı. | Ayrı açık taş gövde, kalın kenar ve iç hazne oluşturuldu. |
| 30 | Su kahverengi metal bir kapak gibi görünüyordu. | Metal etkisi kaldırıldı; daha doğal renk, düşük parlaklık ve hafif saydamlık uygulandı. |
| 31 | Ortak bir su alma noktası yoktu. | Doğu kenarına geniş yalak ve pişmiş toprak su ağzı eklendi. |
| 32 | Su taşıma eşyası yoktu. | Hazır 0 A.D. Roma kovası iki hizmet noktasına yerleştirildi. |
| 33 | Yem depolama yalnızca köşeye sıkıştırılmış torbalardan ibaretti. | Ayrı yem saklama alanı, hazır Roma sepetleri ve kaplar eklendi. |
| 34 | Antik döneme ait gündelik kaplar bulunmuyordu. | Hazır amphora grupları depolama köşelerinde kullanıldı. |
| 35 | Kuru otun kuru tutulmasını sağlayan bir yer yoktu. | Ahşap yükseltilmiş taban ve çatılı yem deposu yapıldı; hazır gevşek ot yığınları kullanıldı. |
| 36 | Gelişigüzel yerde duran antrenman direkleri sahneye işlev katmıyordu. | Direk yığını kaldırıldı; kenarlar bakım ve depolama işlevleriyle düzenlendi. |
| 37 | Testere sehpasına benzeyen boş nesnelerin amacı anlaşılmıyordu. | Bunların yerine üzerinde ekipman bulunan eyer sehpaları kondu. |
| 38 | Eyer ve eyer altlığı eksikti. | Deri yüzeyli, dört destek çıkıntılı Roma tipi eyer yorumu ve altlık eklendi. |
| 39 | Roma koşumunun ayırt edici biçimi gösterilmiyordu. | Dört çıkıntılı eyer, deri kayış ve küçük bronz bağlantı parçaları birlikte ele alındı; modern üzengi eklenmedi. |
| 40 | Duvarlardaki koşumlar yalnızca halka şeklindeydi. | Tepe, yanak, burun ve dizgin kayışlarının okunabildiği askılar oluşturuldu. |
| 41 | Bütün kapıların yanında aynı halka tekrar ediyordu. | Koşumlar sınırlı sayıda kapıya ve ayrı ekipman askılığına dağıtıldı. |
| 42 | Deri malzeme düz kahverengi plastik gibi görünüyordu. | Hazır Brown Leather renk, yükseklik ve pürüzlülük taramaları kullanıldı. |
| 43 | Bakım ekipmanını yağmur ve güneşten koruyacak alan yoktu. | Doğu kenarına açık cepheli, kiremit çatılı bir bakım sundurması eklendi. |
| 44 | At bağlamak için tanımlı bir yer yoktu. | Batı kenarına ahşap bağlama rayı, halkalar ve kısa ipler eklendi. |
| 45 | Temizlik aracı tek bir çubuk ve kutu şeklindeydi. | Süpürge sapı ve ayrılan ince lif demeti oluşturuldu; hizmet köşesine alındı. |
| 46 | Bütün atlar aynı anda aynı hareketi yapıyordu. | Mevcut hazır animasyonun başlangıç evresi her atta farklılaştırıldı. |
| 47 | Bütün atların bakış açısı birebir aynıydı. | Kendi bölmelerinde kalacak küçük yön farkları verildi. |
| 48 | Atların ışıkla ilişkisi yalnızca oval yer gölgesine dayanıyordu. | Yumuşak temas gölgesine ek olarak gerçek güneş gölgesi açıldı. Oyuncunun ayağına da hareketini izleyen yumuşak temas gölgesi eklendi. |

## Tarihsel dayanak ve sınırlar

Bu sahne, Roma dünyasından kanıtları kullanan bir oyun uyarlamasıdır; belirli bir kazı alanının birebir rekonstrüksiyonu değildir. Yan yana 12 özel oda, oynanış düzeni olarak korunmuştur. Modern bir at çiftliğinin bütün eşyaları antik döneme taşınmamıştır.

- **English Heritage, Chesters / Roma süvari ahırları:** Wallsend ve South Shields buluntularında saman-yem kalıntıları ve sıvı tahliyesiyle ilişkili çukurlar anlatılır. Buradan drenaj, kuru yatak ve yem depolamasına önem verildi; kazılardaki asker-at ortak oda düzeni bu oyuna birebir aktarılmadı. [Kaynak](https://www.english-heritage.org.uk/visit/places/chesters-roman-fort-and-museum-hadrians-wall/history/absence-of-stables/)
- **EXARC, Moira Watson, 2021:** Dört çıkıntılı Roma eyerinin deri parçaları ve metal destekleri üzerinden farklı rekonstrüksiyonlar tartışılır. Dört çıkıntılı dış biçim kullanıldı; iç dolgu/iskeletin kesin olarak bilindiği iddia edilmiyor. [Kaynak](https://www.exarc.net/issue-2021-1/ea/reconstruction-roman-cavalry-saddle)
- **Rijksmuseum van Oudheden, Doorwerth koşum parçası:** MS 1–100 tarihli gümüş kaplı bronz kayış ayırıcı, metal disklerin bağlantı ve süs işlevine dayanak oluşturur. Sahnedeki parçalar müze objesinin kopyası değildir. [Kaynak](https://www.rmo.nl/collectie/topstukken/verzilverd-bronzen-paardentuig-2/)
- Taş işçiliğinin yerel biçimi, sundurmaların ölçüsü, hizmet köşelerinin yerleşimi ve temizlik araçları sahne tasarımı tercihidir. Bunlar belirli bir Roma ahırında birebir belgelenmiş ayrıntılar olarak sunulmaz.

## Hazır sanat varlıkları

- Poly Haven: **Dense Sand**, **Cobblestone Floor 08**, **Brown Leather**; önceki hazır **Wood Plank Wall** ve **Castle Wall Slates** korunur. CC0. Renk dokuları sRGB, yükseklik ve pürüzlülük verileri doğrusal renk uzayındadır.
- Wildfire Games / **0 A.D.**: amphora grubu, Roma sepeti, küçük ot yığını ve Roma kovası. CC BY-SA 3.0. Kaynak UV'leri korunarak GLB'ye dönüştürüldü. Saman yüzey dokusu da aynı kaynaktan gelir.
- Tam yollar, özgün dosya özeti ve lisanslar: `assets/stable-v161/sources.json`, `assets/stable-v161/CREDITS.txt` ve `assets/caravan-field-v125/LICENSE-0AD.txt`.

## Doğrulama kapsamı

Gerçek `ludus.html` sahnesi, mevcut at ve seyis modelleriyle tarayıcıda açılır. Hesap verileri yalnızca izole test hesabına aittir. Kontrol edilenler: tüm dokuların ve dört yeni eşya ailesinin yüklenmesi; shader hataları; 12 at; açık gökyüzü; 5,6 m duvar; kesintisiz kapı önü yolu; seyis paneli; odadan çıkıp yeniden girme; eski kayıtlı konumdan doğru girişe dönme. 874×402 ve 568×320 mobil görünümün yanında 1280×720 oda, kum, su/koşum ve yem köşeleri kaydedilir.
