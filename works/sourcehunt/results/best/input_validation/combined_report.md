# SourceHunt — Combined Vulnerability Report

- **Target**: `libavformat/mov.c` @ `ced0dc807eb67516b341d68f04ce5a87b02820de`
- **Verdict**: **PASS** (5/5 runs detected)
- **Unique findings**: 49
- **Severity**: Critical: 6 / High: 31 / Medium: 11 / Low: 1
- **Repository CVE (OSV.dev)**: 71 件登録 / 21 件発見 (CVE-2016-2326, CVE-2016-3062, CVE-2017-14169, CVE-2017-14223, CVE-2017-15672 他 66 件)

## Findings

### [CRITICAL] `libavformat/mov.c:179`
- **Type**: out_of_bounds_access
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run1)
- **Known CVE**: CVE-2016-3062, CVE-2025-1373, CVE-2025-25471
- **Description**: Unsigned integer underflow on nb_streams leads to out-of-bounds array access

### [CRITICAL] `libavcodec/h264_slice.c:214`
- **Type**: integer_overflow
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run2)
- **Known CVE**: 未報告 / 不明
- **Description**: In init_table_pools, size parameters for av_buffer_pool_init are computed using 32-bit signed integer arithmetic. Multiplications involving h->mb_width and h->mb_height (e.g., b4_stride * h->mb_height * 4) overflow when processing high-resolution or crafted streams. The overflowed small values are passed to av_buffer_pool_init, allocating undersized memory pools. Subsequent slice decoding accesses these pools using indices derived from the actual macroblock dimensions, causing out-of-bounds heap writes.

### [CRITICAL] `libavcodec/h264_slice.c:157`
- **Type**: Integer Overflow leading to Heap Buffer Overflow
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run3)
- **Known CVE**: 未報告 / 不明
- **Description**: Unvalidated h->mb_width and h->mb_height from the bitstream are used in arithmetic to calculate allocation sizes without overflow checks. The multiplication b4_stride * h->mb_height * 4 can wrap around to a small value.

### [CRITICAL] `libavcodec/h264_slice.c:132`
- **Type**: Integer Overflow leading to Heap Buffer Overflow
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run3)
- **Known CVE**: 未報告 / 不明
- **Description**: Allocation size calculation for top_borders uses h->mb_width without validation or overflow protection. The expression h->mb_width * 16 * 3 * sizeof(uint8_t) * 2 can overflow.

### [CRITICAL] `libavcodec/h264_slice.c:139`
- **Type**: integer_overflow_in_allocation_size
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run4)
- **Known CVE**: 未報告 / 不明
- **Description**: Integer overflow in size calculation for buffer pool allocation in init_table_pools.

### [CRITICAL] `libavcodec/h264_slice.c:140`
- **Type**: integer_overflow_in_allocation_size
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run5)
- **Known CVE**: 未報告 / 不明
- **Description**: The variables big_mb_num, mb_array_size, b4_stride, and b4_array_size are computed by multiplying untrusted bitstream-derived values (h->mb_width, h->mb_height, h->mb_stride). These multiplications can overflow a signed 32-bit integer, resulting in a negative or unexpectedly small size passed to av_buffer_pool_init. This leads to undersized heap allocations that are subsequently accessed out-of-bounds during slice decoding, causing heap corruption.

### [HIGH] `libavcodec/jpeg2000dec.c:130`
- **Type**: stack_buffer_overflow
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run1)
- **Known CVE**: CVE-2025-22921
- **Description**: Missing bounds check on stack pointer `sp` before writing to fixed-size array `stack[30]` in `tag_tree_decode`

### [HIGH] `libavcodec/h264_slice.c:153`
- **Type**: integer_overflow
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run1)
- **Known CVE**: 未報告 / 不明
- **Description**: Unvalidated size parameters passed to allocators cause integer overflow leading to undersized allocations.

