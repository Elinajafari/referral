"""
The pure rules, one function at a time.

Everything here is a module-level function of referral.py, loaded from the
contract file itself, so what is tested is what is deployed.

    pytest tests/test_logic.py -v
"""

import ast
import pathlib

import pytest

import glsim as S

M = S.load_contract("referral.py")
LIB = pathlib.Path("lib/referral_consensus.py")


class TestText:
    def test_clean_text_collapses_whitespace_and_control_characters(self):
        assert M.clean_text("  Dana\tKim,\n dana@example.com ") == "Dana Kim, dana@example.com"
        assert M.clean_text("bell\x07x") == "bell x"


class TestReferredKey:
    def test_the_same_person_with_different_spacing_or_case_is_the_same_key(self):
        a = M.referred_key("Dana Kim, dana@example.com")
        b = M.referred_key("  dana kim,   DANA@example.com  ")
        assert a == b

    def test_a_different_person_is_a_different_key(self):
        assert M.referred_key("Dana Kim, dana@example.com") != M.referred_key("Eli Osei, eli@example.com")

    def test_the_key_is_a_sha256_hex_digest(self):
        assert len(M.referred_key("x")) == 64 and all(c in "0123456789abcdef" for c in M.referred_key("x"))


class TestNormaliseChoice:
    @pytest.mark.parametrize("raw,want", [
        ("0", "0"), ("1", "1"), (" [0] ", "0"), ("#1", "1"), ("(0)", "0"),
        ("", ""), ("2", ""), ("-1", ""), ("one", ""), ("00", "0"), ("000", ""),
    ])
    def test_a_model_s_answer_reads_as_an_option_number_or_nothing(self, raw, want):
        assert M.normalise_choice(raw, 2) == want

    def test_an_option_past_the_list_is_refused(self):
        assert M.normalise_choice("5", 2) == ""


class TestOptionOf:
    def test_a_choice_reads_back_through_its_order(self):
        assert M.option_of("0", M.FORWARD) == M.QUALIFYING
        assert M.option_of("1", M.FORWARD) == M.NOT_QUALIFYING
        assert M.option_of("0", M.REVERSED) == M.NOT_QUALIFYING

    def test_an_empty_choice_is_empty(self):
        assert M.option_of("", M.FORWARD) == ""


class TestFold:
    def test_the_same_option_both_ways_stands(self):
        assert M.fold(M.QUALIFYING, M.QUALIFYING) == M.QUALIFYING
        assert M.fold(M.NOT_QUALIFYING, M.NOT_QUALIFYING) == M.NOT_QUALIFYING

    def test_a_disagreement_is_not_qualifying(self):
        assert M.fold(M.QUALIFYING, M.NOT_QUALIFYING) == M.NOT_QUALIFYING
        assert M.fold(M.NOT_QUALIFYING, M.QUALIFYING) == M.NOT_QUALIFYING

    def test_either_order_unusable_folds_to_nothing(self):
        assert M.fold("", M.QUALIFYING) == "" and M.fold(M.QUALIFYING, "") == ""


class TestVerdictSound:
    @pytest.mark.parametrize("v,ok", [(M.QUALIFYING, True), (M.NOT_QUALIFYING, True), ("", False), ("maybe", False)])
    def test_only_the_two_options_are_sound(self, v, ok):
        assert M.verdict_sound(v) == ok


class TestReferralAgrees:
    def test_agreement_is_exact_and_symmetric(self):
        assert M.referral_agrees(M.QUALIFYING, M.QUALIFYING) and M.referral_agrees(M.NOT_QUALIFYING, M.NOT_QUALIFYING)
        assert not M.referral_agrees(M.QUALIFYING, M.NOT_QUALIFYING)

    def test_an_unsound_verdict_never_agrees(self):
        assert not M.referral_agrees("", M.QUALIFYING) and not M.referral_agrees(M.QUALIFYING, "maybe")

    def test_an_unsound_verdict_does_not_agree_with_itself(self):
        """Two unsound values that happen to match must still not agree, or
        the structural check could be dropped without any test noticing."""
        assert not M.referral_agrees("", "") and not M.referral_agrees("maybe", "maybe")


