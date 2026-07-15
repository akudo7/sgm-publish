# SourceHunt — integer_overflow / FFmpeg Blind Test Summary

- Target: `libavformat/mov.c`
- Commit: `ced0dc807eb67516b341d68f04ce5a87b02820de`
- Specialist: `integer_overflow`
- Verdict: **PARTIAL** (2/5 runs detected)

## Per-Run Results

| Run | Detected | MaxEvLv | Reflexion | Duration(s) | Error |
|-----|----------|---------|-----------|-------------|-------|
| 1 | ❌ | Lv.2 | 14 | 1606.7 | - |
| 2 | ✅ | Lv.2 | 16 | 2777.0 | - |
| 3 | ❌ | Lv.2 | 13 | 2342.3 | - |
| 4 | ✅ | Lv.2 | 16 | 2631.7 | - |
| 5 | ❌ | Lv.2 | 8 | 1973.4 | - |

## Aggregate

| Metric | Value |
|--------|-------|
| Detection rate | 2/5 |
| Max evidence level reached | Lv.2 |
| Avg reflexion iterations | 13.4 |
| Avg duration | 2266.2s |
