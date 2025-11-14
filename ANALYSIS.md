# Document Analysis

## FINAL AD Structure
Document conține linii de text pentru ad-uri cu următoarea structură:
- Keywords de eliminat: HOOKS, H1, H2, H3, MIRROR, DCS, TRANSITION, NEW_CAUSE, MECHANISM, EMOTIONAL_PROOF, TRANSFORMATION, CTA
- Fiecare linie se termină cu "- XXX chars" care trebuie eliminat
- Exemplu linie brută: "Pentru femeile care simt că oricât se străduiesc, nu reușesc să iasă din datorii. Acest mesaj este pentru voi. Pentru femeile - 125 chars"
- Exemplu linie procesată: "Pentru femeile care simt că oricât se străduiesc, nu reușesc să iasă din datorii. Acest mesaj este pentru voi. Pentru femeile"

Linii identificate în document:
1. "Pentru femeile care s-au săturat să trăiască de la o lună la alta și cred că 'așa e viața'. Acest mesaj este pentru voi."
2. "Pentru femeile care simt că oricât se străduiesc, nu reușesc să iasă din datorii. Acest mesaj este pentru voi. Pentru femeile"
3. "Știu cum e să simți că nu mai poți din cauză că nu mai faci față cu cheltuielile și să-ți vină să renunți la tot. Știu cum e"
4. "Am fost acolo, până în ziua în care am aflat de ce eram blocată cu adevărat. Am fost acolo, până în ziua în care am aflat"

## Prompt Structure
Document conține un prompt detaliat cu:
- Secțiune AUDIO care conține: `Dialogue: "[INSERT TEXT]"`
- Aici trebuie înlocuit [INSERT TEXT] cu o linie din documentul ad
- Restul promptului rămâne neschimbat

## Workflow Logic
1. User uploadează document ad → parsare și extragere linii
2. User uploadează document prompt → parsare și identificare zona [INSERT TEXT]
3. User uploadează multiple imagini
4. Mapare: user selectează combinații (linie text + imagine)
5. Pentru fiecare combinație:
   - Înlocuiește [INSERT TEXT] cu linia selectată
   - Generează video cu promptul complet + imaginea selectată
