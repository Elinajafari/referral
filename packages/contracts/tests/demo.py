"""The demo's data, loaded from demo/demo.json.

scripts/seed.mjs sends exactly these strings and these steps to StudioNet, and
tests/test_runbook.py replays them offline, so the demo on the explorer and the
demo the tests check cannot drift apart.

One program, three referrals, each a different route:

  ANN  refers Dana, a paid signup within three days: qualifying, paid at once
  BEN  refers Eli, a free trial only: not_qualifying, nothing paid
  CAL  tries to refer Dana again, already claimed by Ann: refused for free
  CAL  refers Fay, a paid signup within a week: qualifying, paid at once
  the third of three paid slots is never filled, so settle() returns it
"""

import json
import pathlib

_DATA = json.loads((pathlib.Path(__file__).absolute().parent.parent / "demo" / "demo.json").read_text(encoding="utf-8"))

PROGRAM = {**_DATA["program"], "bonus": int(_DATA["program"]["bonus"])}
REFERRED = _DATA["referred"]
EVIDENCE = _DATA["evidence"]
STEPS = _DATA["steps"]

# the verdict each judged referral is expected to come back with, in order
EXPECTED_VERDICTS = _DATA["expected_verdicts"]
