# SourceHunt — Combined Vulnerability Report

- **Target**: `libavformat/mov.c` @ `ced0dc807eb67516b341d68f04ce5a87b02820de`
- **Verdict**: **PARTIAL** (2/5 runs detected)
- **Unique findings**: 57
- **Severity**: High: 52 / Medium: 5
- **Repository CVE (OSV.dev)**: 71 件登録 / 18 件発見 (CVE-2016-2326, CVE-2016-3062, CVE-2017-14169, CVE-2017-14223, CVE-2017-15672 他 66 件)

## Findings

### [HIGH] `libavcodec/h264_slice.c:111`
- **Type**: integer_overflow
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run1)
- **Known CVE**: 未報告 / 不明
- **Description**: Arithmetic overflow in allocation size calculation for bipred_scratchpad. The expression '16 * 6 * alloc_size' is evaluated as a signed 32-bit int before being cast to size_t for av_fast_malloc. Large linesize values cause the multiplication to wrap around.

### [HIGH] `libavcodec/h264_slice.c:114`
- **Type**: integer_overflow
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run1)
- **Known CVE**: 未報告 / 不明
- **Description**: Arithmetic overflow in allocation size calculation for edge_emu_buffer. The expression 'alloc_size * 2 * 21' is evaluated as a signed 32-bit int before being passed to av_fast_malloc.

### [HIGH] `libavcodec/h264_slice.c:116`
- **Type**: integer_overflow
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run1)
- **Known CVE**: 未報告 / 不明
- **Description**: Arithmetic overflow in allocation size calculation for top_borders. The expression 'h->mb_width * 16 * 3 * sizeof(uint8_t) * 2' is evaluated as a signed 32-bit int. Large mb_width values cause wrap-around before allocation.

### [HIGH] `libavcodec/h264_slice.c:134`
- **Type**: integer_overflow
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run1)
- **Known CVE**: 未報告 / 不明
- **Description**: Multiple integer overflows in init_table_pools. Variables like big_mb_num, mb_array_size, b4_stride, and b4_array_size are computed using signed int arithmetic (e.g., h->mb_stride * h->mb_height). These values are then used in further multiplications and passed to av_buffer_pool_init as size_t, causing severe truncation.

### [HIGH] `libavcodec/hevcdec.c:69`
- **Type**: integer_overflow
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run1)
- **Known CVE**: CVE-2019-11338, CVE-2024-32228
- **Description**: Arithmetic overflow in manual allocation size calculation for pic_size_in_ctb

### [HIGH] `libavcodec/vp9.c:114`
- **Type**: integer_overflow
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run1)
- **Known CVE**: 未報告 / 不明
- **Description**: Integer overflow in frame extradata pool size calculation leads to undersized heap allocation and subsequent buffer overflow.

### [HIGH] `libavcodec/hevcdec.c:103`
- **Type**: integer_overflow
- **Evidence Level**: Lv.2
- **Reproducibility**: 2/5 runs (Run1, Run5)
- **Known CVE**: CVE-2019-11338, CVE-2024-32228
- **Description**: Signed integer overflow in frame dimension and block count calculations used for memory allocation and indexing.

### [HIGH] `libavcodec/hevcdec.c:71`
- **Type**: integer_overflow
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run1)
- **Known CVE**: CVE-2019-11338, CVE-2024-32228
- **Description**: Arithmetic overflow in manual allocation size calculation for ctb_count

### [HIGH] `libavcodec/hevcdec.c:90`
- **Type**: integer_overflow
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run2)
- **Known CVE**: CVE-2019-11338, CVE-2024-32228
- **Description**: Integer overflow in pic_size_in_ctb calculation

### [HIGH] `libavcodec/hevcdec.c:92`
- **Type**: integer_overflow
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run2)
- **Known CVE**: CVE-2019-11338, CVE-2024-32228
- **Description**: Integer overflow in ctb_count calculation

