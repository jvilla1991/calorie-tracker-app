---
name: Calorie Tracker
description: A personal food diary where the day stacks up like produce at a greenmarket
colors:
  field-green: "#0E3B2E"
  field-green-track: "#245A48"
  field-white: "#FFFFFF"
  field-celery: "#C4DCCD"
  aubergine-field: "#2B1436"
  aubergine-track: "#46265A"
  aubergine-mist: "#D5C3DE"
  squash: "#F2A71B"
  squash-text: "#7A5200"
  tomato: "#CE3A20"
  tomato-text: "#B2321B"
  tomato-wash: "#FBE6DF"
  plum: "#6E3189"
  plum-bar: "#A862CC"
  leaf: "#3FA65F"
  leaf-text: "#1F6B3A"
  cornflower: "#2A6DB8"
  cornflower-text: "#1F5C9E"
  window-green: "#2C8C4B"
  fat-ochre: "#8A5A00"
  over-red: "#C41E12"
  over-red-text: "#B01A0F"
  celery-ground: "#F3F6EC"
  celery-ground-deep: "#E8EDDF"
  crate-white: "#FCFDF8"
  crate-ink: "#17231C"
  crate-muted: "#55625A"
  crate-hairline: "#DCE2D3"
  crate-track: "#E1E6D7"
  night-squash: "#F8B93D"
  night-tomato: "#F4664E"
  night-tomato-text: "#FF8A75"
  night-tomato-wash: "rgba(244, 102, 78, 0.16)"
  night-plum: "#B98BD1"
  night-plum-text: "#CDA6E0"
  night-leaf: "#5CC37B"
  night-cornflower: "#6BAAEB"
  night-cornflower-text: "#8ABDF0"
  night-fat-ochre: "#E0B35A"
  night-over-red: "#FF5C4D"
  night-over-red-text: "#FF7A6E"
  night-ground: "#150E1A"
  night-ground-raised: "#241A2C"
  night-card: "#1E1525"
  night-ink: "#F4EDF6"
  night-muted: "#AC9BB4"
  night-hairline: "#30243A"
typography:
  display:
    fontFamily: "Bricolage Grotesque, Barlow, system-ui, sans-serif"
    fontSize: "clamp(60px, 19.5vw, 76px)"
    fontWeight: 800
    lineHeight: 0.92
    fontFeature: "lnum, pnum"
  headline:
    fontFamily: "Bricolage Grotesque, Barlow, system-ui, sans-serif"
    fontSize: "21px"
    fontWeight: 800
    lineHeight: 1.1
  strip-number:
    fontFamily: "Bricolage Grotesque, Barlow, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 800
    lineHeight: 1
    fontFeature: "lnum, pnum"
  sheet-title:
    fontFamily: "Bricolage Grotesque, Barlow, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 700
  action:
    fontFamily: "Bricolage Grotesque, Barlow, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 800
  section-title:
    fontFamily: "Bricolage Grotesque, Barlow, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 800
  figure:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 700
    fontFeature: "tnum"
  body:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 500
    fontFeature: "tnum"
  label:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    fontFeature: "tnum"
  chart-label:
    fontFamily: "Bricolage Grotesque, Barlow, system-ui, sans-serif"
    fontSize: "11px"
rounded:
  bar-slim: "3px"
  swatch: "4px"
  bar: "7px"
  sm: "10px"
  md: "14px"
  pill: "22px"
  field: "26px"
  sheet: "30px"
  full: "50%"
spacing:
  bar-gap: "2px"
  row: "10px"
  page-gutter: "16px"
  stack: "14px"
  diary-gutter: "20px"
  desktop-edge: "24px"
  desktop-gap: "40px"
components:
  day-field:
    backgroundColor: "{colors.field-green}"
    textColor: "{colors.field-white}"
    rounded: "{rounded.field}"
    padding: "0 20px 4px"
    width: "400px"
  day-field-dark:
    backgroundColor: "{colors.aubergine-field}"
    textColor: "{colors.field-white}"
    rounded: "{rounded.field}"
    padding: "0 20px 4px"
    width: "400px"
  budget-bar:
    backgroundColor: "{colors.field-green-track}"
    rounded: "{rounded.bar}"
    height: "22px"
  budget-bar-slim:
    backgroundColor: "{colors.field-green-track}"
    rounded: "{rounded.bar-slim}"
    height: "8px"
  dock-log-dinner:
    backgroundColor: "{colors.plum}"
    textColor: "{colors.field-white}"
    typography: "{typography.action}"
    rounded: "{rounded.field}"
    height: "52px"
  meal-add-breakfast:
    backgroundColor: "{colors.squash}"
    textColor: "{colors.crate-ink}"
    rounded: "{rounded.full}"
    size: "40px"
  meal-tool:
    backgroundColor: "{colors.crate-white}"
    textColor: "{colors.crate-ink}"
    rounded: "{rounded.pill}"
    padding: "0 14px"
    height: "44px"
  button-save:
    backgroundColor: "{colors.tomato}"
    textColor: "{colors.field-white}"
    typography: "{typography.action}"
    rounded: "{rounded.sm}"
    padding: "14px"
  input:
    backgroundColor: "{colors.crate-white}"
    textColor: "{colors.crate-ink}"
    rounded: "{rounded.sm}"
    padding: "12px 14px"
  card:
    backgroundColor: "{colors.crate-white}"
    rounded: "{rounded.md}"
    padding: "13px 15px 15px"
  tab:
    backgroundColor: "{colors.crate-white}"
    textColor: "{colors.crate-muted}"
    height: "58px"
