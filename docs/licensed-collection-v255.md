# Lisanslı maden ve gıda toplama — V256 miktar dengesi

Klanlar ortak imparatorluk kaynaklarından çalışma lisansı alır. Klan lideri,
üyelerin kendi işçilerinden **tam 5 kişilik** bir ekip seçer. Bir lisans **6 saat**
sürer; otomatik yenilenmez. Her işçi seçilen meslekte en az 5. seviyede olmalıdır.
Aynı işçi eşzamanlı alışverişe veya ikinci bir çalışmaya ayrılamaz.

## Üretim ve mülkiyet

Her işçinin seviyesi ve üretimi çıkışta kaydedilir. Sonradan değişen seviyeler
devam eden seferin kazancını değiştirmez. Brüt üretimin %20'si devlete ayrılır;
kalan %80, işçinin çıkışta kayıtlı sahibinin kişisel deposuna gider. Gıda,
yemekhane stoklarına teslim edilir. Klandan ayrılmak kazanılmış payı kaybettirmez.

| Meslek seviyesi | Brüt | Devlet | Sahibine net |
|---|---:|---:|---:|
| 5 | 10 | 2 | 8 |
| 6 | 15 | 3 | 12 |
| 7 | 20 | 4 | 16 |
| 8 | 20 | 4 | 16 |
| 9 | 25 | 5 | 20 |
| 10 | 30 | 6 | 24 |

V256 miktarları **devlet payı sonrası net 8–24 birimdir**. Ürünler tam sayı ve
vergi tam %20 olduğundan 7. ve 8. seviyelerin miktarı aynıdır.

Depoda yer yoksa o işçinin teslimatı bekler; diğer sahiplerin teslimatı sürer.
İşçi çalışma bittiğinde serbest kalır. Yer açıldığında bekleyen ürünler bir kez
teslim edilir. Devlet payı ayrı, sunucunun yönettiği bir stok kaydına yazılır.
Bu kayıt mevcut pazar arzına kendiliğinden satış eklemez.

## Alışveriş ve gelişim

Ücretli alışveriş **3 saat git-gel**, kervan başına **10 birim** kapasitedir.
Her kervana bir işçi seçilir. Ödeme güncel kaynak/pazar fiyatıyla yapılır.
Eski ücretsiz gıda seferi yeni çıkışlar için kapatılmıştır. Gıda kaynağında
hem alışveriş hem çalışma lisansına geçiş bulunur.

Alışveriş, teslim edilen birim başına 1 meslek EXP verir ve 600 EXP/5. seviyede
durur. Lisanslı çalışma başına 60 EXP kazanılır; meslekler 2700 EXP/10. seviyeye
kadar ilerler. Meslekler birbirinden bağımsızdır.

Bu başlangıç dengesinde bir alışveriş işçisi para karşılığında 3,33 birim/saat
taşır. Çalışan işçi 1,33–4 net birim/saat üretir; beş kişilik ekip 6 saatte
40–120 net ürün kazanır. Çalışma alışveriş kervanı kontenjanını kullanmaz;
beş işçiyi aynı süre boyunca bağlar. Lisans için ayrıca ücret tanımlanmamıştır.

| Gıda | Meslek |
|---|---|
| Tahıl | Tahıl yetiştiriciliği |
| Elma | Elma yetiştiriciliği |
| Balık | Balıkçılık |
| Et | Avcılık |
| Yumurta | Yumurta üretimi |
| Şarap | Bağcılık |
| Zeytinyağı | Zeytincilik |

Mevcut dokuz ekipman hammaddesi mesleği korunur; toplam 16 meslek vardır.
Şarabın eski verilerle uyumluluk için kullanılan SKU'su `beer` olarak kalır.
Meslek kartları 6+6+4, kişisel stok 8+8 olarak sayfalanır; dikey kaydırma gerekmez.

## Haftalık toplanan

Sıralama, çalışma bitiş zamanında kazanılan **devlet payı sonrası net birim**
üzerinden hesaplanır. Ücretli alışveriş sayılmaz. Deposu dolu olanın kazanılmış
ürünleri teslimatı beklese de doğru haftaya yazılır. Klan ve işçi listelerinde
net üretim gösterilir. Her lisansın ayrıntısında işçi bazında brüt/devlet/net
ve teslimat durumu görülebilir.

Hafta pazar 23.59 Europe/Istanbul saatinde kapanır. Mevcut ilk 10 şan ödülü
değişmez: 0,50; 0,46; 0,42; 0,38; 0,36; 0,32; 0,28; 0,24; 0,22; 0,18.

## Geçiş ve doğrulama

V255 öncesi başlamış işler ve alışveriş seferleri kayıtlı süre, miktar ve
teslimat şartlarını korur. Yeni kurallar yeni çıkışlara uygulanır. Eski klan
stokları silinmez veya kişisel hesaplara yeniden dağıtılmaz.

`tests/licensed-collection-v255.cjs` gerçek RPC yollarını PGlite üzerinde
çalıştırır: izinler, tam beş işçi, altı saat, vergi, kişisel ve gıda stokları,
dolu depo, klan değişikliği, EXP, haftalık sıralama ve tekrar işlem koruması.
Tarayıcı senaryoları mevcut Chromium/WebKit işçi ve kaynak ekranı testlerine
bağlıdır. Fiziksel iPhone kontrolü bu testlerin kapsamında değildir.

V256 öncesi başlamış lisans ve alışverişler çıkışta kaydedilen miktarlarını korur.
`tests/collection-balance-v256.cjs`, yeni miktarları ve önceki seferlerin
teslimat/tekrar işlem uyumluluğunu gerçek RPC yollarıyla doğrular.
