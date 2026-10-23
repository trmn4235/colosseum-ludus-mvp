# V174 — Şan Avlusu görsel ve dövüş düzeltmeleri

Dikdörtgen 384 m² kum alanı, dört kişilik herkes tek modu, zırhsız giriş, iki avlu silahı ve galibiyet başına +1 Şan korunur. Veritabanı ve para/ödül kuralları değişmez.

## Üst galeri ve çevresi: giderilen 64 sorun

1. Çıplak heykeller seyirci olarak kullanılıyordu; hazır giyimli insanlarla değiştirildi.
2. Seyircilerin heykel kaideleri kaldırıldı.
3. Tüm vücudu tek renge boyayan malzeme kaldırıldı.
4. Ten ve giysi ayrı malzemelerle çiziliyor.
5. Gerçek insan yüz geometrisi kullanılıyor.
6. Dört saç görünümü eklendi.
7. Ayrı sakal/bıyık görünümleri kullanılıyor.
8. Hazır insan ten dokusunun UV eşlemesi korunuyor.
9. Tek insan silueti yerine dört farklı gövde görünümü var.
10. Seyirci boyları çeşitlendirildi.
11. Tunikler ayrı kumaş renkleri taşıyor.
12. Ayaklarda hazır sandalet modeli var.
13. Seyircilerin ayakları galeri kotuna oturtuldu.
14. Kopyalar farklı bekleme animasyonu anlarından hazırlanıyor.
15. Seyirciler dört duvarda da kum alanına dönüyor.
16. Başlangıç bakış açıları küçük farklılıklar taşıyor.
17. Seyircilerin aynı çizgide cetvelle dizilmesi hafif konum farklarıyla kırıldı.
18. Kalabalık 48 heykelden 24 giyimli kişiye indirildi.
19. Orta yürüyüş koridoru seyircilerden ayrıldı.
20. Dört modelin aynı konumda üst üste yerleşmesi engellendi.
21. Pişirilmiş insan geometrisinin yüzey normalleri yenilendi.
22. Kalabalık modellerinin gereksiz poligonları azaltıldı.
23. Aynı varyantın kopyaları ortak geometriyle çiziliyor.
24. Kalabalık dokuları 512px ile sınırlandı.
25. İnsan gölgeleri gövdelerin altında oluşuyor.
26. Galeri zemini duvardan farklı hazır taş döşemeye geçti.
27. Döşeme taşlarının ölçeği metreye göre ayarlandı.
28. Döşemeye gerçek yükseklik dokusu bağlandı.
29. Döşemeye kendi pürüzlülük dokusu bağlandı.
30. Galeri ön alınlığı eklendi; levha gibi açık kenar kapatıldı.
31. Korkuluk dikmelerinin aralıkları iki yönde eşitlendi.
32. Korkuluk dikmelerine taban eklendi.
33. Korkulukta eksik alt yatay kayıt tamamlandı.
34. Korkuluk üst kayıtlarının köşe birleşimleri düzeltildi.
35. Dış duvarın açıkta kalan üstüne harpuşta eklendi.
36. Dış köşelerde duvar birleşimleri tamamlandı.
37. Köşe başlıkları eklendi.
38. Alçak gölgelikler insan başının üstünde daha fazla açıklık bırakacak şekilde yükseltildi.
39. Sert düz levha gölgelik yerine sarkmalı kumaş yüzeyi kullanıldı.
40. Gölgeliklere hazır dokuma kumaş dokusu bağlandı.
41. Kumaşa küçük rüzgâr hareketi verildi.
42. Gölgelik direklerinin ölçeği ve yüksekliği yeniden ayarlandı.
43. Direklerin galeriyle birleşimine taş ayak eklendi.
44. Havada duran kumaş için üst taşıyıcı kiriş eklendi.
45. Kirişlere çapraz payandalar eklendi.
46. Gölgelik gergi ipleri eklendi.
47. Tahta elemanlarda kapı resmi yerine ayrı hazır ahşap dokusu kullanılıyor.
48. Dış kenarda oturma sıraları eklendi.
49. Sıralar dört ayakla zemine oturtuldu.
50. Galerinin dış kenarına hazır su amforaları yerleştirildi.
51. Galeriye sarı renk basan ortam ışığı nötr gün ışığıyla dengelendi.
52. Gölge bias değeri küçültülerek kopuk gölge görünümü azaltıldı.
53. Kamera dış duvarın arkasına geçmeyecek şekilde sınırlandı.
54. Kamera takip mesafesi karakteri daha yakından gösterecek şekilde düzenlendi.
55. Kameranın baktığı nokta yumuşak takip ediyor.
56. Dominusun yön değiştirmesi ani sıçrama yerine yumuşatıldı.
57. Yürüyüş başlangıcı ve bitişine hız geçişi eklendi.
58. Direk, sıra ve amforaların içinden yürümek engellendi.
59. Görevlinin gövdesinin içinden yürümek engellendi.
60. Dokunmatik çubuğa merkez ölü bölgesi eklendi.
61. Çubuğun çapraz yönde daha hızlı hareket üretmesi engellendi.
62. İşaretçi yakalama kaybolduğunda hareketin takılı kalması giderildi.
63. Görevli etiketi ekran dışında ve kamera arkasında gizleniyor.
64. Yakındaki görevliyle E tuşundan konuşulabiliyor; konuşma açılırken hareket temizleniyor.

