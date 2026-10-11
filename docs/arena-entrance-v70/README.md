# Arena seçim arka planı V70

Üç onaylı afiş değiştirilmedi. Beyaz boş alan yerine, kartların dışında
kalan yanlara bordo flamalar ve beyaz taş kemer yerleştiren bir arka plan
eklendi. Kart grubu en fazla ekranın %82'sini kaplar; kenarlardaki önemli
detaylar görünür kalır. Başlık açık altın, hafif koyu zeminlidir.

- Varlık: `assets/arena-entrance-v70.webp` (kayıpsız WebP, 1.41 MB).
- Stil: `arena-entrance-v70.css`, yalnız `savas.html` tarafından yüklenir.
- Kapsam: `#modePage`; hazırlık ekranına geçerken arka plan da gizlenir.
- Mevcut geri düğmesi, mod düğmeleri, afiş oranları ve işlevler korunur.

Yerleşik imagegen ile üretildi. Üretim talimatı özeti: fotoğraf gerçekliğinde
Roma arena giriş kemeri; üç kartın kapattığı merkez düşük detaylı ve düşük
kontrastlı; anlamlı mimari/altın detay ve bordo flamalar uç kenarlarda ve
üst şeritte; doğal beyaz taş, nötr gölge, kahverengi filtre, insan ve metin yok.

`tests/arena-art-v69.cjs`: dört yatay boyutta sekiz seçim/kuyruk görünümü
geçti (1536×706, 844×390, 667×375, 568×320). Görsel çözümlenmesi,
kart oranları, tıklama hedefleri, geri düğmesinin örtülmemesi ve hazırlığa
geçince seçim arka planının gizlenmesi doğrulandı. Test canlı hesap veya
eşleştirme çağrısı yapmaz; fiziksel iPhone/Safari doğrulaması değildir.

`selection-mobile.png`: gerçek HTML/CSS ekran görüntüsü; bakiye alanı
scriptsiz test nedeniyle yükleniyor durumundadır. Yerel çalışma; yayın yok.
