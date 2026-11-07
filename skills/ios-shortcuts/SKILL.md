---
name: ios-shortcuts
description: Use this skill when building, debugging, or documenting iOS Shortcuts (Apple Shortcuts app), especially shortcuts that call HTTP APIs such as a Philips Hue bridge, a home server, or a webhook. Covers action selection, JSON request bodies, variables, input prompts, and common failure modes.
---

# iOS Shortcuts

This skill helps write step-by-step iOS Shortcut recipes and troubleshoot them. Shortcuts cannot be imported from plain text in this repo, so the deliverable is a recipe a person follows in the Shortcuts app on an iPhone.

## When to Activate

- Writing a new Shortcut recipe in `tools/` or `docs/`
- Turning an HTTP API into a Shortcut (PUT/POST/GET with a JSON body)
- Adding a prompt, menu, or variable to an existing Shortcut
- Debugging a Shortcut that fails with a network or JSON error

## Recipe Format

Follow the layout of `tools/hue-picker/ios-shortcut.md`:

1. **Before you start**: list every value the user must supply (IP, key, IDs) and the network requirement.
2. **Build it**: numbered steps, naming each action exactly as it appears in the Shortcuts app.
3. **Reference tables**: one preset per row, with the exact body to paste.
4. **Optional steps**: prompts and variables, marked as optional.
5. **Notes**: failure checks and an explicit "untested" note if it has not run on a device.

## Actions Commonly Used

| Goal | Action | Notes |
|---|---|---|
| Fixed string or URL | **Text** | Put variables inline with the Variables chip, not typed text. |
| HTTP call | **Get Contents of URL** | Set URL, Method (GET/PUT/POST), and Request Body (JSON or Form). |
| Ask the user | **Ask for Input** | Type Number, Text, or URL; set a default value. |
| Choose from a list | **Choose from Menu** | Each menu item can hold its own action list. |
| Pick a value | **Get Dictionary Value** | Use for reading fields from a JSON response. |
| Show output | **Show Result** or **Show Notification** | Use while debugging. |
| Branch | **If** | Compare a variable to a value. |
| Reuse a value | **Set Variable** / **Get Variable** | Name variables for their purpose, such as `BridgeIP`. |

## JSON Request Bodies

- In **Get Contents of URL**, choose Request Body **JSON**, then add one field per key. Pick the field type: Text, Number, Boolean, or Dictionary.
- Use a Number field for numeric values such as `hue` or `bri`. A Text field sends `"254"` with quotes, and many APIs reject that.
- Use a Boolean field for `on`. Do not type `true` as text.
- When a value comes from **Ask for Input**, put the Provided Input variable into the field, then check the range the API expects.

## Hue Bridge Specifics

These come from the repo's Hue recipe:

- Base URL: `http://[bridge IP]/api/[app key]/lights/[light number]/state`
- Method: **PUT**
- Color: `hue` 0–65535, `sat` 0–254, `bri` 1–254
- Color temperature: `ct` (mirek) in roughly 153–500
- Shortcut must run on the same Wi-Fi as the bridge (local network calls fail over cellular).

## Debugging Checklist

1. Add **Show Result** after **Get Contents of URL** to see the raw response.
2. Hue returns an array; a `[{"error": ...}]` element means a bad key, bad ID, or unreachable light.
3. "Could not connect": confirm the phone is on the bridge's Wi-Fi and the IP has not changed (use a DHCP reservation).
4. "Unsupported URL": the Text action probably has a stray space or an unfilled variable.
5. Local-network permission: on first run, iOS may ask to allow Shortcuts to reach local devices. Allow it in Settings if it was declined.

## Writing Guidance

- Use the exact action names shown in the app; if unsure, say the name may differ slightly by iOS version.
- Do not claim a recipe works on a device unless it was tested there. Mark it "untested" otherwise.
- Never put real bridge app keys, passwords, or tokens in committed files. Use placeholders like `[app key]`.
- Keep one shortcut to one job. Split long flows into several shortcuts and call them with **Run Shortcut**.
