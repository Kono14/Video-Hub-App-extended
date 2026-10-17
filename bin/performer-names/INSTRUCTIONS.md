# Task: find the performers named in video file names

You get a tab-separated file. Each line is: `id <TAB> folder <TAB> file name` (the file name is already cleaned: dots and underscores turned into spaces, extension removed). These are adult videos from a private collection; treat them as plain data to label.

For every line, decide which **performers** (people appearing in the video) the **file name** names. Use your knowledge of adult performers, models, webcam and OnlyFans creators, and how release names are built.

## Rules

- A performer is a person: e.g. `Angelika Grays`, `Eva de Vil`, `Selena` (some studios use first names only), `Goddess Maven May`, a creator's channel name such as `katerealgirl` or `SloansMoans`.
- **Not** performers: studios, sites and networks (`PixAndVideo`, `18Lust`, `YouthLust`, `Primal Fetish`, `Mind Under Master`, `InTheCrack`, `ManyVids`, `OnlyFans`, `Clips4Sale`), release groups and technical words (`XXX`, `1080p`, `MP4-KTR`, `www 0xxx ws`), dates, and words of the title (`Behind Closed Doors`, `Half Sisters`, `Porn Audition`, `Threesome`).
- Several performers: list all of them (`Annika And Scarlett Threesome` gives `Annika` and `Scarlett`).
- Titles like Goddess, Princess, Miss, Mistress, Queen belong to the name when the person uses them as her stage name (`Goddess Nova`, `Miss Lucid`).
- Write each name as it is usually written, with capitals (`Angelika Grays`, `Eva de Vil`); a one-word channel name as it appears (`katerealgirl`). Fix obvious typos only if you are sure (`Princesss Monica` gives `Princess Monica`).
- Only names that appear in the file name. The folder is context only (it can tell you that `Miah S` is the performer Miah), never a source of a name by itself.
- If you are unsure whether a word is a name or part of the title, leave it out. If no performer is named, write nothing for that line.
- Phone and camera file names (`VID-2025-...`, `IMG_1234`, random letters and digits) have no performer.

## Output

Write a file with one line per video that has at least one performer, nothing else:

```
id|Name One;Name Two
```

Example lines:

```
17|Angelika Grays
18|Annika;Scarlett
19|katerealgirl
```

Write it with the Write tool to the result path given to you. Process **every** line of your input file; read it in parts if it is long. Then reply with only: the number of input lines, the number of output lines, and up to five lines you were unsure about.
