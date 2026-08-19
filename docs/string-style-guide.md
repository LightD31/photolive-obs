# String style guide

Every string that an operator or an audience member reads obeys one of two
controlled languages:

- **English → ASD-STE100** (Simplified Technical English).
- **French → le Français Rationalisé du GIFAS.**

The product currently ships English only, so all the strings in the repository
follow ASD-STE100. The French rules below apply when a translation starts.

## What counts as a string

In scope:

- Labels, hints, buttons, dialogs, empty states, and errors in
  `apps/web-control` and `apps/web-slideshow`.
- Electron dialog text in `apps/desktop`.
- HTTP error bodies in `apps/server/src/routes` — the control panel shows the
  `error` field to the operator.
- Console text that the server writes at start and at stop.

Out of scope (do not rewrite):

- Data values that go across the wire: `auto`, `auto-skip-blurry`, `approval`,
  `pending`, `fade`, `slide-blur`, log levels, and the other enum members.
- Camera and OBS menu paths (`Network → FTP Transfer Func. → …`). These are
  quotations of another product. Keep them character for character.
- Code comments and identifiers.
- Structured log event names (`bootlog('startServer failed', …)`,
  `logger.info({ … }, 'app settings updated')`). These are keys for a machine,
  not sentences for a person.

## ASD-STE100 rules that this repository applies

1. **One word, one meaning.** Each concept has one word. See the glossary.
2. **Approved words only.** If a word is not in the STE dictionary and it is
   not a Technical Name, replace it.
3. **Active voice.** "The server refuses the token", not "the token was
   rejected".
4. **Instructions are commands.** "Select Replace", not "you can select
   Replace".
5. **One instruction per sentence.** Maximum 20 words in an instruction,
   maximum 25 words in a description.
6. **Simple tenses only.** Simple present, simple past, simple future.
7. **No `-ing` forms** unless the form is part of a Technical Name. This is
   why a pending button says `Please wait…` and not `Saving…`.
8. **Keep the articles.** "The token", not "token".
9. **No contractions.** "cannot", not "can't".
10. **Maximum three nouns in a noun cluster.**
11. **No abbreviations** that the STE dictionary does not have, and no
    abbreviations of ordinary words (`info`, `auto`, `config`).

### Technical Names that this product keeps

PhotoLive, event, photographer, image, thumbnail, caption, slideshow, queue,
token, slug, log, restart, FTP, OBS, HTTP, WebSocket, CORS, QR code, JPEG,
PASV, Chromecast, `settings.json`, `.env`.

`restart` is a Technical Name used as a noun only ("Restart necessary",
"Restart now"). As a verb, write "start the app again".

### Glossary — write this, not that

| Do not write | Write |
| --- | --- |
| Loading… / Saving… / Creating… / Deleting… / Signing in… | Please wait… |
| Sign in / Sign out | Log in / Log out |
| Create | Make / Add |
| Activate | Make active |
| Reveal | Show |
| Rotate (a token or a password) | Replace |
| Unarchive | Restore |
| Curation mode | Selection mode |
| Info | Details |
| Latency | Delay |
| Credentials | The user name and the password |
| Username | User name |
| Invalidate | The server refuses … |
| Failed to X | The system could not X |
| X is required | X is necessary |
| Land / fall back / drop / gate (as verbs) | go to / change to / close / approve |
| Permanently | Completely |
| auto (as a label) | automatic |
| unattributed | no photographer |

### Message patterns

- Failure: `The system could not <do the thing>.`
- Prerequisite: `Make an event active to <do the thing>.`
- Empty list: `There are no <things>.`
- Pending control: `Please wait…`

## Le Français Rationalisé du GIFAS

When a French translation starts, it follows the GIFAS rules, which are the
French counterpart of ASD-STE100:

1. **Lexique contrôlé.** One approved word for each concept, taken from the
   GIFAS dictionary. No synonyms.
2. **Voix active** and **indicatif présent**. No passive, no conditional.
3. **Impératif for the instructions**, one instruction per sentence.
4. **Maximum 20 words** in an instruction, 25 in a description.
5. **No participe présent** and no substantive form of a verb where a verb
   works ("Pour supprimer…", not "Suppression de…").
6. **Keep the determiners** and no ellipsis of the articles.
7. **No abbreviations** outside the technical names above.
8. Keep the technical names of this table in English, because they name
   the objects of the product interface.

Put the French strings beside the English ones and keep the same message
patterns, so the two languages stay parallel.
