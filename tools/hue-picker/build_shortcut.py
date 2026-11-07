"""Build an UNSIGNED Hue Picker .shortcut file (binary plist).

Untested on iOS. Sign it on a Mac with:
  shortcuts sign -m anyone -i "Hue Picker.unsigned.shortcut" -o "Hue Picker.shortcut"
After importing, replace the [bridge IP], [app key] and [light number]
placeholders in each URL text action.
"""
import plistlib
import sys
import uuid

BASE = "http://[bridge IP]/api/[app key]/lights/[light number]/state"

# (title, JSON body as ordered (key, type, value) tuples)
# Types: "num" -> Number, "bool" -> Boolean
PRESETS = [
    ("Red",        [("on", "bool", True), ("hue", "num", 0),     ("sat", "num", 254), ("bri", "num", 254)]),
    ("Orange",     [("on", "bool", True), ("hue", "num", 4551),  ("sat", "num", 254), ("bri", "num", 254)]),
    ("Amber",      [("on", "bool", True), ("hue", "num", 9102),  ("sat", "num", 229), ("bri", "num", 254)]),
    ("Yellow",     [("on", "bool", True), ("hue", "num", 10923), ("sat", "num", 229), ("bri", "num", 254)]),
    ("Green",      [("on", "bool", True), ("hue", "num", 21845), ("sat", "num", 254), ("bri", "num", 254)]),
    ("Teal",       [("on", "bool", True), ("hue", "num", 30947), ("sat", "num", 254), ("bri", "num", 254)]),
    ("Sky",        [("on", "bool", True), ("hue", "num", 38229), ("sat", "num", 254), ("bri", "num", 254)]),
    ("Blue",       [("on", "bool", True), ("hue", "num", 43690), ("sat", "num", 254), ("bri", "num", 254)]),
    ("Violet",     [("on", "bool", True), ("hue", "num", 50061), ("sat", "num", 229), ("bri", "num", 254)]),
    ("Pink",       [("on", "bool", True), ("hue", "num", 58253), ("sat", "num", 229), ("bri", "num", 254)]),
    ("Warm white", [("on", "bool", True), ("ct", "num", 370),    ("bri", "num", 254)]),
    ("Cool white", [("on", "bool", True), ("ct", "num", 250),    ("bri", "num", 254)]),
    ("Off",        [("on", "bool", False)]),
    ("Dim to 50%", [("on", "bool", True), ("bri", "num", 127)]),
]

GTEXT = "is.workflow.actions.gettext"
DOWNLOAD = "is.workflow.actions.downloadurl"
MENU = "is.workflow.actions.choosefrommenu"


def text_action(s):
    return {
        "WFWorkflowActionIdentifier": GTEXT,
        "WFWorkflowActionParameters": {"WFTextActionText": s, "UUID": str(uuid.uuid4())},
    }


def body_field(key, typ, value):
    if typ == "bool":
        item_type = 4  # Boolean (best recollection; verify on device)
        val = {"Value": {"string": "true" if value else "false", "attachmentsByRange": {}},
               "WFSerializationType": "WFTextTokenString"}
    else:
        item_type = 3  # Number (best recollection; verify on device)
        val = {"Value": {"string": str(value), "attachmentsByRange": {}},
               "WFSerializationType": "WFTextTokenString"}
    return {
        "WFItemType": item_type,
        "WFKey": {"Value": {"string": key, "attachmentsByRange": {}},
                  "WFSerializationType": "WFTextTokenString"},
        "WFValue": val,
    }


def request_action(fields):
    return {
        "WFWorkflowActionIdentifier": DOWNLOAD,
        "WFWorkflowActionParameters": {
            "WFHTTPMethod": "PUT",
            "WFHTTPBodyType": "JSON",
            "WFJSONValues": {
                "Value": {"WFDictionaryFieldValueItems": fields},
                "WFSerializationType": "WFDictionaryFieldValue",
            },
            "ShowHeaders": False,
        },
    }


def build():
    actions = []
    group = str(uuid.uuid4()).upper()
    titles = [t for t, _ in PRESETS]
    actions.append({
        "WFWorkflowActionIdentifier": MENU,
        "WFWorkflowActionParameters": {
            "WFControlFlowMode": 0,
            "GroupingIdentifier": group,
            "WFMenuPrompt": "Hue preset",
            "WFMenuItems": titles,
        },
    })
    for title, fields in PRESETS:
        actions.append({
            "WFWorkflowActionIdentifier": MENU,
            "WFWorkflowActionParameters": {
                "WFControlFlowMode": 1,
                "GroupingIdentifier": group,
                "WFMenuItemTitle": title,
            },
        })
        actions.append(text_action(BASE))
        actions.append(request_action([body_field(*f) for f in fields]))
    actions.append({
        "WFWorkflowActionIdentifier": MENU,
        "WFWorkflowActionParameters": {"WFControlFlowMode": 2, "GroupingIdentifier": group},
    })
    return {
        "WFWorkflowActions": actions,
        "WFWorkflowClientVersion": "2038.0.2.4",
        "WFWorkflowMinimumClientVersion": 900,
        "WFWorkflowMinimumClientVersionString": "900",
        "WFWorkflowIcon": {"WFWorkflowIconStartColor": 4282601983,
                           "WFWorkflowIconGlyphNumber": 59511},
        "WFWorkflowImportQuestions": [],
        "WFWorkflowInputContentItemClasses": ["WFAppStoreAppContentItem"],
        "WFWorkflowOutputContentItemClasses": [],
        "WFWorkflowTypes": ["WatchKit", "NCWidget"],
        "WFQuickActionSurfaces": [],
        "WFWorkflowHasShortcutInputVariables": False,
        "WFWorkflowName": "Hue Picker",
    }


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "Hue Picker.unsigned.shortcut"
    with open(out, "wb") as f:
        plistlib.dump(build(), f, fmt=plistlib.FMT_BINARY)
    print("wrote", out)
