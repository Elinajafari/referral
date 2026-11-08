"""Mutation pass: break every defence on purpose, confirm a test notices.

Passing tests prove nothing on their own. Each entry below is a small edit to
the contract that removes a defence. The suite must fail for every one of them,
and this script records WHICH test caught it, so the table in the README is
measured rather than claimed.

    python scripts/mutate.py            # run them all, print what caught what
    python scripts/mutate.py --md       # emit the markdown table for the README

An escaping mutation is a finding, not a nuisance: either a missing test, or a
later defence strict enough that an earlier test can no longer fail. The script
exits non-zero if anything escapes, and refuses to run on a red baseline.

Three rules keep the harness honest:

  * the unmutated suite must be green before anything is mutated;
  * a find string that is missing, or matches more than once, is a failure of
    the harness, never a skip, so refactoring cannot quietly turn a row off;
  * scripts/lift.py runs inside every mutated copy before the suite, so the lib
    parity test can never stand in for the behavioural test a mutation deserves.
"""

import argparse
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile

ROOT = pathlib.Path(__file__).absolute().parent.parent
TARGET = "referral.py"

FENCE = '    return str(raw).replace("<", "(").replace(">", ")").replace("[", "(").replace("]", ")")'

MUTATIONS = [
    # -- who may write
    ("the company may refer", "        if sender == p.company:", "        if False:"),
    ("a referral is claimed twice", "        if int(self.claimed.get(key, u256(0))) > 0:", "        if False:"),
    ("a closed program takes a referral",
     '        if str(p.status) != OPEN:\n            raise gl.vm.UserError(f"{ERR_EXPECTED} this program is closed")',
     '        if False:\n            raise gl.vm.UserError(f"{ERR_EXPECTED} this program is closed")'),
    ("a closed program settles again",
     '        if str(p.status) != OPEN:\n            raise gl.vm.UserError(f"{ERR_EXPECTED} this program was already closed")',
     '        if False:\n            raise gl.vm.UserError(f"{ERR_EXPECTED} this program was already closed")'),

    # -- the clock
    ("referrals never close", "        if self._now() > int(p.closes_at):", "        if False:"),
    ("referrals close a second early", "        if self._now() > int(p.closes_at):", "        if self._now() >= int(p.closes_at):"),
    ("settle runs before the window closes", "        if now <= int(p.closes_at):", "        if False:"),
    ("settle closes a second early", "        if now <= int(p.closes_at):", "        if now < int(p.closes_at):"),

    # -- what open() and refer() accept
    ("criteria of any length are accepted", "        if len(c) < MIN_CRITERIA or len(c) > MAX_CRITERIA:", "        if False:"),
    ("a bonus of zero is accepted", "        if b < 1 or b > MAX_AMOUNT:", "        if b > MAX_AMOUNT:"),
    ("a program pays any number of referrals", "        if m < 1 or m > MAX_REFERRALS:", "        if False:"),
    ("the window is unbounded", "        if w < MIN_WINDOW or w > MAX_WINDOW:", "        if False:"),
    ("the window does not set the clock", "closes_at=u256(now + w)", "closes_at=u256(now + MAX_WINDOW)"),
    ("any payment is accepted at open", "        if pool != b * m:", "        if False:"),
    ("a referred description of any length is accepted",
     "        if len(who) < MIN_REFERRED or len(who) > MAX_REFERRED:", "        if False:"),
    ("evidence of any length is accepted", "        if len(proof) < MIN_EVIDENCE or len(proof) > MAX_EVIDENCE:", "        if False:"),
    ("referrals continue past every paid bonus", "        if int(p.n_paid) >= int(p.max_referrals):", "        if False:"),
    ("a program takes any number of referrals", "        if int(p.n_referrals) >= MAX_ATTEMPTS:", "        if False:"),
    ("control characters are stored", '            out.append(" ")\n        else:', "            out.append(ch)\n        else:"),

    # -- what the contract decides
    ("a not_qualifying referral pays the referrer", "        pay = int(p.bonus) if verdict == QUALIFYING else 0", "        pay = int(p.bonus)"),
    ("a qualifying referral pays nothing", "        pay = int(p.bonus) if verdict == QUALIFYING else 0", "        pay = 0"),
    ("the paid count is not kept", "            p.n_paid = u256(int(p.n_paid) + 1)", "            pass"),
    ("the paid total is not kept", "            p.paid_total = u256(int(p.paid_total) + pay)", "            pass"),
    ("the pool is not drawn down on a payout", "            p.left = u256(int(p.left) - pay)", "            pass"),
    ("a referred person is not remembered as claimed", "        self.claimed[key] = u256(rid + 1)", "        pass"),
    ("a leader's reason is stored as sent",
     '            verdict=verdict, paid=u256(pay), why=sanitise_reason(res.get("because", "")), next=u256(0),',
     '            verdict=verdict, paid=u256(pay), why=str(res.get("because", "")), next=u256(0),'),
    ("a leader's reason is stored uncapped",
     '    return " ".join("".join(out).split())[:limit]', '    return " ".join("".join(out).split())'),
    ("referrals are not linked", "            self.referrals[int(p.last_referral)].next = u256(rid)", "            pass"),
    ("the referral count is not kept", "        p.n_referrals = u256(int(p.n_referrals) + 1)", "        pass"),
    ("the rest is not returned", "        self._send(p.company, rest)", "        pass"),
    ("what was returned is not recorded", "        p.returned = u256(rest)", "        pass"),

    # -- money
    ("the held counter is not raised", "        self.held = u256(int(self.held) + pool)", "        pass"),
    ("a payout beyond what is held is sent", "        if amount > int(self.held):", "        if False:"),
    ("the held counter is not lowered", "        self.held = u256(int(self.held) - amount)", "        pass"),

    # -- the two orders
    ("the second pass is asked in the forward order",
     "            rev, _ = ask(criteria, who, proof, REVERSED)", "            rev, _ = ask(criteria, who, proof, FORWARD)"),
    ("the reversed order is not reversed", "REVERSED = [NOT_QUALIFYING, QUALIFYING]", "REVERSED = [QUALIFYING, NOT_QUALIFYING]"),
    ("a disagreement between the orders keeps the forward verdict",
     "    return forward if forward == reverse else NOT_QUALIFYING", "    return forward"),
    ("a disagreement between the orders is qualifying",
     "    return forward if forward == reverse else NOT_QUALIFYING", "    return forward if forward == reverse else QUALIFYING"),
    ("an answer is not read back through its order", "    return order[int(choice)]", "    return FORWARD[int(choice)]"),

    # -- reading the model
    ("an option past the list is accepted", "    if k < 0 or k >= n:", "    if False:"),
    ("an answer in words is read as a number",
     '    if s == "" or any(ch not in "0123456789" for ch in s) or len(s) > 2:', '    if s == "":'),
    ("an unusable answer is not retried", "    for _ in range(2):", "    for _ in range(1):"),
    ("a bare value is read as if it were an object", "        if isinstance(raw, dict):", "        if True:"),
    ("an unusable answer becomes qualifying",
     '    raise gl.vm.UserError(f"{ERR_LLM} the model named neither option")', '    return QUALIFYING, ""'),

    # -- the validator
    ("the validator agrees with a leader error",
     "                # An [LLM_ERROR] is never agreed with.\n                return False",
     "                # An [LLM_ERROR] is never agreed with.\n                return True"),
    ("the validator skips the free structural check", "            if not verdict_sound(proposed):", "            if False:"),
    ("the validator agrees with anything", '            return referral_agrees(mine["verdict"], proposed)', "            return True"),
    ("the validator agrees when its own model fails",
     "            except gl.vm.UserError:\n                return False", "            except gl.vm.UserError:\n                return True"),
    ("agreement ignores the structural check",
     "    return verdict_sound(mine) and verdict_sound(theirs) and str(mine) == str(theirs)", "    return str(mine) == str(theirs)"),
    ("any word is a sound verdict", "    return verdict == QUALIFYING or verdict == NOT_QUALIFYING", '    return verdict != ""'),
    ("the agreed verdict is not checked again", "        if not verdict_sound(verdict):", "        if False:"),

    # -- the prompt boundary
    ("the fence does nothing", FENCE, "    return str(raw)"),
    ("the fence leaves square brackets", FENCE, '    return str(raw).replace("<", "(").replace(">", ")")'),
    ("the evidence reaches the prompt unfenced", "{fence(evidence)}", "{evidence}"),
    ("the referred person reaches the prompt unfenced", "{fence(referred)}", "{referred}"),
    ("the criteria reach the prompt unfenced", "{fence(criteria)}", "{criteria}"),
    ("the prompt judges effort instead of the evidence",
     "Do not judge whether the referrer worked\nhard to bring this person in, only whether the evidence meets a named\ncriterion.",
     "Judge whether the referrer worked hard."),
]