### [HIGH] `libavcodec/h264_slice.c:123`
- **Type**: integer_overflow
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run1)
- **Known CVE**: 未報告 / 不明
- **Description**: Unvalidated size parameters passed to allocators cause integer overflow leading to undersized allocations.

### [HIGH] `libavcodec/hevcdec.c:203`
- **Type**: out_of_bounds_write
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run1)
- **Known CVE**: CVE-2019-11338, CVE-2024-32228
- **Description**: The loop bound s->sh.nb_refs[L0] is used directly to index fixed-size arrays (luma_weight_l0_flag, s->sh.luma_weight_l0, etc.) without validating that it does not exceed the array size (16). HEVC specification limits active reference indices to 15, but untrusted bitstreams may supply larger values.

### [HIGH] `libavformat/mov.c:102`
- **Type**: missing_bounds_check
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run1)
- **Known CVE**: CVE-2016-3062, CVE-2025-1373, CVE-2025-25471
- **Description**: Function reads 4 bytes unconditionally without verifying len parameter

### [HIGH] `libavcodec/hevcdec.c:93`
- **Type**: integer_overflow
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run1)
- **Known CVE**: CVE-2019-11338, CVE-2024-32228
- **Description**: Missing validation of SPS dimensions before arithmetic operations to compute allocation sizes. Unchecked multiplications in pic_size_in_ctb, ctb_count, and min_pu_size can overflow the int type, leading to undersized heap buffers when passed to av_malloc_array and av_buffer_pool_init.

### [HIGH] `libavcodec/hevcdec.c:163`
- **Type**: out_of_bounds_write
- **Evidence Level**: Lv.2
- **Reproducibility**: 2/5 runs (Run1, Run4)
- **Known CVE**: CVE-2019-11338, CVE-2024-32228
- **Description**: The loop bound `s->sh.nb_refs[L0]` is derived directly from the bitstream without validation against the maximum allowed number of references (16). It is used to index into fixed-size arrays `luma_weight_l0_flag`, `s->sh.luma_weight_l0`, and `s->sh.luma_offset_l0`, which have a capacity of 16 elements. If `nb_refs[L0]` exceeds 15, this results in a stack-based buffer overflow.

### [HIGH] `libavformat/id3v2.c:199`
- **Type**: denial_of_service
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run2)
- **Known CVE**: 未報告 / 不明
- **Description**: Negative maxread causes infinite loop in decode_str

### [HIGH] `libavcodec/h264_slice.c:209`
- **Type**: integer_overflow
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run2)
- **Known CVE**: 未報告 / 不明
- **Description**: Unvalidated h->mb_width and h->mb_height are used to compute b4_array_size and subsequently passed to av_buffer_pool_init. The multiplications are performed in signed 32-bit arithmetic, risking integer overflow before conversion to size_t.

### [HIGH] `libavcodec/vp9.c:107`
- **Type**: integer_overflow
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run2)
- **Known CVE**: 未報告 / 不明
- **Description**: Unchecked integer overflow in size calculation leads to out-of-bounds pointer arithmetic and heap corruption.

### [HIGH] `libavformat/mov.c:87`
- **Type**: out_of_bounds_read
- **Evidence Level**: Lv.2
- **Reproducibility**: 2/5 runs (Run2, Run4)
- **Known CVE**: CVE-2016-3062, CVE-2025-1373, CVE-2025-25471
- **Description**: Missing bounds check before reading from AVIOContext. The function unconditionally reads 4 bytes (two 16-bit values) without verifying that the atom length 'len' is at least 4.

### [HIGH] `libavformat/mov.c:100`
- **Type**: out_of_bounds_read
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run2)
- **Known CVE**: CVE-2016-3062, CVE-2025-1373, CVE-2025-25471
- **Description**: Missing bounds check before reading from AVIOContext. The function unconditionally reads 4 bytes without verifying that the atom length 'len' is at least 4.

