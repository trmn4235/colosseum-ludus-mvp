# Arena kartlarında ortak tasarım · V93

Singleplayer, Multiplayer ve KlanWar seçimleri aynı `arena-choice` bileşenini kullanır. Kartların dikey oranı 3:4; altın çerçevesi, bordo bilgi alanı, yazı stilleri ve alt durum şeridi ortaktır. Multiplayer Beta, Ranked Arena ve 10’a 10 Arena aynı satırda eşit genişlik ve yüksekliktedir. Singleplayer üç, KlanWar dört kartını korur; her satır mevcut ekran alanına sığacak şekilde ölçeklenir.

Ranked görselleri beş kişilik takımın ve iki karşı takımın ortak kart oranında görünmesi için hazırlanmıştır. Başlıklar ve puanlar HTML metnidir. Ranked Arena 1500 başlangıç puanı ve +20/−5, 10’a 10 Arena +10/−10 bilgilerini korur. İki ranked kartı ve klan seçenekleri Yakında durumundadır. Mevcut Multiplayer Beta ile Singleplayer hazırlık akışları korunur.

## Doğrulama

- Mevcut `tests/arena-tabs-v81.cjs`, tüm panellerde ortak kart oranını, aynı panelde eşit ölçüleri, çerçeveyi, ekrana sığmayı, görselleri, puan metinlerini ve sekme dönüşünü denetler.
- Son CSS sürümüyle WebKit kontrolü geçti: 1536×706, 1024×768, 844×390, 667×375 ve 568×320; üç sekme, toplam 15 görünüm. Üç sekmenin 844×390 ve 568×320 çıktıları yayına hazırlık sırasında ayrıca görsel olarak incelendi.
- Önceki Chromium kontrolü aynı beş ekran boyutunda geçti. Bu kontrolden sonra kısa ekranların CSS ölçüleri güncellendi; son değişiklik için geçerli tarayıcı sonucu yukarıdaki WebKit çalışmasıdır.
- Bu kayıt yalnızca arena tasarımının doğrulamasını kapsar; genel MVP testlerinin tamamının geçtiği veya yatırımcı sunumuna hazır olduğu anlamına gelmez.

## Dosyalar

`arena-cards-v93.css`, `savas.html` ve `assets/arena-v93/` ortak tasarımı sağlar. Giriş ve arena gezinme bağlantıları `revision93` sürümünü açar. Önceki `multiplayer-ranked-v92.css` seçim ekranında artık yüklenmez.