class TestSanitiseReason:
    def test_forbidden_characters_are_dropped_and_control_characters_become_spaces(self):
        assert M.sanitise_reason("<b>`x`</b>{}\ny") == "bx/b y"

    def test_the_reason_is_capped_not_truncated_silently_into_garbage(self):
        out = M.sanitise_reason("q" * 400)
        assert len(out) == M.MAX_REASON and out == "q" * M.MAX_REASON


class TestFence:
    def test_every_bracket_and_angle_is_neutralised_with_length_preserved(self):
        raw = "<tag>[0]"
        out = M.fence(raw)
        assert len(out) == len(raw) and "<" not in out and ">" not in out and "[" not in out and "]" not in out


class TestBuildPrompt:
    def test_the_options_are_numbered_by_the_contract_and_caller_text_is_fenced(self):
        p = M.build_prompt("Criteria text.", "Dana Kim <script>", "Dana paid.", M.FORWARD)
        assert "[0]" in p and "[1]" in p and "<script>" not in p and "(script)" in p

    def test_no_amount_or_identity_is_ever_in_the_prompt(self):
        p = M.build_prompt("Criteria text.", "Dana Kim", "Dana paid.", M.FORWARD)
        for secret in ("bonus", "0x", "wei"):
            assert secret not in p.lower()


class TestThePromptJudgesTheCriteriaOnly:
    def test_the_prompt_tells_the_model_not_to_judge_effort(self):
        p = M.build_prompt("Criteria text.", "Dana Kim", "Dana paid.", M.FORWARD)
        assert "do not judge whether the referrer worked" in p.lower()


class TestForbiddenWords:
    """Nothing the model is shown should let it infer money, identity or how
    many referrals were already paid; a prompt that leaked one of these words
    would be leaking exactly what the design promises it never sees."""

    def test_the_prompt_never_names_what_it_must_not_judge(self):
        p = M.build_prompt("Criteria text.", "Dana Kim", "Dana upgraded.", M.FORWARD)
        for word in ("bonus", "paid", "referrer address", "0x"):
            assert word not in p.lower()


class TestTheLiftedLib:
    """lib/referral_consensus.py claims to be lifted verbatim from the
    contract. Compare the parsed trees, function by function and constant by
    constant, so an edit to one side that forgets the other is caught here,
    not found later by someone copying stale rules."""

    def _lib_tree(self):
        return ast.parse(LIB.read_text(encoding="utf-8"))

    def _contract_tree(self):
        return ast.parse(pathlib.Path("referral.py").read_text(encoding="utf-8"))

    def test_the_lib_file_exists_and_parses(self):
        assert LIB.exists()
        self._lib_tree()

    @pytest.mark.parametrize("name", [
        "clean_text", "referred_key", "normalise_choice", "option_of", "fold", "verdict_sound",
        "referral_agrees", "sanitise_reason", "fence", "build_prompt",
    ])
    def test_each_lifted_function_matches_the_contract_s(self, name):
        def find(tree):
            return [n for n in ast.walk(tree) if isinstance(n, ast.FunctionDef) and n.name == name][0]

        lib_fn = ast.dump(find(self._lib_tree()))
        contract_fn = ast.dump(find(self._contract_tree()))
        assert lib_fn == contract_fn

    @pytest.mark.parametrize("name", ["QUALIFYING", "NOT_QUALIFYING", "FORWARD", "REVERSED", "OPTION_TEXT", "MAX_REASON"])
    def test_each_lifted_constant_matches_the_contract_s(self, name):
        def find(tree):
            for n in tree.body:
                if isinstance(n, ast.Assign) and any(isinstance(t, ast.Name) and t.id == name for t in n.targets):
                    return ast.dump(n.value)
            raise AssertionError(f"{name} not found")

        assert find(self._lib_tree()) == find(self._contract_tree())
