# SourceHunt — Merged Vulnerability Report (All Specialists)

- **Target**: `libavformat/mov.c` @ `ced0dc807eb67516b341d68f04ce5a87b02820de`
- **Specialists**: memory_safety, input_validation, integer_overflow
- **Total runs**: 15 (5 runs × 3 specialists)
- **Unique findings**: 136
- **Severity**: Critical: 14 / High: 91 / Medium: 29 / Low: 2
- **Repository CVE (OSV.dev)**: 71 件登録 / 54 件発見 (CVE-2016-2326, CVE-2016-3062, CVE-2017-14169, CVE-2017-14223, CVE-2017-15672 他 66 件)

## Findings

> 複数の specialist が検出した finding は信頼度が高い。Specialist 欄を参照。

### [CRITICAL] 🔴×2 `libavcodec/hevcdec.c:163`
- **Type**: out_of_bounds_write
- **Evidence Level**: Lv.2
- **Specialists**: input_validation, memory_safety (input_validation/run-1, input_validation/run-4, memory_safety/run-3)
- **Known CVE**: CVE-2019-11338, CVE-2024-32228
- **Description**: Missing upper bound validation on s->sh.nb_refs[L0] allows out-of-bounds array access in pred_weight_table.

### [CRITICAL] 🔴×2 `libavcodec/h264_slice.c:145`
- **Type**: integer_overflow
- **Evidence Level**: Lv.2
- **Specialists**: integer_overflow, memory_safety (integer_overflow/run-4, memory_safety/run-2)
- **Known CVE**: 未報告 / 不明
- **Description**: Signed integer overflow in allocation size calculations for buffer pools in init_table_pools

### [CRITICAL] 🔴×2 `libavcodec/h264_slice.c:146`
- **Type**: Integer Overflow leading to Heap Buffer Overflow
- **Evidence Level**: Lv.2
- **Specialists**: integer_overflow, memory_safety (integer_overflow/run-3, integer_overflow/run-4, memory_safety/run-4)
- **Known CVE**: 未報告 / 不明
- **Description**: The calculation `alloc_size * 2 * 21` on line 146 uses 32-bit signed integers. An overflow here causes `av_fast_malloc` to allocate a small `edge_emu_buffer`, while edge emulation routines subsequently write beyond the allocated bounds.

### [CRITICAL] 🔴×2 `libavcodec/h264_slice.c:139`
- **Type**: integer_overflow_in_allocation_size
- **Evidence Level**: Lv.2
- **Specialists**: input_validation, integer_overflow (input_validation/run-4, integer_overflow/run-2, integer_overflow/run-3)
- **Known CVE**: 未報告 / 不明
- **Description**: Integer overflow in size calculation for buffer pool allocation in init_table_pools.

### [CRITICAL] `libavformat/mov.c:179`
- **Type**: out_of_bounds_access
- **Evidence Level**: Lv.2
- **Specialists**: input_validation (input_validation/run-1)
- **Known CVE**: CVE-2016-3062, CVE-2025-1373, CVE-2025-25471
- **Description**: Unsigned integer underflow on nb_streams leads to out-of-bounds array access

### [CRITICAL] `libavcodec/vp9.c:85`
- **Type**: Integer Overflow / Out-of-Bounds Write
- **Evidence Level**: Lv.2
- **Specialists**: memory_safety (memory_safety/run-1)
- **Known CVE**: 未報告 / 不明
- **Description**: The calculation sz = 64 * s->sb_cols * s->sb_rows; uses 32-bit signed integer arithmetic. If s->sb_cols and s->sb_rows are sufficiently large (e.g., from unclamped or malicious bitstream dimensions), the multiplication can overflow, resulting in a negative or wrapped sz value.

### [CRITICAL] `libavcodec/h264_slice.c:126`
- **Type**: integer_overflow
- **Evidence Level**: Lv.2
- **Specialists**: memory_safety (memory_safety/run-2)
- **Known CVE**: 未報告 / 不明
- **Description**: Signed integer overflow in allocation size calculation for top_borders in alloc_scratch_buffers

### [CRITICAL] `libavcodec/h264_slice.c:181`
- **Type**: Integer Overflow leading to Out-of-Bounds Access
- **Evidence Level**: Lv.2
- **Specialists**: memory_safety (memory_safety/run-3)
- **Known CVE**: 未報告 / 不明
- **Description**: Unchecked signed integer multiplication in buffer size calculations allows crafted macroblock dimensions to wrap around to small positive values. This results in undersized pool allocations that are later indexed with the true (large) dimensions, causing out-of-bounds memory access.

### [CRITICAL] `libavcodec/h264_slice.c:175`
- **Type**: Integer Overflow leading to Heap Buffer Overflow
- **Evidence Level**: Lv.2
- **Specialists**: memory_safety (memory_safety/run-4)
- **Known CVE**: 未報告 / 不明
- **Description**: The allocation size for motion_val_pool is computed using 32-bit signed integer arithmetic. b4_array_size is calculated as b4_stride * h->mb_height * 4, and the final size passed to av_buffer_pool_init is 2 * (b4_array_size + 4) * sizeof(int16_t). If h->mb_width or h->mb_height are crafted to be large, the intermediate multiplications overflow the int type, resulting in a negative or truncated size. This value is implicitly cast to size_t for av_buffer_pool_init, causing an undersized buffer to be allocated. Subsequent decoding operations writing motion vectors will trigger out-of-bounds writes.

### [CRITICAL] `libavcodec/vc1.c:55`
- **Type**: buffer_overflow
- **Evidence Level**: Lv.2
- **Specialists**: memory_safety (memory_safety/run-5)
- **Known CVE**: 未報告 / 不明
- **Description**: The size argument for memset is an int, which can be negative. Casting a negative int to size_t results in a massive unsigned value.

### [CRITICAL] `libavcodec/h264_slice.c:214`
- **Type**: integer_overflow
- **Evidence Level**: Lv.2
- **Specialists**: input_validation (input_validation/run-2)
- **Known CVE**: 未報告 / 不明
- **Description**: In init_table_pools, size parameters for av_buffer_pool_init are computed using 32-bit signed integer arithmetic. Multiplications involving h->mb_width and h->mb_height (e.g., b4_stride * h->mb_height * 4) overflow when processing high-resolution or crafted streams. The overflowed small values are passed to av_buffer_pool_init, allocating undersized memory pools. Subsequent slice decoding accesses these pools using indices derived from the actual macroblock dimensions, causing out-of-bounds heap writes.

### [CRITICAL] `libavcodec/h264_slice.c:157`
- **Type**: Integer Overflow leading to Heap Buffer Overflow
- **Evidence Level**: Lv.2
- **Specialists**: input_validation (input_validation/run-3)
- **Known CVE**: 未報告 / 不明
- **Description**: Unvalidated h->mb_width and h->mb_height from the bitstream are used in arithmetic to calculate allocation sizes without overflow checks. The multiplication b4_stride * h->mb_height * 4 can wrap around to a small value.

### [CRITICAL] `libavcodec/h264_slice.c:132`
- **Type**: Integer Overflow leading to Heap Buffer Overflow
- **Evidence Level**: Lv.2
- **Specialists**: input_validation (input_validation/run-3)
- **Known CVE**: 未報告 / 不明
- **Description**: Allocation size calculation for top_borders uses h->mb_width without validation or overflow protection. The expression h->mb_width * 16 * 3 * sizeof(uint8_t) * 2 can overflow.

### [CRITICAL] `libavcodec/h264_slice.c:140`
- **Type**: integer_overflow_in_allocation_size
- **Evidence Level**: Lv.2
- **Specialists**: input_validation (input_validation/run-5)
- **Known CVE**: 未報告 / 不明
- **Description**: The variables big_mb_num, mb_array_size, b4_stride, and b4_array_size are computed by multiplying untrusted bitstream-derived values (h->mb_width, h->mb_height, h->mb_stride). These multiplications can overflow a signed 32-bit integer, resulting in a negative or unexpectedly small size passed to av_buffer_pool_init. This leads to undersized heap allocations that are subsequently accessed out-of-bounds during slice decoding, causing heap corruption.

