# SourceHunt — memory_safety / FFmpeg Blind Test Summary

- Target: `libavformat/mov.c`
- Commit: `ced0dc807eb67516b341d68f04ce5a87b02820de`
- Specialist: `memory_safety`
- Verdict: **PASS** (5/5 runs detected)

## Per-Run Results

| Run | Detected | MaxEvLv | Reflexion | Duration(s) | Error |
|-----|----------|---------|-----------|-------------|-------|
| 1 | ✅ | Lv.2 | 10 | 1477.3 | - |
| 2 | ✅ | Lv.2 | 8 | 1442.5 | - |
| 3 | ✅ | Lv.2 | 8 | 1463.4 | - |
| 4 | ✅ | Lv.2 | 1 | 1276.9 | - |
| 5 | ✅ | Lv.2 | 10 | 2314.7 | - |

## Aggregate

| Metric | Value |
|--------|-------|
| Detection rate | 5/5 |
| Max evidence level reached | Lv.2 |
| Avg reflexion iterations | 7.4 |
| Avg duration | 1594.9s |