### [HIGH] `libavcodec/h264_slice.c:101`
- **Type**: Integer Overflow in Allocation Size Calculation
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run2)
- **Known CVE**: 未報告 / 不明
- **Description**: The multiplication `16 * 6 * alloc_size` is performed using 32-bit signed integers. If `alloc_size` exceeds ~21 million, the result wraps around, yielding a small positive value that is passed to `av_fast_malloc`.

### [HIGH] `libavcodec/h264_slice.c:107`
- **Type**: Integer Overflow in Allocation Size Calculation
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run2)
- **Known CVE**: 未報告 / 不明
- **Description**: The calculation `h->mb_width * 16 * 3 * sizeof(uint8_t) * 2` is evaluated as a 32-bit signed integer. If `h->mb_width` exceeds ~21 million, the multiplication wraps around before being passed to `av_fast_mallocz`.

### [HIGH] `libavcodec/h264_slice.c:135`
- **Type**: Integer Overflow in Allocation Size Calculation
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run2)
- **Known CVE**: 未報告 / 不明
- **Description**: The allocation size for `mb_type_pool` is computed as `(big_mb_num + h->mb_stride) * sizeof(uint32_t)`. This 32-bit signed multiplication can overflow even with moderately large wrapped values, passing a small size to `av_buffer_pool_init`.

### [HIGH] `libavcodec/h264_slice.c:139`
- **Type**: Integer Overflow in Allocation Size Calculation
- **Evidence Level**: Lv.2
- **Reproducibility**: 2/5 runs (Run2, Run3)
- **Known CVE**: 未報告 / 不明
- **Description**: The allocation size for `ref_index_pool` is computed as `4 * mb_array_size`. This 32-bit signed multiplication overflows with large `mb_array_size`, passing a wrapped small value to `av_buffer_pool_init`.

### [HIGH] `libavcodec/hevcdec.c:93`
- **Type**: integer_overflow
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run2)
- **Known CVE**: CVE-2019-11338, CVE-2024-32228
- **Description**: Integer overflow in min_pu_size calculation

### [HIGH] `libavcodec/h264_slice.c:104`
- **Type**: Integer Overflow in Allocation Size Calculation
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run2)
- **Known CVE**: 未報告 / 不明
- **Description**: The expression `alloc_size * 2 * 21` uses 32-bit signed integer arithmetic. Overflow occurs if `alloc_size` > ~48 million, leading to an undersized allocation for `sl->edge_emu_buffer`.

### [HIGH] `libavcodec/h264_slice.c:128`
- **Type**: Integer Overflow in Allocation Size Calculation
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run2)
- **Known CVE**: 未報告 / 不明
- **Description**: Multiple intermediate calculations in `init_table_pools` use 32-bit signed integers: `h->mb_stride * (h->mb_height + 1)`, `h->mb_stride * h->mb_height`, `h->mb_width * 4`, and `b4_stride * h->mb_height * 4`. All can wrap around with large macroblock dimensions parsed from the bitstream.

### [HIGH] `libavcodec/h264_slice.c:178`
- **Type**: integer_overflow
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run2)
- **Known CVE**: 未報告 / 不明
- **Description**: Arithmetic overflow in allocation size calculation within init_table_pools. Intermediate variables (big_mb_num, mb_array_size, b4_array_size) are declared as int and computed via multiplication of macroblock dimensions. For large or malformed dimensions, these 32-bit signed multiplications wrap around. The wrapped values are subsequently used to calculate allocation sizes for av_buffer_pool_init, resulting in severely undersized heap allocations.

### [HIGH] `libavformat/mov.c:192`
- **Type**: integer_overflow
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run2)
- **Known CVE**: CVE-2016-3062, CVE-2025-1373, CVE-2025-25471
- **Description**: The `dstlen` parameter is used to compute `end = dst + dstlen - 1`, which acts as the write boundary. If `dstlen` is a large positive integer (e.g., derived from an untrusted atom size), pointer arithmetic yields a pointer `end` significantly beyond the actual `dst` buffer. The subsequent `p < end` check remains true, allowing `p` to advance and write past the allocated memory, causing a heap/stack buffer overflow.

