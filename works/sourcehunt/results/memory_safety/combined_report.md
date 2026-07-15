# SourceHunt — Combined Vulnerability Report

- **Target**: `libavformat/mov.c` @ `ced0dc807eb67516b341d68f04ce5a87b02820de`
- **Verdict**: **PASS** (5/5 runs detected)
- **Unique findings**: 46
- **Severity**: Critical: 8 / High: 24 / Medium: 13 / Low: 1
- **Repository CVE (OSV.dev)**: 71 件登録 / 20 件発見 (CVE-2016-2326, CVE-2016-3062, CVE-2017-14169, CVE-2017-14223, CVE-2017-15672 他 66 件)

## Findings

### [CRITICAL] `libavcodec/vp9.c:85`
- **Type**: Integer Overflow / Out-of-Bounds Write
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run1)
- **Known CVE**: 未報告 / 不明
- **Description**: The calculation sz = 64 * s->sb_cols * s->sb_rows; uses 32-bit signed integer arithmetic. If s->sb_cols and s->sb_rows are sufficiently large (e.g., from unclamped or malicious bitstream dimensions), the multiplication can overflow, resulting in a negative or wrapped sz value.

### [CRITICAL] `libavcodec/h264_slice.c:145`
- **Type**: integer_overflow
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run2)
- **Known CVE**: 未報告 / 不明
- **Description**: Signed integer overflow in allocation size calculations for buffer pools in init_table_pools

### [CRITICAL] `libavcodec/h264_slice.c:126`
- **Type**: integer_overflow
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run2)
- **Known CVE**: 未報告 / 不明
- **Description**: Signed integer overflow in allocation size calculation for top_borders in alloc_scratch_buffers

### [CRITICAL] `libavcodec/hevcdec.c:163`
- **Type**: out_of_bounds_write
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run3)
- **Known CVE**: CVE-2019-11338, CVE-2024-32228
- **Description**: Missing upper bound validation on s->sh.nb_refs[L0] allows out-of-bounds array access in pred_weight_table.

### [CRITICAL] `libavcodec/h264_slice.c:181`
- **Type**: Integer Overflow leading to Out-of-Bounds Access
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run3)
- **Known CVE**: 未報告 / 不明
- **Description**: Unchecked signed integer multiplication in buffer size calculations allows crafted macroblock dimensions to wrap around to small positive values. This results in undersized pool allocations that are later indexed with the true (large) dimensions, causing out-of-bounds memory access.

### [CRITICAL] `libavcodec/h264_slice.c:175`
- **Type**: Integer Overflow leading to Heap Buffer Overflow
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run4)
- **Known CVE**: 未報告 / 不明
- **Description**: The allocation size for motion_val_pool is computed using 32-bit signed integer arithmetic. b4_array_size is calculated as b4_stride * h->mb_height * 4, and the final size passed to av_buffer_pool_init is 2 * (b4_array_size + 4) * sizeof(int16_t). If h->mb_width or h->mb_height are crafted to be large, the intermediate multiplications overflow the int type, resulting in a negative or truncated size. This value is implicitly cast to size_t for av_buffer_pool_init, causing an undersized buffer to be allocated. Subsequent decoding operations writing motion vectors will trigger out-of-bounds writes.

### [CRITICAL] `libavcodec/h264_slice.c:146`
- **Type**: Integer Overflow leading to Heap Buffer Overflow
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run4)
- **Known CVE**: 未報告 / 不明
- **Description**: The calculation `alloc_size * 2 * 21` on line 146 uses 32-bit signed integers. An overflow here causes `av_fast_malloc` to allocate a small `edge_emu_buffer`, while edge emulation routines subsequently write beyond the allocated bounds.

### [CRITICAL] `libavcodec/vc1.c:55`
- **Type**: buffer_overflow
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run5)
- **Known CVE**: 未報告 / 不明
- **Description**: The size argument for memset is an int, which can be negative. Casting a negative int to size_t results in a massive unsigned value.

