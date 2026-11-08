"""
The shared vectors are the contract's own answers.

packages/shared/referral-vectors.json is what the TypeScript port in
packages/shared is tested against. If the vectors were hand-written, the port
could agree with them and disagree with the contract. So this test recomputes
every vector from the contract's functions and fails if any has drifted:
regenerate with `UPDATE_VECTORS=1 python -m pytest tests/test_vectors.py`.
"""

import json
import os
import pathlib

import glsim as S

M = S.load_contract("referral.py")
VECTORS = pathlib.Path(__file__).absolute().parent.parent.parent / "shared" / "referral-vectors.json"


def recompute(v):
    return {
        "clean_text": [{"raw": x["raw"], "clean": M.clean_text(x["raw"])} for x in v["clean_text"]],
        "referred_key": [{"raw": x["raw"], "key": M.referred_key(x["raw"])} for x in v["referred_key"]],
        "normalise_choice": [{"raw": x["raw"], "n": x["n"], "choice": M.normalise_choice(x["raw"], x["n"])}
                             for x in v["normalise_choice"]],
        "option_of": [{"choice": x["choice"], "order": x["order"], "option": M.option_of(x["choice"], x["order"])}
                      for x in v["option_of"]],
        "fold": [{"forward": x["forward"], "reverse": x["reverse"], "folded": M.fold(x["forward"], x["reverse"])}
                 for x in v["fold"]],
        "verdict_sound": [{"verdict": x["verdict"], "sound": M.verdict_sound(x["verdict"])} for x in v["verdict_sound"]],
    }


def test_every_shared_vector_is_what_the_contract_computes():
    stored = json.loads(VECTORS.read_text(encoding="utf-8"))
    fresh = recompute(stored)
    if os.environ.get("UPDATE_VECTORS"):
        VECTORS.write_text(json.dumps(fresh, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    assert stored == fresh, "referral-vectors.json has drifted from the contract; UPDATE_VECTORS=1"


def test_the_vectors_cover_every_outcome():
    v = json.loads(VECTORS.read_text(encoding="utf-8"))
    assert {x["choice"] for x in v["normalise_choice"]} == {"", "0", "1"}
    assert {x["folded"] for x in v["fold"]} == {"", "qualifying", "not_qualifying"}
    assert {x["sound"] for x in v["verdict_sound"]} == {True, False}
    assert len({x["key"] for x in v["referred_key"]}) >= 2 and all(len(x["key"]) == 64 for x in v["referred_key"])