---

# Design System: Calorie Tracker

## Overview

**Creative North Star: "Market Day"**

The day stacks up like produce. Each meal owns a color, and a budget bar built from visible 100-kcal cells shows where the calories went. The language comes from greenmarket signage and fruit-crate labels: chunky type, plain words, flat color, and size that carries the ranking. The biggest thing on the screen is how many calories are left.

This is a single-owner tool used on phone and desktop several times a day, so it is quick to read and quick to leave. The Diary opens on a full-bleed field in forest green (light theme) or aubergine (dark theme, the default). That field holds the date, the kcal left, the bar, three macros and the eating window. Below it the meals run as open hairline rows on pale celery or deep aubergine, each with a round filled add button in its own color. A docked Log button in the next meal's color sits one thumb away.

Colors and fonts apply across the whole app. The field-and-rows layout belongs to the Diary only; Metrics and Profile keep their single 430px column of hairline-ringed cards, wearing the same palette and type.

**Key Characteristics:**
- One color per meal: squash, tomato, plum, leaf, with cornflower for exercise
- One field per screen, holding the day's answer; everything else sits open on the ground
- A budget bar of visible cells, with a hard end and striped overflow
- Chunky Bricolage Grotesque for big numerals and names; Barlow for food names, figures and labels
- Round filled add buttons and a docked Log button as the only loud controls
- Bar segments grow when food is logged, and the kcal numeral rolls to its new value

## Colors

Saturated produce colors against one deep field and one quiet ground, doubled across a light and a dark theme.