PYTEST = [sys.executable, "-m", "pytest", "tests/", "-x", "-q", "--no-header", "-p", "no:cacheprovider"]


def copy_repo(tmp):
    dst = pathlib.Path(tmp) / "repo"
    shutil.copytree(ROOT, dst, ignore=shutil.ignore_patterns(
        "__pycache__", ".pytest_cache", ".git", "artifacts", "*.pyc", "node_modules", "deployments"))
    # tests/test_vectors.py and tests/test_shape.py read ../shared; a mutant
    # must face the same vectors and the same described surface.
    shared = pathlib.Path(tmp) / "shared"
    shared.mkdir()
    for name in ("referral-vectors.json", "contract-shape.json"):
        shutil.copy(ROOT.parent / "shared" / name, shared / name)
    return dst


def run_one(label, find, replace):
    with tempfile.TemporaryDirectory() as tmp:
        dst = copy_repo(tmp)
        target = dst / TARGET
        src = target.read_text(encoding="utf-8")
        hits = src.count(find)
        if hits == 0:
            return "PATTERN NOT FOUND", None
        if hits > 1:
            return "PATTERN NOT UNIQUE", None
        target.write_text(src.replace(find, replace, 1), encoding="utf-8", newline="\n")
        subprocess.run([sys.executable, "scripts/lift.py"], cwd=dst, capture_output=True)
        proc = subprocess.run(PYTEST, cwd=dst, capture_output=True, text=True,
                          encoding="utf-8", errors="replace")
        if proc.returncode == 0:
            return "ESCAPED", None
        text = proc.stdout + proc.stderr
        m = re.search(r"^(?:FAILED|ERROR) (\S+?)::(\S+?)(?:\[|\s|$)", text, re.M)
        if m:
            return "caught", m.group(2).split("::")[-1]
        m = re.search(r"^E\s+(\w*(?:Error|Exception))", text, re.M)
        if m:
            return "caught", m.group(1) + " at import"
        return "caught", "unnamed failure"


