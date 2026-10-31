# Your voice clips

Record these on your phone and drop them in this folder with exactly these
names. Any common format works (`.ogg`, `.mp3`, `.wav`, `.m4a`). Any clip that
is missing falls back to a built-in sound.

| File name | When it plays | Example |
|---|---|---|
| `lets_mow` | A lawn starts | "Let's mow!" |
| `pick_your_mower` | The garage opens | "Pick your mower!" |
| `pick_a_colour` | Choosing the colour | "What colour today?" |
| `ooh_a_present` | A present lands on the vehicle | "Ooh, a present!" |
| `nearly_done` | Sparkles show where grass is left | "Nearly done! Find the sparkles!" |
| `well_done` | The grass pile celebration | "Well done! Look at that pile!" |
| `time_to_rest` | The play timer ends | "Time for the mower to rest." |

Keep each clip short (1 to 3 seconds). Claude on the Pi can convert files that
don't play, for example:

```
ffmpeg -i well_done.m4a -c:a libopus well_done.ogg
```