### [HIGH] `libavformat/mov.c:114`
- **Type**: out_of_bounds_read
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run2)
- **Known CVE**: CVE-2016-3062, CVE-2025-1373, CVE-2025-25471
- **Description**: Missing bounds check before reading from AVIOContext. The function unconditionally reads 1 byte without verifying that the atom length 'len' is at least 1.

### [HIGH] `libavcodec/hevcdec.c:136`
- **Type**: out_of_bounds_write
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run2)
- **Known CVE**: CVE-2019-11338, CVE-2024-32228
- **Description**: Missing bounds check on s->sh.nb_refs[L0] before array access

### [HIGH] `libavformat/id3v2.c:144`
- **Type**: out_of_bounds_read
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run2)
- **Known CVE**: 未報告 / 不明
- **Description**: Missing bounds check before array access in ff_id3v2_match

### [HIGH] `libavformat/id3v2.c:157`
- **Type**: out_of_bounds_read
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run2)
- **Known CVE**: 未報告 / 不明
- **Description**: Missing bounds check before array access in ff_id3v2_tag_len

### [HIGH] `libavcodec/h264_slice.c:150`
- **Type**: Integer overflow leading to undersized allocation
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run2)
- **Known CVE**: 未報告 / 不明
- **Description**: Unchecked 32-bit integer arithmetic in `init_table_pools` computes allocation sizes for macroblock and motion vector pools using `h->mb_width`, `h->mb_height`, and `h->mb_stride`. If these values are large, multiplications such as `h->mb_stride * h->mb_height` or `b4_stride * h->mb_height * 4` overflow, wrapping to a small positive integer. The resulting undersized value is passed to `av_buffer_pool_init`, allocating a heap buffer smaller than required. Subsequent slice decoding writes to these pools using indices based on the true dimensions, causing a heap buffer overflow.

### [HIGH] `libavformat/mov.c:125`
- **Type**: out_of_bounds_read
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run2)
- **Known CVE**: CVE-2016-3062, CVE-2025-1373, CVE-2025-25471
- **Description**: Missing bounds check before reading from AVIOContext. The function unconditionally reads 2 bytes without verifying that the atom length 'len' is at least 2.

### [HIGH] `libavformat/id3v2.c:115`
- **Type**: out-of-bounds read
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run2)
- **Known CVE**: 未報告 / 不明
- **Description**: ff_id3v2_match accesses buf[0] through buf[9] without verifying the length of the buf pointer. If the caller passes a buffer smaller than 10 bytes, this results in an out-of-bounds read.

### [HIGH] `libavformat/id3v2.c:128`
- **Type**: out-of-bounds read
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run2)
- **Known CVE**: 未報告 / 不明
- **Description**: ff_id3v2_tag_len accesses buf[5] through buf[9] without prior length validation. Similar to ff_id3v2_match, this can read past the allocated buffer if buf is too short.

### [HIGH] `libavcodec/hevcdec.c:152`
- **Type**: missing_bounds_check
- **Evidence Level**: Lv.2
- **Reproducibility**: 2/5 runs (Run3, Run5)
- **Known CVE**: CVE-2019-11338, CVE-2024-32228
- **Description**: The loop iterating over reference pictures uses `s->sh.nb_refs[L0]` as the bound without validating it against the HEVC specification maximum of 16. This value is derived directly from the bitstream. If `nb_refs[L0]` exceeds 16, the loop writes out-of-bounds into the fixed-size stack arrays `luma_weight_l0_flag[16]` and `chroma_weight_l0_flag[16]`, as well as the HEVC context arrays.

### [HIGH] `libavcodec/h264_slice.c:114`
- **Type**: NULL Pointer Dereference
- **Evidence Level**: Lv.2
- **Reproducibility**: 2/5 runs (Run3, Run4)
- **Known CVE**: 未報告 / 不明
- **Description**: Missing NULL check before dereferencing h->DPB[i].f in the Picture Decoding Buffer cleanup loop.

