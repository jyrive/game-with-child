# Pakohuone

Pieni 3D-pakohuonepeli, joka toimii selaimessa tietokoneella ja puhelimella.
Tehty Babylon.js:llä ja TypeScriptillä.

Huoneessa liikutaan vapaasti omalla hahmolla kuten Robloxissa: kävellään,
hypitään huonekalujen päälle ja napautetaan esineitä. Huoneita on kolme, ja
jokainen on edellistä vaikeampi. Kun oven koodi on selvitetty, ovesta kävellään
seuraavaan huoneeseen.

**Kokeile peliä selaimessa:** https://jyrive.github.io/game-with-child/

Toimii tietokoneella ja puhelimella ilman asennusta. Puhelimella pelin voi
lisätä aloitusnäyttöön, jolloin se toimii myös ilman verkkoa.

## Miten tämä peli syntyi

Tämä on vanhemman ja lapsen yhteinen projekti, ja lapsi on pelin suunnittelija.
Lapsi päätti, että pelin pitää olla 3D, että huoneessa pitää voida liikkua
vapaasti kuten Robloxissa ja että tehtävien pitää vaikeutua huone huoneelta.
Pelin säännöt, pulmat ja tunnelma ovat hänen toiveidensa mukaisia.

Koodi on vibekoodattu: se on kirjoitettu tekoälyn (Claude Code) kanssa
keskustellen lapsen toiveiden pohjalta. Aikuinen on toiminut tulkkina toiveiden
ja koodin välillä, ja tekoäly on kirjoittanut ja testannut toteutuksen.
Projekti on samalla kokeilu siitä, millaista pelinkehitys on, kun lapsi
suunnittelee ja tekoäly toteuttaa. Seuraava huone on tarkoitus tehdä niin, että
lapsi kirjoittaa sen itse kansioon `src/game/rooms/`.

## Käynnistys

```bash
npm install
npm run dev
```

Komento tulostaa kaksi osoitetta. `localhost` toimii omalla koneella.
`Network`-osoite toimii puhelimella, kun se on samassa WiFi-verkossa.

Muut komennot:

| Komento             | Mitä tekee                                   |
|---------------------|----------------------------------------------|
| `npm run typecheck` | Tarkistaa TypeScript-tyypit                  |
| `npm run build`     | Tekee julkaistavan version `dist`-kansioon   |
| `npm run preview`   | Näyttää `dist`-kansion version selaimessa    |
| `npm run trim-character -- polku/Hahmo.glb` | Tekee hahmomallista pelin käyttämän kevyen version (ks. Pelaajan hahmo) |

## Ohjaus

| Puhelin                                  | Tietokone                          |
|------------------------------------------|------------------------------------|
| Vasen peukalo: joystick liikuttaa        | WASD tai nuolinäppäimet liikuttaa  |
| Veto oikealla puolella kääntää kameraa   | Hiirellä veto kääntää kameraa      |
| Nipistys zoomaa                          | Rulla zoomaa                       |
| Nurkan nappi hyppää                      | Välilyönti hyppää                  |
| Napautus esineeseen                      | Klikkaus esineeseen                |

Esineisiin yltää vain läheltä. Korkealla oleviin pitää kiivetä: hyppää
laatikon, tuolin tai pöydän päälle.

Ylälaidan huoneen nimeä painamalla voi aloittaa alusta. Eteneminen tallentuu
selaimeen, joten peliä voi jatkaa huoneesta, johon jäi.

## Huoneet

1. **Alku.** Koodi on lapussa taulun takana.
2. **Kolme numeroa.** Koodi on kolmessa värillisessä lapussa: yksi ruukun alla,
   yksi korkealla hyllyllä (laatikon päältä yltää) ja yksi kaapissa. Juliste
   kertoo järjestyksen.
3. **Avain ja lasku.** Avain on vaatekaapin päällä, jonne pääsee pöydän kautta.
   Avaimella arkku aukeaa, ja arkun lappu kertoo, että koodi on tuolien,
   kirjojen ja ikkunoiden määrä.

## Oman huoneen tekeminen

Huoneet ovat kansiossa `src/game/rooms/`. Jokainen huone on yksi tiedosto,
jossa on lista esineitä. Uusi huone tehdään näin:

1. Kopioi `room1.ts` nimellä `room4.ts` ja muuta `id`, `name`, `code` ja `intro`.
2. Lisää huone listaan tiedostossa `src/game/rooms/index.ts`.
3. Muokkaa esineitä. Kentät on selitetty tiedostossa `src/game/rooms/types.ts`.

Esine on muutama rivi:

```ts
{ id: "crate", shape: "box", at: [-3.2, 0.4, 1.4], size: [0.8, 0.8, 0.8], color: "#a67c52", solid: true,
  onTap: { message: "Puulaatikko." } },
```

- `shape`: `box`, `sphere`, `cylinder`, `sign` (kyltti, johon voi kirjoittaa),
  `table` tai `chair`.