### [HIGH] 🔴×3 `libavcodec/hevcdec.c:93`
- **Type**: integer_overflow
- **Evidence Level**: Lv.2
- **Specialists**: input_validation, integer_overflow, memory_safety (input_validation/run-1, integer_overflow/run-2, memory_safety/run-3)
- **Known CVE**: CVE-2019-11338, CVE-2024-32228
- **Description**: Integer overflow in ctb_count calculation can lead to undersized heap allocation for SAO and deblock arrays.

### [HIGH] 🔴×2 `libavcodec/hevcdec.c:148`
- **Type**: Buffer Overflow
- **Evidence Level**: Lv.2
- **Specialists**: integer_overflow, memory_safety (integer_overflow/run-5, memory_safety/run-2)
- **Known CVE**: CVE-2019-11338, CVE-2024-32228
- **Description**: Missing bounds check on `s->sh.nb_refs[L0]` before array access in `pred_weight_table`.

### [HIGH] 🔴×2 `libavformat/mov.c:192`
- **Type**: buffer_overflow
- **Evidence Level**: Lv.2
- **Specialists**: integer_overflow, memory_safety (integer_overflow/run-2, memory_safety/run-2)
- **Known CVE**: CVE-2016-3062, CVE-2025-1373, CVE-2025-25471
- **Description**: The function computes a bounds pointer `end` using the caller-supplied `dstlen` without verifying it against the actual allocated size of `dst`. In the MOV demuxer, `dstlen` is typically passed as the untrusted atom length. If an attacker crafts a file with a large atom length, `dstlen` becomes excessively large, causing `end` to point far beyond the actual buffer. The subsequent loop writes to `dst` via `*p++` and `PUT_UTF8` until `p` reaches `end`, overflowing the buffer. The `PUT_UTF8` macro's internal checks rely on the already-miscalculated `end`.

### [HIGH] 🔴×2 `libavcodec/h264_slice.c:143`
- **Type**: integer_overflow_heap_buffer_overflow
- **Evidence Level**: Lv.2
- **Specialists**: integer_overflow, memory_safety (integer_overflow/run-4, memory_safety/run-2, memory_safety/run-4)
- **Known CVE**: 未報告 / 不明
- **Description**: Size calculations for buffer pools in init_table_pools use 32-bit signed int arithmetic on macroblock dimensions (h->mb_width, h->mb_height, h->mb_stride). Malformed streams or dynamic resolution changes can trigger signed integer overflow. The overflowed int is implicitly cast to size_t for av_buffer_pool_init. If the overflow wraps to a small positive value, an undersized pool is allocated. Subsequent motion vector and reference index writes during slice decoding overflow the heap.

### [HIGH] 🔴×2 `libavformat/mpeg.c:39`
- **Type**: out-of-bounds-read
- **Evidence Level**: Lv.2
- **Specialists**: input_validation, memory_safety (input_validation/run-3, memory_safety/run-4)
- **Known CVE**: 未報告 / 不明
- **Description**: The function check_pes performs multiple array accesses on pointer p without verifying bounds against end. Specifically, p[3], p[4], and p[6] are read at the start, and later p[4], p[5], p[7], and p[9] are accessed after p is advanced, without checking if p + offset < end.

### [HIGH] 🔴×2 `libavcodec/h264_slice.c:165`
- **Type**: Integer Overflow leading to Pool Allocation Underestimation
- **Evidence Level**: Lv.2
- **Specialists**: integer_overflow, memory_safety (integer_overflow/run-3, integer_overflow/run-4, memory_safety/run-4)
- **Known CVE**: 未報告 / 不明
- **Description**: In `init_table_pools`, allocation sizes for macroblock tables are computed using 32-bit signed integer arithmetic. Corrupted frame dimensions cause multiplications to overflow, creating undersized memory pools.

### [HIGH] 🔴×2 `libavcodec/h264_slice.c:114`
- **Type**: NULL Pointer Dereference
- **Evidence Level**: Lv.2
- **Specialists**: input_validation, integer_overflow (input_validation/run-3, input_validation/run-4, integer_overflow/run-1)
- **Known CVE**: 未報告 / 不明
- **Description**: Missing NULL check before dereferencing h->DPB[i].f in the Picture Decoding Buffer cleanup loop.

### [HIGH] 🔴×2 `libavcodec/vp9.c:116`
- **Type**: Integer Overflow / Out-of-Bounds Access
- **Evidence Level**: Lv.2
- **Specialists**: input_validation, integer_overflow (input_validation/run-4, input_validation/run-5, integer_overflow/run-3)
- **Known CVE**: 未報告 / 不明
- **Description**: Integer overflow in `sz` calculation at line 116 when `s->sb_cols` and `s->sb_rows` are large. The resulting negative or wrapped value is used to allocate a buffer at line 119 and compute a pointer offset at line 133, leading to out-of-bounds memory access.

### [HIGH] 🔴×2 `libavcodec/h264_slice.c:137`
- **Type**: Integer Overflow in Allocation Size
- **Evidence Level**: Lv.1
- **Specialists**: integer_overflow, memory_safety (integer_overflow/run-2, memory_safety/run-4)
- **Known CVE**: 未報告 / 不明
- **Description**: In alloc_scratch_buffers, the size argument for av_fast_malloc is computed as 16 * 6 * alloc_size. alloc_size is an int derived from linesize. If linesize is maliciously large, the multiplication 96 * alloc_size can overflow a 32-bit signed integer before being passed to av_fast_malloc, resulting in an undersized allocation.

### [HIGH] `libavcodec/hevcdec.c:118`
- **Type**: Integer Overflow leading to Buffer Overflow
- **Evidence Level**: Lv.2
- **Specialists**: memory_safety (memory_safety/run-1)
- **Known CVE**: CVE-2019-11338, CVE-2024-32228
- **Description**: Integer overflow in `min_pu_size * sizeof(MvField)` passed to `av_buffer_pool_init`

### [HIGH] `libavcodec/hevcdec.c:91`
- **Type**: integer_overflow
- **Evidence Level**: Lv.2
- **Specialists**: memory_safety (memory_safety/run-3)
- **Known CVE**: CVE-2019-11338, CVE-2024-32228
- **Description**: Integer overflow in pic_size_in_ctb calculation can lead to undersized heap allocation and subsequent buffer overflow.

### [HIGH] `libavformat/mov.c:152`
- **Type**: heap_buffer_overflow
- **Evidence Level**: Lv.2
- **Specialists**: memory_safety (memory_safety/run-3)
- **Known CVE**: CVE-2016-3062, CVE-2025-1373, CVE-2025-25471
- **Description**: The function `mov_read_mac_string` computes `char *end = dst+dstlen-1;` based on `dstlen`, which is derived from the MOV atom's `len` field. If the caller's allocation size calculation for `dst` suffers from integer truncation or overflow (e.g., due to `len` being a large `uint32_t`), the actual heap reservation will be smaller than `dstlen`. The computed `end` will therefore point past the allocated heap buffer. The subsequent loop iterates `len` times, and the bounds check `if (p >= end) continue;` only prevents writes once `p` reaches `end`. Since `end` is already beyond the heap boundary, `p` can advance past the allocated buffer while still satisfying `p < end`, resulting in a heap buffer overflow during `*p++ = c` or `*p++ = t`.

### [HIGH] `libavcodec/hevcdec.c:116`
- **Type**: Integer Overflow
- **Evidence Level**: Lv.2
- **Specialists**: memory_safety (memory_safety/run-4)
- **Known CVE**: CVE-2019-11338, CVE-2024-32228
- **Description**: The calculation of pic_size_in_ctb multiplies two values derived from frame dimensions without overflow checking. Maliciously large width and height values can cause the product to wrap around to a small positive or negative integer. This value is passed to av_malloc_array, potentially resulting in an undersized heap allocation for s->tab_slice_address and s->qp_y_tab, leading to heap buffer overflow during subsequent slice decoding operations.

### [HIGH] `libavcodec/hevcdec.c:167`
- **Type**: Out-of-bounds Write
- **Evidence Level**: Lv.2
- **Specialists**: memory_safety (memory_safety/run-4)
- **Known CVE**: CVE-2019-11338, CVE-2024-32228
- **Description**: The loop iterates based on s->sh.nb_refs[L0], which is derived from the bitstream. The arrays luma_weight_l0_flag, s->sh.luma_weight_l0, and s->sh.luma_offset_l0 are fixed at 16 elements. If nb_refs[L0] exceeds 16 due to a malformed bitstream, the loop writes out of bounds to the stack-allocated flag array and the HEVCSh structure fields.

