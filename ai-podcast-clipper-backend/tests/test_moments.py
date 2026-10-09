from moments import MAX_CLIPS, parse_moments, select_moments


def moment(start, length):
    return {"start": start, "end": start + length}


class TestParseMoments:
    def test_plain_json(self):
        assert parse_moments('[{"start": 1, "end": 40}]') == [moment(1, 39)]

    def test_strips_markdown_fence(self):
        raw = '```json\n[{"start": 1, "end": 40}]\n```'
        assert parse_moments(raw) == [moment(1, 39)]

    def test_salvages_truncated_response(self):
        raw = '[{"start": 1, "end": 40}, {"start": 50, "end": 90}, {"start": 100, "en'
        assert parse_moments(raw) == [moment(1, 39), moment(50, 40)]

    def test_non_list_becomes_empty(self):
        assert parse_moments('{"start": 1, "end": 40}') == []

    def test_garbage_becomes_empty(self):
        assert parse_moments("no moments here") == []


class TestSelectMoments:
    def test_keeps_well_sized_moments(self):
        moments = [moment(0, 30), moment(100, 45), moment(200, 60)]
        assert select_moments(moments) == moments

    def test_drops_too_long_and_too_short_when_enough_remain(self):
        good = [moment(0, 30), moment(100, 45), moment(200, 60)]
        moments = good + [moment(300, 5), moment(400, 120)]
        assert select_moments(moments) == good

    def test_tops_up_to_three_with_longest_leftovers(self):
        moments = [moment(0, 30), moment(100, 16), moment(200, 20), moment(300, 10)]
        assert select_moments(moments) == [moment(0, 30), moment(200, 20), moment(100, 16)]

    def test_drops_reversed_and_malformed_moments(self):
        moments = [{"start": 50, "end": 10}, {"start": 5}, "nope", moment(0, 30)]
        assert select_moments(moments) == [moment(0, 30)]

    def test_caps_at_max_clips(self):
        moments = [moment(i * 100, 30) for i in range(MAX_CLIPS + 3)]
        assert len(select_moments(moments)) == MAX_CLIPS

    def test_falls_back_to_raw_moments_when_none_usable(self):
        moments = [moment(0, 5), moment(10, 3)]
        assert select_moments(moments) == moments

    def test_empty(self):
        assert select_moments([]) == []
