# Ortak karakter konuşması standardı

Kullanıcının 21 Ekim 2026 tarihinde verdiği Bannerlord konuşma ekranı referansı, sonraki bütün NPC konuşmalarının tasarım standardıdır.

- Gerçekçi fotoğraf formatında karakter; kameraya konuşur. Arka plan oyun mekânının yönüyle tutarlı olmalıdır.
- Altta solda soru/diyalog: yarı saydam siyaha yakın panel, ince eskitilmiş altın çizgi, solda geniş yuvarlak köşeler. Karakter adı üst kenarda altın renk.
- Altta sağda dikey cevap listesi: koyu dar satırlar; krem renkli, normal kalınlıkta serif yazı. Hover/klavye odağında hardal-altın zemin.
- Yazı ailesi Georgia, Times New Roman, serif. Bu, referansın görünümüne yakın sistem fontu tercihidir; özgün Bannerlord fontunun birebir kopyası değildir.
- Tema değişkenleri ve tekrar kullanılabilir `.npc-dialogue`, `.npc-choices` sınıfları `npc-dialogue-v153.css` dosyasındadır. Soruya `data-speaker` eklenir.
- Cevap seçimi konuşmayı/ilgili işlemi ilerletir. Ayrılma seçeneği bulunur. Büyük beyaz/bordo kartlar kullanılmaz.
- Mobil yatay ekranda solda soru, sağda cevaplar; dikey dar ekranda alt alta. Tek ekrana sığmalı, karakterin yüzünü örtmemelidir.

İlk uygulama: Hipodrom gişesi. Diğer mevcut ekranlar bu değişiklik kapsamında topluca değiştirilmedi; yeni karakter konuşmaları bu ortak dosyayı kullanmalıdır.

## Onaylanan gişe konuşması

Görevli: “Bahis mi yapacaksın, yoksa yarışmaya katılmak için mi geldin?”

- “Bahis yapmaya geldim.” → “Hangi takıma güveniyorsun? Takımları incele, ne kadar yatıracağını söyle.” Bahis formu açılır.
- “Yarışmaya katılacağım.” → “Öyleyse iki atını seç. Takımını kaydedelim.” At seçimi açılır.
- “Şimdilik sadece bakıyorum.” → “Kararını verirsen beni nerede bulacağını biliyorsun.” Son cevap 2,8 saniye gösterilir, konuşma kapanır.

## Kadraj ve boyut düzeltmesi

Kullanıcı düzeltmesi: fotoğrafın özgün uzak kadrajı korunur; cover/zoom ile kırpılmaz. Yatayda panel fotoğrafın 16:9 oranına uyar. Soru-cevap alanı altta yaklaşık 68–78 CSS piksel, metin 11–12 piksel; karakter fotoğrafı baskın kalır. Referansa göre konuşma alanını veya yazıları büyütme.

## Son onay: tam ekran geniş kadraj (V157)

Önceki 16:9 küçük pencere kararı geçersizdir. Kullanıcı son taslağı %13 yakınlaştırma ve %15 daha büyük yazılarla onayladı. Gişe fotoğrafı ekranın tamamını doldurur; modal dış çerçevesi ve kenar boşlukları yoktur. Onaylı fotoğrafın yazısız sürümü kullanılır; zoom tekrar uygulanmaz. Yatayda diyalog ekranın altındaki orta %66 genişlikte, solda soru ve sağda üç cevap olacak şekilde yerleşir; alt boşluk %6. Metin referans görseldeki orana uyar (932px genişlikte yaklaşık 16px). Referans: exec-e67a898a-020e-4359-a687-db013a0233b5.png.

## Sabit ölçüler — bütün karakter konuşmaları için

Kullanıcının açık talebi: “Boyutları sakın unutma kaydet hep aynı boyutta olacak yazılar aynı yerde.” Bu ölçüler yeni NPC ekranlarında yeniden yorumlanmaz; aynı CSS kullanılır. Aynı ekran boyutunda aynı yerleşim, farklı ekranlarda aynı tanımlı uyarlama uygulanır.

| Özellik | Sabit değer |
| --- | --- |
| Fotoğraf alanı | Tam viewport: 100vw × 100dvh; dış kenar, çerçeve, modal boşluğu yok |
| Yatay diyalog sol / sağ boşluk | %16,7 / %17,1 |
| Alt boşluk | Ekran yüksekliğinin %6’sı |
| Soru / cevap sütun oranı | 1,46 : 1 |
| Sütun aralığı | 6 CSS px |
| Cevap satırları aralığı | 3 CSS px |
| Soru ve cevap yazıları | Georgia, Times New Roman, serif; normal kalınlık; clamp(11px, 1.74vw, 19px); satır yüksekliği 1,2 |
| Karakter adı | clamp(12px, 1.85vw, 20px); kutu içinde üstten 9px |
| Soru iç üst boşluğu | clamp(27px, 3.6vw, 40px) |
| Soru iç yatay boşluğu | clamp(14px, 2.5vw, 28px) |
| Soru iç alt boşluğu | 10px |
| Cevap iç dikey / yatay boşluğu | clamp(2px, .25vw, 4px) / clamp(5px, .65vw, 9px) |
| Metin rengi | #eee8da; karakter adı #dbb773 |
| Panel zemini | Koyu yarı saydam; altın çizgi ve hardal-altın odak vurgusu |
| Dikey ekran uyarlaması | Soru ve cevaplar alt alta; metin 15px, ad 16px; sağ/sol en az 16px, alt en az 24px (safe-area korunur) |

932 × 430 yatay referansta yazı yaklaşık 16,22px, diyalog sol kenarı 155,64px, sağ kenarı 772,62px ve alt kenarı 404,2px olur. Görsel referans V157’dir; önceki küçük pencereli sürümler geçersizdir. Başka karakterlerde bu ölçüleri büyütmek, yerini değiştirmek veya farklı font kullanmak kullanıcı onayı olmadan yapılmaz.