### [HIGH] `libavcodec/hevcdec.c:61`
- **Type**: Integer Overflow
- **Evidence Level**: Lv.2
- **Specialists**: memory_safety (memory_safety/run-5)
- **Known CVE**: CVE-2019-11338, CVE-2024-32228
- **Description**: The multiplication `sps->min_pu_width * sps->min_pu_height` on line 61 can overflow a 32-bit signed integer if the SPS contains maliciously large dimensions. The truncated result is passed to `av_mallocz` on line 77, which lacks overflow protection. This results in an undersized heap allocation, leading to a heap buffer overflow when `s->tab_ipm` is subsequently accessed during decoding.

### [HIGH] `libavformat/mov.c:163`
- **Type**: heap_buffer_overflow
- **Evidence Level**: Lv.2
- **Specialists**: memory_safety (memory_safety/run-5)
- **Known CVE**: CVE-2016-3062, CVE-2025-1373, CVE-2025-25471
- **Description**: Bounds-checking relies on dstlen parameter which may not match the actual heap allocation size derived from untrusted metadata.

### [HIGH] `libavformat/mov.c:198`
- **Type**: integer_truncation_overflow
- **Evidence Level**: Lv.2
- **Specialists**: memory_safety (memory_safety/run-5)
- **Known CVE**: CVE-2016-3062, CVE-2025-1373, CVE-2025-25471
- **Description**: Signed int parameter truncates large MOV atom sizes, causing massive downstream allocation/read.

### [HIGH] `libavcodec/jpeg2000dec.c:130`
- **Type**: stack_buffer_overflow
- **Evidence Level**: Lv.2
- **Specialists**: input_validation (input_validation/run-1)
- **Known CVE**: CVE-2025-22921
- **Description**: Missing bounds check on stack pointer `sp` before writing to fixed-size array `stack[30]` in `tag_tree_decode`

### [HIGH] `libavcodec/hevcdec.c:203`
- **Type**: out_of_bounds_write
- **Evidence Level**: Lv.2
- **Specialists**: input_validation (input_validation/run-1)
- **Known CVE**: CVE-2019-11338, CVE-2024-32228
- **Description**: The loop bound s->sh.nb_refs[L0] is used directly to index fixed-size arrays (luma_weight_l0_flag, s->sh.luma_weight_l0, etc.) without validating that it does not exceed the array size (16). HEVC specification limits active reference indices to 15, but untrusted bitstreams may supply larger values.

### [HIGH] `libavformat/mov.c:102`
- **Type**: missing_bounds_check
- **Evidence Level**: Lv.2
- **Specialists**: input_validation (input_validation/run-1)
- **Known CVE**: CVE-2016-3062, CVE-2025-1373, CVE-2025-25471
- **Description**: Function reads 4 bytes unconditionally without verifying len parameter

### [HIGH] `libavformat/mov.c:87`
- **Type**: out_of_bounds_read
- **Evidence Level**: Lv.2
- **Specialists**: input_validation (input_validation/run-2, input_validation/run-4)
- **Known CVE**: CVE-2016-3062, CVE-2025-1373, CVE-2025-25471
- **Description**: Missing bounds check before reading from AVIOContext. The function unconditionally reads 4 bytes (two 16-bit values) without verifying that the atom length 'len' is at least 4.

### [HIGH] `libavformat/mov.c:100`
- **Type**: out_of_bounds_read
- **Evidence Level**: Lv.2
- **Specialists**: input_validation (input_validation/run-2)
- **Known CVE**: CVE-2016-3062, CVE-2025-1373, CVE-2025-25471
- **Description**: Missing bounds check before reading from AVIOContext. The function unconditionally reads 4 bytes without verifying that the atom length 'len' is at least 4.

### [HIGH] `libavformat/mov.c:114`
- **Type**: out_of_bounds_read
- **Evidence Level**: Lv.2
- **Specialists**: input_validation (input_validation/run-2)
- **Known CVE**: CVE-2016-3062, CVE-2025-1373, CVE-2025-25471
- **Description**: Missing bounds check before reading from AVIOContext. The function unconditionally reads 1 byte without verifying that the atom length 'len' is at least 1.

### [HIGH] `libavcodec/hevcdec.c:136`
- **Type**: out_of_bounds_write
- **Evidence Level**: Lv.2
- **Specialists**: input_validation (input_validation/run-2)
- **Known CVE**: CVE-2019-11338, CVE-2024-32228
- **Description**: Missing bounds check on s->sh.nb_refs[L0] before array access

### [HIGH] `libavformat/mov.c:125`
- **Type**: out_of_bounds_read
- **Evidence Level**: Lv.2
- **Specialists**: input_validation (input_validation/run-2)
- **Known CVE**: CVE-2016-3062, CVE-2025-1373, CVE-2025-25471
- **Description**: Missing bounds check before reading from AVIOContext. The function unconditionally reads 2 bytes without verifying that the atom length 'len' is at least 2.

### [HIGH] `libavcodec/hevcdec.c:152`
- **Type**: missing_bounds_check
- **Evidence Level**: Lv.2
- **Specialists**: input_validation (input_validation/run-3, input_validation/run-5)
- **Known CVE**: CVE-2019-11338, CVE-2024-32228
- **Description**: The loop iterating over reference pictures uses `s->sh.nb_refs[L0]` as the bound without validating it against the HEVC specification maximum of 16. This value is derived directly from the bitstream. If `nb_refs[L0]` exceeds 16, the loop writes out-of-bounds into the fixed-size stack arrays `luma_weight_l0_flag[16]` and `chroma_weight_l0_flag[16]`, as well as the HEVC context arrays.

### [HIGH] `libavformat/mov.c:206`
- **Type**: out_of_bounds_read
- **Evidence Level**: Lv.2
- **Specialists**: input_validation (input_validation/run-3)
- **Known CVE**: CVE-2016-3062, CVE-2025-1373, CVE-2025-25471
- **Description**: Accesses c->fc->streams array at index nb_streams - 1 without verifying that at least one stream exists.

### [HIGH] `libavformat/mov.c:209`
- **Type**: out_of_bounds_access
- **Evidence Level**: Lv.2
- **Specialists**: input_validation (input_validation/run-4)
- **Known CVE**: CVE-2016-3062, CVE-2025-1373, CVE-2025-25471
- **Description**: Missing bounds check on nb_streams before array indexing

### [HIGH] `libavformat/mov.c:234`
- **Type**: NULL pointer dereference
- **Evidence Level**: Lv.2
- **Specialists**: input_validation (input_validation/run-5)
- **Known CVE**: CVE-2016-3062, CVE-2025-1373, CVE-2025-25471
- **Description**: Missing NULL check before dereferencing st->codecpar. The codecpar field is not initialized by avformat_new_stream (called internally by ff_add_attached_pic) and is not allocated before assignment.

### [HIGH] `libavformat/mov.c:213`
- **Type**: out_of_bounds_access
- **Evidence Level**: Lv.2
- **Specialists**: input_validation (input_validation/run-5)
- **Known CVE**: CVE-2016-3062, CVE-2025-1373, CVE-2025-25471
- **Description**: Missing bounds check on nb_streams before array access in mov_read_covr

### [HIGH] `libavcodec/hevcdec.c:69`
- **Type**: integer_overflow
- **Evidence Level**: Lv.2
- **Specialists**: integer_overflow (integer_overflow/run-1)
- **Known CVE**: CVE-2019-11338, CVE-2024-32228
- **Description**: Arithmetic overflow in manual allocation size calculation for pic_size_in_ctb

### [HIGH] `libavcodec/hevcdec.c:103`
- **Type**: integer_overflow
- **Evidence Level**: Lv.2
- **Specialists**: integer_overflow (integer_overflow/run-1, integer_overflow/run-5)
- **Known CVE**: CVE-2019-11338, CVE-2024-32228
- **Description**: Signed integer overflow in frame dimension and block count calculations used for memory allocation and indexing.

### [HIGH] `libavcodec/hevcdec.c:71`
- **Type**: integer_overflow
- **Evidence Level**: Lv.2
- **Specialists**: integer_overflow (integer_overflow/run-1)
- **Known CVE**: CVE-2019-11338, CVE-2024-32228
- **Description**: Arithmetic overflow in manual allocation size calculation for ctb_count