### [HIGH] `libavcodec/hevcdec.c:118`
- **Type**: Integer Overflow leading to Buffer Overflow
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run1)
- **Known CVE**: CVE-2019-11338, CVE-2024-32228
- **Description**: Integer overflow in `min_pu_size * sizeof(MvField)` passed to `av_buffer_pool_init`

### [HIGH] `libavcodec/vp9.c:104`
- **Type**: use-after-free
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run1)
- **Known CVE**: 未報告 / 不明
- **Description**: Missing null-assignment of `f->mv` in `vp9_frame_unref` leaves a dangling pointer after `f->extradata` is freed.

### [HIGH] `libavcodec/hevcdec.c:148`
- **Type**: Buffer Overflow
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run2)
- **Known CVE**: CVE-2019-11338, CVE-2024-32228
- **Description**: Missing bounds check on `s->sh.nb_refs[L0]` before array access in `pred_weight_table`.

### [HIGH] `libavformat/mov.c:192`
- **Type**: buffer_overflow
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run2)
- **Known CVE**: CVE-2016-3062, CVE-2025-1373, CVE-2025-25471
- **Description**: The function computes a bounds pointer `end` using the caller-supplied `dstlen` without verifying it against the actual allocated size of `dst`. In the MOV demuxer, `dstlen` is typically passed as the untrusted atom length. If an attacker crafts a file with a large atom length, `dstlen` becomes excessively large, causing `end` to point far beyond the actual buffer. The subsequent loop writes to `dst` via `*p++` and `PUT_UTF8` until `p` reaches `end`, overflowing the buffer. The `PUT_UTF8` macro's internal checks rely on the already-miscalculated `end`.

### [HIGH] `libavcodec/h264_slice.c:143`
- **Type**: integer_overflow_heap_buffer_overflow
- **Evidence Level**: Lv.2
- **Reproducibility**: 2/5 runs (Run2, Run4)
- **Known CVE**: 未報告 / 不明
- **Description**: Size calculations for buffer pools in init_table_pools use 32-bit signed int arithmetic on macroblock dimensions (h->mb_width, h->mb_height, h->mb_stride). Malformed streams or dynamic resolution changes can trigger signed integer overflow. The overflowed int is implicitly cast to size_t for av_buffer_pool_init. If the overflow wraps to a small positive value, an undersized pool is allocated. Subsequent motion vector and reference index writes during slice decoding overflow the heap.

### [HIGH] `libavcodec/hevcdec.c:91`
- **Type**: integer_overflow
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run3)
- **Known CVE**: CVE-2019-11338, CVE-2024-32228
- **Description**: Integer overflow in pic_size_in_ctb calculation can lead to undersized heap allocation and subsequent buffer overflow.

### [HIGH] `libavcodec/hevcdec.c:93`
- **Type**: integer_overflow
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run3)
- **Known CVE**: CVE-2019-11338, CVE-2024-32228
- **Description**: Integer overflow in ctb_count calculation can lead to undersized heap allocation for SAO and deblock arrays.

### [HIGH] `libavformat/mov.c:152`
- **Type**: heap_buffer_overflow
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run3)
- **Known CVE**: CVE-2016-3062, CVE-2025-1373, CVE-2025-25471
- **Description**: The function `mov_read_mac_string` computes `char *end = dst+dstlen-1;` based on `dstlen`, which is derived from the MOV atom's `len` field. If the caller's allocation size calculation for `dst` suffers from integer truncation or overflow (e.g., due to `len` being a large `uint32_t`), the actual heap reservation will be smaller than `dstlen`. The computed `end` will therefore point past the allocated heap buffer. The subsequent loop iterates `len` times, and the bounds check `if (p >= end) continue;` only prevents writes once `p` reaches `end`. Since `end` is already beyond the heap boundary, `p` can advance past the allocated buffer while still satisfying `p < end`, resulting in a heap buffer overflow during `*p++ = c` or `*p++ = t`.