### [HIGH] `libavcodec/hevcdec.c:143`
- **Type**: integer_overflow
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run2)
- **Known CVE**: CVE-2019-11338, CVE-2024-32228
- **Description**: In pic_arrays_init, min_pu_size is declared as int and computed from unchecked SPS fields. When passed to av_buffer_pool_init on line 143, it is multiplied by sizeof(MvField) (size_t). C's usual arithmetic conversions promote the int operand to size_t before evaluation. Malformed inputs can cause min_pu_size to be negative or excessively large, causing the product to wrap around SIZE_MAX (especially on 32-bit systems) to a small value. av_buffer_pool_init may succeed with an undersized pool, leading to heap buffer overflows during subsequent PU decoding.

### [HIGH] `libavcodec/hevcdec.c:108`
- **Type**: integer_overflow
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run2)
- **Known CVE**: CVE-2019-11338, CVE-2024-32228
- **Description**: The calculation of `pic_size_in_ctb` performs multiplication in 32-bit signed `int` arithmetic. If `width` and `height` are large and `log2_min_cb_size` is small, the product can exceed `INT_MAX`, causing signed integer overflow. The resulting wrapped value is passed to `av_malloc_array` as the element count, potentially leading to an undersized heap allocation and subsequent buffer overflow during CTB data population.

### [HIGH] `libavcodec/h264_slice.c:142`
- **Type**: integer_overflow
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run3)
- **Known CVE**: 未報告 / 不明
- **Description**: Expression `h->mb_width * 16 * 3 * sizeof(uint8_t) * 2` is computed as a 32-bit signed integer. If `mb_width` exceeds ~21 million, the allocation size calculation overflows and wraps to a small value.

### [HIGH] `libavcodec/h264_slice.c:165`
- **Type**: integer_overflow
- **Evidence Level**: Lv.2
- **Reproducibility**: 2/5 runs (Run3, Run4)
- **Known CVE**: 未報告 / 不明
- **Description**: Expression `h->mb_stride * (h->mb_height + 1) + 1` is computed as a 32-bit signed integer. Overflow occurs if macroblock dimensions are large, corrupting `big_mb_num`.

### [HIGH] `libavcodec/h264_slice.c:168`
- **Type**: integer_overflow
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run3)
- **Known CVE**: 未報告 / 不明
- **Description**: Expression `b4_stride * h->mb_height * 4` is computed as a 32-bit signed integer. Overflow results in a drastically reduced allocation size for motion value pools.

### [HIGH] `libavcodec/h264_slice.c:174`
- **Type**: integer_overflow
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run3)
- **Known CVE**: 未報告 / 不明
- **Description**: Expression `2 * (b4_array_size + 4) * sizeof(int16_t)` is computed as a 32-bit signed integer. Overflow leads to undersized motion value pool allocation.

### [HIGH] `libavcodec/h264_slice.c:166`
- **Type**: integer_overflow
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run3)
- **Known CVE**: 未報告 / 不明
- **Description**: Expression `h->mb_stride * h->mb_height` is computed as a 32-bit signed integer. Overflow leads to incorrect `mb_array_size` calculation.

### [HIGH] `libavcodec/h264_slice.c:167`
- **Type**: integer_overflow
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run3)
- **Known CVE**: 未報告 / 不明
- **Description**: Expression `h->mb_width * 4 + 1` is computed as a 32-bit signed integer. Overflow occurs if `mb_width` > 536,870,911.

### [HIGH] `libavcodec/h264_slice.c:172`
- **Type**: integer_overflow
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run3)
- **Known CVE**: 未報告 / 不明
- **Description**: Expression `(big_mb_num + h->mb_stride) * sizeof(uint32_t)` is computed as a 32-bit signed integer. Overflow causes undersized allocation for the MB type pool.

### [HIGH] `libavcodec/h264_slice.c:146`
- **Type**: integer_overflow
- **Evidence Level**: Lv.2
- **Reproducibility**: 2/5 runs (Run3, Run4)
- **Known CVE**: 未報告 / 不明
- **Description**: 32-bit signed integer overflow in motion vector table pool allocation size calculation due to unchecked multiplication of macroblock dimensions and block factors.

