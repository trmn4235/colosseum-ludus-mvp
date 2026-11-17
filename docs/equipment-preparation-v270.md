# V270 — ekipman hazırlığı

V269 ekipman ekranı çalışmasını tamamlar. Hazırlık ekranındaki takılı ekipman ve envanter kartları 4:5 oranındadır. Genişlikler önceki küçültülmüş düzeni korur; ekran yüksekliği yetmezse kart, oranı bozulmadan daralır. İkon, ad ve kısa istatistik satırı için ayrı alan ayrılmıştır.

Ortak ekipman SVG'sinde fotoğraf kendi en/boy oranıyla yerleşir. Geliştirme rozeti ayrı bir SVG görünüm alanıyla gerçek sağ üst köşeye hizalanır. İkon kaynakları değiştirilmedi; 36 ekipmanın kimliği ve mevcut model fotoğrafları korunur.

V269'dan gelen özellikler: seçilen ekipmanın gerçek etkili istatistikleri, dört zümrüt yuvası ve bonusları; küçültülmüş gladyatör profili; altı envanter eşyası; ayrı Çıkar düğmesi; hazırlık ekranındaki ölüm açıklamasının kaldırılması.

## Doğrulama

- 16 mevcut ekipman/miğfer kimlik ve uyumluluk testi geçti.
- Tarayıcıda 1280×706, 874×402, 667×375 ve 568×320 yatay düzenleri incelendi. En dar görünümde eski art katmanının profil kuralı düzeltildi; dört zümrüt yuvası panel içinde kalıyor.
- +9 trident seçimi, zırh seçimi, dört dolu zümrüt, çıkarma ve yeniden giydirme örnek verilerle doğrulandı. Gerçek hesaba yazma yapılmadı.
- Dikey telefonda mevcut yatay çevirme ekranı korunur.
- Bu ortamda WebGL önizleme açılamadı ve mevcut yedek karakter görseli gösterildi. Canlı 3D görünüm bu kontrolde doğrulanamadı; model veya animasyon kodu değiştirilmedi.
- JavaScript sözdizimi ve git diff boşluk kontrolleri geçti.