def baseline_is_green():
    with tempfile.TemporaryDirectory() as tmp:
        dst = copy_repo(tmp)
        proc = subprocess.run(PYTEST, cwd=dst, capture_output=True, text=True,
                          encoding="utf-8", errors="replace")
        return proc.returncode == 0, (proc.stdout + proc.stderr)[-2000:]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--md", action="store_true", help="emit the README table")
    args = ap.parse_args()

    green, tail = baseline_is_green()
    if not green:
        print("the unmutated suite is not green; every mutation would look caught:\n" + tail, file=sys.stderr)
        return 2

    rows, escaped = [], []
    for label, find, replace in MUTATIONS:
        status, test = run_one(label, find, replace)
        if status == "caught":
            rows.append((label, test))
            if not args.md:
                print("  caught   %-70s %s" % (label, test), flush=True)
        else:
            escaped.append((label, status))
            print("  %-8s %s" % (status, label), file=sys.stderr, flush=True)

    if args.md:
        print("| Mutation | Caught by |")
        print("|---|---|")
        for label, test in rows:
            print("| %s | `%s` |" % (label, test))
    else:
        print()
        print("  %d mutations, %d caught, %d escaped" % (len(MUTATIONS), len(rows), len(escaped)))
    return 1 if escaped else 0


if __name__ == "__main__":
    sys.exit(main())
