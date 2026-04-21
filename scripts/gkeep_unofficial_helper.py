#!/usr/bin/env python3
# pyright: reportMissingImports=false
import json
import os
import sys
from pathlib import Path

import gkeepapi
from dotenv import load_dotenv


def load_env() -> None:
    repo_root = Path(__file__).resolve().parent.parent
    load_dotenv(repo_root / ".env")


def fail(message: str) -> None:
    print(json.dumps({"ok": False, "error": message}))
    sys.exit(1)


def normalize_note_id(note_id: str) -> str:
    value = (note_id or "").strip()
    if not value:
        raise ValueError("noteId is required")
    return value.removeprefix("notes/")


def safe_media_link(keep, blob):
    try:
        return keep.getMediaLink(blob)
    except Exception:  # noqa: BLE001
        return None


def serialize_label(label):
    return {
        "id": label.id,
        "name": label.name,
    }


def serialize_list_item(item):
    return {
        "id": item.id,
        "text": item.text,
        "checked": item.checked,
        "parentItemId": item.parent_item.id if item.parent_item else None,
    }


def serialize_media_blob(keep, blob):
    blob_type = None
    if blob.blob and getattr(blob.blob, "type", None):
        blob_type = blob.blob.type.value

    return {
        "blobId": blob.id,
        "type": blob_type,
        "mediaLink": safe_media_link(keep, blob),
    }


def serialize_note(keep, note):
    payload = {
        "id": note.id,
        "title": note.title,
        "text": note.text,
        "type": note.type.value,
        "pinned": note.pinned,
        "archived": note.archived,
        "trashed": note.trashed,
        "color": note.color.value if note.color else None,
        "labels": [serialize_label(label) for label in note.labels.all()],
        "collaborators": list(note.collaborators.all()),
        "media": [serialize_media_blob(keep, blob) for blob in note.blobs],
        "url": note.url,
        "created": note.timestamps.created.isoformat() if note.timestamps.created else None,
        "updated": note.timestamps.updated.isoformat() if note.timestamps.updated else None,
        "edited": note.timestamps.edited.isoformat() if note.timestamps.edited else None,
    }

    if hasattr(note, "items"):
        payload["items"] = [serialize_list_item(item) for item in note.items]

    return payload


def get_client():
    load_env()
    email = os.getenv("GOOGLE_EMAIL")
    master_token = os.getenv("GOOGLE_MASTER_TOKEN")
    if not email or not master_token:
        raise ValueError(
            "Missing GOOGLE_EMAIL or GOOGLE_MASTER_TOKEN. Add them to your environment or .env for unofficial Keep tools.",
        )

    keep = gkeepapi.Keep()
    keep.authenticate(email, master_token)
    return keep


def get_note_or_raise(keep, note_id: str):
    normalized = normalize_note_id(note_id)
    note = keep.get(normalized)
    if not note:
        raise ValueError(f"Note with ID {normalized} not found")
    return note


def get_label_or_raise(keep, label_id: str):
    label = keep.getLabel((label_id or "").strip())
    if not label:
        raise ValueError(f"Label with ID {label_id} not found")
    return label


def normalize_query(value: str) -> str:
    query = (value or "").strip().lower()
    if not query:
        raise ValueError("query is required")
    return query


def note_plain_text(note) -> str:
    parts = [note.title or "", note.text or ""]
    if hasattr(note, "items"):
        parts.extend((item.text or "") for item in note.items)
    return "\n".join(part for part in parts if part).lower()


def action_get_note(keep, args):
    note = get_note_or_raise(keep, args["noteId"])
    return serialize_note(keep, note)


def action_search_notes(keep, args):
    query = normalize_query(args.get("query", ""))
    limit = max(1, int(args.get("limit", 10)))
    include_trashed = bool(args.get("includeTrashed", False))
    matches = []

    for note in keep.all():
      if note.trashed and not include_trashed:
          continue

      haystack = note_plain_text(note)
      if query in haystack:
          matches.append(serialize_note(keep, note))
          if len(matches) >= limit:
              break

    return {
        "query": args.get("query", ""),
        "includeTrashed": include_trashed,
        "returned": len(matches),
        "limit": limit,
        "matches": matches,
    }


def action_update_note(keep, args):
    note = get_note_or_raise(keep, args["noteId"])
    if "title" in args and args["title"] is not None:
        note.title = args["title"]
    if "text" in args and args["text"] is not None:
        note.text = args["text"]
    keep.sync()
    return serialize_note(keep, note)


