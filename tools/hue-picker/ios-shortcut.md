# Hue presets as an iOS Shortcut

Build this in the Shortcuts app on iPhone. It calls the Hue bridge directly over your home Wi-Fi.

## Before you start
- Bridge IP (for example `192.168.1.50`)
- Application key (the username from the bridge link-button step)
- Light number (the bridge's ID for the light, for example `1`)
- Run the shortcut on the same Wi-Fi as the bridge.

## Build it (one preset)
1. Shortcuts > **+** > **Add Action**.
2. **Text**: `http://[bridge IP]/api/[app key]/lights/[light number]/state`
3. **Get Contents of URL**:
   - URL: the Text variable from step 2
   - Method: **PUT**
   - Request Body: **JSON**
   - Add a field for each key below, using the type shown.
4. **Show Result** (optional, for checking).
5. Name it, for example "Hue Red", and add it to the Home Screen or Action Button.

Repeat the Get Contents of URL step for each extra light number.

## Request bodies

Colors (full brightness, `bri` 254):

| Preset | JSON body |
|---|---|
| Red | `{"on":true,"hue":0,"sat":254,"bri":254}` |
| Orange | `{"on":true,"hue":4551,"sat":254,"bri":254}` |
| Amber | `{"on":true,"hue":9102,"sat":229,"bri":254}` |
| Yellow | `{"on":true,"hue":10923,"sat":229,"bri":254}` |
| Green | `{"on":true,"hue":21845,"sat":254,"bri":254}` |
| Teal | `{"on":true,"hue":30947,"sat":254,"bri":254}` |
| Sky | `{"on":true,"hue":38229,"sat":254,"bri":254}` |
| Blue | `{"on":true,"hue":43690,"sat":254,"bri":254}` |
| Violet | `{"on":true,"hue":50061,"sat":229,"bri":254}` |
| Pink | `{"on":true,"hue":58253,"sat":229,"bri":254}` |

Whites (color temperature):

| Preset | JSON body |
|---|---|
| Warm white | `{"on":true,"ct":370,"bri":254}` |
| Cool white | `{"on":true,"ct":250,"bri":254}` |

Other:

| Action | JSON body |
|---|---|
| Off | `{"on":false}` |
| Dim to 50% | `{"on":true,"bri":127}` |

## Adding a brightness prompt (optional)
1. Before the Get Contents of URL step, add **Ask for Input**, type Number, default `254`.
2. In the JSON body, set `bri` to the **Provided Input** variable instead of a fixed number.
3. Keep the value between 1 and 254.

## Notes
- Hue values are in the Hue API ranges: hue 0–65535, sat 0–254, bri 1–254.
- If a call fails, check that the bridge IP and app key are correct, and that the phone is on the same network.
- Shortcuts runs outside the browser, so the page's CORS limits don't apply. This recipe is untested on an iPhone.
