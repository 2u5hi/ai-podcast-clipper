import pytest

from watermark import MAX_WATERMARK_LENGTH, drawtext_filter, is_valid_watermark_text


class TestIsValidWatermarkText:
    @pytest.mark.parametrize("text", [
        "DAILYTECH.AI",
        "@my.podcast",
        r"""it's 100% "real": a\b""",
        "x" * MAX_WATERMARK_LENGTH,
    ])
    def test_accepts_printable_text(self, text):
        assert is_valid_watermark_text(text)

    @pytest.mark.parametrize("text", [
        "",
        "x" * (MAX_WATERMARK_LENGTH + 1),
        "line\nbreak",
        "emoji \U0001F399",
        "nul\x00",
    ])
    def test_refuses_the_rest(self, text):
        assert not is_valid_watermark_text(text)


class TestDrawtextFilter:
    def test_reads_the_text_from_a_file_with_expansion_off(self):
        f = drawtext_filter("/tmp/run/clip_0/pyavi/watermark.txt")
        assert "textfile=/tmp/run/clip_0/pyavi/watermark.txt" in f
        assert "expansion=none" in f
        assert "drawtext=text=" not in f and ":text=" not in f
