# Hue picker as one iOS Shortcut (menu)

One shortcut that shows a menu of every preset from `ios-shortcut.md` and sends the chosen one to the bridge. Build this if you want all presets in a single Home Screen or Action Button entry instead of one shortcut per color.

## Before you start
- Bridge IP, application key, and light number (see `ios-shortcut.md`).
- Run the shortcut on the same Wi-Fi as the bridge.

## Build it

### 1. Store the bridge settings
1. **Text**: `[bridge IP]`. Then **Set Variable**, name `BridgeIP`.
2. **Text**: `[app key]`. Then **Set Variable**, name `AppKey`.
3. **Text**: `[light number]`. Then **Set Variable**, name `LightID`.

Keeping these in variables means you only edit them in one place.

### 2. Add the menu
1. **Choose from Menu**. Prompt: `Hue preset`.
2. Add one menu item per preset, in this order: Red, Orange, Amber, Yellow, Green, Teal, Sky, Blue, Violet, Pink, Warm white, Cool white, Off, Dim to 50%.

### 3. Inside each menu item
Under each item, add a **Get Contents of URL** action with these settings:
- **URL**: a **Text** action containing `http://[BridgeIP]/api/[AppKey]/lights/[LightID]/state`, with `BridgeIP`, `AppKey`, and `LightID` inserted as variables (tap the Variables chip, not typed text).
- **Method**: **PUT**
- **Request Body**: **JSON**, then add the fields from the table below.

| Menu item | Fields to add (type) |
|---|---|
| Red | `on` Boolean true; `hue` Number 0; `sat` Number 254; `bri` Number 254 |
| Orange | `on` true; `hue` 4551; `sat` 254; `bri` 254 |
| Amber | `on` true; `hue` 9102; `sat` 229; `bri` 254 |
| Yellow | `on` true; `hue` 10923; `sat` 229; `bri` 254 |
| Green | `on` true; `hue` 21845; `sat` 254; `bri` 254 |
| Teal | `on` true; `hue` 30947; `sat` 254; `bri` 254 |
| Sky | `on` true; `hue` 38229; `sat` 254; `bri` 254 |
| Blue | `on` true; `hue` 43690; `sat` 254; `bri` 254 |
| Violet | `on` true; `hue` 50061; `sat` 229; `bri` 254 |
| Pink | `on` true; `hue` 58253; `sat` 229; `bri` 254 |
| Warm white | `on` true; `ct` Number 370; `bri` 254 |
| Cool white | `on` true; `ct` Number 250; `bri` 254 |
| Off | `on` Boolean false |
| Dim to 50% | `on` true; `bri` Number 127 |

### 4. Name and place it
1. Tap the shortcut name at the top and rename it to "Hue Picker".
2. Add it to the Home Screen, or assign it to the Action Button.

## Optional: ask for brightness
Add **Ask for Input** (Number, default 254) before the menu. In each color item, replace `bri` with the **Provided Input** variable. Keep the value between 1 and 254.

## Notes
- This recipe is untested on an iPhone. Check the first run with **Show Result** after each **Get Contents of URL** if something looks off.
- Each menu item has its own **Get Contents of URL** step. This keeps every body fixed and easy to check, at the cost of more steps to build.
- Hue API ranges: `hue` 0–65535, `sat` 0–254, `bri` 1–254, `ct` roughly 153–500.
- If a call fails, check the bridge IP, app key, and that the phone is on the same Wi-Fi as the bridge.
