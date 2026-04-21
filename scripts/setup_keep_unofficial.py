#!/usr/bin/env python3
# pyright: reportMissingImports=false
import argparse
import getpass
import os
import sys
from pathlib import Path
from uuid import getnode as get_mac

import gpsoauth
from dotenv import load_dotenv


REPO_ROOT = Path(__file__).resolve().parent.parent
ENV_PATH = REPO_ROOT / ".env"


def load_env() -> None:
    load_dotenv(ENV_PATH)


def default_android_id() -> str:
    return f"{get_mac():x}"


def prompt_value(label: str, default: str | None = None, secret: bool = False) -> str:
    prompt = f"{label}"
    if default:
        prompt += f" [{default}]"
    prompt += ": "

    if secret:
        value = getpass.getpass(prompt)
    else:
        value = input(prompt)

    value = value.strip()
    if value:
        return value
    if default is not None:
        return default
    raise ValueError(f"{label} is required")


def read_env_lines() -> list[str]:
    if not ENV_PATH.exists():
        return []
    return ENV_PATH.read_text().splitlines()


def upsert_env_values(values: dict[str, str]) -> None:
    lines = read_env_lines()
    found = {key: False for key in values}
    updated: list[str] = []

    for line in lines:
        replaced = False
        for key, value in values.items():
            if line.startswith(f"{key}="):
                updated.append(f"{key}={value}")
                found[key] = True
                replaced = True
                break
        if not replaced:
            updated.append(line)

    if updated and updated[-1] != "":
        updated.append("")

    if values and not any(line.startswith("# Unofficial Google Keep backend") for line in updated):
        updated.append("# Unofficial Google Keep backend")

    for key, value in values.items():
        if not found[key]:
            updated.append(f"{key}={value}")

    ENV_PATH.write_text("\n".join(updated).rstrip() + "\n")


def redact(value: str) -> str:
    if len(value) <= 8:
        return "*" * len(value)
    return f"{value[:4]}...{value[-4:]}"


def perform_password_flow(email: str, android_id: str) -> str:
    password = prompt_value("Google account password or app password", secret=True)
    response = gpsoauth.perform_master_login(email, password, android_id)
    token = response.get("Token")
    if not token:
        raise RuntimeError(f"Google did not return a master token: {response}")
    return token


def perform_oauth_exchange_flow(email: str, android_id: str) -> str:
    print("Open https://accounts.google.com/EmbeddedSetup in a browser you control.")
    print("Sign in, accept the prompt, then extract the oauth_token cookie value.")
    oauth_token = prompt_value("oauth_token cookie value", secret=True)
    response = gpsoauth.exchange_token(email, oauth_token, android_id)
    token = response.get("Token")
    if not token:
        raise RuntimeError(f"Google did not return a master token: {response}")
    return token


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Interactive setup for unofficial Google Keep credentials",
    )
    parser.add_argument(
        "--method",
        choices=["password", "oauth-token"],
        help="Token acquisition method. If omitted, choose interactively.",
    )
    parser.add_argument(
        "--write-env",
        action="store_true",
        help="Write GOOGLE_EMAIL and GOOGLE_MASTER_TOKEN into .env",
    )
    parser.add_argument(
        "--android-id",
        help="Override Android device ID used for gpsoauth",
    )
    parser.add_argument(
        "--show-token",
        action="store_true",
        help="Print the full GOOGLE_MASTER_TOKEN to stdout. Avoid this on shared or logged terminals.",
    )
    args = parser.parse_args()

    load_env()
    email = prompt_value("Google account email", os.getenv("GOOGLE_EMAIL"))
    android_id = args.android_id or default_android_id()

    method = args.method
    if not method:
        choice = prompt_value(
            "Method (password or oauth-token)",
            default="oauth-token",
        ).lower()
        if choice not in {"password", "oauth-token"}:
            raise ValueError("Method must be 'password' or 'oauth-token'")
        method = choice

    if method == "password":
        token = perform_password_flow(email, android_id)
    else:
        token = perform_oauth_exchange_flow(email, android_id)

    print("")
    print("Unofficial Keep credentials acquired.")
    print(f"GOOGLE_EMAIL={email}")
    print(f"Master token preview: {redact(token)}")

    if args.show_token:
        print(f"GOOGLE_MASTER_TOKEN={token}")
    else:
        print("Full master token hidden. Use --show-token only if you need to copy it manually.")

    if args.write_env:
        upsert_env_values(
            {
                "GOOGLE_EMAIL": email,
                "GOOGLE_MASTER_TOKEN": token,
            },
        )
        print(f"Wrote unofficial Keep credentials to {ENV_PATH}")
    else:
        print("Use --write-env to persist the credentials into .env")

    print("Next: npm run smoke:keep-unofficial")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print("\nCancelled.", file=sys.stderr)
        raise SystemExit(130)
    except Exception as exc:  # noqa: BLE001
        print(f"Setup failed: {exc}", file=sys.stderr)
        raise SystemExit(1)