### [HIGH] `libavcodec/vp9.c:116`
- **Type**: integer_overflow
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run3)
- **Known CVE**: 未報告 / 不明
- **Description**: Unchecked multiplication of frame superblock dimensions causes 32-bit integer overflow, leading to undersized heap allocation and subsequent out-of-bounds memory access.

### [HIGH] `libavcodec/vp9.c:115`
- **Type**: Integer Overflow
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run4)
- **Known CVE**: 未報告 / 不明
- **Description**: The expression `64 * s->sb_cols * s->sb_rows` is evaluated using 32-bit signed integer arithmetic. When `s->sb_cols` and `s->sb_rows` are large (derived from crafted width/height values in the VP9 bitstream), the multiplication wraps around, producing a truncated or negative `sz`. This incorrect size is passed to `av_buffer_pool_init` and later used for pointer arithmetic (`f->extradata->data + sz`), leading to an undersized heap allocation followed by out-of-bounds writes.

### [HIGH] `libavcodec/hevcdec.c:104`
- **Type**: integer_overflow
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run4)
- **Known CVE**: CVE-2019-11338, CVE-2024-32228
- **Description**: Unchecked signed 32-bit integer multiplication for allocation size calculations. pic_size_in_ctb is computed by multiplying frame dimensions (width, height) without overflow checks. If crafted SPS values cause the intermediate product to exceed INT_MAX, it wraps to a negative value. This negative value is then implicitly cast to size_t when passed to av_malloc_array, potentially resulting in massive allocation requests or incorrect buffer sizing.

### [HIGH] `libavcodec/h264_slice.c:145`
- **Type**: integer_overflow
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run4)
- **Known CVE**: 未報告 / 不明
- **Description**: Arithmetic overflow in allocation size calculation passed to av_buffer_pool_init

### [HIGH] `libavcodec/h264_slice.c:147`
- **Type**: integer_overflow
- **Evidence Level**: Lv.2
- **Reproducibility**: 2/5 runs (Run4, Run5)
- **Known CVE**: 未報告 / 不明
- **Description**: Arithmetic overflow in allocation size calculation passed to av_buffer_pool_init

### [HIGH] `libavcodec/h264_slice.c:120`
- **Type**: integer_overflow
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run4)
- **Known CVE**: 未報告 / 不明
- **Description**: Arithmetic overflow in allocation size calculation passed to av_fast_malloc

### [HIGH] `libavcodec/h264_slice.c:182`
- **Type**: integer_overflow
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run4)
- **Known CVE**: 未報告 / 不明
- **Description**: 32-bit signed integer overflow in motion value array size calculation

### [HIGH] `libavcodec/hevcdec.c:106`
- **Type**: integer_overflow
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run4)
- **Known CVE**: CVE-2019-11338, CVE-2024-32228
- **Description**: Similar signed integer overflow risk in ctb_count and min_pu_size calculations. sps->ctb_width * sps->ctb_height and sps->min_pu_width * sps->min_pu_height are performed in int before being used in av_calloc and av_mallocz. Negative overflow values cast to size_t can trigger oversized allocations.

### [HIGH] `libavformat/mov.c:312`
- **Type**: signed/unsigned conversion bug leading to integer wraparound
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run4)
- **Known CVE**: CVE-2016-3062, CVE-2025-1373, CVE-2025-25471
- **Description**: The `len` parameter is declared as `unsigned`, but `avio_get_str()` returns a signed `int`. If `avio_get_str()` returns a negative error code, the subtraction `len -= avio_get_str(...)` causes an unsigned integer wraparound, inflating `len` to near `UINT_MAX`. Subsequent bounds checks are bypassed.