### [HIGH] `libavformat/mov.c:206`
- **Type**: out_of_bounds_read
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run3)
- **Known CVE**: CVE-2016-3062, CVE-2025-1373, CVE-2025-25471
- **Description**: Accesses c->fc->streams array at index nb_streams - 1 without verifying that at least one stream exists.

### [HIGH] `libavformat/mpeg.c:39`
- **Type**: out_of_bounds_read
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run3)
- **Known CVE**: 未報告 / 不明
- **Description**: The check_pes function accesses p[3], p[4], and p[6] without verifying that the input pointer p has at least 7 bytes remaining before the end boundary. The end parameter is provided but never used for bounds checking.

### [HIGH] `libavformat/mpeg.c:67`
- **Type**: out_of_bounds_read
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run3)
- **Known CVE**: 未報告 / 不明
- **Description**: In mpegps_probe, the code unconditionally reads p->buf[i + 1] and p->buf[i + 2] immediately after detecting a start code. If the start code occurs at i == p->buf_size - 1 or i == p->buf_size - 2, these accesses go out of bounds.

### [HIGH] `libavcodec/h264_slice.c:125`
- **Type**: unvalidated_allocation_size
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run4)
- **Known CVE**: 未報告 / 不明
- **Description**: Unvalidated mb_width used in allocation size calculation in alloc_scratch_buffers.

### [HIGH] `libavcodec/vp9.c:116`
- **Type**: Integer Overflow / Out-of-Bounds Access
- **Evidence Level**: Lv.2
- **Reproducibility**: 2/5 runs (Run4, Run5)
- **Known CVE**: 未報告 / 不明
- **Description**: Integer overflow in `sz` calculation at line 116 when `s->sb_cols` and `s->sb_rows` are large. The resulting negative or wrapped value is used to allocate a buffer at line 119 and compute a pointer offset at line 133, leading to out-of-bounds memory access.

### [HIGH] `libavcodec/cbs_h265_syntax_template.c:148`
- **Type**: out-of-bounds-access
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run4)
- **Known CVE**: 未報告 / 不明
- **Description**: Missing bounds check on max_num_sub_layers_minus1 before array indexing

### [HIGH] `libavformat/mov.c:209`
- **Type**: out_of_bounds_access
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run4)
- **Known CVE**: CVE-2016-3062, CVE-2025-1373, CVE-2025-25471
- **Description**: Missing bounds check on nb_streams before array indexing

### [HIGH] `libavformat/mov.c:234`
- **Type**: NULL pointer dereference
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run5)
- **Known CVE**: CVE-2016-3062, CVE-2025-1373, CVE-2025-25471
- **Description**: Missing NULL check before dereferencing st->codecpar. The codecpar field is not initialized by avformat_new_stream (called internally by ff_add_attached_pic) and is not allocated before assignment.

### [HIGH] `libavformat/mov.c:213`
- **Type**: out_of_bounds_access
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run5)
- **Known CVE**: CVE-2016-3062, CVE-2025-1373, CVE-2025-25471
- **Description**: Missing bounds check on nb_streams before array access in mov_read_covr

### [MEDIUM] `libavformat/mov.c:122`
- **Type**: missing_bounds_check
- **Evidence Level**: Lv.2
- **Reproducibility**: 2/5 runs (Run1, Run2)
- **Known CVE**: CVE-2016-3062, CVE-2025-1373, CVE-2025-25471
- **Description**: The function unconditionally reads 4 bytes from the stream without validating the atom payload length (len) against the required minimum size.

### [MEDIUM] `libavformat/id3v2.c:172`
- **Type**: uninitialized memory read
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run2)
- **Known CVE**: 未報告 / 不明
- **Description**: In check_tag, AV_RB32(tag) is called on line 172 to read 4 bytes from tag, but tag is only populated with len bytes via avio_read on line 170. When len is less than 4, the remaining bytes in tag are uninitialized stack memory.