### [HIGH] `libavcodec/hevcdec.c:90`
- **Type**: integer_overflow
- **Evidence Level**: Lv.2
- **Specialists**: integer_overflow (integer_overflow/run-2)
- **Known CVE**: CVE-2019-11338, CVE-2024-32228
- **Description**: Integer overflow in pic_size_in_ctb calculation

### [HIGH] `libavcodec/hevcdec.c:92`
- **Type**: integer_overflow
- **Evidence Level**: Lv.2
- **Specialists**: integer_overflow (integer_overflow/run-2)
- **Known CVE**: CVE-2019-11338, CVE-2024-32228
- **Description**: Integer overflow in ctb_count calculation

### [HIGH] `libavcodec/hevcdec.c:143`
- **Type**: integer_overflow
- **Evidence Level**: Lv.2
- **Specialists**: integer_overflow (integer_overflow/run-2)
- **Known CVE**: CVE-2019-11338, CVE-2024-32228
- **Description**: In pic_arrays_init, min_pu_size is declared as int and computed from unchecked SPS fields. When passed to av_buffer_pool_init on line 143, it is multiplied by sizeof(MvField) (size_t). C's usual arithmetic conversions promote the int operand to size_t before evaluation. Malformed inputs can cause min_pu_size to be negative or excessively large, causing the product to wrap around SIZE_MAX (especially on 32-bit systems) to a small value. av_buffer_pool_init may succeed with an undersized pool, leading to heap buffer overflows during subsequent PU decoding.

### [HIGH] `libavcodec/hevcdec.c:108`
- **Type**: integer_overflow
- **Evidence Level**: Lv.2
- **Specialists**: integer_overflow (integer_overflow/run-2)
- **Known CVE**: CVE-2019-11338, CVE-2024-32228
- **Description**: The calculation of `pic_size_in_ctb` performs multiplication in 32-bit signed `int` arithmetic. If `width` and `height` are large and `log2_min_cb_size` is small, the product can exceed `INT_MAX`, causing signed integer overflow. The resulting wrapped value is passed to `av_malloc_array` as the element count, potentially leading to an undersized heap allocation and subsequent buffer overflow during CTB data population.

### [HIGH] `libavcodec/hevcdec.c:104`
- **Type**: integer_overflow
- **Evidence Level**: Lv.2
- **Specialists**: integer_overflow (integer_overflow/run-4)
- **Known CVE**: CVE-2019-11338, CVE-2024-32228
- **Description**: Unchecked signed 32-bit integer multiplication for allocation size calculations. pic_size_in_ctb is computed by multiplying frame dimensions (width, height) without overflow checks. If crafted SPS values cause the intermediate product to exceed INT_MAX, it wraps to a negative value. This negative value is then implicitly cast to size_t when passed to av_malloc_array, potentially resulting in massive allocation requests or incorrect buffer sizing.

### [HIGH] `libavcodec/hevcdec.c:106`
- **Type**: integer_overflow
- **Evidence Level**: Lv.2
- **Specialists**: integer_overflow (integer_overflow/run-4)
- **Known CVE**: CVE-2019-11338, CVE-2024-32228
- **Description**: Similar signed integer overflow risk in ctb_count and min_pu_size calculations. sps->ctb_width * sps->ctb_height and sps->min_pu_width * sps->min_pu_height are performed in int before being used in av_calloc and av_mallocz. Negative overflow values cast to size_t can trigger oversized allocations.

### [HIGH] `libavformat/mov.c:312`
- **Type**: signed/unsigned conversion bug leading to integer wraparound
- **Evidence Level**: Lv.2
- **Specialists**: integer_overflow (integer_overflow/run-4)
- **Known CVE**: CVE-2016-3062, CVE-2025-1373, CVE-2025-25471
- **Description**: The `len` parameter is declared as `unsigned`, but `avio_get_str()` returns a signed `int`. If `avio_get_str()` returns a negative error code, the subtraction `len -= avio_get_str(...)` causes an unsigned integer wraparound, inflating `len` to near `UINT_MAX`. Subsequent bounds checks are bypassed.

### [HIGH] `libavcodec/hevcdec.c:97`
- **Type**: integer_overflow
- **Evidence Level**: Lv.2
- **Specialists**: integer_overflow (integer_overflow/run-4)
- **Known CVE**: CVE-2019-11338, CVE-2024-32228
- **Description**: Unchecked multiplication of SPS-derived dimensions (min_pu_width * min_pu_height) on line 97 can overflow a 32-bit signed integer. The resulting wrapped value is passed directly to av_mallocz (line 113) and av_buffer_pool_init (line 131) without validation. If the overflow wraps to a small positive value, the allocator succeeds with an undersized buffer, but subsequent decoder logic uses the wrapped int value as a loop bound or index multiplier, causing out-of-bounds heap writes.

### [HIGH] `libavcodec/hevcdec.c:146`
- **Type**: integer_overflow
- **Evidence Level**: Lv.2
- **Specialists**: integer_overflow (integer_overflow/run-5)
- **Known CVE**: CVE-2019-11338, CVE-2024-32228
- **Description**: Integer overflow/truncation in buffer pool initialization size calculation. min_pu_size * sizeof(MvField) is evaluated before passing to av_buffer_pool_init. If sps->min_pu_width and sps->min_pu_height are large, the multiplication overflows the 32-bit int parameter, resulting in an undersized pool allocation.

### [HIGH] `libavcodec/hevcdec.c:112`
- **Type**: integer_overflow
- **Evidence Level**: Lv.2
- **Specialists**: integer_overflow (integer_overflow/run-5)
- **Known CVE**: CVE-2019-11338, CVE-2024-32228
- **Description**: Integer overflow in pic_size_in_ctb calculation. The multiplication of block dimensions is performed using 32-bit signed integers. Maliciously large width/height values in the SPS can cause the product to wrap around, resulting in a truncated or negative value passed to av_malloc_array.

### [HIGH] `libavcodec/hevcdec.c:47`
- **Type**: integer_overflow
- **Evidence Level**: Lv.1
- **Specialists**: memory_safety (memory_safety/run-1)
- **Known CVE**: CVE-2019-11338, CVE-2024-32228
- **Description**: Integer overflow in `min_pu_size` calculation combined with missing overflow checks in `av_buffer_pool_init` leads to undersized heap allocations. Malicious SPS parameters can cause the multiplication to wrap around to a small positive value, resulting in a heap buffer overflow during subsequent decoding operations.

### [HIGH] `libavcodec/vp9.c:104`
- **Type**: use-after-free
- **Evidence Level**: Lv.2
- **Specialists**: memory_safety (memory_safety/run-1)
- **Known CVE**: 未報告 / 不明
- **Description**: Missing null-assignment of `f->mv` in `vp9_frame_unref` leaves a dangling pointer after `f->extradata` is freed.

### [HIGH] `libavcodec/vp9.c:123`
- **Type**: Integer Overflow
- **Evidence Level**: Lv.2
- **Specialists**: memory_safety (memory_safety/run-4)
- **Known CVE**: 未報告 / 不明
- **Description**: Integer overflow in frame extradata pool size calculation

### [HIGH] `libavformat/mpeg.c:74`
- **Type**: out-of-bounds-read
- **Evidence Level**: Lv.2
- **Specialists**: memory_safety (memory_safety/run-4)
- **Known CVE**: 未報告 / 不明
- **Description**: In mpegps_probe, the code reads p->buf[i + 1] and p->buf[i + 2] at line 74 without ensuring i + 2 < p->buf_size. Additionally, i += len at lines 88 and 89 can cause i to jump beyond the buffer boundary, leading to out-of-bounds reads in subsequent iterations or invalid pointer arithmetic.

### [HIGH] `libavcodec/vc1.c:112`
- **Type**: out_of_bounds_write
- **Evidence Level**: Lv.2
- **Specialists**: memory_safety (memory_safety/run-5)
- **Known CVE**: 未報告 / 不明
- **Description**: Pointer arithmetic planep += stride - width can move the pointer backwards if stride is less than width.

### [HIGH] `libavcodec/vc1.c:100`
- **Type**: integer_overflow
- **Evidence Level**: Lv.2
- **Specialists**: memory_safety (memory_safety/run-5)
- **Known CVE**: 未報告 / 不明
- **Description**: Signed integer overflow on the height * width calculation used for loop bounds and indexing logic.