### [HIGH] `libavcodec/hevcdec.c:116`
- **Type**: Integer Overflow
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run4)
- **Known CVE**: CVE-2019-11338, CVE-2024-32228
- **Description**: The calculation of pic_size_in_ctb multiplies two values derived from frame dimensions without overflow checking. Maliciously large width and height values can cause the product to wrap around to a small positive or negative integer. This value is passed to av_malloc_array, potentially resulting in an undersized heap allocation for s->tab_slice_address and s->qp_y_tab, leading to heap buffer overflow during subsequent slice decoding operations.

### [HIGH] `libavcodec/hevcdec.c:167`
- **Type**: Out-of-bounds Write
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run4)
- **Known CVE**: CVE-2019-11338, CVE-2024-32228
- **Description**: The loop iterates based on s->sh.nb_refs[L0], which is derived from the bitstream. The arrays luma_weight_l0_flag, s->sh.luma_weight_l0, and s->sh.luma_offset_l0 are fixed at 16 elements. If nb_refs[L0] exceeds 16 due to a malformed bitstream, the loop writes out of bounds to the stack-allocated flag array and the HEVCSh structure fields.

### [HIGH] `libavcodec/vp9.c:123`
- **Type**: Integer Overflow
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run4)
- **Known CVE**: 未報告 / 不明
- **Description**: Integer overflow in frame extradata pool size calculation

### [HIGH] `libavformat/mpeg.c:39`
- **Type**: out-of-bounds-read
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run4)
- **Known CVE**: 未報告 / 不明
- **Description**: The function check_pes performs multiple array accesses on pointer p without verifying bounds against end. Specifically, p[3], p[4], and p[6] are read at the start, and later p[4], p[5], p[7], and p[9] are accessed after p is advanced, without checking if p + offset < end.

### [HIGH] `libavformat/mpeg.c:74`
- **Type**: out-of-bounds-read
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run4)
- **Known CVE**: 未報告 / 不明
- **Description**: In mpegps_probe, the code reads p->buf[i + 1] and p->buf[i + 2] at line 74 without ensuring i + 2 < p->buf_size. Additionally, i += len at lines 88 and 89 can cause i to jump beyond the buffer boundary, leading to out-of-bounds reads in subsequent iterations or invalid pointer arithmetic.

### [HIGH] `libavcodec/h264_slice.c:165`
- **Type**: Integer Overflow leading to Pool Allocation Underestimation
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run4)
- **Known CVE**: 未報告 / 不明
- **Description**: In `init_table_pools`, allocation sizes for macroblock tables are computed using 32-bit signed integer arithmetic. Corrupted frame dimensions cause multiplications to overflow, creating undersized memory pools.

### [HIGH] `libavcodec/hevcdec.c:61`
- **Type**: Integer Overflow
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run5)
- **Known CVE**: CVE-2019-11338, CVE-2024-32228
- **Description**: The multiplication `sps->min_pu_width * sps->min_pu_height` on line 61 can overflow a 32-bit signed integer if the SPS contains maliciously large dimensions. The truncated result is passed to `av_mallocz` on line 77, which lacks overflow protection. This results in an undersized heap allocation, leading to a heap buffer overflow when `s->tab_ipm` is subsequently accessed during decoding.

### [HIGH] `libavcodec/vc1.c:112`
- **Type**: out_of_bounds_write
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run5)
- **Known CVE**: 未報告 / 不明
- **Description**: Pointer arithmetic planep += stride - width can move the pointer backwards if stride is less than width.

### [HIGH] `libavcodec/vc1.c:100`
- **Type**: integer_overflow
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run5)
- **Known CVE**: 未報告 / 不明
- **Description**: Signed integer overflow on the height * width calculation used for loop bounds and indexing logic.

### [HIGH] `libavcodec/vc1.c:80`
- **Type**: out-of-bounds-read-write
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run5)
- **Known CVE**: 未報告 / 不明
- **Description**: Unvalidated stride multiplier in column-wise bitplane decoding causes out-of-bounds memory access.

### [HIGH] `libavformat/mov.c:163`
- **Type**: heap_buffer_overflow
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run5)
- **Known CVE**: CVE-2016-3062, CVE-2025-1373, CVE-2025-25471
- **Description**: Bounds-checking relies on dstlen parameter which may not match the actual heap allocation size derived from untrusted metadata.

