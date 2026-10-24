# Şan Avlusu V177

## Savaş ve seçim

- Ortak hareket kontrolü, işaretçi alanın dışında bırakılsa veya iptal edilse de sıfırlanır. Yakalama kaybı, sekme gizlenmesi, pencere odağı kaybı, sayfadan ayrılma ve yön değişimi de kontrolü bırakır. Safari'nin yerel touchend/touchcancel olayları, kaybolan pointerup olayını telafi eder. Saldırı parmağını kaldırmak hareket parmağını iptal etmez; basılı tutma süresiz çalışır.
- Aynı kontrol arena, çevrimiçi arena ve kervan savaşında kullanılır. Savunma düğmesinin kesilen basışı da temizlenir.
- V176 avlu müsabakalarında on gladyatörün tamamının vuruş sıklığı 1,2 ile çarpılır; hazırlık, temas ve toparlanma süreleri 1,2'ye bölünür. Bu %20 hız artışıdır. Diğer savaş türlerinin hızı değişmez.
- Gürzler hazır Quaternius Sword_Regular_A/B ve KayKit Melee_1H_Attack_Chop animasyonlarını kullanır. Kaynak kliplerin kalça yüksekliği mevcut gladyatöre uyarlanır. Bekleme duruşuna dönüş 120 ms içinde yumuşatılır; temas gürz başının süpürdüğü alanda hesaplanır.
- 2x5 ekranında iki gladyatör ve iki ayrı silah seçimi aynı anda görünür. İki kişilik kadroda birini diğerinin yerine seçmek yerlerini değiştirir; aynı savaşçı iki kez gönderilmez. İlk savaşçıyı oyuncu, ikincisini takım yapay zekâsı yönetir.
- Taş ve ahşap gürzler için iki özgün, saydam ikon hazırlandı. Seçim kartlarının görseli yanında metin ve seçili durumu da bulunur.
- İnce galeri korkulukları masif taş parapet, derzli aşınmış taş başlık ve köşe taşlarıyla değiştirildi. Mermer parlaması kullanılmaz.

## Avluda 20 ek iyileştirme

| No | Önceki eksik | Uygulanan değişiklik |
| --- | --- | --- |
| 1 | Kapıların üstü düz ve boştu | İki girişe radyal taş hafifletme kemeri |
| 2 | Eşikler zeminden ayrışmıyordu | Aşınmış taş kapı eşikleri |
| 3 | Duvar dipleri kesintisizdi | Taş tahliye ağızları ve gölgeli yarıkları |
| 4 | Malzeme depolama ayrıntısı yoktu | Poly Haven hazır ahşap sandıkları |
| 5 | Su köşesi eksikti | 0 A.D. kovaları ve içlerinde su yüzeyi |
| 6 | Kullanılabilir su kabı yoktu | Sandık üstünde Poly Haven ahşap tasları |
| 7 | Küçük teçhizat kapları eksikti | 0 A.D. örgü sepetleri |
| 8 | Sepetler boş görünüyordu | Fotoğraf dokulu katlı keten bezler |
| 9 | Yedek donanım depolaması yoktu | Quaternius hazır çuvalları |
| 10 | Görevli masası basit kutulardan oluşuyordu | Kenney hazır ahşap masası |
| 11 | Yan galeride oturacak yer yoktu | Poly Haven hazır bekleme sıraları |
| 12 | Dış duvarın dekoru yetersizdi | Taş kaidelerde hazır dekoratif büstler |
| 13 | Avlu köşeleri fazla boştu | Quaternius kazan modelinden demir mangal gövdeleri |
| 14 | Gölgelik ipleri sert çubuk gibiydi | Sarkan eğimli keten halatlar |
| 15 | Gölgelikler birbirinin aynıydı | Ayrı solma tonları ve doku konumları |
| 16 | Galeri yüzeyi her yerde aynıydı | Geçişlerde kenarları yumuşak taş aşınması |
| 17 | Seyirciler cetvelle dizilmiş gibiydi | Aralık, konum ve bakış açılarında küçük farklılıklar |
| 18 | Yeni eşyalarda fiziksel sınır yoktu | Model ölçülerinden yürüme ve kamera engelleri |
| 19 | Küçük eşyalar zeminden kopuk görünüyordu | Zemine bağlı yumuşak temas gölgeleri |
| 20 | Tekrarlanan hazır eşyalar ayrı çiziliyordu | Ortak geometri ve malzemeyi kullanan GPU örnekleri |

Hazır modellerin geometrileri korunur; sahneye ölçeklenir ve yerleştirilir. Mimari parçalar kodla oluşturulur ve hazır fotoğraf dokuları kullanır. Kaynaklar `assets/pit-v177/CREDITS.md` içinde kayıtlıdır. Onaylı NPC konuşma ölçüleri korunur.

## Doğrulama

- `pit-round-v176.cjs`: gerçek yerel SQL akışı, on savaşçı, yedek sırası, takım kuralları ve tekrar istek güvenliği.
- `pit-controls-v177.cjs`: bırakma/iptal/yakalama kaybı, çoklu dokunma, Safari tarzı eksik pointerup, uzun basış ve tam %20 hız oranı.
- `pit-browser-v176.cjs` ve `pit-motion-browser-v177.cjs`: iki ayrı seçim ve yer değiştirme, ayrı silahlar, 1x10/2x5, üç ekran boyutu, gerçek iskeletle altı gürz pozu ve duruşa dönüş.
- `pit-gallery-v175.cjs`: dış duvarlar, kamera engelleri, hazır nesnelerin sınırları, malzeme renkleri, yürüme animasyonu ve üç ekran boyutu.
- Genel arena testleri ve yayımlama kontrolleri ayrıca çalıştırılır. Fiziksel iPhone üzerinde dokunma testi yapılmış sayılmaz.