### [HIGH] `libavcodec/vc1.c:80`
- **Type**: out-of-bounds-read-write
- **Evidence Level**: Lv.2
- **Specialists**: memory_safety (memory_safety/run-5)
- **Known CVE**: 未報告 / 不明
- **Description**: Unvalidated stride multiplier in column-wise bitplane decoding causes out-of-bounds memory access.

### [HIGH] `libavcodec/vc1.c:108`
- **Type**: Out-of-bounds Write
- **Evidence Level**: Lv.2
- **Specialists**: memory_safety (memory_safety/run-5)
- **Known CVE**: 未報告 / 不明
- **Description**: Incorrect pointer arithmetic in IMODE_DIFF2/NORM2 bitplane decoding assumes stride >= width, risking backward pointer movement and out-of-bounds access if stride is smaller.

### [HIGH] `libavcodec/h264_slice.c:153`
- **Type**: integer_overflow
- **Evidence Level**: Lv.2
- **Specialists**: input_validation (input_validation/run-1)
- **Known CVE**: 未報告 / 不明
- **Description**: Unvalidated size parameters passed to allocators cause integer overflow leading to undersized allocations.

### [HIGH] `libavcodec/h264_slice.c:123`
- **Type**: integer_overflow
- **Evidence Level**: Lv.2
- **Specialists**: input_validation (input_validation/run-1)
- **Known CVE**: 未報告 / 不明
- **Description**: Unvalidated size parameters passed to allocators cause integer overflow leading to undersized allocations.

### [HIGH] `libavformat/id3v2.c:199`
- **Type**: denial_of_service
- **Evidence Level**: Lv.2
- **Specialists**: input_validation (input_validation/run-2)
- **Known CVE**: 未報告 / 不明
- **Description**: Negative maxread causes infinite loop in decode_str

### [HIGH] `libavcodec/h264_slice.c:209`
- **Type**: integer_overflow
- **Evidence Level**: Lv.2
- **Specialists**: input_validation (input_validation/run-2)
- **Known CVE**: 未報告 / 不明
- **Description**: Unvalidated h->mb_width and h->mb_height are used to compute b4_array_size and subsequently passed to av_buffer_pool_init. The multiplications are performed in signed 32-bit arithmetic, risking integer overflow before conversion to size_t.

### [HIGH] `libavcodec/vp9.c:107`
- **Type**: integer_overflow
- **Evidence Level**: Lv.2
- **Specialists**: input_validation (input_validation/run-2)
- **Known CVE**: 未報告 / 不明
- **Description**: Unchecked integer overflow in size calculation leads to out-of-bounds pointer arithmetic and heap corruption.

### [HIGH] `libavformat/id3v2.c:144`
- **Type**: out_of_bounds_read
- **Evidence Level**: Lv.2
- **Specialists**: input_validation (input_validation/run-2)
- **Known CVE**: 未報告 / 不明
- **Description**: Missing bounds check before array access in ff_id3v2_match

### [HIGH] `libavformat/id3v2.c:157`
- **Type**: out_of_bounds_read
- **Evidence Level**: Lv.2
- **Specialists**: input_validation (input_validation/run-2)
- **Known CVE**: 未報告 / 不明
- **Description**: Missing bounds check before array access in ff_id3v2_tag_len

### [HIGH] `libavcodec/h264_slice.c:150`
- **Type**: Integer overflow leading to undersized allocation
- **Evidence Level**: Lv.2
- **Specialists**: input_validation (input_validation/run-2)
- **Known CVE**: 未報告 / 不明
- **Description**: Unchecked 32-bit integer arithmetic in `init_table_pools` computes allocation sizes for macroblock and motion vector pools using `h->mb_width`, `h->mb_height`, and `h->mb_stride`. If these values are large, multiplications such as `h->mb_stride * h->mb_height` or `b4_stride * h->mb_height * 4` overflow, wrapping to a small positive integer. The resulting undersized value is passed to `av_buffer_pool_init`, allocating a heap buffer smaller than required. Subsequent slice decoding writes to these pools using indices based on the true dimensions, causing a heap buffer overflow.

### [HIGH] `libavformat/id3v2.c:115`
- **Type**: out-of-bounds read
- **Evidence Level**: Lv.2
- **Specialists**: input_validation (input_validation/run-2)
- **Known CVE**: 未報告 / 不明
- **Description**: ff_id3v2_match accesses buf[0] through buf[9] without verifying the length of the buf pointer. If the caller passes a buffer smaller than 10 bytes, this results in an out-of-bounds read.

### [HIGH] `libavformat/id3v2.c:128`
- **Type**: out-of-bounds read
- **Evidence Level**: Lv.2
- **Specialists**: input_validation (input_validation/run-2)
- **Known CVE**: 未報告 / 不明
- **Description**: ff_id3v2_tag_len accesses buf[5] through buf[9] without prior length validation. Similar to ff_id3v2_match, this can read past the allocated buffer if buf is too short.

### [HIGH] `libavformat/mpeg.c:67`
- **Type**: out_of_bounds_read
- **Evidence Level**: Lv.2
- **Specialists**: input_validation (input_validation/run-3)
- **Known CVE**: 未報告 / 不明
- **Description**: In mpegps_probe, the code unconditionally reads p->buf[i + 1] and p->buf[i + 2] immediately after detecting a start code. If the start code occurs at i == p->buf_size - 1 or i == p->buf_size - 2, these accesses go out of bounds.

### [HIGH] `libavcodec/h264_slice.c:125`
- **Type**: unvalidated_allocation_size
- **Evidence Level**: Lv.2
- **Specialists**: input_validation (input_validation/run-4)
- **Known CVE**: 未報告 / 不明
- **Description**: Unvalidated mb_width used in allocation size calculation in alloc_scratch_buffers.

### [HIGH] `libavcodec/cbs_h265_syntax_template.c:148`
- **Type**: out-of-bounds-access
- **Evidence Level**: Lv.2
- **Specialists**: input_validation (input_validation/run-4)
- **Known CVE**: 未報告 / 不明
- **Description**: Missing bounds check on max_num_sub_layers_minus1 before array indexing

### [HIGH] `libavcodec/h264_slice.c:111`
- **Type**: integer_overflow
- **Evidence Level**: Lv.2
- **Specialists**: integer_overflow (integer_overflow/run-1)
- **Known CVE**: 未報告 / 不明
- **Description**: Arithmetic overflow in allocation size calculation for bipred_scratchpad. The expression '16 * 6 * alloc_size' is evaluated as a signed 32-bit int before being cast to size_t for av_fast_malloc. Large linesize values cause the multiplication to wrap around.

### [HIGH] `libavcodec/h264_slice.c:116`
- **Type**: integer_overflow
- **Evidence Level**: Lv.2
- **Specialists**: integer_overflow (integer_overflow/run-1)
- **Known CVE**: 未報告 / 不明
- **Description**: Arithmetic overflow in allocation size calculation for top_borders. The expression 'h->mb_width * 16 * 3 * sizeof(uint8_t) * 2' is evaluated as a signed 32-bit int. Large mb_width values cause wrap-around before allocation.

### [HIGH] `libavcodec/h264_slice.c:134`
- **Type**: integer_overflow
- **Evidence Level**: Lv.2
- **Specialists**: integer_overflow (integer_overflow/run-1)
- **Known CVE**: 未報告 / 不明
- **Description**: Multiple integer overflows in init_table_pools. Variables like big_mb_num, mb_array_size, b4_stride, and b4_array_size are computed using signed int arithmetic (e.g., h->mb_stride * h->mb_height). These values are then used in further multiplications and passed to av_buffer_pool_init as size_t, causing severe truncation.

### [HIGH] `libavcodec/vp9.c:114`
- **Type**: integer_overflow
- **Evidence Level**: Lv.2
- **Specialists**: integer_overflow (integer_overflow/run-1)
- **Known CVE**: 未報告 / 不明
- **Description**: Integer overflow in frame extradata pool size calculation leads to undersized heap allocation and subsequent buffer overflow.

### [HIGH] `libavcodec/h264_slice.c:101`
- **Type**: Integer Overflow in Allocation Size Calculation
- **Evidence Level**: Lv.2
- **Specialists**: integer_overflow (integer_overflow/run-2)
- **Known CVE**: 未報告 / 不明
- **Description**: The multiplication `16 * 6 * alloc_size` is performed using 32-bit signed integers. If `alloc_size` exceeds ~21 million, the result wraps around, yielding a small positive value that is passed to `av_fast_malloc`.