## Kum, duvar, kapı ve flama

Yeni hazır Plaster Stone Wall 02 ve Wooden Gate 1K renk/normal/pürüzlülük haritaları kullanılır. Kum, Dense Sand setinden gelir. Duvarlarla doğrudan birleşir; iç taş bordür yoktur. Duvar ve döşeme UV'leri fiziksel ölçekte tutulur. Kapı dokusu on dar tahtada on kez tekrarlanmaz; iki kanat üzerinde devam eder. Menteşe, perçin ve halkalar derinlik taşır. Flamada 0 A.D.'nin hazır kartallı SPQR resmi kullanılır; kumaş yüzeyi hafif hareket eder. Mimari parçalar malzemeye göre birleştirilerek çizim çağrıları azaltılır.

## Bahis fotoğrafı ve seçim

Orijinal `bookmaker.webp` değiştirilmedi. Konuşmanın V157 onaylı yazı ölçüleri ve konumu korunur. Kupon formu artık fotoğrafı kapatıp küçük kahverengi pencereye geçmez: aynı fotoğraf tam ekran kalır. Kupon geçmişi açılır kapanır. Silah seçimi açık taş renkli tam ekran düzen, bordo seçim vurgusu ve gerçek mevcut modellerden alınmış 420×800px önizlemeler kullanır. Yatay/dikey tek ekran uyarlaması vardır.

## Gösteri dövüşü

Eski sinüs/kosinüs kare hareketi kaldırıldı. Dört karakter mevcut ArenaCombat hedef, menzil, temas, savunma, kaçınma, yorgunluk ve çarpışma davranışlarını kullanır. Birinci karakter de bot kontrolündedir. Kamera canlı dövüşçülerin merkezini ve yayılımını izler. Dekoratif renkli taban işaretleri seyir modunda gizlenir.

Bu bir gösteri görselleştirmesidir. Sunucu kupon sonucunun tek yetkilisidir. Sunucu sonuçlanana kadar görsel dövüş erken ölüm üretmez; sonuca ulaşınca kazanan gerçek yaklaşma ve silah temasıyla kalan rakipleri sırayla düşürür. Kazananı ekranda göstermek için karakterleri başka yere ışınlamaz. Geri dönüş/yeni kupon farklı kimlikle yeni gösteri başlatır. Eski iki kişilik kuponlar da desteklenir.

## Doğrulama

- `tests/pit-model-v172.cjs`: boyutlar, duvar sınırları, dört ayrı takım, avlu ekipmanı.
- `tests/pit-exhibition-v174.cjs`: iki/dört kişi, tüm kazanan olasılıkları, gerçek menzil içi temas, yaklaşma/savunma, gövde ayrımı, sunucu sonucuna uygun final.
- `tests/pit-browser-v172.cjs`: gerçek WebGL sahne, 932×430 / 667×375 / 390×844 yerleşim, konuşma ölçüleri, yürüme, görsellerin yüklenmesi, gösteri ve final.
- `tests/pit-combat-browser-v172.cjs`: bot ve çevrimiçi avlu açılışı, dört zırhsız model, ödünç silahlar ve sınırlar.

Tarayıcı testleri yerel test hesabı yanıtlarıyla yapılır; gerçek iPhone GPU FPS ölçümü değildir.
