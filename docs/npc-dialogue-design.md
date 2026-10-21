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