### [HIGH] `libavcodec/h264_slice.c:107`
- **Type**: Integer Overflow in Allocation Size Calculation
- **Evidence Level**: Lv.2
- **Specialists**: integer_overflow (integer_overflow/run-2)
- **Known CVE**: 未報告 / 不明
- **Description**: The calculation `h->mb_width * 16 * 3 * sizeof(uint8_t) * 2` is evaluated as a 32-bit signed integer. If `h->mb_width` exceeds ~21 million, the multiplication wraps around before being passed to `av_fast_mallocz`.

### [HIGH] `libavcodec/h264_slice.c:135`
- **Type**: Integer Overflow in Allocation Size Calculation
- **Evidence Level**: Lv.2
- **Specialists**: integer_overflow (integer_overflow/run-2)
- **Known CVE**: 未報告 / 不明
- **Description**: The allocation size for `mb_type_pool` is computed as `(big_mb_num + h->mb_stride) * sizeof(uint32_t)`. This 32-bit signed multiplication can overflow even with moderately large wrapped values, passing a small size to `av_buffer_pool_init`.

### [HIGH] `libavcodec/h264_slice.c:104`
- **Type**: Integer Overflow in Allocation Size Calculation
- **Evidence Level**: Lv.2
- **Specialists**: integer_overflow (integer_overflow/run-2)
- **Known CVE**: 未報告 / 不明
- **Description**: The expression `alloc_size * 2 * 21` uses 32-bit signed integer arithmetic. Overflow occurs if `alloc_size` > ~48 million, leading to an undersized allocation for `sl->edge_emu_buffer`.

### [HIGH] `libavcodec/h264_slice.c:128`
- **Type**: Integer Overflow in Allocation Size Calculation
- **Evidence Level**: Lv.2
- **Specialists**: integer_overflow (integer_overflow/run-2)
- **Known CVE**: 未報告 / 不明
- **Description**: Multiple intermediate calculations in `init_table_pools` use 32-bit signed integers: `h->mb_stride * (h->mb_height + 1)`, `h->mb_stride * h->mb_height`, `h->mb_width * 4`, and `b4_stride * h->mb_height * 4`. All can wrap around with large macroblock dimensions parsed from the bitstream.

### [HIGH] `libavcodec/h264_slice.c:178`
- **Type**: integer_overflow
- **Evidence Level**: Lv.2
- **Specialists**: integer_overflow (integer_overflow/run-2)
- **Known CVE**: 未報告 / 不明
- **Description**: Arithmetic overflow in allocation size calculation within init_table_pools. Intermediate variables (big_mb_num, mb_array_size, b4_array_size) are declared as int and computed via multiplication of macroblock dimensions. For large or malformed dimensions, these 32-bit signed multiplications wrap around. The wrapped values are subsequently used to calculate allocation sizes for av_buffer_pool_init, resulting in severely undersized heap allocations.

### [HIGH] `libavcodec/h264_slice.c:174`
- **Type**: integer_overflow
- **Evidence Level**: Lv.2
- **Specialists**: integer_overflow (integer_overflow/run-3)
- **Known CVE**: 未報告 / 不明
- **Description**: Expression `2 * (b4_array_size + 4) * sizeof(int16_t)` is computed as a 32-bit signed integer. Overflow leads to undersized motion value pool allocation.

### [HIGH] `libavcodec/h264_slice.c:166`
- **Type**: integer_overflow
- **Evidence Level**: Lv.2
- **Specialists**: integer_overflow (integer_overflow/run-3)
- **Known CVE**: 未報告 / 不明
- **Description**: Expression `h->mb_stride * h->mb_height` is computed as a 32-bit signed integer. Overflow leads to incorrect `mb_array_size` calculation.

### [HIGH] `libavcodec/h264_slice.c:167`
- **Type**: integer_overflow
- **Evidence Level**: Lv.2
- **Specialists**: integer_overflow (integer_overflow/run-3)
- **Known CVE**: 未報告 / 不明
- **Description**: Expression `h->mb_width * 4 + 1` is computed as a 32-bit signed integer. Overflow occurs if `mb_width` > 536,870,911.

### [HIGH] `libavcodec/h264_slice.c:172`
- **Type**: integer_overflow
- **Evidence Level**: Lv.2
- **Specialists**: integer_overflow (integer_overflow/run-3)
- **Known CVE**: 未報告 / 不明
- **Description**: Expression `(big_mb_num + h->mb_stride) * sizeof(uint32_t)` is computed as a 32-bit signed integer. Overflow causes undersized allocation for the MB type pool.

### [HIGH] `libavcodec/vp9.c:115`
- **Type**: Integer Overflow
- **Evidence Level**: Lv.2
- **Specialists**: integer_overflow (integer_overflow/run-4)
- **Known CVE**: 未報告 / 不明
- **Description**: The expression `64 * s->sb_cols * s->sb_rows` is evaluated using 32-bit signed integer arithmetic. When `s->sb_cols` and `s->sb_rows` are large (derived from crafted width/height values in the VP9 bitstream), the multiplication wraps around, producing a truncated or negative `sz`. This incorrect size is passed to `av_buffer_pool_init` and later used for pointer arithmetic (`f->extradata->data + sz`), leading to an undersized heap allocation followed by out-of-bounds writes.

### [HIGH] `libavcodec/h264_slice.c:147`
- **Type**: integer_overflow
- **Evidence Level**: Lv.2
- **Specialists**: integer_overflow (integer_overflow/run-4, integer_overflow/run-5)
- **Known CVE**: 未報告 / 不明
- **Description**: Arithmetic overflow in allocation size calculation passed to av_buffer_pool_init

### [HIGH] `libavcodec/h264_slice.c:120`
- **Type**: integer_overflow
- **Evidence Level**: Lv.2
- **Specialists**: integer_overflow (integer_overflow/run-4)
- **Known CVE**: 未報告 / 不明
- **Description**: Arithmetic overflow in allocation size calculation passed to av_fast_malloc

### [HIGH] `libavcodec/h264_slice.c:182`
- **Type**: integer_overflow
- **Evidence Level**: Lv.2
- **Specialists**: integer_overflow (integer_overflow/run-4)
- **Known CVE**: 未報告 / 不明
- **Description**: 32-bit signed integer overflow in motion value array size calculation

### [HIGH] `libavcodec/h264_slice.c:173`
- **Type**: integer_overflow
- **Evidence Level**: Lv.2
- **Specialists**: integer_overflow (integer_overflow/run-4)
- **Known CVE**: 未報告 / 不明
- **Description**: 32-bit signed integer overflow in macroblock grid dimension calculations

### [HIGH] `libavcodec/mpeg4videodec.c:158`
- **Type**: Integer Overflow in Array Indexing
- **Evidence Level**: Lv.2
- **Specialists**: integer_overflow (integer_overflow/run-5)
- **Known CVE**: 未報告 / 不明
- **Description**: The calculation `s->block_index[n] * 16` uses signed 32-bit integers. If `block_index` exceeds ~134 million, the multiplication overflows. The result is used as an offset for pointer arithmetic into the `ac_val` array, pointing to invalid memory locations.

### [HIGH] `libavcodec/mpeg4videodec.c:163`
- **Type**: Integer Overflow in Array Indexing
- **Evidence Level**: Lv.2
- **Specialists**: integer_overflow (integer_overflow/run-5)
- **Known CVE**: 未報告 / 不明
- **Description**: The expression `s->mb_y * s->mb_stride` performs signed 32-bit multiplication. If macroblock coordinates or stride are manipulated to be large, the multiplication overflows. The resulting `xy` is used as an index into `qscale_table`, leading to out-of-bounds array access.

### [HIGH] `libavcodec/h264_slice.c:115`
- **Type**: integer_overflow
- **Evidence Level**: Lv.2
- **Specialists**: integer_overflow (integer_overflow/run-5)
- **Known CVE**: 未報告 / 不明
- **Description**: Allocation size calculations in alloc_scratch_buffers are performed using signed 32-bit integers before implicit conversion to size_t. The expressions '16 * 6 * alloc_size', 'alloc_size * 2 * 21', and 'h->mb_width * 16 * 3 * sizeof(uint8_t) * 2' can wrap around if linesize or mb_width are large.