def action_pin_note(keep, args):
    note = get_note_or_raise(keep, args["noteId"])
    note.pinned = bool(args.get("pinned", True))
    keep.sync()
    return serialize_note(keep, note)


def action_archive_note(keep, args):
    note = get_note_or_raise(keep, args["noteId"])
    note.archived = bool(args.get("archived", True))
    keep.sync()
    return serialize_note(keep, note)


def action_list_labels(keep, args):
    labels = [serialize_label(label) for label in keep.labels()]
    if not args.get("includeStats"):
        return labels

    counts = {label["id"]: 0 for label in labels}
    for note in keep.all():
        for label in note.labels.all():
            if label.id in counts:
                counts[label.id] += 1

    return [
        {
            **label,
            "noteCount": counts.get(label["id"], 0),
        }
        for label in labels
    ]


def action_create_label(keep, args):
    name = (args["name"] or "").strip()
    if not name:
        raise ValueError("name is required")
    existing = keep.findLabel(name)
    label = existing or keep.createLabel(name)
    keep.sync()
    return serialize_label(label)


def action_rename_label(keep, args):
    label = get_label_or_raise(keep, args["labelId"])
    new_name = (args["newName"] or "").strip()
    if not new_name:
        raise ValueError("newName is required")
    label.name = new_name
    keep.sync()
    return serialize_label(label)


def action_delete_label(keep, args):
    label = get_label_or_raise(keep, args["labelId"])
    keep.deleteLabel(label.id)
    keep.sync()
    return {"deleted": True, "label": serialize_label(label)}


def action_add_label_to_note(keep, args):
    note = get_note_or_raise(keep, args["noteId"])
    label = get_label_or_raise(keep, args["labelId"])
    note.labels.add(label)
    keep.sync()
    return serialize_note(keep, note)


def action_remove_label_from_note(keep, args):
    note = get_note_or_raise(keep, args["noteId"])
    label = get_label_or_raise(keep, args["labelId"])
    note.labels.remove(label)
    keep.sync()
    return serialize_note(keep, note)


def action_add_list_item(keep, args):
    note = get_note_or_raise(keep, args["noteId"])
    if not isinstance(note, gkeepapi.node.List):
        raise ValueError(f"Note with ID {note.id} is not a list")
    item = note.add(text=args["text"], checked=bool(args.get("checked", False)))
    keep.sync()
    return {"note": serialize_note(keep, note), "itemId": item.id}


def action_update_list_item(keep, args):
    note = get_note_or_raise(keep, args["noteId"])
    if not isinstance(note, gkeepapi.node.List):
        raise ValueError(f"Note with ID {note.id} is not a list")
    item = note.get((args["itemId"] or "").strip())
    if not item:
        raise ValueError(f"List item with ID {args['itemId']} not found")
    if "text" in args and args["text"] is not None:
        item.text = args["text"]
    if "checked" in args and args["checked"] is not None:
        item.checked = bool(args["checked"])
    keep.sync()
    return serialize_note(keep, note)


def action_delete_list_item(keep, args):
    note = get_note_or_raise(keep, args["noteId"])
    if not isinstance(note, gkeepapi.node.List):
        raise ValueError(f"Note with ID {note.id} is not a list")
    item = note.get((args["itemId"] or "").strip())
    if not item:
        raise ValueError(f"List item with ID {args['itemId']} not found")
    item.delete()
    keep.sync()
    return {"deleted": True, "note": serialize_note(keep, note), "itemId": item.id}


ACTIONS = {
    "get_note": action_get_note,
    "search_notes": action_search_notes,
    "update_note": action_update_note,
    "pin_note": action_pin_note,
    "archive_note": action_archive_note,
    "list_labels": action_list_labels,
    "create_label": action_create_label,
    "rename_label": action_rename_label,
    "delete_label": action_delete_label,
    "add_label_to_note": action_add_label_to_note,
    "remove_label_from_note": action_remove_label_from_note,
    "add_list_item": action_add_list_item,
    "update_list_item": action_update_list_item,
    "delete_list_item": action_delete_list_item,
}


def main() -> None:
    try:
        request = json.load(sys.stdin)
        action = request.get("action")
        args = request.get("args", {})
        if action not in ACTIONS:
            raise ValueError(f"Unsupported action: {action}")
        keep = get_client()
        result = ACTIONS[action](keep, args)
        print(json.dumps({"ok": True, "result": result}))
    except Exception as exc:  # noqa: BLE001
        fail(str(exc))


if __name__ == "__main__":
    main()