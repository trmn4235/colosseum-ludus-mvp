# Şan Avlusu V178

İki gürzün seçim kartlarında kullanıcının gönderdiği saydam PNG görselleri aynen kullanılır. Üçüncü seçenek yaydır. 1x10'da bir, 2x5'te iki savaşçı kendi silahını bağımsız seçebilir. Üç seçenek de yatay ve dikey mobil görünümde kaydırmadan görünür.

Yay için ayrı bir avlu savaş modülü vardır. Saldırma düğmesi yayı gerer; 0,35 saniye sonra ok çıkar, 0,30 saniye toparlanma sürer. Bir atış 13 kondisyon kullanır. Yayla gürz saldırısı, yumruk veya silah özeli çalışmaz. Yaya sahip takım arkadaşı mesafesini korur ve rakibe atış yapar.

İnce saydam çizgi okun başlangıcından mevcut yönündeki ilk engele kadar çizilir. Rakip üzerinde yeşil, boşlukta veya takım arkadaşı/duvar önünde sarıdır. Bu, mevcut konumlardaki güzergâh bilgisidir; hareket eden hedefe gelecekte isabet garantisi değildir. Renk ve ok aynı süpürülmüş çarpışma sorgusunu kullanır. Takım arkadaşları oku durdurur ama dost hasarı almaz. Ölüler hedef sayılmaz; duvarlar ve 20 metre menzil oku sonlandırır. Çizgi ölüm, duraklatma ve savaş bitişinde gizlenir. Darbeyle kesilen veya ölen okçunun yarım kalmış atışı çıkmaz.

Sunucuda yalnızca özel avlu ödünç silahı doğrulamasına `pit_bow` eklenir. Envanter, sahiplik, iki farklı gladyatör, müsabaka katılımı, tekrar istek güvenliği ve +1 şan kuralları korunur. Üretim yayları bu ödünç seçime dahil edilmez.

Doğrulama: gerçek yerel SQL ile iki yaylı takım ve tekrar istek, üç ekran boyutunda altı kart, gerçek tarayıcıda yeşil isabet/sarı boşa atış ve dost engeli, duraklatma, iki ayrı yay modeli, üç zaman adımında ok çarpışması, menzil, duvar, kondisyon, kesilen atış ve tek ok/tek hasar.