### [HIGH] `libavcodec/mpeg4videodec.c:114`
- **Type**: buffer_underflow
- **Evidence Level**: Lv.2
- **Specialists**: integer_overflow (integer_overflow/run-5)
- **Known CVE**: 未報告 / 不明
- **Description**: Uncapped `uvlinesize` can be negative, causing `dct_offset` to become negative. This negative offset is added to base pointers (`dest_cb`, `dest_cr`) without bounds validation, resulting in out-of-bounds memory access.

### [HIGH] `libavcodec/mpeg4videodec.c:83`
- **Type**: pointer_underflow
- **Evidence Level**: Lv.2
- **Specialists**: integer_overflow (integer_overflow/run-5)
- **Known CVE**: 未報告 / 不明
- **Description**: Negative uvlinesize causes dct_offset to become negative, leading to pointer underflow in idct_put calls.

### [HIGH] `libavcodec/h264_slice.c:118`
- **Type**: integer_overflow
- **Evidence Level**: Lv.1
- **Specialists**: memory_safety (memory_safety/run-5)
- **Known CVE**: 未報告 / 不明
- **Description**: Integer overflow in scratch buffer allocation size calculation

### [HIGH] `libavcodec/h264_slice.c:136`
- **Type**: integer_overflow
- **Evidence Level**: Lv.1
- **Specialists**: integer_overflow (integer_overflow/run-3)
- **Known CVE**: 未報告 / 不明
- **Description**: Multiplication `16 * 6 * alloc_size` is evaluated as a 32-bit signed integer. If `alloc_size` exceeds ~21 million, the result wraps around, causing an undersized allocation passed to `av_fast_malloc`.

### [HIGH] `libavcodec/h264_slice.c:176`
- **Type**: integer_overflow
- **Evidence Level**: Lv.1
- **Specialists**: integer_overflow (integer_overflow/run-3)
- **Known CVE**: 未報告 / 不明
- **Description**: Expression `4 * mb_array_size` is computed as a 32-bit signed integer. Overflow causes undersized allocation for the reference index pool.

### [MEDIUM] 🔴×2 `libavcodec/h264_slice.c:142`
- **Type**: NULL pointer dereference
- **Evidence Level**: Lv.2
- **Specialists**: integer_overflow, memory_safety (integer_overflow/run-3, memory_safety/run-1, memory_safety/run-5)
- **Known CVE**: 未報告 / 不明
- **Description**: In release_unused_pictures, the code dereferences h->DPB[i].f without checking for NULL. Unused DPB slots have f set to NULL, causing a crash when accessing buf[0].

### [MEDIUM] 🔴×2 `libavcodec/h264_slice.c:168`
- **Type**: missing_null_check
- **Evidence Level**: Lv.2
- **Specialists**: input_validation, integer_overflow (input_validation/run-5, integer_overflow/run-3)
- **Known CVE**: 未報告 / 不明
- **Description**: Inside alloc_picture, pic->f_grain is dereferenced to assign format, width, and height without verifying it is non-NULL. If pic->needs_fg is true but pic->f_grain was not previously allocated, this results in a NULL pointer dereference.

### [MEDIUM] `libavformat/mov.c:208`
- **Type**: integer_overflow
- **Evidence Level**: Lv.2
- **Specialists**: memory_safety (memory_safety/run-1)
- **Known CVE**: CVE-2016-3062, CVE-2025-1373, CVE-2025-25471
- **Description**: Unsigned integer underflow in length calculation bypasses bounds checks

### [MEDIUM] `libavformat/mov.c:92`
- **Type**: out-of-bounds_read
- **Evidence Level**: Lv.2
- **Specialists**: memory_safety (memory_safety/run-4)
- **Known CVE**: CVE-2016-3062, CVE-2025-1373, CVE-2025-25471
- **Description**: Function reads 4 bytes unconditionally from the AVIOContext without verifying that the atom length (len) is at least 4.

### [MEDIUM] `libavformat/mov.c:173`
- **Type**: memory_leak
- **Evidence Level**: Lv.2
- **Specialists**: memory_safety (memory_safety/run-4)
- **Known CVE**: CVE-2016-3062, CVE-2025-1373, CVE-2025-25471
- **Description**: Overwrites st->priv_data with a newly allocated MOVStreamContext without freeing the previously assigned pointer.

### [MEDIUM] `libavformat/mov.c:268`
- **Type**: integer-overflow
- **Evidence Level**: Lv.2
- **Specialists**: memory_safety (memory_safety/run-5)
- **Known CVE**: CVE-2016-3062, CVE-2025-1373, CVE-2025-25471
- **Description**: Unsigned integer underflow due to type mismatch with avio_get_str return value

### [MEDIUM] `libavformat/mov.c:122`
- **Type**: missing_bounds_check
- **Evidence Level**: Lv.2
- **Specialists**: input_validation (input_validation/run-1, input_validation/run-2)
- **Known CVE**: CVE-2016-3062, CVE-2025-1373, CVE-2025-25471
- **Description**: The function unconditionally reads 4 bytes from the stream without validating the atom payload length (len) against the required minimum size.

### [MEDIUM] `libavformat/mov.c:101`
- **Type**: out_of_bounds_read
- **Evidence Level**: Lv.2
- **Specialists**: input_validation (input_validation/run-2)
- **Known CVE**: CVE-2016-3062, CVE-2025-1373, CVE-2025-25471
- **Description**: Missing bounds check on atom payload size (`len`) before reading data. The function unconditionally calls `avio_r8(pb)` without verifying that `len` is greater than zero. If a crafted MOV file contains a metadata atom with a declared size of 0, the read operation will step past the atom's payload boundary, resulting in an out-of-bounds read.

### [MEDIUM] `libavformat/mov.c:99`
- **Type**: Missing Bounds Check / Out-of-bounds Read
- **Evidence Level**: Lv.2
- **Specialists**: input_validation (input_validation/run-3, input_validation/run-4)
- **Known CVE**: CVE-2016-3062, CVE-2025-1373, CVE-2025-25471
- **Description**: mov_metadata_int8_no_padding reads 1 byte from pb without verifying len >= 1. Similar to above, allows reading past the atom boundary if len is 0.

### [MEDIUM] `libavcodec/hevcdec.c:144`
- **Type**: out_of_bounds_write
- **Evidence Level**: Lv.2
- **Specialists**: input_validation (input_validation/run-4)
- **Known CVE**: CVE-2019-11338, CVE-2024-32228
- **Description**: Missing bounds check on s->sh.nb_refs[L0] before accessing fixed-size stack array luma_weight_l0_flag[16] in pred_weight_table.

### [MEDIUM] `libavcodec/hevcdec.c:65`
- **Type**: signed_integer_overflow
- **Evidence Level**: Lv.2
- **Specialists**: integer_overflow (integer_overflow/run-3)
- **Known CVE**: CVE-2019-11338, CVE-2024-32228
- **Description**: The calculation of pic_size_in_ctb uses signed 32-bit integers for width, height, and log2_min_cb_size. If log2_min_cb_size is malformed (e.g., 0 or 1) or dimensions are unclamped, the multiplication can overflow INT_MAX, triggering undefined behavior before av_malloc_array validation.

### [MEDIUM] `libavformat/mov.c:229`
- **Type**: signed_to_unsigned_conversion
- **Evidence Level**: Lv.2
- **Specialists**: integer_overflow (integer_overflow/run-4)
- **Known CVE**: CVE-2016-3062, CVE-2025-1373, CVE-2025-25471
- **Description**: The `len` parameter is declared as `unsigned`, but `avio_get_str()` returns a signed `int` that can be negative on error. Subtracting a negative return value from `len` causes an unsigned integer wraparound to a large positive value, bypassing subsequent length validation checks.

### [MEDIUM] `libavformat/mov.c:119`
- **Type**: out-of-bounds-read
- **Evidence Level**: Lv.1
- **Specialists**: memory_safety (memory_safety/run-3)
- **Known CVE**: CVE-2016-3062, CVE-2025-1373, CVE-2025-25471
- **Description**: The function reads 4 bytes unconditionally without verifying that the atom length (`len`) is at least 4. If a crafted MOV file contains a metadata atom shorter than 4 bytes, the parser will read past the atom boundary into subsequent data, potentially causing desynchronization or reading sensitive memory if the stream buffer is tightly packed.

