# V289 — Revir, tedavi ve Doktor bilgileri

Revir aynı Ludus kasasını kullanır. Yeni sakatlık için gladyatör seçilir, gereken ve eldeki malzemeler görülür, ardından tedavi başlatılır. Tedavi başladıktan sonra hafif sakatlık 3, orta sakatlık 12, kötü sakatlık 24 saat sürer. Bu süreler papirüsle kısalmaz. Çevrimdışı süre ilerler; sunucu saati dolmadan gladyatör savaşa, antrenmana veya satışa açılamaz.

| Hafif — 3 saat | Orta — 12 saat | Kötü — 24 saat |
|---|---|---|
| Diz sıyrığı | Derin ön kol kesiği | Açık kaval kemiği kırığı |
| Omuzda zırh vurması | Ayak bileği burkulması | Parçalı uyluk kemiği kırığı |
| Yüzeysel kaş yarılması | Kaburga ezilmesi | Leğen kemiği kırığı |
| Hafif omuz ezilmesi | Kapalı ön kol kırığı | Ağır kafa travması |
| Hafif baldır zorlanması | Kapalı, parçalı olmayan kaval kemiği kırığı | İç kanamalı karın yaralanması |

Demircinin Revir malzemeleri bölümünde yedi ürün hazırlanır: Balmumu Merhemi, Defne Merhemi, Ballı Sirke Şurubu, İncir Şurubu, Tahta Atel, Keten Sargı ve Sirkeli Sünger. Üretim anında girdiler tüketilir, ürün aynı kasaya eklenir. Malzeme yetmiyorsa hiçbir kısmi tüketim yapılmaz. Önizleme ve miktar seçimi stok değiştirmez.

Haritaya balmumu, defne, bal, incir, şarap sirkesi ve doğal sünger için altı kaynak eklendi. Toplam 22 kaynak aynı ekrandadır. Bu altı kaynak mevcut toplama ve şehir alışverişi sistemini kullanır: 6 saat toplama, %20 devlet payı, işçi düzeyine göre 8–24 net birim; alışverişte 3 saat ve kervan başına 10 birim. Yeni stok verilmez. İncir ve bal bu sürümde üretim girdisidir; günlük menüye yeni yemek tercihi eklenmez. Zeytinyağı mevcut gıda stoğundan, diğer girdiler mevcut malzeme stoğundan alınır.

## Doktorun etkileri

Öğrenilmiş 24 Doktor bilgisi gerçek tedavi veya sakatlık sonucuna bağlanır. Malzeme koruma zarları tam stok kontrolünden sonra sunucuda atılır. Aynı tedavi veya üretim isteğinin tekrarı yeni zar ya da ikinci tüketim oluşturmaz. Tedavi başlarken öğrenilmiş bilgiler sabitlenir.

Sargı tasarrufunda genel bilgi ile derin ön kol kesiği bilgisi birlikteyse %0,8 olan yüksek ihtimal uygulanır. Ballı Sirke Şurubunda genel %0,4 ve kaburga ezilmesine özel %0,8 katkı birlikteyse yüksek katkı uygulanır. Bu oranlar yüzde puan olarak değil, ilgili temel miktara göre hesaplanır.

Sakatlık için önceki yorgunluk riski ve kervan baskını yenilgi kuralı korunur. Tür seçimi yalnız mevcut kaynakta doğrulanan olayların uygun adayları arasındadır. Darbe ve düşüşe bağlı adaylar tarayıcının gönderdiği olay iddialarından üretilmez: SQL tarafından yürütülen PvP ve kervan baskınının sunucudaki savaş tekrarı kullanılır. Omuz teması kervan savaşının gerçek silah temas geometrisinden doğrulanır. Dönüş koruması ilk tamamlanan gerçek maçta bir kez değerlendirilir; geçersiz sonuç veya yarıda bırakma bu hakkı tüketmez.

**doctor_025 — Kalabalık Revirin Düzeni bekler.** Aynı klan savaşından gelen en az iki doğrulanmış yaralanma kaynağı henüz yoktur. Klan üyeliği, kupa kaydı veya bitmiş kadro bu koşulun yerine geçirilmez. Bilgi ve öğrenilmiş kaydı korunur; etkin pasif olarak sayılmaz. Diğer mesleklerin V288 kapsamı değişmez.

## Uygulama tercihleri ve korunan kayıtlar

Tarif miktarları ve sakatlık başına ürün adetleri bu sürümün denge tercihleridir; eski onaylı bir sayı gibi sunulmaz. Ballı Sirke Şurubunun tabanı tedavi süresine dağıtılan 5 ek yorgunluk puanı, İncir Şurubunun tabanı taburculukta 5 puandır. Öğrenilmiş ilgili bilgi bu miktarı artırır; yorgunluk sıfırın altına inmez. Eski sargı ile süreyi %20 kısaltma taslağı kullanılmaz.

V289 öncesindeki sakatlıklar eski bitiş zamanlarını korur. Mevcut para, ekipman, papirüs öğrenimi ve devam eden kervan teslimatları sıfırlanmaz. V288'de verilen 90 papirüs tekrar verilmez. Özel çalışanlara meslek EXP'si eklenmez.

Yeni malzemeli tedavi oyuncu hesaplarına uygulanır. Botların tıbbi malzeme üretip tedavi başlatan yapay zekâsı henüz bulunmadığı için bot hesapları eski otomatik 12 saatlik sakatlık akışını korur. Başlamış eski savaşlar geriye dönük yeni olay kaydı veya yeni sakatlık türü almaz.

## Doğrulama

Veritabanı kurulumu yeni sakatlık atamasını başlangıçta kapalı tutar. Özel yayın anahtarı yalnız yönetici tarafından, güncel Revir ekranının canlı dosyaları doğrulandıktan sonra açılır. Bu sırada eski iyileşme akışı çalışmayı sürdürür.

Test kapsamı; stokların ve eski hesapların korunması, altı kaynağın gerçek toplama ve alışveriş teslimatları, 15 sakatlık ve üç süre, sahiplik, yetkisiz çağrıların reddi, tekrar güvenliği, çevrimdışı toparlanma, dondurulmuş Doktor katkıları, gerçek savaş tekrarının değişmemesi ve farklı ekran boyutlarında Revir/üretim/harita düzenidir. Tarayıcı kontrolleri Chromium ve WebKit üzerinde çalıştırılır. Gerçek iPhone testi ayrıca değerlendirilir.