- `at`: paikka metreinä. Huoneen keskipiste on `[0, 0, 0]` lattian tasolla.
  x on vasen/oikea, y korkeus, z etelä/pohjoinen. Ovi on aina pohjoisseinällä.
- `solid: true` tarkoittaa, että hahmo törmää esineeseen ja voi seistä sen päällä.
- `hidden: true` piilottaa esineen, kunnes jokin toinen esine paljastaa sen.
- `onTap` kertoo, mitä napautuksesta tapahtuu: `message` näyttää tekstin,
  `reveals` paljastaa piilotettuja esineitä, `swing` kääntää esineen saranan
  ympäri (taulu, kaapin ovi), `gives` antaa esineen taskuun, `requires` vaatii
  esineen taskusta ja `farMessage` on viesti, kun esine on liian kaukana.

Ovi, karmi ja koodilukko tehdään automaattisesti kohtaan `doorX`.

## Pelaajan hahmo

Pelaajan hahmo on valmis 3D-malli: KayKit-paketin *Adventurers* Rogue, jonka
on tehnyt Kay Lousberg (CC0-lisenssi, saa käyttää vapaasti). Malli on
tiedostossa `public/models/rogue.glb`, ja peli lataa sen taustalla. Kunnes
malli on ladattu, tai jos lataus epäonnistuu, näkyy vanha palikkahahmo.

Paketin alkuperäinen tiedosto on 3,5 Mt, koska siinä on 76 animaatiota ja
aseita. Komento `npm run trim-character` jättää tiedostoon vain pelin
käyttämät animaatiot (Idle, Walking_A, Running_A, Jump_Idle, Interact, Cheer)
ja poistaa aseet. Tulos on noin 0,4 Mt ja 4 300 kolmiota.

Hahmon voi vaihtaa toiseen saman paketin hahmoon (Knight, Barbarian, Mage,
Rogue_Hooded) näin:

1. Lataa paketti: https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0
   (mallit ovat kansiossa `Characters/gltf/`) tai https://kaylousberg.itch.io/kaykit-adventurers.
2. `npm run trim-character -- polku/Knight.glb` tekee tiedoston `public/models/knight.glb`.
3. Vaihda `model: "models/knight.glb"` tiedostossa `src/game/config.ts`.

Samassa tiedostossa säädetään hahmon pituus (`height`) ja askelten tahti
(`animSpeed`). Muidenkin tekijöiden malleja voi käyttää, kunhan animaatioilla
on samat nimet; muuten nimet vaihdetaan tiedoston `src/game/avatar.ts` alkuun.

Mallin PBR-materiaalit vaihdetaan latauksen jälkeen tavallisiin materiaaleihin
ilman kiiltoa, samoin kuin huoneen esineillä. Se on puhelimelle kevyempää.

## Suorituskyvyn seuranta

Oikeassa yläkulmassa on pieni **FPS**-nappi. Tietokoneella sama avautuu
**P**-näppäimellä. Mittari näyttää:

| Rivi        | Mitä tarkoittaa                                                  |
|-------------|------------------------------------------------------------------|
| FPS         | Kuvia sekunnissa. 60 on hyvä, alle 30 tuntuu tökkivältä.         |
| Kehys ka.   | Yhden kuvan piirtämiseen kulunut aika keskimäärin. 16,7 ms = 60 fps. |
| Kehys p95   | 95 % kuvista oli tätä nopeampia. Paljastaa tökkimisen paremmin kuin keskiarvo. |
| Kehys max   | Hitain kuva viimeisen sekunnin aikana.                           |
| Piirtoja    | Piirtokutsujen määrä. Pidä pienenä, jokainen esine on yleensä yksi. |
| Meshejä     | Kuinka monta mallia oli näkyvissä.                               |
| Resoluutio  | Todellinen piirtotarkkuus ja skaalauskerroin.                    |
| Tökkäyksiä  | Yli 33 ms kestäneiden kuvien määrä yhteensä ja tällä sekunnilla.  |

Mittari muuttuu oranssiksi, jos peli alkaa tökkiä.

### Tökkäysloki

Jokainen yli 33 ms kestänyt kuva kirjataan lokiin selaimen muistiin. Loki
säilyy, vaikka peli suljetaan. Näin puhelimella pelatun testin voi käydä läpi
jälkikäteen:

1. Pelaa peli läpi puhelimella.
2. Avaa FPS-mittari ja paina **Kopioi loki**. Loki kopioituu leikepöydälle,
   tai latautuu tiedostona, jos leikepöytä ei ole käytettävissä.
3. Liitä loki viestiin tai tiedostoon. Mukana on laitteen tiedot ja jokaisen
   tökkäyksen aika, kesto ja huone.
4. **Tyhjennä loki** nollaa listan ennen seuraavaa testiä.

Ensimmäiset kolme sekuntia eivät kirjaudu, koska silloin selain kääntää
shaderit ja kaikki on hidasta.

### Automaattinen laatu

