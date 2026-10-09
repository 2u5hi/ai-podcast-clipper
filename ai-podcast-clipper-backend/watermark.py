import re

MAX_WATERMARK_LENGTH = 40  # matches the web app and the User_watermarkText_length check
FONT = "/usr/share/fonts/truetype/custom/Anton-Regular.ttf"

_PRINTABLE = re.compile(r"[\x20-\x7E]{1,%d}" % MAX_WATERMARK_LENGTH)


def is_valid_watermark_text(text: str) -> bool:
    return _PRINTABLE.fullmatch(text) is not None


def drawtext_filter(textfile: str) -> str:
    """The watermark filter: upper right, small enough to clear the captions.

    The text comes from a file and expansion is off, so whatever the creator typed is drawn literally;
    nothing they write is ever parsed as filter syntax or %{...} expressions. The path is ours.
    """
    return (
        f"drawtext=textfile={textfile}:expansion=none:fontfile={FONT}"
        ":fontsize=36:fontcolor=white@0.6:x=w-tw-30:y=30"
        ":box=1:boxcolor=black@0.3:boxborderw=6"
    )