### [HIGH] `libavcodec/hevcdec.c:97`
- **Type**: integer_overflow
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run4)
- **Known CVE**: CVE-2019-11338, CVE-2024-32228
- **Description**: Unchecked multiplication of SPS-derived dimensions (min_pu_width * min_pu_height) on line 97 can overflow a 32-bit signed integer. The resulting wrapped value is passed directly to av_mallocz (line 113) and av_buffer_pool_init (line 131) without validation. If the overflow wraps to a small positive value, the allocator succeeds with an undersized buffer, but subsequent decoder logic uses the wrapped int value as a loop bound or index multiplier, causing out-of-bounds heap writes.

### [HIGH] `libavcodec/h264_slice.c:143`
- **Type**: integer_overflow
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run4)
- **Known CVE**: 未報告 / 不明
- **Description**: 32-bit signed integer overflow in bipred scratchpad allocation size calculation

### [HIGH] `libavcodec/h264_slice.c:173`
- **Type**: integer_overflow
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run4)
- **Known CVE**: 未報告 / 不明
- **Description**: 32-bit signed integer overflow in macroblock grid dimension calculations

### [HIGH] `libavcodec/hevcdec.c:146`
- **Type**: integer_overflow
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run5)
- **Known CVE**: CVE-2019-11338, CVE-2024-32228
- **Description**: Integer overflow/truncation in buffer pool initialization size calculation. min_pu_size * sizeof(MvField) is evaluated before passing to av_buffer_pool_init. If sps->min_pu_width and sps->min_pu_height are large, the multiplication overflows the 32-bit int parameter, resulting in an undersized pool allocation.

### [HIGH] `libavcodec/hevcdec.c:148`
- **Type**: integer_overflow
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run5)
- **Known CVE**: CVE-2019-11338, CVE-2024-32228
- **Description**: Integer overflow/truncation in rpl_tab_pool initialization size calculation. ctb_count * sizeof(RefPicListTab) suffers from the same 32-bit multiplication overflow before being passed to av_buffer_pool_init.

### [HIGH] `libavcodec/mpeg4videodec.c:158`
- **Type**: Integer Overflow in Array Indexing
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run5)
- **Known CVE**: 未報告 / 不明
- **Description**: The calculation `s->block_index[n] * 16` uses signed 32-bit integers. If `block_index` exceeds ~134 million, the multiplication overflows. The result is used as an offset for pointer arithmetic into the `ac_val` array, pointing to invalid memory locations.

### [HIGH] `libavcodec/mpeg4videodec.c:163`
- **Type**: Integer Overflow in Array Indexing
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run5)
- **Known CVE**: 未報告 / 不明
- **Description**: The expression `s->mb_y * s->mb_stride` performs signed 32-bit multiplication. If macroblock coordinates or stride are manipulated to be large, the multiplication overflows. The resulting `xy` is used as an index into `qscale_table`, leading to out-of-bounds array access.

### [HIGH] `libavcodec/h264_slice.c:115`
- **Type**: integer_overflow
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run5)
- **Known CVE**: 未報告 / 不明
- **Description**: Allocation size calculations in alloc_scratch_buffers are performed using signed 32-bit integers before implicit conversion to size_t. The expressions '16 * 6 * alloc_size', 'alloc_size * 2 * 21', and 'h->mb_width * 16 * 3 * sizeof(uint8_t) * 2' can wrap around if linesize or mb_width are large.

### [HIGH] `libavcodec/hevcdec.c:112`
- **Type**: integer_overflow
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run5)
- **Known CVE**: CVE-2019-11338, CVE-2024-32228
- **Description**: Integer overflow in pic_size_in_ctb calculation. The multiplication of block dimensions is performed using 32-bit signed integers. Maliciously large width/height values in the SPS can cause the product to wrap around, resulting in a truncated or negative value passed to av_malloc_array.

### [HIGH] `libavcodec/mpeg4videodec.c:114`
- **Type**: buffer_underflow
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run5)
- **Known CVE**: 未報告 / 不明
- **Description**: Uncapped `uvlinesize` can be negative, causing `dct_offset` to become negative. This negative offset is added to base pointers (`dest_cb`, `dest_cr`) without bounds validation, resulting in out-of-bounds memory access.