Jos kuvanopeus pysyy alle 40 fps:n, peli pudottaa piirtotarkkuutta askel
kerrallaan. Kun peli pyörii taas sujuvasti, tarkkuus nousee takaisin.
Tämän voi kytkeä pois mittarin **Auto-laatu**-napista, jos haluat nähdä
laitteen todellisen suorituskyvyn.

### Inspector

Kehitystilassa (`npm run dev`) **I**-näppäin tai mittarin **Inspector**-nappi
avaa Babylonin oman tarkastustyökalun. Siitä näkee jokaisen esineen,
materiaalin ja tarkemman suorituskykyprofiilin. Julkaistuun peliin se ei
päädy.

Kehitystilassa selaimen konsolissa on myös `__pakohuone`, jolla voi kokeilla
asioita: esimerkiksi `__pakohuone.teleport(0, 2)` siirtää hahmon.

## Suorituskyvyn perussäännöt

Näitä on noudatettu, ja niistä kannattaa pitää kiinni, kun peliin lisätään
sisältöä:

- Huone on yksi malli, jonka sisäpuoli piirretään. Seinät, lattia ja katto
  menevät yhdellä piirtokutsulla.
- Valoja on kaksi eikä varjoja lainkaan. Varjot ovat puhelimelle kallein
  yksittäinen asia.
- Materiaaleista on otettu kiilto pois, ja samanväriset esineet jakavat
  materiaalin. Liikkumattomat esineet on jäädytetty.
- Törmäystarkistus on vain esineillä, joilla on `solid: true`.
- Osumatarkistus tehdään vain napautuksen lopussa, ei joka sormen liikkeellä.
- Piirtotarkkuus on enintään kaksi kuvapistettä per CSS-pikseli.

Jos lisäät 3D-malleja, käytä glTF-muotoa ja matalapolygonisia malleja.
KayKitin (kaylousberg.itch.io) ja Kenneyn (kenney.nl) ilmaiset mallit sopivat
tyyliin hyvin, ja molemmat ovat CC0-lisensoituja.

## Julkaisu

`npm run build` tekee `dist`-kansion, jonka voi laittaa mihin tahansa
staattiseen hostaukseen (GitHub Pages, Cloudflare Pages, Netlify).

Repossa on valmis GitHub Actions -työnkulku, joka julkaisee pelin GitHub
Pagesiin jokaisella pushilla `main`-haaraan. Ota se käyttöön repon
asetuksista: **Settings → Pages → Source: GitHub Actions**. Peli löytyy
osoitteesta `https://<käyttäjä>.github.io/game-with-child/`.

Jos julkaiset muualle kuin juureen, aseta `VITE_BASE`-ympäristömuuttuja
buildin ajaksi, esimerkiksi `VITE_BASE=/pakohuone/ npm run build`.

Peli on PWA: puhelimella selaimen "Lisää aloitusnäyttöön" tekee siitä
kuvakkeen, ja se toimii myös ilman verkkoa ensimmäisen latauksen jälkeen.

## Rakenne

```
index.html                 Käyttöliittymän elementit
src/main.ts                Käynnistys: moottori, valot, kamera, kaikki osat yhteen
src/style.css              Käyttöliittymän ulkoasu
src/game/config.ts         Yleiset tekstit, ulottuma ja liikkeen säädöt
src/game/rooms/            Huoneet datana (room1.ts, room2.ts, room3.ts) ja kenttien kuvaus (types.ts)
src/game/roomBuilder.ts    Rakentaa huoneen meshit kuvauksesta
src/game/avatar.ts         Pelaajan hahmo: 3D-mallin lataus ja animaatiot, varalla palikkahahmo
src/game/characterController.ts  Liike, painovoima, hyppy ja törmäykset
src/game/followCamera.ts   Hahmoa seuraava kamera
src/game/input.ts          Näppäimistö, joystick-arvot ja napautuksen osumatarkistus
src/game/game.ts           Pelin säännöt, huoneiden vaihto, tasku, tallennus
src/game/tween.ts          Pehmeä liike animaatioihin
src/ui/overlay.ts          Viestit, tasku, koodilukko, loppuruutu, häivytys
src/ui/joystick.ts         Virtuaalinen joystick ja hyppynappi
src/perf/perfMonitor.ts    Kehysaikojen mittaus ja tökkäysloki
src/perf/autoQuality.ts    Automaattinen tarkkuuden säätö
src/perf/perfHud.ts        Mittarin näyttö
public/                    Kuvakkeet
public/models/             Pelaajan hahmon 3D-malli (rogue.glb)
scripts/trim-character.mjs Karsii hahmomallista turhat animaatiot ja aseet
```

## Ideoita jatkoon

- Neljäs huone, jonka lapsi suunnittelee itse.
- Esine, jota voi työntää (laatikko oikeaan paikkaan).
- Äänet: askeleet, napsahdus kun lukko aukeaa, oven narina.
- Oikeita 3D-malleja glTF-tiedostoina myös huonekaluille.
- Hahmon valinta pelin alussa (Knight, Mage, Barbarian...).
- Pimeä huone ja taskulamppu.