### Primary
- **Field Green** (#0E3B2E): The light theme's day field and readout strip, and the browser chrome color in that theme. Its track (#245A48) carries the empty bar and the eating-window divider.
- **Aubergine Field** (#2B1436): The same roles in the dark theme, with Aubergine Track (#46265A) behind the bar. It is also the PWA theme color.
- **Field White and its quiet partners** (#FFFFFF, with Field Celery #C4DCCD and Aubergine Mist #D5C3DE): Numbers and actions on the field are white. Captions and units use the quiet partner (8.59:1 and 10.10:1).

### Secondary
Meal colors. Each fill has a set ink that clears 4.5:1 on it, listed for light and then dark.
- **Squash** (#F2A71B / #F8B93D): Breakfast, with dark ink on both themes. On the field it also signals over-budget, because red would fight the green and aubergine.
- **Tomato** (#CE3A20 / #F4664E): Lunch, white ink in light and dark ink in dark. It is also the app accent outside the Diary's meals: save buttons, active segments, protein.
- **Plum** (#6E3189 / #B98BD1): Dinner, white ink in light and dark ink in dark. In light mode the bar uses Plum Bar (#A862CC), because plum itself nearly disappears against the green track (1.07:1).
- **Leaf** (#3FA65F / #5CC37B): Snacks, with dark ink on both themes.
- **Cornflower** (#2A6DB8 / #6BAAEB): Exercise, including the stretch it adds to the budget, shown at 45% opacity. It also marks carbs on Metrics.

### Tertiary
- **Over Red** (#C41E12 / #FF5C4D): Overflow stripes on the bar, over-goal chart bars and errors. Its text variant is #B01A0F / #FF7A6E.
- **Fat Ochre** (#8A5A00 / #E0B35A): Fat on the Metrics charts.
- **Window Green** (#2C8C4B / #5CC37B): The eating window on the Metrics charts.

### Neutral
- **Celery Ground** (#F3F6EC) and **Night Ground** (#150E1A): The page behind everything. Deep variants (#E8EDDF, #241A2C) fill search wells.
- **Crate White** (#FCFDF8) and **Night Card** (#1E1525): Sheets, cards, the tab bar and inputs.
- **Crate Ink** (#17231C) and **Night Ink** (#F4EDF6): Primary text (14.85:1 and 16.48:1 on the ground).
- **Crate Muted** (#55625A) and **Night Muted** (#AC9BB4): Secondary text and resting icons (5.85:1 and 7.30:1 on the ground).
- **Crate Hairline** (#DCE2D3) and **Night Hairline** (#30243A): Row dividers and card rings. Crate Track (#E1E6D7) carries chart tracks in light; Night Hairline does the same in dark.

### Named Rules
**The Meal Owns Its Color Rule.** A meal color marks its own swatch, add button, bar segment, docked Log button and food sheet. It is never decoration. The sanctioned second jobs are squash for over-budget on the field, tomato as the app accent, and cornflower for carbs.

**The Readable Variant Rule.** Colored text on the ground or a card uses a text variant (such as #7A5200 for squash or #1F6B3A for leaf), never the raw fill, so every text pairing stays at 4.5:1 or better. Filled buttons use the meal's set ink.

**The Two-Theme Rule.** Every color role exists in both themes. Dark is the default, and neither theme is an afterthought.

## Typography

**Display Font:** Bricolage Grotesque (with Barlow, system-ui, sans-serif)
**Body Font:** Barlow (with system-ui, sans-serif)

**Character:** Bricolage is the hand-painted sign: wide, chunky and loud at 800. Barlow is the printed crate label beside it: plain, sturdy and easy to scan at 15px.

### Hierarchy
- **Display** (800, clamp(60px, 19.5vw, 76px), 0.92): The kcal-left numeral, in lining proportional figures. One per screen.
- **Headline** (800, 21px, 1.1): Meal names.
- **Strip number** (800, 22px, 1): Kcal left in the slim readout that pins to the top when the field scrolls away.
- **Sheet title** (700, 18px): Bottom sheet headings.
- **Action** (800, 17px): The docked Log button. Save buttons use the same family at 700, 15px.
- **Section title** (800, 16px): Card headings on Metrics and Profile.
- **Figure** (700, 15px): Meal totals, eaten and budget, macro values. Barlow in tabular figures, so the kcal column lines up.
- **Body** (500, 15px): Food names. They truncate to one line with an ellipsis.
- **Label** (600, 13px): Macro names, units and captions.
- **Chart label** (11px): Numerals on chart axes, at the 11px floor.

### Named Rules
**The Size Carries Rank Rule.** Ranking comes from size and weight, not from boxes or color. Kcal left leads, meal names follow, food rows stay quiet.

**The Two Numeral Voices Rule.** A number standing alone as a headline is Bricolage with proportional figures. A number in a column is Barlow with tabular figures. Tabular is the app-wide default.

**The 11px Floor Rule.** No text renders below 11px, including SVG chart labels. Words stay in sentence case.

## Layout

**Phone.** The Diary runs edge to edge. The field fills the width with its lower corners rounded, then meals follow in a 20px gutter, 10px apart, with hairline-topped food rows indented 22px to clear the swatch. The first viewport holds the answer: date nav, kcal left, eaten and budget at right, the bar, three equal macro columns, and the eating-window row. The Log button docks 10px above the 58px tab bar, centered at up to 398px wide, over a tray that fades the list out behind it. Once the field scrolls away, a slim readout pins to the top with kcal left, P/C/F and a slim bar.

**Desktop (900px and up).** The Diary becomes two columns inside a 1040px container: a sticky 400px field on the left, a 40px gap, and the log on the right. The field rounds on all corners, the Log button goes static at the top of the log, and the readout strip is hidden because the field never leaves.

**Other screens.** Metrics and Profile stay in a centered 430px column with a 16px gutter at every width. The app is deliberately not two-column there.

Tall rows set the rhythm: 52px meal heads and 40px food rows. Everything respects the safe-area insets for the installed PWA.

## Elevation & Depth

Flat by default. Depth comes from color, with the dark field against a pale ground and filled buttons against open rows. Cards use a 1px ring rather than a shadow. Real shadows appear only on things that float over scrolling content.

### Shadow Vocabulary
- **Card ring** (`box-shadow: 0 0 0 1px #DCE2D3`, dark `#30243A`): Cards on Metrics and Profile.
- **Dock lift** (`box-shadow: 0 8px 20px rgba(0,0,0,.28)`): The docked Log button on phones. Removed on desktop, where it stops floating.
- **Toast lift** (`box-shadow: 0 8px 24px rgba(0,0,0,0.25)`; dark adds a hairline ring and raises the alpha to 0.5): The undo toast.
- **Sheet lift** (`box-shadow: 0 -12px 44px rgba(40,24,14,0.20)`): Bottom sheets.

### Named Rules
**The Only Floaters Cast Shadows Rule.** If it does not float over scrolling content, it does not get a soft shadow.

## Shapes

Soft, round and friendly, like painted signboards and crate corners. The field takes the largest structural curve (26px), matched by the pill-shaped Log button. Sheets top out at 30px. Controls and inputs sit at 10px, cards at 14px. Add buttons are full circles, and a meal's swatch is a small rounded square (12px, 4px radius) that echoes the bar's cells. The bar is 7px, or 3px when slim. Overflow is the one hard geometry: 135-degree red-and-white stripes behind a 3px end marker.

## Components

### Budget Bar (signature)
The day's budget as one object. Meal segments in meal order, 2px apart, sit over 100-kcal cell lines at 50% opacity. Exercise tints the stretch it added.
- **Hard end:** Eating past budget shrinks the scale so the budget lands inside the bar, marks it with a 3px line and stripes the excess.
- **Growth:** Segments grow over 700ms with a soft ease-out; off under reduced motion.
- **Slim form:** 8px tall with no cell lines, inside the readout strip.
- **Access:** It reads as a single image, labelled with each meal's kcal and the total.

### Day Field
The screen's one elevated answer. White numbers and celery or mist captions. The kcal numeral rolls to its new value over 600ms and jumps under reduced motion. When over budget, the numeral and caption turn squash and the copy says "over". Macros are three columns with 4px white bars that turn squash when over.

### Log Dock
A 52px pill in the next meal's color, reading "Log dinner" with a plus icon. It presses to 98% and brightens slightly on hover, and the toast region moves up to clear it.

### Buttons
- **Meal add:** A 44px hit area around a 40px filled circle in the meal's color, with an inline SVG plus. It presses to 92%.
- **Save:** Accent fill with accent ink, 10px radius, 14px padding. Inside a food sheet the accent becomes the meal's color. Disabled drops to 40% opacity.
- **Tool pill:** A 44px outlined pill on a card fill for meal notes and photos. Its border darkens on hover.
- **Text actions:** On the field, actions are bold underlined words such as "Stop eating" or "Today".
- **Focus:** A 2px outline in ink, or white on the field.

### Meal Rows
Open rows, never cards. The head is a swatch, the name, a quiet overflow control, the total and the add button. Food rows carry a hairline top, a truncating name, a tabular figure and a remove control. Estimates mute the name and prefix the figure with "≈".

### Cards / Containers
- **Corner Style:** Gently rounded (14px).
- **Background:** Crate White or Night Card.
- **Shadow Strategy:** The card ring only (see Elevation & Depth).
- **Border:** None beyond the ring.
- **Internal Padding:** 13px top, 15px sides, 15px bottom on metric cards.

Used on Metrics and Profile, not for Diary meals.

### Inputs / Fields
- **Style:** A 1.5px hairline border on a card fill, 10px radius, 12px by 14px padding, Barlow 600 at 16px so phones do not zoom on focus.
- **Focus:** The border shifts to the accent color.
- **Search:** A borderless well on the deep ground.

### Navigation
A fixed 58px tab bar on the card color with a hairline top: Diary, Metrics, Profile, each with an icon over a 12px bold label. Resting is muted; active is ink with a 28px, 2px bar along the top edge.

### Bottom Sheets
A full-width panel (430px maximum, centered) rising over 360ms, with 30px top corners, a small handle and a dimmed scrim. The panel stops scroll chaining at its edge.

## Do's and Don'ts

### Do:
- **Do** keep all text at 4.5:1 contrast or better, in both themes.
- **Do** keep all text at 11px or larger, including chart labels.
- **Do** give every touch target at least 44px, growing the hit area around a smaller visual if needed, as the 40px add circle does.
- **Do** give a new meal-related surface its meal's color through the set fill, ink and text-variant trio.
- **Do** use a dotted underline for a value that opens an editor (budget, eating-window times) and a solid underline for a word that acts now (Today, Stop eating).
- **Do** say over-budget in words as well as color and stripes.
- **Do** honor reduced motion: bar growth, number rolls, swipe nudges, toasts and the strip all switch off.
- **Do** keep logging one tap from the first view.

### Don't:
- **Don't** put a ring chart or summary cards on the Diary; the bar and open rows are the answer.
- **Don't** wrap Diary meals in cards or add a second field.
- **Don't** use a raw meal fill as text on the ground or a card.
- **Don't** let the budget bar imply room past the budget; it always has a hard end.
- **Don't** carry the Diary's layout to Metrics or Profile without the owner asking; only colors and fonts are app-wide.
- **Don't** add multi-user affordances; the product has exactly one owner.
