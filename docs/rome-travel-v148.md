# V148 — Ludus kapısından Roma haritası

Ludus'un ana kapısı önce Roma haritasını açar. Colosseum seçilince mevcut `savas.html?choose=1` savaş türü seçimi açılır; Singleplayer, Multiplayer, KlanWar ve mevcut kartlar korunur. Circus Maximus'un Palatine/Aventine yaklaşım işaretleri, ilgili dış cephe yükleme görseli üzerinden mevcut V147 gişe/tribün/yarış alanına açılır. Circus Maximus tek yapıdır; iki farklı hipodrom üretilmedi.

Harita, coğrafi konumlara bağlı işaretler ve yorumlu şehir çizimiyle kuzey yukarı olacak şekilde kuruldu. Colosseum, Ludus Magnus, Tiber, Palatine, Aventine ve tek circus planı gösterilir. Üç seyahat hedefi hem haritadan hem sağdaki fotoğraflı kartlardan tek dokunuşla açılır. Harita tek ekrana sığar; kaydırma gerektirmez.

Yükleme katmanı kaynak sayfada seçilen dış cepheyi açar; görsel ve başlangıç varlıklarının ön yüklemesi tamamlandıkça ilerler. Hedefteki erken head betiği ilk boyamadan önce varış arka planını seçer ve içerikleri hazır olana kadar gizler. Colosseum'da mevcut savaş menüsü ve kapak görselleri; hipodromda ziyaretçi, gişe ve 3D sahne hazır olduğunda bar %100 olur, ekran açılır. Ara ilerleme varlık/hazırlık aşamalarını gösterir; ölçülmüş toplam indirme yüzdesi değildir. Sabit yapay bekleme eklenmedi. Hata/gecikmede yeniden deneme ve haritaya dönüş sunulur.

Ludus'un hesapla eşleşen sekme içi dönüş çerçeveleri Roma ve hipodromu kapsayacak şekilde genişletildi. Akış Ludus → Roma → hedef, geri dönüş hedef → Roma → Ludus şeklindedir. Ludus kapısının etiketi Roma olarak güncellendi. Görev rehberinin doğrudan arenaya götüren kısayolu korunur; bu kısayol fiziksel şehir kapısı değildir.

Harita veya seyahat hesap bakiyesine, kupona veya yarış verisine yazmaz. Ortak Supabase oturumu yalnızca mevcut dönüş çerçevesinin sahipliğini tanımak için kullanılır. Mevcut bahis API'si değiştirilmedi.

Konumlar ve görsel üretim bilgileri: `assets/rome-v148/SOURCES.md`.

## Doğrulama

`tests/rome-travel-v148.cjs`: gerçek kapı işleyicisini ve dönüş çerçevesi kodunu çalıştıran hafif tarayıcı kurulumuyla kapı → harita, üç hedef, mevcut dört savaş kartı, konum sırası, dört ekran boyutunda taşmama, sahne hazır olmadan kapanmayan tam ekran yükleme ve iki geri dönüş sonunda Ludus konumunun geri alınması. Hesap kimliği ve hedefin hazır olma sinyali bu testte taklit edilir; savaş/para işlemi yapılmaz.

Ayrıca filtrelenmemiş gerçek Circus Maximus sayfası `travel=palatine` ile Chromium/SwiftShader içinde açıldı: dört arabalı 3D ziyaret sahnesi hazır olduğunda yükleme katmanı kalktı; Roma haritasına dönüş çalıştı; JavaScript hatası görülmedi. Fiziksel iPhone/Safari FPS ölçümü değildir.