### [HIGH] `libavformat/mov.c:198`
- **Type**: integer_truncation_overflow
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run5)
- **Known CVE**: CVE-2016-3062, CVE-2025-1373, CVE-2025-25471
- **Description**: Signed int parameter truncates large MOV atom sizes, causing massive downstream allocation/read.

### [HIGH] `libavcodec/vc1.c:108`
- **Type**: Out-of-bounds Write
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run5)
- **Known CVE**: 未報告 / 不明
- **Description**: Incorrect pointer arithmetic in IMODE_DIFF2/NORM2 bitplane decoding assumes stride >= width, risking backward pointer movement and out-of-bounds access if stride is smaller.

### [HIGH] `libavcodec/hevcdec.c:47`
- **Type**: integer_overflow
- **Evidence Level**: Lv.1
- **Reproducibility**: 1/5 runs (Run1)
- **Known CVE**: CVE-2019-11338, CVE-2024-32228
- **Description**: Integer overflow in `min_pu_size` calculation combined with missing overflow checks in `av_buffer_pool_init` leads to undersized heap allocations. Malicious SPS parameters can cause the multiplication to wrap around to a small positive value, resulting in a heap buffer overflow during subsequent decoding operations.

### [HIGH] `libavcodec/h264_slice.c:137`
- **Type**: Integer Overflow in Allocation Size
- **Evidence Level**: Lv.1
- **Reproducibility**: 1/5 runs (Run4)
- **Known CVE**: 未報告 / 不明
- **Description**: In alloc_scratch_buffers, the size argument for av_fast_malloc is computed as 16 * 6 * alloc_size. alloc_size is an int derived from linesize. If linesize is maliciously large, the multiplication 96 * alloc_size can overflow a 32-bit signed integer before being passed to av_fast_malloc, resulting in an undersized allocation.

### [HIGH] `libavcodec/h264_slice.c:118`
- **Type**: integer_overflow
- **Evidence Level**: Lv.1
- **Reproducibility**: 1/5 runs (Run5)
- **Known CVE**: 未報告 / 不明
- **Description**: Integer overflow in scratch buffer allocation size calculation

### [MEDIUM] `libavcodec/h264_slice.c:142`
- **Type**: NULL pointer dereference
- **Evidence Level**: Lv.2
- **Reproducibility**: 2/5 runs (Run1, Run5)
- **Known CVE**: 未報告 / 不明
- **Description**: In release_unused_pictures, the code dereferences h->DPB[i].f without checking for NULL. Unused DPB slots have f set to NULL, causing a crash when accessing buf[0].

### [MEDIUM] `libavformat/mov.c:208`
- **Type**: integer_overflow
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run1)
- **Known CVE**: CVE-2016-3062, CVE-2025-1373, CVE-2025-25471
- **Description**: Unsigned integer underflow in length calculation bypasses bounds checks

### [MEDIUM] `libavformat/id3v2.c:138`
- **Type**: out-of-bounds read
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run3)
- **Known CVE**: 未報告 / 不明
- **Description**: The check_tag function declares a fixed-size 4-byte stack buffer 'tag[4]'. It reads 'len' bytes into this buffer, where 'len' is validated to be <= 4. However, when 'len' is less than 4, the remaining bytes in 'tag' remain uninitialized. The subsequent macro AV_RB32(tag) unconditionally reads exactly 4 bytes from 'tag', resulting in an out-of-bounds read of uninitialized stack memory.

### [MEDIUM] `libavformat/mov.c:92`
- **Type**: out-of-bounds_read
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run4)
- **Known CVE**: CVE-2016-3062, CVE-2025-1373, CVE-2025-25471
- **Description**: Function reads 4 bytes unconditionally from the AVIOContext without verifying that the atom length (len) is at least 4.

### [MEDIUM] `libavformat/mov.c:173`
- **Type**: memory_leak
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run4)
- **Known CVE**: CVE-2016-3062, CVE-2025-1373, CVE-2025-25471
- **Description**: Overwrites st->priv_data with a newly allocated MOVStreamContext without freeing the previously assigned pointer.