### [MEDIUM] `libavformat/mov.c:142`
- **Type**: out-of-bounds-write
- **Evidence Level**: Lv.1
- **Specialists**: memory_safety (memory_safety/run-3)
- **Known CVE**: CVE-2016-3062, CVE-2025-1373, CVE-2025-25471
- **Description**: The pointer calculation `char *end = dst+dstlen-1;` underflows when `dstlen` is 0. This results in `end` pointing before the start of the destination buffer. Although the loop checks `p >= end`, the subsequent null-termination `*p = 0;` on line 154 writes to `dst` regardless, and the underflowed `end` pointer can cause undefined behavior or incorrect bounds checking in edge cases.

### [MEDIUM] `libavformat/id3v2.c:138`
- **Type**: out-of-bounds read
- **Evidence Level**: Lv.2
- **Specialists**: memory_safety (memory_safety/run-3)
- **Known CVE**: 未報告 / 不明
- **Description**: The check_tag function declares a fixed-size 4-byte stack buffer 'tag[4]'. It reads 'len' bytes into this buffer, where 'len' is validated to be <= 4. However, when 'len' is less than 4, the remaining bytes in 'tag' remain uninitialized. The subsequent macro AV_RB32(tag) unconditionally reads exactly 4 bytes from 'tag', resulting in an out-of-bounds read of uninitialized stack memory.

### [MEDIUM] `libavformat/id3v2.c:172`
- **Type**: uninitialized memory read
- **Evidence Level**: Lv.2
- **Specialists**: input_validation (input_validation/run-2)
- **Known CVE**: 未報告 / 不明
- **Description**: In check_tag, AV_RB32(tag) is called on line 172 to read 4 bytes from tag, but tag is only populated with len bytes via avio_read on line 170. When len is less than 4, the remaining bytes in tag are uninitialized stack memory.

### [MEDIUM] `libavformat/mpeg.c:69`
- **Type**: out_of_bounds_read
- **Evidence Level**: Lv.2
- **Specialists**: input_validation (input_validation/run-3)
- **Known CVE**: 未報告 / 不明
- **Description**: check_pack_header is called with p->buf + i without ensuring that at least 2 bytes are available. If i == p->buf_size - 1, accessing buf[1] is out of bounds.

### [MEDIUM] `libavcodec/cbs_h265_syntax_template.c:80`
- **Type**: integer-overflow
- **Evidence Level**: Lv.2
- **Specialists**: input_validation (input_validation/run-4)
- **Known CVE**: 未報告 / 不明
- **Description**: Missing upper bound validation on current->bit_length before allocation

### [MEDIUM] `libavcodec/mpeg4videodec.c:178`
- **Type**: Integer Overflow in Pointer Arithmetic
- **Evidence Level**: Lv.2
- **Specialists**: integer_overflow (integer_overflow/run-5)
- **Known CVE**: 未報告 / 不明
- **Description**: The multiplication `16 * s->block_wrap[n]` can overflow a 32-bit signed integer. The result is subtracted from `ac_val`, causing pointer wrap-around. This misaligns the AC prediction source pointer, leading to out-of-bounds reads during the prediction loop.

### [MEDIUM] `libavcodec/h264_slice.c:105`
- **Type**: null_pointer_dereference
- **Evidence Level**: Lv.1
- **Specialists**: memory_safety (memory_safety/run-2)
- **Known CVE**: 未報告 / 不明
- **Description**: Unchecked pointer dereference of h->DPB[i].f in release_unused_pictures

### [MEDIUM] `libavcodec/vp9.c:118`
- **Type**: integer_overflow
- **Evidence Level**: Lv.1
- **Specialists**: memory_safety (memory_safety/run-2)
- **Known CVE**: 未報告 / 不明
- **Description**: The size calculation for the extradata pool in vp9_frame_alloc uses signed 32-bit integer arithmetic (sz = 64 * s->sb_cols * s->sb_rows). For sufficiently large frame dimensions, this multiplication can overflow, resulting in a negative or wrapped size passed to av_buffer_pool_init.

### [MEDIUM] `libavcodec/vp9.c:138`
- **Type**: use_after_free
- **Evidence Level**: Lv.1
- **Specialists**: memory_safety (memory_safety/run-2)
- **Known CVE**: 未報告 / 不明
- **Description**: In vp9_frame_ref, if av_buffer_ref fails and execution jumps to the fail label, dst->segmentation_map and dst->mv are not cleared. These pointers retain references to src's buffers, which may be freed or modified independently.

### [MEDIUM] `libavformat/id3v2.c:136`
- **Type**: uninitialized memory read
- **Evidence Level**: Lv.1
- **Specialists**: memory_safety (memory_safety/run-3)
- **Known CVE**: 未報告 / 不明
- **Description**: AV_RB32(tag) reads 4 bytes from the tag buffer, but avio_read only populates len bytes. When len < 4, the remaining bytes in tag are uninitialized stack memory. This results in reading uninitialized data.

### [MEDIUM] `libavcodec/h264_cabac.c:28`
- **Type**: missing bounds check
- **Evidence Level**: Lv.1
- **Specialists**: memory_safety (memory_safety/run-5)
- **Known CVE**: 未報告 / 不明
- **Description**: Disabling bitstream reader bounds checks via macro

### [MEDIUM] `libavformat/id3v2.c:223`
- **Type**: null_pointer_dereference
- **Evidence Level**: Lv.1
- **Specialists**: input_validation (input_validation/run-2)
- **Known CVE**: 未報告 / 不明
- **Description**: Missing NULL check before pointer dereference in free_geobtag

### [MEDIUM] `libavformat/id3v2.c:170`
- **Type**: infinite_loop
- **Evidence Level**: Lv.1
- **Specialists**: input_validation (input_validation/run-2)
- **Known CVE**: 未報告 / 不明
- **Description**: Unchecked negative index/loop counter in get_size

### [MEDIUM] `libavcodec/h264_slice.c:124`
- **Type**: unvalidated_size_parameter
- **Evidence Level**: Lv.1
- **Specialists**: input_validation (input_validation/run-5)
- **Known CVE**: 未報告 / 不明
- **Description**: In alloc_scratch_buffers, alloc_size is derived from linesize, and subsequent calculations (16 * 6 * alloc_size, alloc_size * 2 * 21, h->mb_width * 16 * 3 * sizeof(uint8_t) * 2) can overflow if linesize or h->mb_width are maliciously large. Although av_fast_malloc checks for NULL, the overflow itself indicates a lack of input validation on size parameters.

### [MEDIUM] `libavcodec/mpeg4videodec.c:93`
- **Type**: Integer Overflow in Pointer Arithmetic
- **Evidence Level**: Lv.1
- **Specialists**: integer_overflow (integer_overflow/run-5)
- **Known CVE**: 未報告 / 不明
- **Description**: The expression `block_size * 2` uses signed 32-bit integers. If `block_size` exceeds 1,073,741,823, the multiplication overflows, wrapping to a negative value. This value is used as an offset in subsequent pointer arithmetic, causing the pointer to wrap backwards in memory.

### [MEDIUM] `libavcodec/mjpegdec.c:154`
- **Type**: integer_overflow
- **Evidence Level**: Lv.1
- **Specialists**: integer_overflow (integer_overflow/run-5)
- **Known CVE**: 未報告 / 不明
- **Description**: Multiplication of avctx->extradata_size by 8 can overflow a signed 32-bit integer if extradata_size exceeds 0x1FFFFFFF, resulting in a negative or truncated bit count passed to init_get_bits.

### [LOW] `libavformat/mov.c:118`
- **Type**: out_of_bounds_read
- **Evidence Level**: Lv.1
- **Specialists**: memory_safety (memory_safety/run-1)
- **Known CVE**: CVE-2016-3062, CVE-2025-1373, CVE-2025-25471
- **Description**: Missing length validation before reading metadata bytes

### [LOW] `libavformat/mov.c:124`
- **Type**: missing_bounds_check
- **Evidence Level**: Lv.1
- **Specialists**: input_validation (input_validation/run-3)
- **Known CVE**: CVE-2016-3062, CVE-2025-1373, CVE-2025-25471
- **Description**: Reads four bytes unconditionally without verifying len >= 4.
