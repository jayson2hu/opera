"""Validate pinned dependencies against the manifest and installed metadata offline.

Run with Python 3.12 after installing requirements-dev.lock. This checks the
active platform, including transitive dependencies selected by declared extras.
"""

from importlib.metadata import distribution
from pathlib import Path
import re
import sys
import tomllib

from packaging.requirements import Requirement
from packaging.specifiers import SpecifierSet
from packaging.utils import canonicalize_name


ROOT = Path(__file__).resolve().parents[1]


def read_lock(path: Path) -> dict[str, str]:
    result = {}
    for entry in path.read_text().replace("\\\n", " ").splitlines():
        entry = entry.strip()
        if not entry or entry.startswith("#"):
            continue
        declaration, *hashes = entry.split("--hash=")
        requirement = Requirement(declaration.strip())
        pins = list(requirement.specifier)
        if len(pins) != 1 or pins[0].operator != "==" or "*" in pins[0].version:
            raise ValueError(f"{path.name}: {requirement.name} must have an exact version")
        if not hashes or any(not re.fullmatch(r"sha256:[0-9a-f]{64}", value.strip()) for value in hashes):
            raise ValueError(f"{path.name}: {requirement.name} needs valid SHA-256 hashes")
        if requirement.marker and not requirement.marker.evaluate():
            continue
        name = canonicalize_name(requirement.name)
        if name in result:
            raise ValueError(f"{path.name}: duplicate active requirement: {name}")
        result[name] = pins[0].version
    return result


def check_closure(declarations: list[str], locked: dict[str, str]) -> None:
    pending = [(Requirement(value), "") for value in declarations]
    visited = set()
    required = set()
    while pending:
        requirement, parent_extra = pending.pop()
        if requirement.marker and not requirement.marker.evaluate({"extra": parent_extra}):
            continue
        name = canonicalize_name(requirement.name)
        if name not in locked or locked[name] not in requirement.specifier:
            raise ValueError(f"Lock does not satisfy {requirement}")
        required.add(name)
        for extra in requirement.extras | {""}:
            if (name, extra) in visited:
                continue
            visited.add((name, extra))
            installed = distribution(name)
            if installed.version != locked[name]:
                raise ValueError(f"Installed {name} differs from the lock; reinstall requirements-dev.lock")
            pending.extend((Requirement(value), extra) for value in installed.requires or [])
    unexpected = locked.keys() - required
    if unexpected:
        raise ValueError(f"Lock contains dependencies not required by the manifest: {sorted(unexpected)}")


def main() -> None:
    project = tomllib.loads((ROOT / "pyproject.toml").read_text())["project"]
    if ".".join(map(str, sys.version_info[:3])) not in SpecifierSet(project["requires-python"]):
        raise ValueError("Python does not meet the project requirement")
    runtime = read_lock(ROOT / "requirements.lock")
    development = read_lock(ROOT / "requirements-dev.lock")
    if any(development.get(name) != version for name, version in runtime.items()):
        raise ValueError("Runtime and development locks resolve different runtime versions")
    check_closure(project["dependencies"], runtime)
    check_closure(project["dependencies"] + project["optional-dependencies"]["dev"], development)
    print(f"Dependency locks match pyproject.toml: {len(runtime)} runtime, {len(development)} development packages")


if __name__ == "__main__":
    main()