### [MEDIUM] `libavformat/mov.c:101`
- **Type**: out_of_bounds_read
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run2)
- **Known CVE**: CVE-2016-3062, CVE-2025-1373, CVE-2025-25471
- **Description**: Missing bounds check on atom payload size (`len`) before reading data. The function unconditionally calls `avio_r8(pb)` without verifying that `len` is greater than zero. If a crafted MOV file contains a metadata atom with a declared size of 0, the read operation will step past the atom's payload boundary, resulting in an out-of-bounds read.

### [MEDIUM] `libavformat/mov.c:99`
- **Type**: Missing Bounds Check / Out-of-bounds Read
- **Evidence Level**: Lv.2
- **Reproducibility**: 2/5 runs (Run3, Run4)
- **Known CVE**: CVE-2016-3062, CVE-2025-1373, CVE-2025-25471
- **Description**: mov_metadata_int8_no_padding reads 1 byte from pb without verifying len >= 1. Similar to above, allows reading past the atom boundary if len is 0.

### [MEDIUM] `libavformat/mpeg.c:69`
- **Type**: out_of_bounds_read
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run3)
- **Known CVE**: 未報告 / 不明
- **Description**: check_pack_header is called with p->buf + i without ensuring that at least 2 bytes are available. If i == p->buf_size - 1, accessing buf[1] is out of bounds.

### [MEDIUM] `libavcodec/hevcdec.c:144`
- **Type**: out_of_bounds_write
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run4)
- **Known CVE**: CVE-2019-11338, CVE-2024-32228
- **Description**: Missing bounds check on s->sh.nb_refs[L0] before accessing fixed-size stack array luma_weight_l0_flag[16] in pred_weight_table.

### [MEDIUM] `libavcodec/cbs_h265_syntax_template.c:80`
- **Type**: integer-overflow
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run4)
- **Known CVE**: 未報告 / 不明
- **Description**: Missing upper bound validation on current->bit_length before allocation

### [MEDIUM] `libavcodec/h264_slice.c:168`
- **Type**: missing_null_check
- **Evidence Level**: Lv.2
- **Reproducibility**: 1/5 runs (Run5)
- **Known CVE**: 未報告 / 不明
- **Description**: Inside alloc_picture, pic->f_grain is dereferenced to assign format, width, and height without verifying it is non-NULL. If pic->needs_fg is true but pic->f_grain was not previously allocated, this results in a NULL pointer dereference.

### [MEDIUM] `libavformat/id3v2.c:223`
- **Type**: null_pointer_dereference
- **Evidence Level**: Lv.1
- **Reproducibility**: 1/5 runs (Run2)
- **Known CVE**: 未報告 / 不明
- **Description**: Missing NULL check before pointer dereference in free_geobtag

### [MEDIUM] `libavformat/id3v2.c:170`
- **Type**: infinite_loop
- **Evidence Level**: Lv.1
- **Reproducibility**: 1/5 runs (Run2)
- **Known CVE**: 未報告 / 不明
- **Description**: Unchecked negative index/loop counter in get_size

### [MEDIUM] `libavcodec/h264_slice.c:124`
- **Type**: unvalidated_size_parameter
- **Evidence Level**: Lv.1
- **Reproducibility**: 1/5 runs (Run5)
- **Known CVE**: 未報告 / 不明
- **Description**: In alloc_scratch_buffers, alloc_size is derived from linesize, and subsequent calculations (16 * 6 * alloc_size, alloc_size * 2 * 21, h->mb_width * 16 * 3 * sizeof(uint8_t) * 2) can overflow if linesize or h->mb_width are maliciously large. Although av_fast_malloc checks for NULL, the overflow itself indicates a lack of input validation on size parameters.

### [LOW] `libavformat/mov.c:124`
- **Type**: missing_bounds_check
- **Evidence Level**: Lv.1
- **Reproducibility**: 1/5 runs (Run3)
- **Known CVE**: CVE-2016-3062, CVE-2025-1373, CVE-2025-25471
- **Description**: Reads four bytes unconditionally without verifying len >= 4.