### [MEDIUM] `libavformat/mov.c:268`
- **Type**: integer-overflow
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run5)
- **Known CVE**: CVE-2016-3062, CVE-2025-1373, CVE-2025-25471
- **Description**: Unsigned integer underflow due to type mismatch with avio_get_str return value

### [MEDIUM] `libavcodec/h264_slice.c:105`
- **Type**: null_pointer_dereference
- **Evidence Level**: Lv.1
- **Reproducibility**: 1/5 runs (Run2)
- **Known CVE**: 未報告 / 不明
- **Description**: Unchecked pointer dereference of h->DPB[i].f in release_unused_pictures

### [MEDIUM] `libavcodec/vp9.c:118`
- **Type**: integer_overflow
- **Evidence Level**: Lv.1
- **Reproducibility**: 1/5 runs (Run2)
- **Known CVE**: 未報告 / 不明
- **Description**: The size calculation for the extradata pool in vp9_frame_alloc uses signed 32-bit integer arithmetic (sz = 64 * s->sb_cols * s->sb_rows). For sufficiently large frame dimensions, this multiplication can overflow, resulting in a negative or wrapped size passed to av_buffer_pool_init.

### [MEDIUM] `libavcodec/vp9.c:138`
- **Type**: use_after_free
- **Evidence Level**: Lv.1
- **Reproducibility**: 1/5 runs (Run2)
- **Known CVE**: 未報告 / 不明
- **Description**: In vp9_frame_ref, if av_buffer_ref fails and execution jumps to the fail label, dst->segmentation_map and dst->mv are not cleared. These pointers retain references to src's buffers, which may be freed or modified independently.

### [MEDIUM] `libavformat/mov.c:119`
- **Type**: out-of-bounds-read
- **Evidence Level**: Lv.1
- **Reproducibility**: 1/5 runs (Run3)
- **Known CVE**: CVE-2016-3062, CVE-2025-1373, CVE-2025-25471
- **Description**: The function reads 4 bytes unconditionally without verifying that the atom length (`len`) is at least 4. If a crafted MOV file contains a metadata atom shorter than 4 bytes, the parser will read past the atom boundary into subsequent data, potentially causing desynchronization or reading sensitive memory if the stream buffer is tightly packed.

### [MEDIUM] `libavformat/mov.c:142`
- **Type**: out-of-bounds-write
- **Evidence Level**: Lv.1
- **Reproducibility**: 1/5 runs (Run3)
- **Known CVE**: CVE-2016-3062, CVE-2025-1373, CVE-2025-25471
- **Description**: The pointer calculation `char *end = dst+dstlen-1;` underflows when `dstlen` is 0. This results in `end` pointing before the start of the destination buffer. Although the loop checks `p >= end`, the subsequent null-termination `*p = 0;` on line 154 writes to `dst` regardless, and the underflowed `end` pointer can cause undefined behavior or incorrect bounds checking in edge cases.

### [MEDIUM] `libavformat/id3v2.c:136`
- **Type**: uninitialized memory read
- **Evidence Level**: Lv.1
- **Reproducibility**: 1/5 runs (Run3)
- **Known CVE**: 未報告 / 不明
- **Description**: AV_RB32(tag) reads 4 bytes from the tag buffer, but avio_read only populates len bytes. When len < 4, the remaining bytes in tag are uninitialized stack memory. This results in reading uninitialized data.

### [MEDIUM] `libavcodec/h264_cabac.c:28`
- **Type**: missing bounds check
- **Evidence Level**: Lv.1
- **Reproducibility**: 1/5 runs (Run5)
- **Known CVE**: 未報告 / 不明
- **Description**: Disabling bitstream reader bounds checks via macro

### [LOW] `libavformat/mov.c:118`
- **Type**: out_of_bounds_read
- **Evidence Level**: Lv.1
- **Reproducibility**: 1/5 runs (Run1)
- **Known CVE**: CVE-2016-3062, CVE-2025-1373, CVE-2025-25471
- **Description**: Missing length validation before reading metadata bytes