### [HIGH] `libavcodec/mpeg4videodec.c:83`
- **Type**: pointer_underflow
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run5)
- **Known CVE**: 未報告 / 不明
- **Description**: Negative uvlinesize causes dct_offset to become negative, leading to pointer underflow in idct_put calls.

### [HIGH] `libavcodec/h264_slice.c:137`
- **Type**: Integer Overflow in Allocation Size Calculation
- **Evidence Level**: Lv.1
- **Reproducibility**: 1/5 runs (Run2)
- **Known CVE**: 未報告 / 不明
- **Description**: The allocation size for `motion_val_pool` is computed as `2 * (b4_array_size + 4) * sizeof(int16_t)`. This 32-bit signed multiplication overflows with large `b4_array_size`, resulting in an undersized buffer pool.

### [HIGH] `libavcodec/h264_slice.c:136`
- **Type**: integer_overflow
- **Evidence Level**: Lv.1
- **Reproducibility**: 1/5 runs (Run3)
- **Known CVE**: 未報告 / 不明
- **Description**: Multiplication `16 * 6 * alloc_size` is evaluated as a 32-bit signed integer. If `alloc_size` exceeds ~21 million, the result wraps around, causing an undersized allocation passed to `av_fast_malloc`.

### [HIGH] `libavcodec/h264_slice.c:176`
- **Type**: integer_overflow
- **Evidence Level**: Lv.1
- **Reproducibility**: 1/5 runs (Run3)
- **Known CVE**: 未報告 / 不明
- **Description**: Expression `4 * mb_array_size` is computed as a 32-bit signed integer. Overflow causes undersized allocation for the reference index pool.

### [MEDIUM] `libavcodec/hevcdec.c:65`
- **Type**: signed_integer_overflow
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run3)
- **Known CVE**: CVE-2019-11338, CVE-2024-32228
- **Description**: The calculation of pic_size_in_ctb uses signed 32-bit integers for width, height, and log2_min_cb_size. If log2_min_cb_size is malformed (e.g., 0 or 1) or dimensions are unclamped, the multiplication can overflow INT_MAX, triggering undefined behavior before av_malloc_array validation.

### [MEDIUM] `libavformat/mov.c:229`
- **Type**: signed_to_unsigned_conversion
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run4)
- **Known CVE**: CVE-2016-3062, CVE-2025-1373, CVE-2025-25471
- **Description**: The `len` parameter is declared as `unsigned`, but `avio_get_str()` returns a signed `int` that can be negative on error. Subtracting a negative return value from `len` causes an unsigned integer wraparound to a large positive value, bypassing subsequent length validation checks.

### [MEDIUM] `libavcodec/mpeg4videodec.c:178`
- **Type**: Integer Overflow in Pointer Arithmetic
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run5)
- **Known CVE**: 未報告 / 不明
- **Description**: The multiplication `16 * s->block_wrap[n]` can overflow a 32-bit signed integer. The result is subtracted from `ac_val`, causing pointer wrap-around. This misaligns the AC prediction source pointer, leading to out-of-bounds reads during the prediction loop.

### [MEDIUM] `libavcodec/mpeg4videodec.c:93`
- **Type**: Integer Overflow in Pointer Arithmetic
- **Evidence Level**: Lv.1
- **Reproducibility**: 1/5 runs (Run5)
- **Known CVE**: 未報告 / 不明
- **Description**: The expression `block_size * 2` uses signed 32-bit integers. If `block_size` exceeds 1,073,741,823, the multiplication overflows, wrapping to a negative value. This value is used as an offset in subsequent pointer arithmetic, causing the pointer to wrap backwards in memory.

### [MEDIUM] `libavcodec/mjpegdec.c:154`
- **Type**: integer_overflow
- **Evidence Level**: Lv.1
- **Reproducibility**: 1/5 runs (Run5)
- **Known CVE**: 未報告 / 不明
- **Description**: Multiplication of avctx->extradata_size by 8 can overflow a signed 32-bit integer if extradata_size exceeds 0x1FFFFFFF, resulting in a negative or truncated bit count passed to init_get_bits.
